const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const FantasyUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    minlength: 8,
    default: null,
  },
  googleId: {
    type: String,
    default: null,
    sparse: true,
    unique: true,
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
  teamName: {
    type: String,
    required: true,
    trim: true
  },
  managerName: {
    type: String,
    required: true,
    trim: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationCodeHash: {
    type: String,
    default: null
  },
  verificationCodeExpires: {
    type: Date,
    default: null
  },
  passwordResetTokenHash: {
    type: String,
    default: null
  },
  passwordResetTokenExpires: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

FantasyUserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

FantasyUserSchema.methods.comparePassword = async function(candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

FantasyUserSchema.methods.hasPasswordLogin = function() {
  return this.authProvider !== 'google' && Boolean(this.password);
};

FantasyUserSchema.methods.setVerificationCode = async function(code, ttlMinutes = 10) {
  const salt = await bcrypt.genSalt(10);
  this.verificationCodeHash = await bcrypt.hash(code, salt);
  this.verificationCodeExpires = new Date(Date.now() + ttlMinutes * 60 * 1000);
};

FantasyUserSchema.methods.isVerificationCodeValid = async function(code) {
  if (!this.verificationCodeHash || !this.verificationCodeExpires) return false;
  if (this.verificationCodeExpires < new Date()) return false;
  return bcrypt.compare(code, this.verificationCodeHash);
};

FantasyUserSchema.methods.clearPasswordResetToken = function() {
  this.passwordResetTokenHash = null;
  this.passwordResetTokenExpires = null;
};

module.exports = mongoose.model('FantasyUser', FantasyUserSchema);
