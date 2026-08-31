const express = require('express');
const router = express.Router();
const Competition = require('../models/Competition');
const Match = require('../models/Match');
const Team = require('../models/Team');
const { authenticateAdmin } = require('../middleware/auth');

async function computeCompetitionWinners() {
  const results = {};

  const leagueMatches = await Match.find({ competition: 'league' });
  const totalLeagueMatches = leagueMatches.length;
  const playedLeagueMatches = leagueMatches.filter((match) => match.isPlayed).length;

  if (totalLeagueMatches > 0 && playedLeagueMatches === totalLeagueMatches) {
    const leagueWinner = await Team.findOne().sort({ points: -1, goalDifference: -1, goalsFor: -1 });
    if (leagueWinner) {
      results.league = leagueWinner.name;
    }
  }

  const cupFinal = await Match.findOne({ competition: 'cup', stage: 'final', isPlayed: true })
    .populate('homeTeam', 'name')
    .populate('awayTeam', 'name');

  if (cupFinal) {
    let cupWinner;
    if (cupFinal.homeScore > cupFinal.awayScore) {
      cupWinner = cupFinal.homeTeam;
    } else if (cupFinal.awayScore > cupFinal.homeScore) {
      cupWinner = cupFinal.awayTeam;
    } else if (cupFinal.homePenalties !== null && cupFinal.awayPenalties !== null) {
      cupWinner = cupFinal.homePenalties > cupFinal.awayPenalties ? cupFinal.homeTeam : cupFinal.awayTeam;
    }

    if (cupWinner) {
      results.cup = cupWinner.name;
    }
  }

  const superCupMatch = await Match.findOne({ competition: 'super-cup', isPlayed: true })
    .populate('homeTeam', 'name')
    .populate('awayTeam', 'name');

  if (superCupMatch) {
    let superCupWinner;
    if (superCupMatch.homeScore > superCupMatch.awayScore) {
      superCupWinner = superCupMatch.homeTeam;
    } else if (superCupMatch.awayScore > superCupMatch.homeScore) {
      superCupWinner = superCupMatch.awayTeam;
    } else if (superCupMatch.homePenalties !== null && superCupMatch.awayPenalties !== null) {
      superCupWinner =
        superCupMatch.homePenalties > superCupMatch.awayPenalties
          ? superCupMatch.homeTeam
          : superCupMatch.awayTeam;
    }

    if (superCupWinner) {
      results.superCup = superCupWinner.name;
    }
  }

  const gscMatches = await Match.find({ competition: 'girls-super-cup' })
    .populate('homeTeam', 'name')
    .populate('awayTeam', 'name')
    .sort({ matchweek: 1 })
    .lean();
  const gscWins = {};
  for (const m of gscMatches) {
    if (!m.isPlayed || m.isVoided) continue;
    const h = m.homeScore;
    const a = m.awayScore;
    let winnerTeam = null;
    if (typeof h === 'number' && typeof a === 'number') {
      if (h > a) winnerTeam = m.homeTeam;
      else if (a > h) winnerTeam = m.awayTeam;
      else if (m.homePenalties != null && m.awayPenalties != null && m.homePenalties !== m.awayPenalties) {
        winnerTeam = m.homePenalties > m.awayPenalties ? m.homeTeam : m.awayTeam;
      }
    }
    if (winnerTeam && winnerTeam.name) {
      gscWins[winnerTeam.name] = (gscWins[winnerTeam.name] || 0) + 1;
    }
  }
  const gscLeader = Object.entries(gscWins).sort((x, y) => y[1] - x[1])[0];
  if (gscLeader && gscLeader[1] >= 2) {
    results.girlsSuperCup = gscLeader[0];
  }

  return results;
}

// Get all competitions
router.get('/', async (req, res) => {
  try {
    const competitions = await Competition.find().populate('winner', 'name');
    res.json(competitions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Read-only winner computation for public fixture pages
router.get('/winners', async (req, res) => {
  try {
    const results = await computeCompetitionWinners();
    res.json({ results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new competition
router.post('/', authenticateAdmin, async (req, res) => {
  const competition = new Competition(req.body);

  try {
    const newCompetition = await competition.save();
    res.status(201).json(newCompetition);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Legacy reset — deprecated; use POST /seasons/archive-and-reset instead.
router.post('/reset-season', authenticateAdmin, async (req, res) => {
  try {
    return res.status(410).json({
      message:
        'This endpoint is deprecated. Use Admin → Reset Season → Archive Season & Start New Season instead.',
      code: 'deprecated_reset_route',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Persist competition winners (admin only)
router.post('/check-winners', authenticateAdmin, async (req, res) => {
  try {
    const results = await computeCompetitionWinners();

    if (results.league) {
      const leagueWinner = await Team.findOne({ name: results.league }).select('_id');
      if (leagueWinner) {
        await Competition.updateOne(
          { name: 'league' },
          { winner: leagueWinner._id, isCompleted: true },
          { upsert: true }
        );
      }
    }

    if (results.cup) {
      const cupWinner = await Team.findOne({ name: results.cup }).select('_id');
      if (cupWinner) {
        await Competition.updateOne(
          { name: 'cup' },
          { winner: cupWinner._id, isCompleted: true },
          { upsert: true }
        );
      }
    }

    if (results.superCup) {
      const superCupWinner = await Team.findOne({ name: results.superCup }).select('_id');
      if (superCupWinner) {
        await Competition.updateOne(
          { name: 'super-cup' },
          { winner: superCupWinner._id, isCompleted: true },
          { upsert: true }
        );
      }
    }

    res.json({ message: 'Winners checked', results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
