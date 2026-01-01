const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Player = require('../models/Player');
const Match = require('../models/Match');
const PlayerStats = require('../models/PlayerStats');
const Season = require('../models/Season');
const { authenticateAdmin } = require('../middleware/auth');

async function getActiveSeasonNumber() {
  const season = await Season.findOne({ isActive: true }).lean();
  return season ? season.seasonNumber : null;
}

function computeTotalPoints(stats) {
  if (!stats) return 0;
  const { goals = 0, assists = 0, cleanSheets = 0, yellowCards = 0, redCards = 0, ownGoals = 0 } = stats;
  // Simple FPL-like heuristic; adjust later if needed
  return (goals * 4) + (assists * 3) + (cleanSheets * 4) - yellowCards - (redCards * 3) - (ownGoals * 2);
}

// Admin: set all player fantasy prices to 4.5
router.post('/admin/set-default-prices', authenticateAdmin, async (req, res) => {
  try {
    const result = await Player.updateMany({}, { $set: { fantasyPrice: 4.5 } });
    res.json({ message: 'All player fantasy prices set to 4.5', matched: result.matchedCount, modified: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Players listing with filters and next three matches
// GET /fantasy/players?position=DF&minPrice=4.0&maxPrice=5.0&teams=ID1,ID2&search=name
router.get('/players', async (req, res) => {
  try {
    const { position, minPrice, maxPrice, teams, search } = req.query;
    const filter = {};
    if (position) filter.position = position;
    if (minPrice || maxPrice) filter.fantasyPrice = {};
    if (minPrice) filter.fantasyPrice.$gte = parseFloat(minPrice);
    if (maxPrice) filter.fantasyPrice.$lte = parseFloat(maxPrice);
    if (teams) {
      const teamIds = (teams.split(',') || []).filter(Boolean).map(id => {
        try { return new mongoose.Types.ObjectId(id); } catch { return null; }
      }).filter(Boolean);
      if (teamIds.length > 0) filter.team = { $in: teamIds };
    }
    if (search) filter.name = { $regex: new RegExp(search, 'i') };

    const seasonNumber = await getActiveSeasonNumber();
    const players = await Player.find(filter)
      .populate('team', 'name logo')
      .lean();

    const now = new Date();
    const teamIdsForMatches = [...new Set(players.map(p => p.team?._id).filter(Boolean))];
    const matchesByTeam = {};
    if (teamIdsForMatches.length) {
      const matches = await Match.find({
        $or: [{ homeTeam: { $in: teamIdsForMatches } }, { awayTeam: { $in: teamIdsForMatches } }],
        date: { $gt: now },
        isPublished: true
      }).populate('homeTeam', 'name').populate('awayTeam', 'name').sort({ date: 1 }).lean();
      for (const m of matches) {
        const homeId = m.homeTeam?._id?.toString();
        const awayId = m.awayTeam?._id?.toString();
        if (homeId) {
          matchesByTeam[homeId] = matchesByTeam[homeId] || [];
          matchesByTeam[homeId].push(m);
        }
        if (awayId) {
          matchesByTeam[awayId] = matchesByTeam[awayId] || [];
          matchesByTeam[awayId].push(m);
        }
      }
    }

    const result = [];
    for (const p of players) {
      // Skip players without valid team association (mock data)
      if (!p.team || !p.team._id) continue;

      // Stats (aggregate across competitions for active season)
      let statsAgg = null;
      if (seasonNumber) {
        const stats = await PlayerStats.find({ player: p._id, seasonNumber }).lean();
        statsAgg = stats.reduce((acc, s) => ({
          goals: acc.goals + (s.goals || 0),
          assists: acc.assists + (s.assists || 0),
          cleanSheets: acc.cleanSheets + (s.cleanSheets || 0),
          yellowCards: acc.yellowCards + (s.yellowCards || 0),
          redCards: acc.redCards + (s.redCards || 0),
          ownGoals: acc.ownGoals + (s.ownGoals || 0),
        }), { goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, ownGoals: 0 });
      }

      const totalPoints = computeTotalPoints(statsAgg);
      const teamIdStr = p.team._id.toString();
      const upcoming = (matchesByTeam[teamIdStr] || []).slice(0, 3).map(m => ({
        date: m.date,
        opponent: m.homeTeam?._id?.toString() === teamIdStr ? m.awayTeam?.name : m.homeTeam?.name,
        matchweek: m.matchweek
      }));

      // Skip players without upcoming matches (filters out old mock data)
      if (upcoming.length === 0) continue;

      result.push({
        _id: p._id,
        name: p.name,
        number: p.number,
        position: p.position,
        team: p.team,
        fantasyPrice: p.fantasyPrice,
        selectionPercentage: 0, // placeholder until fantasy ownership is tracked
        totalPoints,
        nextThree: upcoming
      });
    }

    res.json({ players: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;