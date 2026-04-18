const express = require('express');
const router = express.Router();
const PlayerStats = require('../models/PlayerStats');
const Player = require('../models/Player');
const Team = require('../models/Team');
const Season = require('../models/Season');

async function getActiveSeasonNumber() {
  const season = await Season.findOne({ isActive: true }).lean();
  return season ? season.seasonNumber : null;
}

/**
 * Prefer an explicitly active season; otherwise use the highest seasonNumber that
 * already has PlayerStats rows (covers databases where `isActive` was never set).
 * Optional `competition` / `team` scopes the stats fallback so we match real buckets.
 */
async function resolveStatsSeasonNumber({ competition, team } = {}) {
  const activeNumber = await getActiveSeasonNumber();
  if (activeNumber != null) return activeNumber;

  const statsFilter = {};
  if (competition) statsFilter.competition = competition;
  if (team) statsFilter.team = team;

  const latestStats = await PlayerStats.findOne(statsFilter)
    .sort({ seasonNumber: -1 })
    .select('seasonNumber')
    .lean();
  if (latestStats) return latestStats.seasonNumber;

  const latestSeason = await Season.findOne().sort({ seasonNumber: -1 }).lean();
  return latestSeason ? latestSeason.seasonNumber : null;
}

/** Manual join so deleted players still expose an id for labels (populate alone drops the ref). */
async function decorateStatsRows(statsDocs) {
  if (!statsDocs.length) return statsDocs;
  const playerIds = [...new Set(statsDocs.map((s) => String(s.player)))];
  const teamIds = [...new Set(statsDocs.map((s) => String(s.team)))];
  const [players, teams] = await Promise.all([
    Player.find({ _id: { $in: playerIds } }).select('name number position').lean(),
    Team.find({ _id: { $in: teamIds } }).select('name logo').lean(),
  ]);
  const playerById = Object.fromEntries(players.map((p) => [String(p._id), p]));
  const teamById = Object.fromEntries(teams.map((t) => [String(t._id), t]));
  return statsDocs.map((s) => {
    const pid = String(s.player);
    const tid = String(s.team);
    return {
      ...s,
      player: playerById[pid] || null,
      orphanedPlayerId: playerById[pid] ? undefined : pid,
      team: teamById[tid] || null,
    };
  });
}

async function sortedDecoratedStats(filter, sortObj) {
  const docs = await PlayerStats.find(filter).sort(sortObj).lean();
  return decorateStatsRows(docs);
}

// GET /stats?team=teamId (get all stats for a specific team)
router.get('/', async (req, res) => {
  try {
    const { team } = req.query;
    if (!team) return res.status(400).json({ message: 'team parameter required' });
    const seasonNumber = await resolveStatsSeasonNumber({ team });
    const raw = seasonNumber
      ? await PlayerStats.find({ team, seasonNumber }).lean()
      : [];
    const stats = await decorateStatsRows(raw);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /stats/leaderboard?competition=&metric=&limit=3
router.get('/leaderboard', async (req, res) => {
  try {
    const { competition, metric = 'goals', limit = 3 } = req.query;
    const seasonNumber = await resolveStatsSeasonNumber({ competition });
    if (!seasonNumber) return res.status(400).json({ message: 'No active season' });
    const allowedCompetitions = ['league', 'cup', 'super-cup', 'acwpl'];
    const allowedMetrics = ['goals', 'assists', 'cleanSheets', 'yellowCards', 'redCards'];
    if (!allowedCompetitions.includes(competition)) return res.status(400).json({ message: 'Invalid competition' });
    if (!allowedMetrics.includes(metric)) return res.status(400).json({ message: 'Invalid metric' });
    const raw = await PlayerStats.find({ competition, seasonNumber })
      .sort({ [metric]: -1 })
      .limit(parseInt(limit, 10))
      .lean();
    const top = await decorateStatsRows(raw);
    res.json(top);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /stats/summary?competition=
router.get('/summary', async (req, res) => {
  try {
    const { competition } = req.query;
    const seasonNumber = await resolveStatsSeasonNumber({ competition });
    if (!seasonNumber) return res.status(400).json({ message: 'No active season' });
    const allowedCompetitions = ['league', 'cup', 'super-cup', 'acwpl'];
    if (!allowedCompetitions.includes(competition)) return res.status(400).json({ message: 'Invalid competition' });

    // Return ALL stats, sorted by each metric (frontend will show top 3 by default)
    const filter = { competition, seasonNumber };
    const [goals, assists, cleanSheets, yellowCards, redCards] = await Promise.all([
      sortedDecoratedStats(filter, { goals: -1 }),
      sortedDecoratedStats(filter, { assists: -1 }),
      sortedDecoratedStats(filter, { cleanSheets: -1 }),
      sortedDecoratedStats(filter, { yellowCards: -1 }),
      sortedDecoratedStats(filter, { redCards: -1 }),
    ]);

    res.json({ goals, assists, cleanSheets, yellowCards, redCards });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
