const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Team = require('../models/Team');

// Get all matches
router.get('/', async (req, res) => {
  try {
    const { competition, matchweek, includeUnpublished } = req.query;
    let filter = {};
    
    if (competition) {
      filter.competition = competition;
    }
    
    if (matchweek) {
      filter.matchweek = parseInt(matchweek);
    }
    
    if (!includeUnpublished) {
      filter.isPublished = true;
    }

    const matches = await Match.find(filter)
      .populate('homeTeam awayTeam')
      .sort({ matchweek: 1, date: 1 });
    
    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new match
router.post('/', async (req, res) => {
  try {
    const match = new Match(req.body);
    const savedMatch = await match.save();
    const populatedMatch = await Match.findById(savedMatch._id)
      .populate('homeTeam awayTeam');
    res.status(201).json(populatedMatch);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a match
router.put('/:id', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    // Store old values for stats update
    const oldHomeScore = match.homeScore;
    const oldAwayScore = match.awayScore;
    const wasPlayed = match.played;

    // Update match
    Object.assign(match, req.body);
    
    // Auto-set played status if scores are provided
    if (match.homeScore !== null && match.awayScore !== null) {
      match.played = true;
      match.datePlayed = match.datePlayed || new Date();
    }

    const updatedMatch = await match.save();
    
    // Update team stats if match was played
    if (updatedMatch.played) {
      await updateTeamStats(updatedMatch, oldHomeScore, oldAwayScore, wasPlayed);
    }

    // Update cup progression if it's a cup match
    if (updatedMatch.competition === 'cup' && updatedMatch.played) {
      await updateCupProgression();
    }

    const populatedMatch = await Match.findById(updatedMatch._id)
      .populate('homeTeam awayTeam');
    
    res.json(populatedMatch);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a match
router.delete('/:id', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    await Match.findByIdAndDelete(req.params.id);
    res.json({ message: 'Match deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate league fixtures using Circle Method
router.post('/generate-league', async (req, res) => {
  try {
    const teams = await Team.find();
    if (teams.length !== 6) {
      return res.status(400).json({ message: 'Exactly 6 teams required for league' });
    }

    // Clear existing league matches
    await Match.deleteMany({ competition: 'league' });

    const fixtures = [];
    const teamIds = teams.map(team => team._id);
    
    // 🎯 CIRCLE METHOD with randomization
    function generateCircleMethodSchedule(teamIds) {
      // 🔀 RANDOMIZE team order to make each generation unique
      const shuffledTeams = [...teamIds];
      for (let i = shuffledTeams.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledTeams[i], shuffledTeams[j]] = [shuffledTeams[j], shuffledTeams[i]];
      }
      
      const teams = shuffledTeams; // Use shuffled teams
      const n = teams.length; // Should be 6
      const half = n / 2; // Should be 3
      const rounds = n - 1; // Should be 5
      const fixtures = [];
      
      // Round 1 (first leg)
      const team_list = teams.slice(0, -1); // All except last [0,1,2,3,4]
      const fixed = teams[teams.length - 1]; // Last team [5]
      
      console.log('🔀 Teams shuffled for unique fixture generation');
      console.log('🔄 Circle Method - Fixed team:', fixed, 'Rotating teams:', team_list.length);
      
      for (let round = 0; round < rounds; round++) {
        const matchweek = [];
        
        // Fixed team plays first rotating team
        matchweek.push([team_list[0], fixed]);
        
        // Pair remaining teams from opposite ends
        for (let i = 1; i < half; i++) {
          const home = team_list[i];
          const away = team_list[team_list.length - i]; // Opposite end
          matchweek.push([home, away]);
        }
        
        fixtures.push(matchweek);
        console.log(`Round ${round + 1}: ${matchweek.length} matches - ${JSON.stringify(matchweek)}`);
        
        // Rotate clockwise (except fixed team)
        const lastTeam = team_list.pop(); // Remove last
        team_list.unshift(lastTeam); // Add to beginning
      }
      
      // Generate second round by reversing home/away
      const secondRoundFixtures = fixtures.map(round => 
        round.map(([home, away]) => [away, home])
      );
      
      // 🎯 SHUFFLE the return fixtures to avoid perfect mirror pattern
      const shuffledSecondRound = [...secondRoundFixtures];
      for (let i = shuffledSecondRound.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledSecondRound[i], shuffledSecondRound[j]] = [shuffledSecondRound[j], shuffledSecondRound[i]];
      }
      
      return { 
        firstRoundSchedule: fixtures, 
        secondRoundSchedule: shuffledSecondRound 
      };
    }
    
    // 🎯 Generate fixtures using Circle Method
    const { firstRoundSchedule, secondRoundSchedule } = generateCircleMethodSchedule(teamIds);
    
    console.log('✅ Circle Method - First round weeks:', firstRoundSchedule.length); // Should be 5
    console.log('✅ Circle Method - Second round weeks:', secondRoundSchedule.length); // Should be 5
    
    // Combine both rounds
    const fullSchedule = [...firstRoundSchedule, ...secondRoundSchedule];
    
    // Create match documents
    let baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 7); // Start next week
    
    for (let week = 0; week < fullSchedule.length; week++) {
      const weekMatches = fullSchedule[week];
      
      for (let gameIndex = 0; gameIndex < weekMatches.length; gameIndex++) {
        const [homeTeamId, awayTeamId] = weekMatches[gameIndex];
        
        // Calculate match date
        const matchDate = new Date(baseDate);
        matchDate.setDate(matchDate.getDate() + (week * 7));
        
        const match = new Match({
          homeTeam: homeTeamId,
          awayTeam: awayTeamId,
          date: matchDate,
          time: gameIndex === 0 ? '13:00' : gameIndex === 1 ? '15:00' : '17:00',
          matchweek: week + 1,
          competition: 'league'
        });
        
        fixtures.push(match);
      }
    }

    await Match.insertMany(fixtures);
    
    // Count matches for verification
    const totalMatches = fixtures.length;
    const expectedMatches = 30; // 6 teams, each plays 5 others twice = 30 matches
    
    res.json({ 
      message: '🎯 League fixtures generated with CIRCLE METHOD (Round Robin Algorithm)', 
      count: totalMatches,
      expected: expectedMatches,
      matchweeks: fullSchedule.length,
      gamesPerWeek: 3,
      firstRoundWeeks: '1-5 (Circle Method - mathematically proven)',
      secondRoundWeeks: '6-10 (home/away reversed, randomized order)'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate cup fixtures with manual team selection
router.post('/generate-cup', async (req, res) => {
  try {
    const { teamIds } = req.body; // Expect array of 4 team IDs
    
    if (!teamIds || teamIds.length !== 4) {
      return res.status(400).json({ message: 'Exactly 4 team IDs required for cup' });
    }

    // Verify all teams exist
    const teams = await Team.find({ _id: { $in: teamIds } });
    if (teams.length !== 4) {
      return res.status(400).json({ message: 'One or more teams not found' });
    }

    // Clear existing cup matches
    await Match.deleteMany({ competition: 'cup' });

    // Randomize the 4 teams for semi-finals
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
    
    const fixtures = [];
    
    // Semi-finals with randomized draw
    const semiFinal1 = new Match({
      homeTeam: shuffledTeams[0]._id,
      awayTeam: shuffledTeams[1]._id,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      time: '19:00',
      matchweek: 1,
      competition: 'cup',
      round: 'semi-final',
      cupMatchNumber: 1
    });

    const semiFinal2 = new Match({
      homeTeam: shuffledTeams[2]._id,
      awayTeam: shuffledTeams[3]._id,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      time: '21:00',
      matchweek: 1,
      competition: 'cup',
      round: 'semi-final',
      cupMatchNumber: 2
    });

    // Final (teams TBD)
    const final = new Match({
      homeTeam: null,
      awayTeam: null,
      date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      time: '20:00',
      matchweek: 2,
      competition: 'cup',
      round: 'final',
      cupMatchNumber: 3
    });

    fixtures.push(semiFinal1, semiFinal2, final);
    await Match.insertMany(fixtures);

    res.json({ 
      message: 'Cup fixtures generated successfully',
      count: fixtures.length,
      semiFinals: `${shuffledTeams[0].name} vs ${shuffledTeams[1].name}, ${shuffledTeams[2].name} vs ${shuffledTeams[3].name}`
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate super cup fixture
router.post('/generate-super-cup', async (req, res) => {
  try {
    const { leagueWinnerId, cupWinnerId } = req.body;
    
    if (!leagueWinnerId || !cupWinnerId) {
      return res.status(400).json({ message: 'League winner and cup winner team IDs required' });
    }

    // Verify teams exist
    const teams = await Team.find({ _id: { $in: [leagueWinnerId, cupWinnerId] } });
    if (teams.length !== 2) {
      return res.status(400).json({ message: 'One or more teams not found' });
    }

    // Clear existing super cup matches
    await Match.deleteMany({ competition: 'super-cup' });

    const superCup = new Match({
      homeTeam: leagueWinnerId,
      awayTeam: cupWinnerId,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      time: '20:00',
      matchweek: 1,
      competition: 'super-cup'
    });

    await superCup.save();

    res.json({ 
      message: 'Super Cup fixture generated successfully',
      fixture: 'League Winner vs Cup Winner'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Save fixtures (publish them)
router.post('/save-fixtures', async (req, res) => {
  try {
    const { competition } = req.body;
    
    if (!competition) {
      return res.status(400).json({ message: 'Competition type required' });
    }

    await Match.updateMany(
      { competition },
      { isPublished: true }
    );

    res.json({ message: `${competition} fixtures published successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reset fixtures
router.post('/reset-fixtures', async (req, res) => {
  try {
    const { competition } = req.body;
    
    if (!competition) {
      return res.status(400).json({ message: 'Competition type required' });
    }

    await Match.deleteMany({ competition });

    res.json({ message: `${competition} fixtures reset successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get fixture status
router.get('/fixture-status', async (req, res) => {
  try {
    const { competition } = req.query;
    
    if (!competition) {
      return res.status(400).json({ message: 'Competition parameter required' });
    }

    const matches = await Match.find({ competition }).populate('homeTeam awayTeam');
    
    const status = {
      competition,
      totalMatches: matches.length,
      publishedMatches: matches.filter(m => m.isPublished).length,
      playedMatches: matches.filter(m => m.played).length,
      fixtures: matches.map(match => ({
        matchweek: match.matchweek,
        home: match.homeTeam?.name || 'TBD',
        away: match.awayTeam?.name || 'TBD',
        date: match.date,
        time: match.time,
        played: match.played,
        published: match.isPublished,
        score: match.played ? `${match.homeScore}-${match.awayScore}` : null
      }))
    };

    res.json(status);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper function to update cup progression
async function updateCupProgression() {
  try {
    const cupMatches = await Match.find({ 
      competition: 'cup', 
      played: true 
    }).populate('homeTeam awayTeam');

    const semiFinalsPlayed = cupMatches.filter(m => m.round === 'semi-final');
    
    if (semiFinalsPlayed.length === 2) {
      // Determine semi-final winners
      const winners = semiFinalsPlayed.map(match => {
        if (match.homeScore > match.awayScore) {
          return match.homeTeam;
        } else if (match.awayScore > match.homeScore) {
          return match.awayTeam;
        } else {
          // Handle penalties if it's a draw
          if (match.homePenalties > match.awayPenalties) {
            return match.homeTeam;
          } else if (match.awayPenalties > match.homePenalties) {
            return match.awayTeam;
          }
        }
        return null;
      }).filter(Boolean);

      if (winners.length === 2) {
        // Update final with the winners
        await Match.findOneAndUpdate(
          { competition: 'cup', round: 'final' },
          { 
            homeTeam: winners[0]._id,
            awayTeam: winners[1]._id 
          }
        );
      }
    }
  } catch (error) {
    console.error('Error updating cup progression:', error);
  }
}

// Helper function to update team stats
async function updateTeamStats(match, oldHomeScore, oldAwayScore, wasPlayed) {
  const homeTeam = await Team.findById(match.homeTeam);
  const awayTeam = await Team.findById(match.awayTeam);

  if (!homeTeam || !awayTeam) return;

  // Revert old stats if match was already played
  if (wasPlayed && oldHomeScore !== null && oldAwayScore !== null) {
    // Revert old results
    homeTeam.goalsFor -= oldHomeScore;
    homeTeam.goalsAgainst -= oldAwayScore;
    awayTeam.goalsFor -= oldAwayScore;
    awayTeam.goalsAgainst -= oldHomeScore;

    if (oldHomeScore > oldAwayScore) {
      homeTeam.wins--;
      homeTeam.points -= 3;
      awayTeam.losses--;
    } else if (oldHomeScore < oldAwayScore) {
      awayTeam.wins--;
      awayTeam.points -= 3;
      homeTeam.losses--;
    } else {
      homeTeam.draws--;
      awayTeam.draws--;
      homeTeam.points--;
      awayTeam.points--;
    }
  }

  // Add new stats
  homeTeam.goalsFor += match.homeScore;
  homeTeam.goalsAgainst += match.awayScore;
  awayTeam.goalsFor += match.awayScore;
  awayTeam.goalsAgainst += match.homeScore;

  if (match.homeScore > match.awayScore) {
    homeTeam.wins++;
    homeTeam.points += 3;
    awayTeam.losses++;
  } else if (match.homeScore < match.awayScore) {
    awayTeam.wins++;
    awayTeam.points += 3;
    homeTeam.losses++;
  } else {
    homeTeam.draws++;
    awayTeam.draws++;
    homeTeam.points++;
    awayTeam.points++;
  }

  await homeTeam.save();
  await awayTeam.save();
}

module.exports = router;
