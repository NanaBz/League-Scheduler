/**
 * Populate default fantasy matchweek deadlines for the active season.
 *
 * Usage: node scripts/populate-default-deadlines.js
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

    console.log('Populating default deadlines for season', seasonNumber);

    const now = new Date();
    // Default: matchweek 1..10 with deadlines at next 10 weeks on Saturday 13:30 UTC
    const base = new Date(now.getTime());
    base.setUTCHours(13, 30, 0, 0);

    for (let mw = 1; mw <= 10; mw++) {
      const d = new Date(base.getTime() + (mw - 1) * 7 * 24 * 60 * 60 * 1000);
      const doc = await FantasyMatchweek.findOneAndUpdate(
        { seasonNumber, matchweek: mw },
        { $set: { seasonNumber, matchweek: mw, deadline: d, status: 'OPEN' } },
        { upsert: true, new: true }
      );
      console.log(`- MW${mw}: ${d.toISOString()} (id: ${doc._id})`);
    }

    console.log('Done.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
