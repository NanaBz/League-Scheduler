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
    required: true,
    minlength: 8
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
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

FantasyUserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

FantasyUserSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
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

module.exports = mongoose.model('FantasyUser', FantasyUserSchema);
