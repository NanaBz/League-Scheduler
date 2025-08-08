const express = require('express');
const router = express.Router();
const Team = require('../models/Team');

// Get all teams
router.get('/', async (req, res) => {
  try {
    const teams = await Team.find().sort({ points: -1, goalDifference: -1, goalsFor: -1 });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new team
router.post('/', async (req, res) => {
  const team = new Team({
    name: req.body.name
  });

  try {
    const newTeam = await team.save();
    res.status(201).json(newTeam);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update team stats
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
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
router.post('/initialize', async (req, res) => {
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
      const team = new Team(teamData);
      teams.push(await team.save());
    }

    res.json({ message: 'Teams initialized with logos', teams });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
