const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const { 
  isWhitelistedEmail, 
  validatePasswordStrength, 
  generateToken,
  authenticateAdmin 
} = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/mailer');
const {
  generateResetToken,
  hashResetToken,
  isResetTokenValid,
  resetTokenExpiry,
  buildResetUrl,
  GENERIC_FORGOT_MESSAGE,
} = require('../utils/passwordReset');

// Check if email is whitelisted and if admin exists
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;

    // Debug logging
    console.log('Email check request:', { email });
    console.log('Environment variables:', {
      ADMIN_EMAIL: process.env.ADMIN_EMAIL,
      ADMIN_EMAILS: process.env.ADMIN_EMAILS,
      NODE_ENV: process.env.NODE_ENV
    });

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if email is whitelisted
    if (!isWhitelistedEmail(email)) {
      console.log('Email not whitelisted:', email);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Email not authorized for admin access.'
      });
    }

    console.log('Email is whitelisted:', email);

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });

    res.json({
      success: true,
      exists: !!existingAdmin,
      isFirstLogin: existingAdmin ? existingAdmin.isFirstLogin : true,
      message: existingAdmin 
        ? 'Admin account found. Please enter your password.' 
        : 'Welcome! Please set up your admin password.'
    });

  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
});

// First-time password setup
router.post('/setup-password', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    if (!email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and password confirmation are required'
      });
    }

    // Check if email is whitelisted
    if (!isWhitelistedEmail(email)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Email not authorized for admin access.'
      });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin && !existingAdmin.isFirstLogin) {
      return res.status(400).json({
        success: false,
        message: 'Admin account already set up. Please use login instead.'
      });
    }

    // Create or update admin
    let admin;
    if (existingAdmin) {
      admin = existingAdmin;
      admin.password = password;
      admin.isFirstLogin = false;
      await admin.save();
    } else {
      admin = new Admin({
        email: email.toLowerCase(),
        password: password,
        isFirstLogin: false
      });
      await admin.save();
    }

    // Generate token
    const token = generateToken(admin._id, admin.email);

    res.json({
      success: true,
      message: 'Admin password set up successfully!',
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        isFirstLogin: false
      }
    });

  } catch (error) {
    console.error('Setup password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
});

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Check if email is whitelisted
    if (!isWhitelistedEmail(email)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Email not authorized for admin access.'
      });
    }

    // Find admin
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if it's first login
    if (admin.isFirstLogin) {
      return res.status(400).json({
        success: false,
        message: 'Please set up your password first',
        requiresSetup: true
      });
    }

    // Check password
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    await admin.updateLastLogin();

    // Generate token
    const token = generateToken(admin._id, admin.email);

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        lastLogin: admin.lastLogin
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
});

// Verify token and get admin info
router.get('/verify', authenticateAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      admin: {
        id: req.admin._id,
        email: req.admin.email,
        lastLogin: req.admin.lastLogin
      }
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
});

// Change password
router.post('/change-password', authenticateAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password, new password, and confirmation are required'
      });
    }

    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match'
      });
    }

    // Validate current password
    const isCurrentPasswordValid = await req.admin.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'New password does not meet security requirements',
        errors: passwordValidation.errors
      });
    }

    // Update password
    req.admin.password = newPassword;
    await req.admin.save();

    res.json({
      success: true,
      message: 'Password changed successfully!'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
});

// Logout (invalidate token - in a real app, you'd use a token blacklist)
router.post('/logout', authenticateAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (isWhitelistedEmail(normalizedEmail)) {
      const admin = await Admin.findOne({ email: normalizedEmail });
      if (admin && !admin.isFirstLogin) {
        const token = generateResetToken();
        admin.passwordResetTokenHash = await hashResetToken(token);
        admin.passwordResetTokenExpires = resetTokenExpiry(
          Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 60
        );
        await admin.save();

        const resetUrl = buildResetUrl('/', token);
        const adminResetUrl = resetUrl.includes('?')
          ? `${resetUrl}&adminReset=1`
          : `${resetUrl}?adminReset=1`;
        await sendPasswordResetEmail(normalizedEmail, adminResetUrl, { audience: 'Admin' });
      }
    }

    return res.json({ success: true, message: GENERIC_FORGOT_MESSAGE });
  } catch (error) {
    console.error('Admin forgot-password error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Reset token, new password, and confirmation are required',
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors,
      });
    }

    const candidates = await Admin.find({
      passwordResetTokenExpires: { $gt: new Date() },
      passwordResetTokenHash: { $ne: null },
    });

    let matchedAdmin = null;
    for (const admin of candidates) {
      const valid = await isResetTokenValid(
        token,
        admin.passwordResetTokenHash,
        admin.passwordResetTokenExpires
      );
      if (valid) {
        matchedAdmin = admin;
        break;
      }
    }

    if (!matchedAdmin) {
      return res.status(400).json({
        success: false,
        message: 'This reset link is invalid or has expired. Please request a new one.',
      });
    }

    matchedAdmin.password = password;
    matchedAdmin.clearPasswordResetToken();
    await matchedAdmin.save();

    return res.json({
      success: true,
      message: 'Password updated successfully. You can now sign in with your new password.',
    });
  } catch (error) {
    console.error('Admin reset-password error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

module.exports = router;
