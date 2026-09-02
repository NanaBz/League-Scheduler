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
const { fantasyEmailVerifyBypassEnabled } = require('../utils/startupValidation');
const {
  validateManagerName,
  validateFantasyTeamName,
  serializeFantasyUser,
} = require('../utils/fantasyProfileValidation');
const { deleteFantasyAccount } = require('../utils/fantasyAccountDelete');

const normalizeEmail = (email) => (email || '').trim().toLowerCase();
const generateCode = () => `${Math.floor(100000 + Math.random() * 900000)}`;

/** When true, skip email codes: register/login issue tokens; verify accepts without a valid code. Dev/test only. */
function fantasyEmailVerifyBypass() {
  if (process.env.NODE_ENV === 'production' && fantasyEmailVerifyBypassEnabled()) {
    throw new Error('FANTASY_BYPASS_EMAIL_VERIFY must not be enabled in production');
  }
  return fantasyEmailVerifyBypassEnabled();
}

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

    const bypass = fantasyEmailVerifyBypass();
    const code = bypass ? null : generateCode();

    let user = await FantasyUser.findOne({ email: normalizedEmail });
    if (user && user.isVerified) {
      return res.status(409).json({ success: false, message: 'Account already exists. Please sign in instead.' });
    }

    if (user) {
      // Reset credentials for existing unverified account
      user.password = password;
      user.teamName = teamName;
      user.managerName = managerName;
      if (bypass) {
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
        isVerified: bypass
      });
      if (!bypass) await user.setVerificationCode(code);
    }

    await user.save();

    if (bypass) {
      const token = generateFantasyToken(user._id, user.email);
      return res.json({
        success: true,
        message: 'Account created. Email verification is skipped (testing only).',
        verificationBypassed: true,
        token,
        user: serializeFantasyUser(user)
      });
    }

    await sendVerificationEmail(normalizedEmail, code);

    return res.json({ success: true, message: 'Registration received. Check your email for the 6-digit verification code.' });
  } catch (err) {
    console.error('Fantasy register error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error. Please try again.' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }
    if (!fantasyEmailVerifyBypass() && !code) {
      return res.status(400).json({ success: false, message: 'Email and verification code are required.' });
    }

    const user = await FantasyUser.findOne({ email: normalizeEmail(email) });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    if (fantasyEmailVerifyBypass()) {
      user.isVerified = true;
      user.verificationCodeHash = null;
      user.verificationCodeExpires = null;
      user.lastLogin = new Date();
      await user.save();
      const token = generateFantasyToken(user._id, user.email);
      return res.json({
        success: true,
        message: 'Email verified (testing bypass).',
        verificationBypassed: true,
        token,
        user: serializeFantasyUser(user)
      });
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

    const token = generateFantasyToken(user._id, user.email);
    return res.json({
      success: true,
      message: 'Email verified successfully.',
      token,
      user: serializeFantasyUser(user)
    });
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

    const user = await FantasyUser.findOne({ email: normalizeEmail(email) });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const passwordOk = await user.comparePassword(password);
    if (!passwordOk) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.isVerified) {
      if (fantasyEmailVerifyBypass()) {
        user.isVerified = true;
        user.verificationCodeHash = null;
        user.verificationCodeExpires = null;
        user.lastLogin = new Date();
        await user.save();
        const token = generateFantasyToken(user._id, user.email);
        return res.json({
          success: true,
          message: 'Login successful (testing: unverified account was activated without email code).',
          verificationBypassed: true,
          token,
          user: serializeFantasyUser(user),
        });
      }
      const code = generateCode();
      await user.setVerificationCode(code);
      await user.save();
      await sendVerificationEmail(user.email, code);
      return res.status(403).json({ success: false, requiresVerification: true, message: 'Please verify your email. A new code has been sent.' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateFantasyToken(user._id, user.email);
    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: serializeFantasyUser(user)
    });
  } catch (err) {
    console.error('Fantasy login error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await FantasyUser.findOne({ email: normalizeEmail(email) });
    if (!user) {
      return res.json({ success: true, message: 'If the account exists, a code has been sent.' });
    }

    if (user.isVerified) {
      return res.json({ success: true, message: 'Account already verified. Please sign in.' });
    }

    if (fantasyEmailVerifyBypass()) {
      return res.json({
        success: true,
        message: 'Email verification is disabled for testing; sign in with your password.'
      });
    }

    const code = generateCode();
    await user.setVerificationCode(code);
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
    if (!password) {
      return res.status(400).json({ success: false, message: 'Current password is required.' });
    }

    const user = req.fantasyUser;
    const passwordOk = await user.comparePassword(password);
    if (!passwordOk) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
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
    const user = await FantasyUser.findOne({ email: normalizedEmail });

    if (user && user.isVerified) {
      const token = generateResetToken();
      user.passwordResetTokenHash = await hashResetToken(token);
      user.passwordResetTokenExpires = resetTokenExpiry(
        Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 60
      );
      await user.save();

      const resetUrl = buildResetUrl('/fantasy', token);
      await sendPasswordResetEmail(normalizedEmail, resetUrl, { audience: 'ACFPL Fantasy' });
    }

    return res.json({ success: true, message: GENERIC_FORGOT_MESSAGE });
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
