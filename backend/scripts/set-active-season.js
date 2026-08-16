/**
 * Sets isActive=true only on the Season with the highest seasonNumber.
 *
 * If there are no Season documents but PlayerStats exist, creates a minimal Season
 * row for max(PlayerStats.seasonNumber) first, then syncs flags.
 *
 * Run from the backend folder (uses MONGODB_URI in backend/.env):
 *   node scripts/set-active-season.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Season = require('../models/Season');
const PlayerStats = require('../models/PlayerStats');
const { syncSeasonActiveFlagsToLatest } = require('../utils/seasonContext');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/league-scheduler';

async function main() {
  await mongoose.connect(URI);

  let seasonCount = await Season.countDocuments();
  if (seasonCount === 0) {
    const agg = await PlayerStats.aggregate([
      { $group: { _id: null, maxSeason: { $max: '$seasonNumber' } } },
    ]);
    const target = agg[0]?.maxSeason;
    if (target == null) {
      console.log('No Season and no PlayerStats documents; nothing to do.');
      await mongoose.disconnect();
      return;
    }
    await new Season({
      seasonNumber: target,
      name: `Season ${target}`,
      startDate: new Date(),
      endDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
      isActive: false,
    }).save();
    console.log(`Created placeholder Season ${target} (flags will be synced next).`);
  }

  const activeSeasonNumber = await syncSeasonActiveFlagsToLatest();
  console.log('Active season number (highest Season.seasonNumber):', activeSeasonNumber);

  const active = await Season.find({ isActive: true }).select('seasonNumber name').lean();
  console.log('Season rows with isActive=true:', active);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
