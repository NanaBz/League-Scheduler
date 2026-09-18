const FantasyUser = require('../models/FantasyUser');

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const exactMatch = await FantasyUser.findOne({ email: normalizedEmail });
  if (exactMatch) return exactMatch;

  const escaped = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return FantasyUser.findOne({ email: { $regex: new RegExp(`^${escaped}$`, 'i') } });
}

module.exports = {
  normalizeEmail,
  findUserByEmail,
};
