const express = require('express');
const router = express.Router();
const Player = require('../models/Player');
const Team = require('../models/Team');
const mongoose = require('mongoose');
const { authenticateAdmin } = require('../middleware/auth');

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
    Object.assign(player, req.body);
    const saved = await player.save();
    res.json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete player (soft delete by default, permanent if ?permanent=true and no stats)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ message: 'Player not found' });

    const permanent = req.query.permanent === 'true';
    if (permanent) {
      // Check for linked stats or match events before hard delete
      const PlayerStats = require('../models/PlayerStats');
      const Match = require('../models/Match');
      const statsCount = await PlayerStats.countDocuments({ player: player._id });
      const matchEventCount = await Match.countDocuments({ 'events.player': player._id });
      if (statsCount > 0 || matchEventCount > 0) {
        return res.status(400).json({ message: 'Cannot permanently delete player with linked stats or match events. Please remove stats/events first.' });
      }
      await player.deleteOne();
      return res.json({ message: 'Player permanently deleted' });
    } else {
      // Soft delete: mark as inactive
      player.active = false;
      await player.save();
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
    res.json({ message: 'Player transferred', player: saved });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Debug endpoint: Check all teams and their players
router.get('/debug/teams-players', async (req, res) => {
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
