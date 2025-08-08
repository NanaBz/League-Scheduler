const express = require('express');
const router = express.Router();
const Competition = require('../models/Competition');
const Match = require('../models/Match');
const Team = require('../models/Team');

// Get all competitions
router.get('/', async (req, res) => {
  try {
    const competitions = await Competition.find().populate('winner', 'name');
    res.json(competitions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new competition
router.post('/', async (req, res) => {
  const competition = new Competition(req.body);

  try {
    const newCompetition = await competition.save();
    res.status(201).json(newCompetition);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Reset season (clear all data)
router.post('/reset-season', async (req, res) => {
  try {
    // Reset all team stats
    await Team.updateMany({}, {
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0
    });

    // Delete all matches
    await Match.deleteMany({});

    // Reset competitions
    await Competition.updateMany({}, {
      winner: null,
      isCompleted: false
    });

    res.json({ message: 'Season reset successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Check and update competition winners
router.post('/check-winners', async (req, res) => {
  try {
    const results = {};

    // Check league winner
    const leagueMatches = await Match.find({ competition: 'league' });
    const totalLeagueMatches = leagueMatches.length;
    const playedLeagueMatches = leagueMatches.filter(match => match.isPlayed).length;

    if (totalLeagueMatches > 0 && playedLeagueMatches === totalLeagueMatches) {
      const leagueWinner = await Team.findOne().sort({ points: -1, goalDifference: -1, goalsFor: -1 });
      if (leagueWinner) {
        await Competition.updateOne(
          { name: 'league' },
          { winner: leagueWinner._id, isCompleted: true },
          { upsert: true }
        );
        results.league = leagueWinner.name;
      }
    }

    // Check cup winner
    const cupFinal = await Match.findOne({ competition: 'cup', stage: 'final', isPlayed: true })
      .populate('homeTeam', 'name')
      .populate('awayTeam', 'name');

    if (cupFinal) {
      let cupWinner;
      // Regular time winner
      if (cupFinal.homeScore > cupFinal.awayScore) {
        cupWinner = cupFinal.homeTeam;
      } else if (cupFinal.awayScore > cupFinal.homeScore) {
        cupWinner = cupFinal.awayTeam;
      } else {
        // Draw in regular time - check penalties
        if (cupFinal.homePenalties !== null && cupFinal.awayPenalties !== null) {
          cupWinner = cupFinal.homePenalties > cupFinal.awayPenalties ? cupFinal.homeTeam : cupFinal.awayTeam;
        } else {
          // No penalties recorded yet
          cupWinner = null;
        }
      }
      
      if (cupWinner) {
        await Competition.updateOne(
          { name: 'cup' },
          { winner: cupWinner._id, isCompleted: true },
          { upsert: true }
        );
        results.cup = cupWinner.name;
      }
    }

    // Check super cup winner
    const superCupMatch = await Match.findOne({ competition: 'super-cup', isPlayed: true })
      .populate('homeTeam', 'name')
      .populate('awayTeam', 'name');

    if (superCupMatch) {
      let superCupWinner;
      // Regular time winner
      if (superCupMatch.homeScore > superCupMatch.awayScore) {
        superCupWinner = superCupMatch.homeTeam;
      } else if (superCupMatch.awayScore > superCupMatch.homeScore) {
        superCupWinner = superCupMatch.awayTeam;
      } else {
        // Draw in regular time - check penalties
        if (superCupMatch.homePenalties !== null && superCupMatch.awayPenalties !== null) {
          superCupWinner = superCupMatch.homePenalties > superCupMatch.awayPenalties ? superCupMatch.homeTeam : superCupMatch.awayTeam;
        } else {
          // No penalties recorded yet
          superCupWinner = null;
        }
      }
      
      if (superCupWinner) {
        await Competition.updateOne(
          { name: 'super-cup' },
          { winner: superCupWinner._id, isCompleted: true },
          { upsert: true }
        );
        results.superCup = superCupWinner.name;
      }
    }

    res.json({ message: 'Winners checked', results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
