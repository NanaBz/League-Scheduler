const jwt = require('jsonwebtoken');
const FantasyUser = require('../models/FantasyUser');
const { validatePasswordStrength } = require('./auth');

const getFantasySecret = () => {
  const secret = process.env.FANTASY_JWT_SECRET || process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error('Fantasy JWT secret is not configured');
  }
  return secret;
};

const generateFantasyToken = (userId, email) => {
  const secret = getFantasySecret();
  return jwt.sign(
    {
      id: userId,
      email,
      type: 'fantasy'
    },
    secret,
    { expiresIn: '12h' }
  );
};

const authenticateFantasyUser = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Missing token' });
    }

    const decoded = jwt.verify(token, getFantasySecret());
    if (decoded.type !== 'fantasy') {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }

    const user = await FantasyUser.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.fantasyUser = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = {
  generateFantasyToken,
  authenticateFantasyUser,
  validatePasswordStrength
};
