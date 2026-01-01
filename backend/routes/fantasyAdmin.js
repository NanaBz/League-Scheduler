const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/auth');
const FantasySquad = require('../models/FantasySquad');
const FantasyMatchPerformance = require('../models/FantasyMatchPerformance');
const PlayerAvailability = require('../models/PlayerAvailability');
const Match = require('../models/Match');
const Player = require('../models/Player');

// GET /api/fantasy/admin/dashboard - Dashboard stats
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const totalFantasyPlayers = await require('../models/FantasyUser').countDocuments({ isVerified: true });
    
    // Most captained players (across all matchweeks)
    const captainStats = await FantasySquad.aggregate([
      { $unwind: '$players' },
      { $match: { 'players.isCaptain': true } },
      { $group: { _id: '$players.player', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'players', localField: '_id', foreignField: '_id', as: 'playerData' } },
      { $unwind: '$playerData' }
    ]);

    // Most transfers in/out
    const transfersIn = await FantasySquad.aggregate([
      { $unwind: '$transfersIn' },
      { $group: { _id: '$transfersIn', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'players', localField: '_id', foreignField: '_id', as: 'playerData' } },
      { $unwind: '$playerData' }
    ]);

    const transfersOut = await FantasySquad.aggregate([
      { $unwind: '$transfersOut' },
      { $group: { _id: '$transfersOut', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'players', localField: '_id', foreignField: '_id', as: 'playerData' } },
      { $unwind: '$playerData' }
    ]);

    // Highest points (aggregate across all matchweeks per fantasy user)
    const topScorers = await FantasySquad.aggregate([
      { $group: { _id: '$fantasyUser', totalPoints: { $sum: '$points' } } },
      { $sort: { totalPoints: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'fantasyusers', localField: '_id', foreignField: '_id', as: 'userData' } },
      { $unwind: '$userData' }
    ]);

    // Average points
    const avgPointsResult = await FantasySquad.aggregate([
      { $group: { _id: null, avgPoints: { $avg: '$points' } } }
    ]);
    const avgPoints = avgPointsResult.length > 0 ? avgPointsResult[0].avgPoints : 0;

    return res.json({
      success: true,
      data: {
        totalFantasyPlayers,
        mostCaptained: captainStats.map(c => ({ player: c.playerData.name, count: c.count })),
        transfersIn: transfersIn.map(t => ({ player: t.playerData.name, count: t.count })),
        transfersOut: transfersOut.map(t => ({ player: t.playerData.name, count: t.count })),
        topScorers: topScorers.map(s => ({ manager: s.userData.managerName, team: s.userData.teamName, points: s.totalPoints })),
        avgPoints: Math.round(avgPoints * 10) / 10
      }
    });
  } catch (err) {
    console.error('Fantasy dashboard error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/fantasy/admin/matchweeks - List all matchweeks from Match collection
router.get('/matchweeks', authenticateAdmin, async (req, res) => {
  try {
    const competition = req.query.competition || 'league';
    // Get distinct matchweeks from matches for the chosen competition
    const matchweeks = await Match.aggregate([
      { $match: { competition } },
      { $group: { _id: '$matchweek', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { number: '$_id', matchCount: '$count', _id: 0 } }
    ]);

    // Fallback: if no matches exist yet, return 1..10 to sync with fixture management plan
    if (!matchweeks || matchweeks.length === 0) {
      const defaultWeeks = Array.from({ length: 10 }, (_, i) => ({ number: i + 1, matchCount: 0 }));
      return res.json({ success: true, data: defaultWeeks });
    }

    return res.json({ success: true, data: matchweeks });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/fantasy/admin/matchweeks/:mwNumber/matches - Get matches for a matchweek
router.get('/matchweeks/:mwNumber/matches', authenticateAdmin, async (req, res) => {
  try {
    const matches = await Match.find({ matchweek: parseInt(req.params.mwNumber) })
      .populate('homeTeam awayTeam')
      .sort({ date: 1 });
    return res.json({ success: true, data: matches });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/fantasy/admin/matches/:matchId/players - Get players in a match for minutes assignment
router.get('/matches/:matchId/players', authenticateAdmin, async (req, res) => {
  try {
    const match = await Match.findById(req.params.matchId).populate('homeTeam awayTeam');
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    if (!match.isPlayed) return res.status(400).json({ success: false, message: 'Match not yet played. Enter match details first.' });

    // Get all players from both teams
    const homePlayers = await Player.find({ team: match.homeTeam._id }).select('name number position team');
    const awayPlayers = await Player.find({ team: match.awayTeam._id }).select('name number position team');

    // Get existing performance data if any
    const performances = await FantasyMatchPerformance.find({ match: req.params.matchId }).populate('player');

    return res.json({
      success: true,
      data: {
        match,
        homePlayers,
        awayPlayers,
        performances
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/fantasy/admin/matches/:matchId/minutes - Assign minutes for players
router.post('/matches/:matchId/minutes', authenticateAdmin, async (req, res) => {
  try {
    const { matchweek, playerMinutes } = req.body; // playerMinutes: [{ playerId, minutes }]
    
    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    if (!match.isPlayed) return res.status(400).json({ success: false, message: 'Match not yet played' });

    // Calculate points based on minutes: <35=1pt, 35-60=2pt, >60=2pt
    const calculateMinutesPoints = (min) => {
      if (min === 0) return 0;
      if (min < 35) return 1;
      if (min >= 35 && min <= 60) return 2;
      return 2;
    };

    for (const { playerId, minutes } of playerMinutes) {
      const minutesPoints = calculateMinutesPoints(minutes);
      await FantasyMatchPerformance.findOneAndUpdate(
        { match: req.params.matchId, player: playerId },
        {
          $set: {
            matchweek: matchweek || match.matchweek,
            minutesPlayed: minutes,
            minutesPoints
          }
        },
        { upsert: true, new: true }
      );
    }

    return res.json({ success: true, message: 'Minutes assigned successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/fantasy/admin/matches/:matchId/bonus - Assign bonus points
router.post('/matches/:matchId/bonus', authenticateAdmin, async (req, res) => {
  try {
    const { bonusAssignments } = req.body; // [{ playerId, bonusPoints: 3|2|1 }]
    
    for (const { playerId, bonusPoints } of bonusAssignments) {
      await FantasyMatchPerformance.findOneAndUpdate(
        { match: req.params.matchId, player: playerId },
        { $set: { bonusPoints } },
        { upsert: true }
      );
    }

    return res.json({ success: true, message: 'Bonus points assigned' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/fantasy/admin/matches/:matchId/special - Assign special points
router.post('/matches/:matchId/special', authenticateAdmin, async (req, res) => {
  try {
    const { playerId, specialPoints, reason } = req.body;
    
    await FantasyMatchPerformance.findOneAndUpdate(
      { match: req.params.matchId, player: playerId },
      { $set: { specialPoints, specialPointsReason: reason } },
      { upsert: true }
    );

    return res.json({ success: true, message: 'Special points assigned' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/fantasy/admin/players/:playerId/availability - Get player injury/availability
router.get('/players/:playerId/availability', authenticateAdmin, async (req, res) => {
  try {
    const availability = await PlayerAvailability.findOne({
      player: req.params.playerId
    }).populate('player');

    return res.json({
      success: true,
      data: availability || { player: req.params.playerId, status: 'available', chanceOfPlaying: 100 }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/fantasy/admin/players/:playerId/availability - Set player injury/availability
router.post('/players/:playerId/availability', authenticateAdmin, async (req, res) => {
  try {
    const { matchweek, injuryDetails, chanceOfPlaying } = req.body;
    
    await PlayerAvailability.findOneAndUpdate(
      { player: req.params.playerId, matchweek },
      {
        $set: {
          status: 'injured',
          injuryDetails,
          chanceOfPlaying
        }
      },
      { upsert: true }
    );

    return res.json({ success: true, message: 'Player availability updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
