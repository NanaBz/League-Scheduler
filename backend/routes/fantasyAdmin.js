const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticateAdmin } = require('../middleware/auth');
const { logAdminAction } = require('../utils/adminAuditLog');
const FantasySquad = require('../models/FantasySquad');
const FantasyMatchPerformance = require('../models/FantasyMatchPerformance');
const {
  recalcPerformanceTotalsForMatch,
  rescoreGameweek,
  calculateMinutesPoints,
} = require('../utils/fantasyScoring');
const { backfillMissingSnapshotsForGameweek } = require('../utils/fantasyGameweekSnapshot');
const {
  syncFantasyPerformanceFromMatchEvents,
  syncFantasyPerformanceForGameweek,
} = require('../utils/fantasyMatchEventsSync');
const Player = require('../models/Player');
const Match = require('../models/Match');
const { FANTASY_MATCH_COMPETITION, assertFantasyLeagueMatch } = require('../utils/fantasyLeagueScope');
const { resetFantasySeasonData } = require('../utils/resetFantasySeason');
const { deriveCurrentGameweekFromMatches } = require('../utils/fantasyGameweek');
const FantasyMatchweek = require('../models/FantasyMatchweek');
const { getLiveSeasonStatsNumber } = require('../utils/seasonContext');
const { isMatchweekComplete, latestCompletedMatchweek } = require('../utils/fantasyMatchweek');
const { lineupWithResolvedCaptains } = require('../utils/fantasyCaptainRoles');
const { performanceHasScoringEventStats } = require('../utils/fantasyCaptainScoring');
const { parseFantasyMinutes } = require('../utils/fantasyMinutes');
const {
  computeManagerOfTheWeek,
  computeTopManager,
} = require('../utils/fantasyManagerAwards');
const FantasyUser = require('../models/FantasyUser');
const { validatePasswordStrength } = require('../middleware/fantasyAuth');

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
    await logAdminAction(req, 'fantasy_season_reset', { currentGameweek });
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
    await logAdminAction(req, 'fantasy_prices_reset', {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
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

    const managerOfTheWeek = latestCompletedGameweek
      ? await computeManagerOfTheWeek(latestCompletedGameweek)
      : null;
    const topManager = await computeTopManager();

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
        managerOfTheWeek,
        topManager,
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

    await logAdminAction(req, 'fantasy_deadline_updated', {
      matchweek: mw,
      deadline: doc.deadline || null,
      status: doc.status || null,
    });
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

    if (!Array.isArray(playerMinutes)) {
      return res.status(400).json({ success: false, message: 'playerMinutes array required' });
    }

    const match = await Match.findById(req.params.matchId);
    if (!assertFantasyLeagueMatch(match, res)) return;

    // Appearance: 1–44 min = 1 pt, 45+ min = 2 pts (max 70 per player)
    for (const { playerId, minutes } of playerMinutes) {
      if (!playerId) {
        return res.status(400).json({ success: false, message: 'Each entry must include playerId' });
      }

      const parsed = parseFantasyMinutes(minutes);
      if (!parsed.ok) {
        return res.status(400).json({ success: false, message: parsed.error });
      }

      let minutesPlayed = parsed.minutes;
      const existing = await FantasyMatchPerformance.findOne({
        match: req.params.matchId,
        player: playerId,
      }).lean();
      if (performanceHasScoringEventStats(existing) && minutesPlayed < 1) {
        minutesPlayed = 1;
      }
      const minutesPoints = calculateMinutesPoints(minutesPlayed);
      await FantasyMatchPerformance.findOneAndUpdate(
        { match: req.params.matchId, player: playerId },
        {
          $set: {
            matchweek: matchweek || match.matchweek,
            minutesPlayed,
            minutesPoints,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
    }

    const updatedMatch = await Match.findById(req.params.matchId);
    await afterMatchPerformanceUpdate(updatedMatch);
    await logAdminAction(req, 'fantasy_minutes_updated', {
      matchId: req.params.matchId,
      matchweek: updatedMatch?.matchweek,
    });
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
    await logAdminAction(req, 'fantasy_bonus_assigned', {
      matchId: req.params.matchId,
      matchweek: mw,
      assignmentCount: bonusAssignments.length,
    });
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
    await logAdminAction(req, 'fantasy_special_assigned', {
      matchId: req.params.matchId,
      matchweek: mw,
      playerId,
      specialPoints,
    });
    return res.json({ success: true, message: 'Special points assigned' });
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
    await rescoreGameweek(mw, matches, { forceAutosubRecalc: true });

    await logAdminAction(req, 'fantasy_gameweek_rescored', {
      matchweek: mw,
      backfilled,
      eventSynced,
    });
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

// POST /api/fantasy/admin/users/reset-password — admin fallback when email reset is unavailable
router.post('/users/reset-password', authenticateAdmin, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, new password, and confirmation are required.',
      });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password is too weak.',
        errors: passwordValidation.errors,
      });
    }

    const user = await FantasyUser.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Fantasy account not found.' });
    }

    user.password = newPassword;
    user.authProvider = 'local';
    user.clearPasswordResetToken();
    await user.save();

    await logAdminAction(req, 'fantasy_password_reset_admin', {
      fantasyUserId: String(user._id),
      email: user.email,
    });

    return res.json({
      success: true,
      message: `Password updated for ${user.teamName} (${user.email}).`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
