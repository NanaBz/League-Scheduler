/**
 * Rebuild PlayerStats for one competition + season from Match.events (source of truth).
 * Fixes negative or inconsistent counts after bucket mismatches (e.g. old player.team vs match-side logic).
 *
 * Usage (from backend folder):
 *   node scripts/recalculate-playerstats-from-matches.js [competition] [seasonNumber]
 *
 * Examples:
 *   node scripts/recalculate-playerstats-from-matches.js league
 *   node scripts/recalculate-playerstats-from-matches.js league 1
 *
 * Defaults: competition=league, seasonNumber=active season from DB.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Player = require('../models/Player');
const PlayerStats = require('../models/PlayerStats');
const Season = require('../models/Season');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/league-scheduler';

const toOid = (ref) => {
  if (!ref) return null;
  if (ref instanceof mongoose.Types.ObjectId) return ref;
  if (typeof ref === 'object' && ref._id) return toOid(ref._id);
  const s = String(ref);
  if (!mongoose.Types.ObjectId.isValid(s)) return null;
  return new mongoose.Types.ObjectId(s);
};

function teamIdForSide(match, side) {
  const ref = side === 'home' ? match.homeTeam : match.awayTeam;
  if (!ref) return null;
  return ref instanceof mongoose.Types.ObjectId ? ref : ref._id;
}

async function applyPositiveEvent(match, ev, seasonNumber) {
  const allowedTypes = ['GOAL', 'CLEAN_SHEET', 'YELLOW_CARD', 'RED_CARD'];
  const allowedSides = ['home', 'away'];
  if (!allowedTypes.includes(ev.type)) return;
  if (!allowedSides.includes(ev.side)) return;
  const playerOid = toOid(ev.player);
  if (!playerOid) return;

  const competition = match.competition;
  const statsTeamId = teamIdForSide(match, ev.side);
  if (!statsTeamId) return;

  const statsDoc = await PlayerStats.findOneAndUpdate(
    { player: playerOid, team: statsTeamId, seasonNumber, competition },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const delta = 1;
  const update = {};
  if (ev.type === 'GOAL') {
    if (ev.ownGoal) {
      update.ownGoals = (statsDoc.ownGoals || 0) + delta;
    } else {
      update.goals = (statsDoc.goals || 0) + delta;
      const assistOid = toOid(ev.assistPlayer);
      if (assistOid) {
        const assistExists = await Player.findById(assistOid).lean();
        if (assistExists) {
          await PlayerStats.findOneAndUpdate(
            { player: assistOid, team: statsTeamId, seasonNumber, competition },
            { $inc: { assists: delta } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }
      }
    }
  } else if (ev.type === 'CLEAN_SHEET') {
    update.cleanSheets = (statsDoc.cleanSheets || 0) + delta;
  } else if (ev.type === 'YELLOW_CARD') {
    update.yellowCards = (statsDoc.yellowCards || 0) + delta;
  } else if (ev.type === 'RED_CARD') {
    update.redCards = (statsDoc.redCards || 0) + delta;
  }

  if (Object.keys(update).length) {
    await PlayerStats.updateOne({ _id: statsDoc._id }, { $set: update });
  }
}

async function main() {
  const competition = process.argv[2] || 'league';
  let seasonNumber = process.argv[3] ? parseInt(process.argv[3], 10) : null;

  await mongoose.connect(URI);

  if (!seasonNumber) {
    const season = await Season.findOne({ isActive: true });
    if (!season) {
      console.error('No active season; pass season number as second argument.');
      process.exit(1);
    }
    seasonNumber = season.seasonNumber;
  }

  console.log(`Rebuilding PlayerStats for competition="${competition}" seasonNumber=${seasonNumber}`);

  const del = await PlayerStats.deleteMany({ seasonNumber, competition });
  console.log(`Deleted ${del.deletedCount} existing PlayerStats row(s) for this filter.`);

  const matches = (await Match.find({ competition, isPlayed: true })
    .sort({ matchweek: 1, date: 1 })
    .lean()).filter((m) => m.events && m.events.length > 0);

  console.log(`Replaying events from ${matches.length} played match(es).`);

  for (const match of matches) {
    for (const ev of match.events || []) {
      await applyPositiveEvent(match, ev, seasonNumber);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
