const express = require('express');
const router = express.Router();
const FantasyUser = require('../models/FantasyUser');
const { generateFantasyToken, authenticateFantasyUser, validatePasswordStrength } = require('../middleware/fantasyAuth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');
const {
  generateResetToken,
  hashResetToken,
  isResetTokenValid,
  resetTokenExpiry,
  buildResetUrl,
  GENERIC_FORGOT_MESSAGE,
} = require('../utils/passwordReset');
const {
  fantasySkipEmailVerifyEnabled,
  passwordResetViaEmailEnabled,
  getFantasyAuthPublicConfig,
  getFantasyAdminContactEmail,
  googleSignInEnabled,
} = require('../utils/fantasyAuthConfig');
const { verifyGoogleIdToken } = require('../utils/googleAuth');
const {
  validateManagerName,
  validateFantasyTeamName,
  serializeFantasyUser,
} = require('../utils/fantasyProfileValidation');
const { deleteFantasyAccount } = require('../utils/fantasyAccountDelete');

const normalizeEmail = (email) => (email || '').trim().toLowerCase();
const generateCode = () => `${Math.floor(100000 + Math.random() * 900000)}`;

async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const exactMatch = await FantasyUser.findOne({ email: normalizedEmail });
  if (exactMatch) return exactMatch;

  const escaped = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return FantasyUser.findOne({ email: { $regex: new RegExp(`^${escaped}$`, 'i') } });
}

async function sendPasswordResetForUser(user, normalizedEmail, audience = 'ACFPL Fantasy') {
  const token = generateResetToken();
  user.passwordResetTokenHash = await hashResetToken(token);
  user.passwordResetTokenExpires = resetTokenExpiry(
    Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 60
  );
  await user.save();

  const resetUrl = buildResetUrl('/fantasy', token);
  await sendPasswordResetEmail(normalizedEmail, resetUrl, { audience });
}

function respondAccountAlreadyExists(res, existingUser) {
  if (existingUser.authProvider === 'google') {
    return res.status(409).json({
      success: false,
      accountExists: true,
      useGoogleSignIn: googleSignInEnabled(),
      message: 'An account with this email already exists via Google Sign-In. Please sign in with Google instead of registering again.',
    });
  }

  return res.status(409).json({
    success: false,
    accountExists: true,
    suggestForgotPassword: true,
    suggestLoginWithSamePassword: true,
    message: 'An account with this email already exists. If you just tried to register, sign in with the same password. Otherwise use Forgot password.',
  });
}

function issueAuthSuccess(res, user, message) {
  const token = generateFantasyToken(user._id, user.email);
  return res.json({
    success: true,
    message,
    token,
    user: serializeFantasyUser(user),
  });
}

router.get('/config', (req, res) => {
  return res.json({
    success: true,
    config: getFantasyAuthPublicConfig(),
  });
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, confirmPassword, teamName, managerName } = req.body;
    if (!email || !password || !confirmPassword || !teamName || !managerName) {
      return res.status(400).json({ success: false, message: 'Email, password, confirm password, team name, and manager name are required.' });
    }

    const normalizedEmail = normalizeEmail(email);
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ success: false, message: 'Password is too weak.', errors: passwordValidation.errors });
    }

    const skipVerify = fantasySkipEmailVerifyEnabled();
    const code = skipVerify ? null : generateCode();

    const existingUser = await findUserByEmail(normalizedEmail);

    if (existingUser?.authProvider === 'google') {
      existingUser.password = password;
      existingUser.teamName = teamName;
      existingUser.managerName = managerName;
      existingUser.authProvider = 'local';
      existingUser.isVerified = true;
      existingUser.verificationCodeHash = null;
      existingUser.verificationCodeExpires = null;
      existingUser.lastLogin = new Date();
      await existingUser.save();
      return issueAuthSuccess(
        res,
        existingUser,
        'Account linked to email and password. You are signed in.'
      );
    }

    if (existingUser?.isVerified) {
      return respondAccountAlreadyExists(res, existingUser);
    }

    let user = existingUser;

    if (user) {
      user.email = normalizedEmail;
      user.password = password;
      user.teamName = teamName;
      user.managerName = managerName;
      user.authProvider = 'local';
      if (skipVerify) {
        user.isVerified = true;
        user.verificationCodeHash = null;
        user.verificationCodeExpires = null;
      } else {
        await user.setVerificationCode(code);
      }
    } else {
      user = new FantasyUser({
        email: normalizedEmail,
        password,
        teamName,
        managerName,
        authProvider: 'local',
        isVerified: skipVerify,
      });
      if (!skipVerify) await user.setVerificationCode(code);
    }

    user.lastLogin = skipVerify ? new Date() : user.lastLogin;
    await user.save();

    if (skipVerify) {
      return issueAuthSuccess(res, user, 'Account created. You are signed in.');
    }

    await sendVerificationEmail(normalizedEmail, code);
    return res.json({ success: true, message: 'Registration received. Check your email for the 6-digit verification code.' });
  } catch (err) {
    if (err.code === 11000) {
      const duplicateUser = await findUserByEmail(req.body?.email);
      if (duplicateUser) {
        return respondAccountAlreadyExists(res, duplicateUser);
      }
      return res.status(409).json({
        success: false,
        accountExists: true,
        suggestForgotPassword: true,
        message: 'An account with this email already exists. Sign in with your password, or use Forgot password if you do not remember it.',
      });
    }
    console.error('Fantasy register error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error. Please try again.' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    if (fantasySkipEmailVerifyEnabled()) {
      return res.status(400).json({
        success: false,
        message: 'Email verification is disabled. Please sign in with your password or Google.',
      });
    }

    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and verification code are required.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    const isValid = await user.isVerificationCodeValid(code);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired code. Please request a new one.' });
    }

    user.isVerified = true;
    user.verificationCodeHash = null;
    user.verificationCodeExpires = null;
    user.lastLogin = new Date();
    await user.save();

    return issueAuthSuccess(res, user, 'Email verified successfully.');
  } catch (err) {
    console.error('Fantasy verify error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        accountNotFound: true,
        message: 'No account found for this email. Please register first.',
      });
    }

    if (user.email !== normalizeEmail(email)) {
      user.email = normalizeEmail(email);
      await user.save();
    }

    if (!user.hasPasswordLogin()) {
      return res.status(401).json({
        success: false,
        accountExists: true,
        message: 'This account uses Google Sign-In. Continue with Google instead.',
        useGoogleSignIn: googleSignInEnabled(),
      });
    }

    const passwordOk = await user.comparePassword(password);
    if (!passwordOk) {
      return res.status(401).json({
        success: false,
        accountExists: true,
        suggestForgotPassword: true,
        message: 'Incorrect password. Try again or use Forgot password below.',
      });
    }

    if (!user.isVerified && !fantasySkipEmailVerifyEnabled()) {
      const code = generateCode();
      await user.setVerificationCode(code);
      await user.save();
      await sendVerificationEmail(user.email, code);
      return res.status(403).json({ success: false, requiresVerification: true, message: 'Please verify your email. A new code has been sent.' });
    }

    user.isVerified = true;
    user.lastLogin = new Date();
    await user.save();

    return issueAuthSuccess(res, user, 'Login successful.');
  } catch (err) {
    console.error('Fantasy login error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

router.post('/google', async (req, res) => {
  try {
    if (!googleSignInEnabled()) {
      return res.status(503).json({ success: false, message: 'Google Sign-In is not configured.' });
    }

    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential is required.' });
    }

    const googleProfile = await verifyGoogleIdToken(credential);
    let user = await FantasyUser.findOne({ googleId: googleProfile.googleId });
    if (!user) {
      user = await findUserByEmail(googleProfile.email);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        registerRequired: true,
        message: 'No fantasy account found for this Google email. Register first with your email, password, team name, and manager name.',
      });
    }

    if (!user.googleId) {
      user.googleId = googleProfile.googleId;
    }
    user.isVerified = true;
    user.verificationCodeHash = null;
    user.verificationCodeExpires = null;
    user.lastLogin = new Date();
    await user.save();
    return issueAuthSuccess(res, user, 'Signed in with Google.');
  } catch (err) {
    console.error('Fantasy Google auth error:', err.message);
    return res.status(401).json({ success: false, message: err.message || 'Google Sign-In failed.' });
  }
});

router.post('/resend-code', async (req, res) => {
  try {
    if (fantasySkipEmailVerifyEnabled()) {
      return res.json({
        success: true,
        message: 'Email verification is disabled. Sign in with your password or Google.',
      });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.json({ success: true, message: 'If the account exists, a code has been sent.' });
    }

    if (user.isVerified) {
      return res.json({ success: true, message: 'Account already verified. Please sign in.' });
    }

    const code = generateCode();
    await user.setVerificationCode(code);
    if (user.email !== normalizeEmail(email)) {
      user.email = normalizeEmail(email);
    }
    await user.save();
    await sendVerificationEmail(user.email, code);

    return res.json({ success: true, message: 'Verification code resent. Please check your email.' });
  } catch (err) {
    console.error('Fantasy resend-code error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

router.get('/me', authenticateFantasyUser, async (req, res) => {
  return res.json({
    success: true,
    user: serializeFantasyUser(req.fantasyUser),
  });
});

router.patch('/profile', authenticateFantasyUser, async (req, res) => {
  try {
    const user = req.fantasyUser;
    const updates = {};

    if (req.body.managerName !== undefined) {
      const result = validateManagerName(req.body.managerName);
      if (!result.ok) {
        return res.status(400).json({ success: false, message: result.message });
      }
      updates.managerName = result.value;
    }

    if (req.body.teamName !== undefined) {
      const result = validateFantasyTeamName(req.body.teamName);
      if (!result.ok) {
        return res.status(400).json({ success: false, message: result.message });
      }
      updates.teamName = result.value;
    }

    if (req.body.email !== undefined) {
      return res.status(400).json({ success: false, message: 'Email cannot be changed through this endpoint.' });
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: 'No valid profile fields to update.' });
    }

    Object.assign(user, updates);
    await user.save();

    return res.json({
      success: true,
      message: 'Profile updated.',
      user: serializeFantasyUser(user),
    });
  } catch (err) {
    console.error('Fantasy profile update error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

router.delete('/account', authenticateFantasyUser, async (req, res) => {
  try {
    const { password, confirmation } = req.body;
    if (confirmation !== 'DELETE') {
      return res.status(400).json({
        success: false,
        message: 'Type DELETE to confirm account deletion.',
      });
    }

    const user = req.fantasyUser;
    if (user.hasPasswordLogin()) {
      if (!password) {
        return res.status(400).json({ success: false, message: 'Current password is required.' });
      }
      const passwordOk = await user.comparePassword(password);
      if (!passwordOk) {
        return res.status(401).json({ success: false, message: 'Incorrect password.' });
      }
    }

    await deleteFantasyAccount(user._id);

    return res.json({ success: true, message: 'Account deleted successfully.' });
  } catch (err) {
    console.error('Fantasy account delete error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await findUserByEmail(normalizedEmail);
    const adminContactEmail = getFantasyAdminContactEmail();
    const alternatives = {
      googleSignIn: googleSignInEnabled(),
      adminContactEmail,
    };

    if (!passwordResetViaEmailEnabled()) {
      return res.json({
        success: true,
        emailSent: false,
        message: adminContactEmail
          ? `Password reset emails are unavailable. Sign in with Google if you used it, or contact the league admin at ${adminContactEmail}.`
          : 'Password reset emails are unavailable. Sign in with Google if you used it, or contact the league admin for help.',
        alternatives,
      });
    }

    if (user && user.hasPasswordLogin()) {
      await sendPasswordResetForUser(user, normalizedEmail);

      return res.json({
        success: true,
        emailSent: true,
        message: GENERIC_FORGOT_MESSAGE,
        alternatives,
      });
    }

    if (user && !user.hasPasswordLogin()) {
      if (passwordResetViaEmailEnabled()) {
        await sendPasswordResetForUser(user, normalizedEmail);

        return res.json({
          success: true,
          emailSent: true,
          message: 'We sent a link to set a password for this account so you can sign in with email and password.',
          alternatives,
        });
      }

      return res.json({
        success: true,
        emailSent: false,
        message: 'This account uses Google Sign-In. Continue with Google, or contact the league admin to set a password.',
        alternatives,
      });
    }

    return res.json({
      success: true,
      emailSent: false,
      message: GENERIC_FORGOT_MESSAGE,
      alternatives,
    });
  } catch (err) {
    console.error('Fantasy forgot-password error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Reset token, new password, and confirmation are required.',
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password is too weak.',
        errors: passwordValidation.errors,
      });
    }

    const candidates = await FantasyUser.find({
      passwordResetTokenExpires: { $gt: new Date() },
      passwordResetTokenHash: { $ne: null },
    }).select('+passwordResetTokenHash +passwordResetTokenExpires');

    let matchedUser = null;
    for (const user of candidates) {
      const valid = await isResetTokenValid(
        token,
        user.passwordResetTokenHash,
        user.passwordResetTokenExpires
      );
      if (valid) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      return res.status(400).json({
        success: false,
        message: 'This reset link is invalid or has expired. Please request a new one.',
      });
    }

    matchedUser.password = password;
    matchedUser.authProvider = 'local';
    matchedUser.clearPasswordResetToken();
    await matchedUser.save();

    return res.json({
      success: true,
      message: 'Password updated successfully. You can now sign in with your new password.',
    });
  } catch (err) {
    console.error('Fantasy reset-password error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

module.exports = router;
