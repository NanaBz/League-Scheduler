const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const { authenticateAdmin } = require('../middleware/auth');

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
    res.json({ message: 'Team deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Initialize default teams
router.post('/initialize', authenticateAdmin, async (req, res) => {
  try {
    // Clear existing teams first to avoid duplicates
    await Team.deleteMany({});
    
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
    res.json({ message: 'Staff removed', staff: team.staff });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
