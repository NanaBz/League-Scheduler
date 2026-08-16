/**
 * Simple test script for deadline guard logic.
 * Usage: node scripts/test-deadline-guard.js
 */
const mongoose = require('mongoose');
require('dotenv').config();
const FantasyMatchweek = require('../models/FantasyMatchweek');
const { getPrimaryActiveSeasonNumber } = require('../utils/seasonContext');

async function main() {
  const mongo = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/league-scheduler';
  await mongoose.connect(mongo, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    const seasonNumber = await getPrimaryActiveSeasonNumber();
    if (!seasonNumber) {
      console.error('No season found. Create a Season document first.');
      process.exit(1);
    }

    const mw = 1;
    console.log('Using season', seasonNumber, 'matchweek', mw);

    // Future deadline
    const future = new Date(Date.now() + 60 * 60 * 1000);
    await FantasyMatchweek.findOneAndUpdate({ seasonNumber, matchweek: mw }, { $set: { deadline: future, status: 'OPEN' } }, { upsert: true });
    const doc = await FantasyMatchweek.findOne({ seasonNumber, matchweek: mw }).lean();
    console.log('Set future deadline:', doc.deadline);
    console.log('Guard result (should be open):', new Date() < new Date(doc.deadline) ? 'UNLOCKED' : 'LOCKED');

    // Past deadline
    const past = new Date(Date.now() - 60 * 60 * 1000);
    await FantasyMatchweek.findOneAndUpdate({ seasonNumber, matchweek: mw }, { $set: { deadline: past, status: 'LOCKED' } });
    const doc2 = await FantasyMatchweek.findOne({ seasonNumber, matchweek: mw }).lean();
    console.log('Set past deadline:', doc2.deadline);
    console.log('Guard result (should be locked):', new Date() < new Date(doc2.deadline) ? 'UNLOCKED' : 'LOCKED');

    // Cleanup: remove test doc
    await FantasyMatchweek.deleteOne({ seasonNumber, matchweek: mw });
    console.log('Cleanup done.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
