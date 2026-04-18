/**
 * Ensures exactly one Season has isActive=true for fantasy, stats, and match flows.
 *
 * Chooses the season number from max(PlayerStats.seasonNumber) when any stats exist;
 * otherwise the highest Season.seasonNumber. If stats reference a season with no
 * Season document yet, creates a minimal Season row.
 *
 * Run from the backend folder (uses MONGODB_URI in backend/.env):
 *   node scripts/set-active-season.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Season = require('../models/Season');
const PlayerStats = require('../models/PlayerStats');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/league-scheduler';

async function main() {
  await mongoose.connect(URI);

  const agg = await PlayerStats.aggregate([
    { $group: { _id: null, maxSeason: { $max: '$seasonNumber' } } },
  ]);
  let target = agg[0]?.maxSeason;

  if (target == null) {
    const latest = await Season.findOne().sort({ seasonNumber: -1 }).lean();
    target = latest?.seasonNumber;
  }

  if (target == null) {
    console.log('No PlayerStats and no Season documents; nothing to do.');
    await mongoose.disconnect();
    return;
  }

  await Season.updateMany({}, { $set: { isActive: false } });

  let season = await Season.findOne({ seasonNumber: target });
  if (!season) {
    season = new Season({
      seasonNumber: target,
      name: `Season ${target}`,
      startDate: new Date(),
      endDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
      isActive: true,
    });
    await season.save();
    console.log(`Created Season ${target} with isActive=true.`);
  } else {
    season.isActive = true;
    await season.save();
    console.log(`Set existing Season ${target} to isActive=true.`);
  }

  const active = await Season.find({ isActive: true }).select('seasonNumber name').lean();
  console.log('Active season(s):', active);
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
