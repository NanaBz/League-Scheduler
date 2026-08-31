const express = require('express');
const router = express.Router();
const Player = require('../models/Player');
const PlayerStats = require('../models/PlayerStats');
const Team = require('../models/Team');
const Match = require('../models/Match');
const FantasyMatchPerformance = require('../models/FantasyMatchPerformance');
const mongoose = require('mongoose');
const { authenticateAdmin } = require('../middleware/auth');
const { logAdminAction } = require('../utils/adminAuditLog');

// List players (optionally by team)
// List players (optionally by team, and optionally include inactive)
router.get('/', async (req, res) => {
  try {
    const { teamId, includeInactive } = req.query;
    console.log('🔍 Players endpoint hit - teamId:', teamId, 'includeInactive:', includeInactive);

    let filter = {};
    if (teamId) {
      try {
        filter.team = new mongoose.Types.ObjectId(teamId);
      } catch (e) {
        console.warn('⚠️ Failed to convert teamId to ObjectId, using string:', e.message);
        filter.team = teamId;
      }
    }
    if (!includeInactive) {
      filter.active = true;
    }

    console.log('📋 Using filter:', filter);

    const players = await Player.find(filter)
      .populate('team', 'name logo')
      .sort({ team: 1, position: 1, number: 1 })
      .lean();

    console.log(`✅ Found ${players.length} players with filter:`, filter);
    if (players.length > 0) {
      console.log('Sample player:', players[0]);
    }

    res.json(players);
  } catch (error) {
    console.error('❌ Error in players endpoint:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create player
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { name, number, position, team, isCaptain, isViceCaptain } = req.body;
    if (!name || !position || !team) return res.status(400).json({ message: 'name, position, and team are required' });
    const teamDoc = await Team.findById(team);
    if (!teamDoc) return res.status(400).json({ message: 'Invalid team' });
    const player = new Player({ name, number, position, team, isCaptain: !!isCaptain, isViceCaptain: !!isViceCaptain });
    const saved = await player.save();
    await logAdminAction(req, 'player_created', {
      playerId: saved._id,
      playerName: saved.name,
      teamId: saved.team,
    });
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update player
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ message: 'Player not found' });

    const prevPrice = player.fantasyPrice;
    const prevTeam = player.team ? String(player.team) : null;
    Object.assign(player, req.body);
    const saved = await player.save();

    if (req.body.fantasyPrice !== undefined && Number(req.body.fantasyPrice) !== Number(prevPrice)) {
      await logAdminAction(req, 'player_price_updated', {
        playerId: saved._id,
        playerName: saved.name,
        oldPrice: prevPrice,
        newPrice: saved.fantasyPrice,
      });
    } else if (
      ['name', 'number', 'position', 'team', 'isCaptain', 'isViceCaptain'].some((key) =>
        Object.prototype.hasOwnProperty.call(req.body, key)
      )
    ) {
      await logAdminAction(req, 'player_updated', {
        playerId: saved._id,
        playerName: saved.name,
        teamChanged: req.body.team !== undefined && String(req.body.team) !== prevTeam,
      });
    }

    res.json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: stats summary before removing a player (helps distinguish duplicates)
router.get('/:id/removal-preview', authenticateAdmin, async (req, res) => {
  try {
    const player = await Player.findById(req.params.id).populate('team', 'name logo').lean();
    if (!player) return res.status(404).json({ message: 'Player not found' });

    const [statsAgg, fantasyAgg, statsRowCount, matchEventCount] = await Promise.all([
      PlayerStats.aggregate([
        { $match: { player: player._id } },
        {
          $group: {
            _id: null,
            goals: { $sum: '$goals' },
            assists: { $sum: '$assists' },
            yellowCards: { $sum: '$yellowCards' },
            redCards: { $sum: '$redCards' },
          },
        },
      ]),
      FantasyMatchPerformance.aggregate([
        { $match: { player: player._id } },
        { $group: { _id: null, fantasyPoints: { $sum: '$totalPoints' } } },
      ]),
      PlayerStats.countDocuments({ player: player._id }),
      Match.countDocuments({ 'events.player': player._id }),
    ]);

    const totals = {
      goals: statsAgg[0]?.goals || 0,
      assists: statsAgg[0]?.assists || 0,
      yellowCards: statsAgg[0]?.yellowCards || 0,
      redCards: statsAgg[0]?.redCards || 0,
      fantasyPoints: fantasyAgg[0]?.fantasyPoints || 0,
    };

    const canPermanentDelete = statsRowCount === 0 && matchEventCount === 0 && totals.fantasyPoints === 0;

    res.json({
      player: {
        _id: player._id,
        name: player.name,
        number: player.number,
        position: player.position,
        team: player.team,
      },
      totals,
      statsRowCount,
      matchEventCount,
      canPermanentDelete,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete player (soft delete by default, permanent if ?permanent=true and no stats)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ message: 'Player not found' });

    const permanent = req.query.permanent === 'true';
    if (permanent) {
      const statsCount = await PlayerStats.countDocuments({ player: player._id });
      const matchEventCount = await Match.countDocuments({ 'events.player': player._id });
      const fantasyRows = await FantasyMatchPerformance.countDocuments({ player: player._id });
      if (statsCount > 0 || matchEventCount > 0 || fantasyRows > 0) {
        return res.status(400).json({
          message: 'Cannot permanently delete player with linked stats, match events, or fantasy points. They will be marked inactive instead.',
        });
      }
      await player.deleteOne();
      await logAdminAction(req, 'player_deleted', {
        playerId: player._id,
        playerName: player.name,
        permanent: true,
      });
      return res.json({ message: 'Player permanently deleted' });
    } else {
      // Soft delete: mark as inactive
      player.active = false;
      await player.save();
      await logAdminAction(req, 'player_deactivated', {
        playerId: player._id,
        playerName: player.name,
      });
      return res.json({ message: 'Player marked as inactive (soft deleted)' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Transfer player
router.post('/:id/transfer', authenticateAdmin, async (req, res) => {
  try {
    const { toTeamId } = req.body;
    if (!toTeamId) return res.status(400).json({ message: 'toTeamId is required' });
    const player = await Player.findById(req.params.id).populate('team');
    if (!player) return res.status(404).json({ message: 'Player not found' });
    const teamDoc = await Team.findById(toTeamId);
    if (!teamDoc) return res.status(400).json({ message: 'Invalid destination team' });
    // Enforce category restrictions: girls can only move to girls teams; boys within boys
    const fallbackCategory = (teamName, category) => {
      if (category) return category;
      return ['orion', 'firestorm'].includes((teamName || '').toLowerCase()) ? 'girls' : 'boys';
    };
    const fromCategory = fallbackCategory(player.team?.name, player.team?.category);
    const toCategory = fallbackCategory(teamDoc.name, teamDoc.category);
    if (fromCategory !== toCategory) {
      return res.status(400).json({ message: 'Transfer not allowed: players can only move within the same team category' });
    }
    player.team = toTeamId;
    const saved = await player.save();
    await logAdminAction(req, 'player_transferred', {
      playerId: saved._id,
      playerName: saved.name,
      toTeamId,
      toTeamName: teamDoc.name,
    });
    res.json({ message: 'Player transferred', player: saved });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Debug endpoint: Check all teams and their players (admin only)
router.get('/debug/teams-players', authenticateAdmin, async (req, res) => {
  try {
    const teams = await Team.find();
    const teamPlayerMap = {};
    
    for (const team of teams) {
      const players = await Player.find({ team: team._id }).select('name position number');
      teamPlayerMap[team.name] = {
        teamId: team._id,
        playerCount: players.length,
        players: players
      };
    }
    
    res.json(teamPlayerMap);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
