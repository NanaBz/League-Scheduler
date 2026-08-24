const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticateAdmin } = require('../middleware/auth');
const FantasySquad = require('../models/FantasySquad');
const FantasyMatchPerformance = require('../models/FantasyMatchPerformance');
const {
  recalcPerformanceTotalsForMatch,
  rescoreGameweek,
} = require('../utils/fantasyScoring');
const { backfillMissingSnapshotsForGameweek } = require('../utils/fantasyGameweekSnapshot');
const {
  syncFantasyPerformanceFromMatchEvents,
  syncFantasyPerformanceForGameweek,
} = require('../utils/fantasyMatchEventsSync');
const PlayerAvailability = require('../models/PlayerAvailability');
const Match = require('../models/Match');
const Player = require('../models/Player');
const { FANTASY_MATCH_COMPETITION, assertFantasyLeagueMatch } = require('../utils/fantasyLeagueScope');
const { resetFantasySeasonData } = require('../utils/resetFantasySeason');
const { deriveCurrentGameweekFromMatches } = require('../utils/fantasyGameweek');
const FantasyMatchweek = require('../models/FantasyMatchweek');
const { getLiveSeasonStatsNumber } = require('../utils/seasonContext');
const { isMatchweekComplete, latestCompletedMatchweek } = require('../utils/fantasyMatchweek');
const { lineupWithResolvedCaptains } = require('../utils/fantasyCaptainRoles');

async function afterMatchPerformanceUpdate(match) {
  await syncFantasyPerformanceFromMatchEvents(match._id);
  await recalcPerformanceTotalsForMatch(match._id);
  
  // Mark match as played so gameweek is recognized as complete for scoring
  if (!match.isPlayed && match.matchState !== 'ft') {
    await Match.findByIdAndUpdate(match._id, {
      isPlayed: true,
      matchState: 'ft'
    });
  }
  
  const matches = await Match.find({
    competition: FANTASY_MATCH_COMPETITION,
    isPublished: true,
  })
    .select('matchweek isPlayed matchState isVoided competition isPublished')
    .lean();
  await rescoreGameweek(match.matchweek, matches);
}

// POST /api/fantasy/admin/reset-season
router.post('/reset-season', authenticateAdmin, async (req, res) => {
  try {
    const cleared = await resetFantasySeasonData();
    const matches = await Match.find({
      competition: FANTASY_MATCH_COMPETITION,
      isPublished: true,
    })
      .select('matchweek isPlayed matchState isVoided competition')
      .lean();
    const currentGameweek = deriveCurrentGameweekFromMatches(matches);
    return res.json({
      success: true,
      message: 'Fantasy season reset. All manager squads and matchweek data cleared.',
      currentGameweek,
      cleared,
      archive: cleared.archiveResult || null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/fantasy/admin/set-default-prices — on fantasy admin router so it is reachable (not shadowed by this mount)
router.post('/set-default-prices', authenticateAdmin, async (req, res) => {
  try {
    const result = await Player.updateMany({}, { $set: { fantasyPrice: 4.5 } });
    res.json({
      success: true,
      message: 'All player fantasy prices set to 4.5',
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/fantasy/admin/dashboard - Dashboard stats
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const totalFantasyPlayers = await require('../models/FantasyUser').countDocuments({ isVerified: true });

    const leagueMatches = await Match.find({
      competition: FANTASY_MATCH_COMPETITION,
      isPublished: true,
    })
      .select('matchweek isPlayed matchState isVoided competition isPublished')
      .lean();
    const latestCompletedGameweek = latestCompletedMatchweek(leagueMatches);
    const showTransferStats = latestCompletedGameweek >= 1;

    // Most captained — latest completed GW (resolve defaults when captain not set)
    let mostCaptained = [];
    if (latestCompletedGameweek) {
      const captainRows = await FantasySquad.find({ matchweek: latestCompletedGameweek })
        .select('fantasyUser lineup')
        .lean();

      const captainCounts = new Map();
      for (const row of captainRows) {
        const resolved = await lineupWithResolvedCaptains(row.lineup, row.fantasyUser);
        const id = resolved?.captainId ? String(resolved.captainId) : null;
        if (!id) continue;
        captainCounts.set(id, (captainCounts.get(id) || 0) + 1);
      }

      const sorted = [...captainCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      const playerIds = sorted.map(([id]) => id).filter((id) => mongoose.Types.ObjectId.isValid(id));
      const players = playerIds.length
        ? await Player.find({ _id: { $in: playerIds } }).select('name').lean()
        : [];
      const nameById = new Map(players.map((p) => [String(p._id), p.name]));

      mostCaptained = sorted.map(([id, count]) => ({
        player: nameById.get(id) || 'Unknown',
        count,
      }));
    }

    const captainStats = mostCaptained;

    // Transfers tracked from GW2 onward (GW1 is initial squad selection)
    const transfersIn = showTransferStats
      ? await FantasySquad.aggregate([
          { $match: { matchweek: { $gte: 2 }, transfersIn: { $exists: true, $ne: [] } } },
          { $unwind: '$transfersIn' },
          { $group: { _id: '$transfersIn', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
          { $lookup: { from: 'players', localField: '_id', foreignField: '_id', as: 'playerData' } },
          { $unwind: { path: '$playerData', preserveNullAndEmptyArrays: true } },
        ])
      : [];

    const transfersOut = showTransferStats
      ? await FantasySquad.aggregate([
          { $match: { matchweek: { $gte: 2 }, transfersOut: { $exists: true, $ne: [] } } },
          { $unwind: '$transfersOut' },
          { $group: { _id: '$transfersOut', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
          { $lookup: { from: 'players', localField: '_id', foreignField: '_id', as: 'playerData' } },
          { $unwind: { path: '$playerData', preserveNullAndEmptyArrays: true } },
        ])
      : [];

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
        latestCompletedGameweek,
        showTransferStats,
        mostCaptained: captainStats,
        transfersIn: transfersIn.map((t) => ({
          player: t.playerData?.name || 'Unknown',
          count: t.count,
        })),
        transfersOut: transfersOut.map((t) => ({
          player: t.playerData?.name || 'Unknown',
          count: t.count,
        })),
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
    const competition = FANTASY_MATCH_COMPETITION;
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

// GET /api/fantasy/admin/matchweeks/deadlines - List admin-configured fantasy matchweek deadlines
router.get('/matchweeks/deadlines', authenticateAdmin, async (req, res) => {
  try {
    const seasonNumber = await getLiveSeasonStatsNumber();
    const docs = await FantasyMatchweek.find({ seasonNumber }).sort({ matchweek: 1 }).lean();
    return res.json({ success: true, data: docs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/fantasy/admin/matchweeks/:mw/deadline - Create or update a matchweek deadline
router.put('/matchweeks/:mw/deadline', authenticateAdmin, async (req, res) => {
  try {
    const mw = Number(req.params.mw);
    if (!Number.isFinite(mw) || mw < 1) return res.status(400).json({ success: false, message: 'Invalid matchweek number.' });

    const { deadline, status, startDate } = req.body;
    const seasonNumber = await getLiveSeasonStatsNumber();

    const update = {};
    if (deadline) update.deadline = new Date(deadline);
    if (typeof status === 'string') update.status = String(status).toUpperCase();
    if (startDate) update.startDate = new Date(startDate);

    const doc = await FantasyMatchweek.findOneAndUpdate(
      { seasonNumber, matchweek: mw },
      { $set: { ...update, seasonNumber, matchweek: mw } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({ success: true, data: doc });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/fantasy/admin/matchweeks/:mwNumber/matches - Get matches for a matchweek
router.get('/matchweeks/:mwNumber/matches', authenticateAdmin, async (req, res) => {
  try {
    const matches = await Match.find({
      matchweek: parseInt(req.params.mwNumber, 10),
      competition: FANTASY_MATCH_COMPETITION,
    })
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
    if (!assertFantasyLeagueMatch(match, res)) return;
    if (!match.isPlayed && match.matchState !== 'ft') {
      return res.status(400).json({ success: false, message: 'Match not yet played. Enter match details first.' });
    }

    await syncFantasyPerformanceFromMatchEvents(req.params.matchId);

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
    if (!assertFantasyLeagueMatch(match, res)) return;

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

    const updatedMatch = await Match.findById(req.params.matchId);
    await afterMatchPerformanceUpdate(updatedMatch);
    return res.json({ success: true, message: 'Minutes assigned successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/fantasy/admin/matches/:matchId/bonus - Assign bonus points
router.post('/matches/:matchId/bonus', authenticateAdmin, async (req, res) => {
  try {
    const { bonusAssignments } = req.body; // [{ playerId, bonusPoints: 3|2|1 }]
    if (!Array.isArray(bonusAssignments)) {
      return res.status(400).json({ success: false, message: 'bonusAssignments array required' });
    }
    const match = await Match.findById(req.params.matchId);
    if (!assertFantasyLeagueMatch(match, res)) return;
    const mw = match.matchweek;

    for (const { playerId, bonusPoints } of bonusAssignments) {
      await FantasyMatchPerformance.findOneAndUpdate(
        { match: req.params.matchId, player: playerId },
        { $set: { bonusPoints, matchweek: mw } },
        { upsert: true }
      );
    }

    const updatedMatch = await Match.findById(req.params.matchId);
    await afterMatchPerformanceUpdate(updatedMatch);
    return res.json({ success: true, message: 'Bonus points assigned' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/fantasy/admin/matches/:matchId/special - Assign special points
router.post('/matches/:matchId/special', authenticateAdmin, async (req, res) => {
  try {
    const { playerId, specialPoints, reason } = req.body;
    const match = await Match.findById(req.params.matchId);
    if (!assertFantasyLeagueMatch(match, res)) return;
    const mw = match.matchweek;

    await FantasyMatchPerformance.findOneAndUpdate(
      { match: req.params.matchId, player: playerId },
      { $set: { specialPoints, specialPointsReason: reason, matchweek: mw } },
      { upsert: true }
    );

    const updatedMatch = await Match.findById(req.params.matchId);
    await afterMatchPerformanceUpdate(updatedMatch);
    return res.json({ success: true, message: 'Special points assigned' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/fantasy/admin/players/:playerId/availability - Get player injury/availability
router.get('/players/:playerId/availability', authenticateAdmin, async (req, res) => {
  try {
    const player = await Player.findById(req.params.playerId).populate('team', 'competition');
    if (player?.team && player.team.competition !== FANTASY_MATCH_COMPETITION) {
      return res.status(403).json({
        success: false,
        message: 'Fantasy availability only applies to league competition players.',
      });
    }

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

    const player = await Player.findById(req.params.playerId).populate('team', 'competition category');
    if (!player || !player.team) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }
    if (player.team.competition !== FANTASY_MATCH_COMPETITION) {
      return res.status(403).json({
        success: false,
        message: 'Fantasy availability only applies to league competition players.',
      });
    }

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

// POST /api/fantasy/admin/rescore-gameweek/:matchweek — backfill snapshots and recalculate points
router.post('/rescore-gameweek/:matchweek', authenticateAdmin, async (req, res) => {
  try {
    const mw = Number(req.params.matchweek);
    if (!Number.isFinite(mw) || mw < 1) {
      return res.status(400).json({ success: false, message: 'Invalid matchweek.' });
    }

    // Clean up orphaned FantasySquad records with null or undefined matchweek before rescoring
    // This prevents E11000 duplicate key errors during upsert
    await FantasySquad.deleteMany({ 
      $or: [
        { matchweek: null },
        { matchweek: undefined },
        { matchweek: { $exists: false } }
      ]
    });

    // Drop both old (gameweek) and new (matchweek) indexes to clear stale state
    // Database may have old index from when field was called "gameweek"
    try {
      await FantasySquad.collection.dropIndex('fantasyUser_1_gameweek_1');
    } catch (err) {
      // Index might not exist with old name, that's okay
    }
    
    try {
      await FantasySquad.collection.dropIndex('fantasyUser_1_matchweek_1');
    } catch (err) {
      // Index might not exist with new name, that's okay
    }
    
    // Recreate the unique index with correct field name
    await FantasySquad.collection.createIndex({ fantasyUser: 1, matchweek: 1 }, { unique: true });

    const matches = await Match.find({
      competition: FANTASY_MATCH_COMPETITION,
      isPublished: true,
    })
      .select('matchweek isPlayed matchState isVoided competition isPublished')
      .lean();

    const backfilled = await backfillMissingSnapshotsForGameweek(mw);
    const eventSynced = await syncFantasyPerformanceForGameweek(mw);
    await rescoreGameweek(mw, matches);

    return res.json({
      success: true,
      message: `Gameweek ${mw} rescored.`,
      matchweek: mw,
      backfilled,
      eventSynced,
      complete: isMatchweekComplete(matches, mw),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
