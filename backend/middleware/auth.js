const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Admin email whitelist checker
const isWhitelistedEmail = (email) => {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  return adminEmails.includes(email.toLowerCase());
};

// Password strength validator
const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength: errors.length === 0 ? 'Strong' : 
             errors.length <= 2 ? 'Medium' : 'Weak'
  };
};

// JWT token generator
const generateToken = (adminId, email) => {
  return jwt.sign(
    { 
      id: adminId, 
      email: email,
      type: 'admin'
    },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Auth middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    
    if (decoded.type !== 'admin') {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. Invalid token type.' 
      });
    }

    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. Admin not found.' 
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Access denied. Invalid token.' 
    });
  }
};

module.exports = {
  isWhitelistedEmail,
  validatePasswordStrength,
  generateToken,
  authenticateAdmin
};
