console.log('matches.js loaded');
const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Team = require('../models/Team');
const Player = require('../models/Player');
const PlayerStats = require('../models/PlayerStats');
const Season = require('../models/Season');
const { authenticateAdmin } = require('../middleware/auth');

// Reset match score
router.post('/:id/reset-score', authenticateAdmin, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }
    match.homeScore = null;
    match.awayScore = null;
    match.homePenalties = null;
    match.awayPenalties = null;
    match.isPlayed = false;
    await match.save();
    await match.populate('homeTeam', 'name logo');
    await match.populate('awayTeam', 'name logo');
    res.json({ message: 'Match score reset', match });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ACWPL best-of-5 series route (moved to top for guaranteed registration)
router.post('/generate-acwpl', authenticateAdmin, async (req, res) => {
  console.log('ACWPL route hit');
  try {
    const teams = await Team.find({ competition: 'acwpl' });
    if (teams.length !== 2) {
      return res.status(400).json({ message: 'Exactly 2 teams required for ACWPL best-of-5 series' });
    }
    await Match.deleteMany({ competition: 'acwpl' });
    const fixtures = [];
    const teamIds = teams.map(team => team._id);
    let baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 7);
    for (let week = 0; week < 5; week++) {
      const isHomeOrion = week % 2 === 0;
      const homeTeamId = isHomeOrion ? teamIds[0] : teamIds[1];
      const awayTeamId = isHomeOrion ? teamIds[1] : teamIds[0];
      const matchDate = new Date(baseDate);
      matchDate.setDate(matchDate.getDate() + (week * 7));
      const match = new Match({
        homeTeam: homeTeamId,
        awayTeam: awayTeamId,
        date: matchDate,
        time: '15:00',
        matchweek: week + 1,
        competition: 'acwpl'
      });
      fixtures.push(match);
    }
    await Match.insertMany(fixtures);
    res.json({
      message: 'ACWPL best-of-5 series fixtures generated',
      count: fixtures.length,
      matchweeks: 5
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Get all matches
router.get('/', async (req, res) => {
  try {
    const { competition, matchweek, includeUnpublished } = req.query;
    let filter = {};
    
    if (competition) filter.competition = competition;
    if (matchweek) filter.matchweek = parseInt(matchweek);
    
    // Only show published fixtures unless specifically requested otherwise (for admin)
    if (includeUnpublished !== 'true') {
      filter.isPublished = true;
    }

    const matches = await Match.find(filter)
      .populate('homeTeam', 'name logo')
      .populate('awayTeam', 'name logo')
      .populate('events.player', 'name number')
      .populate('events.assistPlayer', 'name number')
      .sort({ matchweek: 1, date: 1 });
    
    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new match
router.post('/', authenticateAdmin, async (req, res) => {
  const match = new Match(req.body);

  try {
    const newMatch = await match.save();
    await newMatch.populate('homeTeam', 'name logo');
    await newMatch.populate('awayTeam', 'name logo');
    res.status(201).json(newMatch);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update match score and details
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    const oldHomeScore = match.homeScore;
    const oldAwayScore = match.awayScore;
    const wasPlayed = match.isPlayed;

    Object.assign(match, req.body);
    
    // Simple, explicit check: if both scores are numbers (including 0), mark as played
    const homeScore = match.homeScore;
    const awayScore = match.awayScore;
    
    if (typeof homeScore === 'number' && typeof awayScore === 'number' && 
        homeScore >= 0 && awayScore >= 0) {
      match.isPlayed = true;
      console.log(`✅ Match ${match._id} marked as PLAYED: ${homeScore}-${awayScore}`);
    } else {
      console.log(`❌ Match ${match._id} NOT marked as played. Scores: home=${homeScore} (${typeof homeScore}), away=${awayScore} (${typeof awayScore})`);
    }

    const updatedMatch = await match.save();
    await updatedMatch.populate('homeTeam', 'name logo');
    await updatedMatch.populate('awayTeam', 'name logo');

    // Update team stats if this is a league match and score changed
    if (match.competition === 'league' && match.isPlayed) {
      await updateTeamStats(match, oldHomeScore, oldAwayScore, wasPlayed);
    }

    // Update cup progression if this is a semi-final match that is now played
    if (match.competition === 'cup' && match.stage === 'semi-final' && match.isPlayed) {
      await updateCupProgression();
    }

    res.json(updatedMatch);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a match
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    await match.deleteOne();
    res.json({ message: 'Match deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate league fixtures
router.post('/generate-league', authenticateAdmin, async (req, res) => {
  try {
    const teams = await Team.find();
    if (teams.length !== 6) {
      return res.status(400).json({ message: 'Exactly 6 teams required for league' });
    }

    // Clear existing league matches
    await Match.deleteMany({ competition: 'league' });

    const fixtures = [];
    const teamIds = teams.map(team => team._id);
    
    // 🎯 CIRCLE METHOD - Using Your Exact Pseudocode
    function generateCircleMethodSchedule(teamIds) {
      // 🎯 RANDOMIZE THE ENTIRE TEAM LIST to change the fixed team every time!
      const shuffledTeams = [...teamIds];
      for (let i = shuffledTeams.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledTeams[i], shuffledTeams[j]] = [shuffledTeams[j], shuffledTeams[i]];
      }
      
      const teams = shuffledTeams; // Use shuffled teams - this changes the fixed team!
      const n = teams.length; // Should be 6
      const half = n / 2; // Should be 3
      const rounds = n - 1; // Should be 5
      const fixtures = [];
      
      // Round 1 (first leg) - NOW WITH RANDOM FIXED TEAM!
      const team_list = teams.slice(0, -1); // All except last [0,1,2,3,4]
      const fixed = teams[teams.length - 1]; // Last team [5] - BUT NOW RANDOM!
      
      console.log('� Teams shuffled! New fixed team each generation');
      console.log('🎯 Fixed team this round:', fixed, 'Rotating teams:', team_list.length);
      
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
        
        // 🎯 RANDOMIZE MATCH ORDER WITHIN EACH MATCHWEEK!
        for (let i = matchweek.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [matchweek[i], matchweek[j]] = [matchweek[j], matchweek[i]];
        }
        
        fixtures.push(matchweek);
        console.log(`Round ${round + 1}: ${matchweek.length} matches - RANDOMIZED ORDER: ${JSON.stringify(matchweek)}`);
        
        // Rotate clockwise (except fixed team)
        const lastTeam = team_list.pop(); // Remove last
        team_list.unshift(lastTeam); // Add to beginning
      }
      
      // Generate second round by reversing home/away
      const secondRoundFixtures = fixtures.map(round => {
        const reversedRound = round.map(([home, away]) => [away, home]);
        
        // 🎯 RANDOMIZE MATCH ORDER IN SECOND ROUND MATCHWEEKS TOO!
        for (let i = reversedRound.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [reversedRound[i], reversedRound[j]] = [reversedRound[j], reversedRound[i]];
        }
        
        return reversedRound;
      });
      
      // 🎯 DOUBLE SHUFFLE: Shuffle return fixtures AND their week order for maximum variety
      const shuffledSecondRound = [...secondRoundFixtures];
      for (let i = shuffledSecondRound.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledSecondRound[i], shuffledSecondRound[j]] = [shuffledSecondRound[j], shuffledSecondRound[i]];
      }
      
      console.log('🔄 Return fixtures shuffled for maximum variety!');
      
      return { 
        firstRoundSchedule: fixtures, 
        secondRoundSchedule: shuffledSecondRound 
      };
    }
    
    // 🎯 Generate fixtures using Circle Method (NO distribution needed - already perfect!)
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
      secondRoundWeeks: '6-10 (home/away reversed, no conflicts guaranteed)'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate cup fixtures with manual team selection
router.post('/generate-cup', authenticateAdmin, async (req, res) => {
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
      stage: 'semi-final'
    });

    const semiFinal2 = new Match({
      homeTeam: shuffledTeams[2]._id,
      awayTeam: shuffledTeams[3]._id,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      time: '19:00',
      matchweek: 1,
      competition: 'cup',
      stage: 'semi-final'
    });

    fixtures.push(semiFinal1, semiFinal2);

    // Note: Final match will be created automatically once semi-finals are completed

    await Match.insertMany(fixtures);
    res.json({ 
      message: 'Cup fixtures generated with randomized draw', 
      count: fixtures.length,
      teams: shuffledTeams.map(t => t.name)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate super cup fixtures with explicit winner selection
router.post('/generate-super-cup', authenticateAdmin, async (req, res) => {
  // Generate ACWPL (girls league) fixtures
// --- ACWPL fixture generation route moved above module.exports ---
router.post('/generate-acwpl', async (req, res) => {
  console.log('ACWPL route hit');
  try {
    const teams = await Team.find({ competition: 'acwpl' });
    if (teams.length !== 2) {
      return res.status(400).json({ message: 'Exactly 2 teams required for ACWPL best-of-5 series' });
    }
    await Match.deleteMany({ competition: 'acwpl' });
    const fixtures = [];
    const teamIds = teams.map(team => team._id);
    let baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 7);
    for (let week = 0; week < 5; week++) {
      const isHomeOrion = week % 2 === 0;
      const homeTeamId = isHomeOrion ? teamIds[0] : teamIds[1];
      const awayTeamId = isHomeOrion ? teamIds[1] : teamIds[0];
      const matchDate = new Date(baseDate);
      matchDate.setDate(matchDate.getDate() + (week * 7));
      const match = new Match({
        homeTeam: homeTeamId,
        awayTeam: awayTeamId,
        date: matchDate,
        time: '15:00',
        matchweek: week + 1,
        competition: 'acwpl'
      });
      fixtures.push(match);
    }
    await Match.insertMany(fixtures);
    res.json({
      message: 'ACWPL best-of-5 series fixtures generated',
      count: fixtures.length,
      matchweeks: 5
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
  try {
    const { leagueWinnerId, cupWinnerId, originalDoubleWinnerId } = req.body; // Explicit winner selection
    if (!leagueWinnerId || !cupWinnerId) {
      return res.status(400).json({ message: 'Both league winner and cup winner IDs required' });
    }
    // Verify both teams exist
    const [leagueWinner, cupWinner] = await Promise.all([
      Team.findById(leagueWinnerId),
      Team.findById(cupWinnerId)
    ]);
    if (!leagueWinner || !cupWinner) {
      return res.status(400).json({ message: 'One or more teams not found' });
    }
    // Clear existing super cup matches
    await Match.deleteMany({ competition: 'super-cup' });
    // If double winner, store originalDoubleWinnerId for frontend display
    const superCupMatch = new Match({
      homeTeam: leagueWinnerId, // League winner is always home
      awayTeam: cupWinnerId,    // Cup winner or runner-up is always away
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      time: '18:00',
      matchweek: 1,
      competition: 'super-cup',
      round: 'final',
      leagueWinner: leagueWinnerId,  // Store for display purposes
      cupWinner: cupWinnerId,        // Store for display purposes
      originalDoubleWinnerId: originalDoubleWinnerId || null // Store if double winner
    });
    await superCupMatch.save();
    res.json({ 
      message: 'Super Cup fixture generated successfully', 
      fixture: `${leagueWinner.name} (League Winner) vs ${cupWinner.name} (Cup Winner${originalDoubleWinnerId ? ' / Runner-up' : ''})`,
      leagueWinner: leagueWinner.name,
      cupWinner: cupWinner.name,
      runnerUp: originalDoubleWinnerId ? cupWinner.name : null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Save fixtures for a competition (publish them)
router.post('/save-fixtures', authenticateAdmin, async (req, res) => {
  try {
    const { competition } = req.body;
    
    if (!competition || !['league', 'cup', 'super-cup', 'acwpl'].includes(competition)) {
      return res.status(400).json({ message: 'Valid competition required' });
    }

    // Mark all matches for this competition as published
    await Match.updateMany(
      { competition },
      { isPublished: true }
    );

    res.json({ message: `${competition} fixtures saved successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reset fixtures for a competition (delete them)
router.post('/reset-fixtures', authenticateAdmin, async (req, res) => {
  try {
    const { competition } = req.body;
    
    if (!competition || !['league', 'cup', 'super-cup', 'acwpl'].includes(competition)) {
      return res.status(400).json({ message: 'Valid competition required' });
    }

    // Delete all matches for this competition
    await Match.deleteMany({ competition });

    res.json({ message: `${competition} fixtures reset successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get fixture status for all competitions
router.get('/fixture-status', async (req, res) => {
  try {
    const leagueCount = await Match.countDocuments({ competition: 'league' });
    const leaguePublished = await Match.countDocuments({ competition: 'league', isPublished: true });

    const cupCount = await Match.countDocuments({ competition: 'cup' });
    const cupPublished = await Match.countDocuments({ competition: 'cup', isPublished: true });

    const superCupCount = await Match.countDocuments({ competition: 'super-cup' });
    const superCupPublished = await Match.countDocuments({ competition: 'super-cup', isPublished: true });

    const acwplCount = await Match.countDocuments({ competition: 'acwpl' });
    const acwplPublished = await Match.countDocuments({ competition: 'acwpl', isPublished: true });

    res.json({
      league: {
        hasFixtures: leagueCount > 0,
        isPublished: leaguePublished > 0,
        totalMatches: leagueCount,
        publishedMatches: leaguePublished
      },
      cup: {
        hasFixtures: cupCount > 0,
        isPublished: cupPublished > 0,
        totalMatches: cupCount,
        publishedMatches: cupPublished
      },
      'super-cup': {
        hasFixtures: superCupCount > 0,
        isPublished: superCupPublished > 0,
        totalMatches: superCupCount,
        publishedMatches: superCupPublished
      },
      acwpl: {
        hasFixtures: acwplCount > 0,
        isPublished: acwplPublished > 0,
        totalMatches: acwplCount,
        publishedMatches: acwplPublished
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper function to update cup progression after semi-finals
async function updateCupProgression() {
  try {
    // Get all semi-final matches
    const semiFinals = await Match.find({
      competition: 'cup',
      stage: 'semi-final',
      isPlayed: true
    }).populate('homeTeam awayTeam');

    // Only proceed if both semi-finals are completed
    if (semiFinals.length !== 2) {
      return; // Not all semi-finals completed yet
    }

    // Check if final already exists
    const existingFinal = await Match.findOne({
      competition: 'cup',
      stage: 'final'
    });

    if (existingFinal) {
      return; // Final already created
    }

    // Determine winners of each semi-final
    const winners = semiFinals.map(match => {
      // Regular time winner
      if (match.homeScore > match.awayScore) {
        return match.homeTeam;
      } else if (match.awayScore > match.homeScore) {
        return match.awayTeam;
      } else {
        // Draw in regular time - check penalties
        if (match.homePenalties !== null && match.awayPenalties !== null) {
          if (match.homePenalties > match.awayPenalties) {
            return match.homeTeam;
          } else if (match.awayPenalties > match.homePenalties) {
            return match.awayTeam;
          }
        }
        // If no penalties recorded, home team advances (fallback)
        return match.homeTeam;
      }
    });

    if (winners.length === 2) {
      // Create the final match with actual winners
      const finalMatch = new Match({
        homeTeam: winners[0]._id,
        awayTeam: winners[1]._id,
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        time: '20:00',
        matchweek: 2,
        competition: 'cup',
        stage: 'final',
        isPublished: true  // Make sure it's published so it shows up
      });

      await finalMatch.save();
      console.log(`Cup final created: ${winners[0].name} vs ${winners[1].name}`);
    }
  } catch (error) {
    console.error('Error updating cup progression:', error);
  }
}

// Helper function to update team stats
async function updateTeamStats(match, oldHomeScore, oldAwayScore, wasPlayed) {
  const homeTeam = await Team.findById(match.homeTeam);
  const awayTeam = await Team.findById(match.awayTeam);

  // If match was previously played, reverse old stats
  if (wasPlayed && oldHomeScore !== null && oldAwayScore !== null) {
    // Reverse old stats
    homeTeam.played--;
    awayTeam.played--;
    homeTeam.goalsFor -= oldHomeScore;
    homeTeam.goalsAgainst -= oldAwayScore;
    awayTeam.goalsFor -= oldAwayScore;
    awayTeam.goalsAgainst -= oldHomeScore;

    // Remove last form entry (since we're reversing)
    if (homeTeam.form.length > 0) homeTeam.form.pop();
    if (awayTeam.form.length > 0) awayTeam.form.pop();

    if (oldHomeScore > oldAwayScore) {
      homeTeam.won--;
      homeTeam.points -= 3;
      awayTeam.lost--;
    } else if (oldHomeScore < oldAwayScore) {
      awayTeam.won--;
      awayTeam.points -= 3;
      homeTeam.lost--;
    } else {
      homeTeam.drawn--;
      awayTeam.drawn--;
      homeTeam.points--;
      awayTeam.points--;
    }
  }

  // Apply new stats
  homeTeam.played++;
  awayTeam.played++;
  homeTeam.goalsFor += match.homeScore;
  homeTeam.goalsAgainst += match.awayScore;
  awayTeam.goalsFor += match.awayScore;
  awayTeam.goalsAgainst += match.homeScore;

  // Update form (last 3 games)
  let homeResult, awayResult;
  
  if (match.homeScore > match.awayScore) {
    homeTeam.won++;
    homeTeam.points += 3;
    awayTeam.lost++;
    homeResult = 'W';
    awayResult = 'L';
  } else if (match.homeScore < match.awayScore) {
    awayTeam.won++;
    awayTeam.points += 3;
    homeTeam.lost++;
    homeResult = 'L';
    awayResult = 'W';
  } else {
    homeTeam.drawn++;
    awayTeam.drawn++;
    homeTeam.points++;
    awayTeam.points++;
    homeResult = 'D';
    awayResult = 'D';
  }

  // Add to form (keep only last 3)
  homeTeam.form.unshift(homeResult);
  if (homeTeam.form.length > 3) homeTeam.form.pop();
  
  awayTeam.form.unshift(awayResult);
  if (awayTeam.form.length > 3) awayTeam.form.pop();

  await homeTeam.save();
  await awayTeam.save();
}

module.exports = router;

// Record or replace match events for stats aggregation
router.post('/:id/events', authenticateAdmin, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Match not found' });

    // Ensure there is an active season so event stats have a season bucket
    let season = await Season.findOne({ isActive: true });
    if (!season) {
      const lastSeason = await Season.findOne().sort({ seasonNumber: -1 });
      const nextSeasonNumber = lastSeason ? lastSeason.seasonNumber + 1 : 1;
      season = new Season({
        seasonNumber: nextSeasonNumber,
        name: `Season ${nextSeasonNumber}`,
        startDate: new Date(),
        endDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
        isActive: true
      });
      await season.save();
    }
    const seasonNumber = season.seasonNumber;

    const { events } = req.body;
    if (!Array.isArray(events)) return res.status(400).json({ message: 'events array required' });

    const allowedTypes = ['GOAL', 'CLEAN_SHEET', 'YELLOW_CARD', 'RED_CARD'];
    const allowedSides = ['home', 'away'];

    // Helper to adjust stats for an event (delta=+1 or -1)
    const adjustStatsForEvent = async (ev, delta) => {
      if (!allowedTypes.includes(ev.type)) throw new Error('Invalid event type');
      if (!allowedSides.includes(ev.side)) throw new Error('Invalid event side');
      if (!ev.player) throw new Error('Event must include player');

      const player = await Player.findById(ev.player).lean();
      if (!player) throw new Error('Player not found');

      const competition = match.competition;

      // Upsert the PlayerStats doc
      const statsDoc = await PlayerStats.findOneAndUpdate(
        { player: player._id, team: player.team, seasonNumber, competition },
        {},
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const update = {};
      if (ev.type === 'GOAL') {
        if (ev.ownGoal) {
          update.ownGoals = (statsDoc.ownGoals || 0) + delta;
        } else {
          update.goals = (statsDoc.goals || 0) + delta;
          if (ev.assistPlayer) {
            const assistPlayer = await Player.findById(ev.assistPlayer).lean();
            if (assistPlayer) {
              await PlayerStats.findOneAndUpdate(
                { player: assistPlayer._id, team: assistPlayer.team, seasonNumber, competition },
                { $inc: { assists: delta } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
              );
            }
          }
        }
      } else if (ev.type === 'CLEAN_SHEET') {
        update.cleanSheets = (statsDoc.cleanSheets || 0) + delta;
      } else if (ev.type === 'YELLOW_CARD') {
        update.yellowCards = (statsDoc.yellowCards || 0) + delta;
      } else if (ev.type === 'RED_CARD') {
        update.redCards = (statsDoc.redCards || 0) + delta;
      }

      await PlayerStats.updateOne(
        { _id: statsDoc._id },
        { $set: update }
      );
    };

    // Reverse previous events
    for (const ev of match.events || []) {
      await adjustStatsForEvent(ev, -1);
    }

    // Validate and apply new events
    for (const ev of events) {
      await adjustStatsForEvent(ev, +1);
    }

    match.events = events;
    await match.save();

    res.json({ message: 'Match events updated', matchId: match._id, eventsCount: events.length });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
