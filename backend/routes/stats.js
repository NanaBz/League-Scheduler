const express = require('express');
const router = express.Router();
const PlayerStats = require('../models/PlayerStats');
const Season = require('../models/Season');

async function getActiveSeasonNumber() {
  const season = await Season.findOne({ isActive: true }).lean();
  return season ? season.seasonNumber : null;
}

// GET /stats?team=teamId (get all stats for a specific team)
router.get('/', async (req, res) => {
  try {
    const { team } = req.query;
    if (!team) return res.status(400).json({ message: 'team parameter required' });
    const seasonNumber = await getActiveSeasonNumber();
    const stats = await PlayerStats.find({ team, seasonNumber })
      .populate('player', 'name number position')
      .populate('team', 'name logo')
      .lean();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /stats/leaderboard?competition=&metric=&limit=3
router.get('/leaderboard', async (req, res) => {
  try {
    const { competition, metric = 'goals', limit = 3 } = req.query;
    const seasonNumber = await getActiveSeasonNumber();
    if (!seasonNumber) return res.status(400).json({ message: 'No active season' });
    const allowedCompetitions = ['league', 'cup', 'super-cup', 'acwpl'];
    const allowedMetrics = ['goals', 'assists', 'cleanSheets', 'yellowCards', 'redCards'];
    if (!allowedCompetitions.includes(competition)) return res.status(400).json({ message: 'Invalid competition' });
    if (!allowedMetrics.includes(metric)) return res.status(400).json({ message: 'Invalid metric' });
    const top = await PlayerStats.find({ competition, seasonNumber })
      .sort({ [metric]: -1 })
      .limit(parseInt(limit, 10))
      .populate('player', 'name number position')
      .populate('team', 'name logo')
      .lean();
    res.json(top);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /stats/summary?competition=
router.get('/summary', async (req, res) => {
  try {
    const { competition } = req.query;
    const seasonNumber = await getActiveSeasonNumber();
    if (!seasonNumber) return res.status(400).json({ message: 'No active season' });
    const allowedCompetitions = ['league', 'cup', 'super-cup', 'acwpl'];
    if (!allowedCompetitions.includes(competition)) return res.status(400).json({ message: 'Invalid competition' });

    // Return ALL stats, sorted by each metric (frontend will show top 3 by default)
    const [goals, assists, cleanSheets, yellowCards, redCards] = await Promise.all([
      PlayerStats.find({ competition, seasonNumber }).sort({ goals: -1 })
        .populate('player', 'name number position').populate('team', 'name logo').lean(),
      PlayerStats.find({ competition, seasonNumber }).sort({ assists: -1 })
        .populate('player', 'name number position').populate('team', 'name logo').lean(),
      PlayerStats.find({ competition, seasonNumber }).sort({ cleanSheets: -1 })
        .populate('player', 'name number position').populate('team', 'name logo').lean(),
      PlayerStats.find({ competition, seasonNumber }).sort({ yellowCards: -1 })
        .populate('player', 'name number position').populate('team', 'name logo').lean(),
      PlayerStats.find({ competition, seasonNumber }).sort({ redCards: -1 })
        .populate('player', 'name number position').populate('team', 'name logo').lean()
    ]);

    res.json({ goals, assists, cleanSheets, yellowCards, redCards });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
