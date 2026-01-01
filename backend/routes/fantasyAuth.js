const express = require('express');
const router = express.Router();
const FantasyUser = require('../models/FantasyUser');
const { generateFantasyToken, authenticateFantasyUser, validatePasswordStrength } = require('../middleware/fantasyAuth');
const { sendVerificationEmail } = require('../utils/mailer');

const normalizeEmail = (email) => (email || '').trim().toLowerCase();
const generateCode = () => `${Math.floor(100000 + Math.random() * 900000)}`;

router.post('/register', async (req, res) => {
  try {
    const { email, password, teamName, managerName } = req.body;
    if (!email || !password || !teamName || !managerName) {
      return res.status(400).json({ success: false, message: 'Email, password, team name, and manager name are required.' });
    }

    const normalizedEmail = normalizeEmail(email);
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ success: false, message: 'Password is too weak.', errors: passwordValidation.errors });
    }

    let user = await FantasyUser.findOne({ email: normalizedEmail });
    if (user && user.isVerified) {
      return res.status(409).json({ success: false, message: 'Account already exists. Please sign in instead.' });
    }

    const code = generateCode();

    if (user) {
      // Reset credentials for existing unverified account
      user.password = password;
      user.teamName = teamName;
      user.managerName = managerName;
      await user.setVerificationCode(code);
    } else {
      user = new FantasyUser({
        email: normalizedEmail,
        password,
        teamName,
        managerName,
        isVerified: false
      });
      await user.setVerificationCode(code);
    }

    await user.save();
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
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and verification code are required.' });
    }

    const user = await FantasyUser.findOne({ email: normalizeEmail(email) });
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

    const token = generateFantasyToken(user._id, user.email);
    return res.json({
      success: true,
      message: 'Email verified successfully.',
      token,
      user: {
        id: user._id,
        email: user.email,
        teamName: user.teamName,
        managerName: user.managerName,
        isVerified: user.isVerified
      }
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
      user: {
        id: user._id,
        email: user.email,
        teamName: user.teamName,
        managerName: user.managerName,
        isVerified: user.isVerified
      }
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
  const user = req.fantasyUser;
  return res.json({
    success: true,
    user: {
      id: user._id,
      email: user.email,
      teamName: user.teamName,
      managerName: user.managerName,
      isVerified: user.isVerified,
      lastLogin: user.lastLogin
    }
  });
});

module.exports = router;
