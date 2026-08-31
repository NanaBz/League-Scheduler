const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const RESET_TOKEN_BYTES = 32;
const DEFAULT_TTL_MINUTES = 60;

const GENERIC_FORGOT_MESSAGE =
  'If an account exists for that email, a password reset link has been sent.';

function generateResetToken() {
  return crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
}

async function hashResetToken(token) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(token, salt);
}

async function isResetTokenValid(token, hash, expires) {
  if (!token || !hash || !expires) return false;
  if (expires < new Date()) return false;
  return bcrypt.compare(token, hash);
}

function resetTokenExpiry(minutes = DEFAULT_TTL_MINUTES) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function buildResetUrl(path, token) {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const basePath = path.startsWith('/') ? path : `/${path}`;
  return `${frontendUrl}${basePath}?reset=${encodeURIComponent(token)}`;
}

module.exports = {
  generateResetToken,
  hashResetToken,
  isResetTokenValid,
  resetTokenExpiry,
  buildResetUrl,
  GENERIC_FORGOT_MESSAGE,
  DEFAULT_TTL_MINUTES,
};
