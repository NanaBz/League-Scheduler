const express = require('express');
const router = express.Router();

// In-memory leagues array for demo (replace with DB in production)
let leagues = [];

// Create a league
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'League name is required' });
  }
  const newLeague = {
    id: Date.now().toString(),
    name,
    createdAt: new Date(),
  };
  leagues.push(newLeague);
  res.status(201).json(newLeague);
});

// Get all leagues
router.get('/', (req, res) => {
  res.json(leagues);
});

// Join a league (dummy, just returns league if exists)
router.post('/join', (req, res) => {
  const { id } = req.body;
  const league = leagues.find(l => l.id === id);
  if (!league) {
    return res.status(404).json({ error: 'League not found' });
  }
  res.json({ message: 'Joined league', league });
});

module.exports = router;
