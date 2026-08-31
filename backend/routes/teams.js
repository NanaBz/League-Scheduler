const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Player = require('../models/Player');
const { authenticateAdmin } = require('../middleware/auth');
const { logAdminAction } = require('../utils/adminAuditLog');

// Get all teams
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    // Normalize categories for existing teams if missing
    await Team.updateMany({ category: { $exists: false }, name: { $in: ['Orion', 'Firestorm'] } }, { category: 'girls' });
    await Team.updateMany({ category: { $exists: false }, name: { $nin: ['Orion', 'Firestorm'] } }, { category: 'boys' });
    const filter = {};
    if (category && ['boys', 'girls'].includes(category)) filter.category = category;
    const teams = await Team.find(filter).sort({ points: -1, goalDifference: -1, goalsFor: -1 });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new team
router.post('/', authenticateAdmin, async (req, res) => {
  const { name, logo, competition, category } = req.body;
  const team = new Team({
    name,
    logo: logo || '',
    competition: competition || 'league',
    category: category && ['boys', 'girls'].includes(category) ? category : 'boys'
  });

  try {
    const newTeam = await team.save();
    await logAdminAction(req, 'team_created', { teamId: newTeam._id, teamName: newTeam.name });
    res.status(201).json(newTeam);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update team stats
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    Object.assign(team, req.body);
    const updatedTeam = await team.save();
    await logAdminAction(req, 'team_updated', { teamId: updatedTeam._id, teamName: updatedTeam.name });
    res.json(updatedTeam);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a team
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    await team.deleteOne();
    await logAdminAction(req, 'team_deleted', { teamId: team._id, teamName: team.name });
    res.json({ message: 'Team deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Initialize default teams (empty database only — rosters are preserved across season resets)
router.post('/initialize', authenticateAdmin, async (req, res) => {
  try {
    const boysTeams = await Team.find({ category: 'boys' }).sort({ name: 1 });
    if (boysTeams.length === 6) {
      return res.json({
        message: 'League teams are already initialized.',
        alreadyInitialized: true,
        teams: boysTeams,
      });
    }

    const [teamCount, playerCount] = await Promise.all([
      Team.countDocuments(),
      Player.countDocuments(),
    ]);
    if (teamCount > 0 || playerCount > 0) {
      return res.status(409).json({
        message:
          `Cannot initialize: found ${boysTeams.length} boys league team(s) and ${teamCount} total team(s). Expected 6 boys teams or an empty database. Adjust rosters in Player Management or remove extra teams.`,
        code: 'teams_already_exist',
        boysTeamCount: boysTeams.length,
        teamCount,
      });
    }
    
    const teamsData = [
      { name: 'Vikings', logo: '/logos/vikings-logo.png' },
      { name: 'Warriors', logo: '/logos/warriors-logo.png' },
      { name: 'Lions', logo: '/logos/lions-logo.png' },
      { name: 'Elites', logo: '/logos/elites-logo.png' },
      { name: 'Falcons', logo: '/logos/falcons-logo.png' },
      { name: 'Dragons', logo: '/logos/dragons-logo.png' }
    ];
    
    const teams = [];

    for (const teamData of teamsData) {
      const team = new Team({ ...teamData, category: 'boys' });
      teams.push(await team.save());
    }

    await logAdminAction(req, 'team_initialized', { teamCount: teams.length });
    res.json({ message: 'Teams initialized with logos', teams });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

// Staff management endpoints
router.post('/:id/staff', authenticateAdmin, async (req, res) => {
  try {
    const { role, name } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (!role || !name) return res.status(400).json({ message: 'Role and name are required' });
    if (!['Coach', 'Assistant'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
    team.staff = team.staff || [];
    team.staff.push({ role, name });
    await team.save();
    await logAdminAction(req, 'team_staff_added', {
      teamId: team._id,
      teamName: team.name,
      role,
      staffName: name,
    });
    res.json({ message: 'Staff added', staff: team.staff });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id/staff/:index', authenticateAdmin, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    const idx = parseInt(req.params.index, 10);
    if (isNaN(idx) || idx < 0 || idx >= (team.staff?.length || 0)) {
      return res.status(400).json({ message: 'Invalid staff index' });
    }
    team.staff.splice(idx, 1);
    await team.save();
    await logAdminAction(req, 'team_staff_removed', {
      teamId: team._id,
      teamName: team.name,
      staffIndex: idx,
    });
    res.json({ message: 'Staff removed', staff: team.staff });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
