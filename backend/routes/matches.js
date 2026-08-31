console.log('matches.js loaded');
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Match = require('../models/Match');
const Team = require('../models/Team');
const Player = require('../models/Player');
const PlayerStats = require('../models/PlayerStats');
const Season = require('../models/Season');
const { authenticateAdmin } = require('../middleware/auth');
const { logAdminAction } = require('../utils/adminAuditLog');
const {
  resolveSeasonNumberForMatch,
  seasonNumberForNewFixtures,
  syncSeasonActiveFlagsToLatest,
} = require('../utils/seasonContext');
const { nearestQuarterLocalParts } = require('../utils/matchLiveTime');
const { resetFantasySeasonData } = require('../utils/resetFantasySeason');
const { finalizeFantasyMatchScoring } = require('../utils/fantasyMatchEventsSync');

function effectiveMatchState(match) {
  if (!match) return 'scheduled';
  if (match.matchState) return match.matchState;
  return match.isPlayed ? 'ft' : 'scheduled';
}

/** Rebuild league table totals from all finished league fixtures (source of truth). */
async function recalculateLeagueTeamStats() {
  const teams = await Team.find({ competition: 'league' });
  const teamById = new Map(teams.map((t) => [t._id.toString(), t]));

  for (const team of teams) {
    team.played = 0;
    team.won = 0;
    team.drawn = 0;
    team.lost = 0;
    team.goalsFor = 0;
    team.goalsAgainst = 0;
    team.points = 0;
    team.form = [];
  }

  const matches = await Match.find({
    competition: 'league',
    isPlayed: true,
    isVoided: { $ne: true },
    homeScore: { $ne: null },
    awayScore: { $ne: null },
  })
    .sort({ matchweek: 1, date: 1 })
    .lean();

  for (const match of matches) {
    const homeTeam = teamById.get(String(match.homeTeam));
    const awayTeam = teamById.get(String(match.awayTeam));
    if (!homeTeam || !awayTeam) continue;

    const h = match.homeScore;
    const a = match.awayScore;
    if (typeof h !== 'number' || typeof a !== 'number') continue;

    homeTeam.played += 1;
    awayTeam.played += 1;
    homeTeam.goalsFor += h;
    homeTeam.goalsAgainst += a;
    awayTeam.goalsFor += a;
    awayTeam.goalsAgainst += h;

    let homeResult;
    let awayResult;
    if (h > a) {
      homeTeam.won += 1;
      homeTeam.points += 3;
      awayTeam.lost += 1;
      homeResult = 'W';
      awayResult = 'L';
    } else if (h < a) {
      awayTeam.won += 1;
      awayTeam.points += 3;
      homeTeam.lost += 1;
      homeResult = 'L';
      awayResult = 'W';
    } else {
      homeTeam.drawn += 1;
      awayTeam.drawn += 1;
      homeTeam.points += 1;
      awayTeam.points += 1;
      homeResult = 'D';
      awayResult = 'D';
    }

    homeTeam.form.unshift(homeResult);
    if (homeTeam.form.length > 3) homeTeam.form.pop();
    awayTeam.form.unshift(awayResult);
    if (awayTeam.form.length > 3) awayTeam.form.pop();
  }

  await Promise.all(teams.map((team) => team.save()));
}

// Reset match score
router.post('/:id/reset-score', authenticateAdmin, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }
    const competition = match.competition;
    match.homeScore = null;
    match.awayScore = null;
    match.homePenalties = null;
    match.awayPenalties = null;
    match.isPlayed = false;
    match.matchState = 'scheduled';
    match.events = [];
    match.eventsSyncedToStats = true;
    match.liveLeagueStatsLastHome = null;
    match.liveLeagueStatsLastAway = null;
    await match.save();
    if (competition === 'league') {
      await recalculateLeagueTeamStats();
    }
    await match.populate('homeTeam', 'name logo');
    await match.populate('awayTeam', 'name logo');
    await logAdminAction(req, 'match_score_reset', {
      matchId: match._id,
      competition: match.competition,
      homeTeam: match.homeTeam?.name,
      awayTeam: match.awayTeam?.name,
    });
    res.json({ message: 'Match score reset', match });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ACWPL best-of-5 series route (moved to top for guaranteed registration)
router.post('/generate-acwpl', authenticateAdmin, async (req, res) => {
  console.log('ACWPL route hit');
  try {
    let teams = await Team.find({ competition: 'acwpl' });
    if (teams.length !== 2) {
      // Reset ACWPL teams to Orion and Firestorm
      await Team.deleteMany({ competition: 'acwpl' });
      const newTeams = [
        { name: 'Orion', logo: '/logos/Orion.png', competition: 'acwpl', category: 'girls' },
        { name: 'Firestorm', logo: '/logos/Firestorm.png', competition: 'acwpl', category: 'girls' }
      ];
      await Team.insertMany(newTeams);
      teams = await Team.find({ competition: 'acwpl' });
      if (teams.length !== 2) {
        return res.status(500).json({ message: 'Failed to reset ACWPL teams. Please check database.' });
      }
    }
    await Match.deleteMany({ competition: 'acwpl' });
    const fixtures = [];
    const teamIds = teams.map(team => team._id);
    const fixtureSeason = await seasonNumberForNewFixtures();
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
        competition: 'acwpl',
        seasonNumber: fixtureSeason,
      });
      fixtures.push(match);
    }
    await Match.insertMany(fixtures);
    await logAdminAction(req, 'fixtures_generated', {
      competition: 'acwpl',
      count: fixtures.length,
    });
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
  const body = { ...req.body };
  if (body.seasonNumber == null) {
    body.seasonNumber = await seasonNumberForNewFixtures();
  }
  const match = new Match(body);

  try {
    const newMatch = await match.save();
    await newMatch.populate('homeTeam', 'name logo');
    await newMatch.populate('awayTeam', 'name logo');
    await logAdminAction(req, 'match_created', {
      matchId: newMatch._id,
      competition: newMatch.competition,
      homeTeam: newMatch.homeTeam?.name,
      awayTeam: newMatch.awayTeam?.name,
    });
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
    if (match.isVoided) {
      return res.status(400).json({
        message: 'This fixture is void and can no longer be edited.',
      });
    }

    const oldHomeScore = match.homeScore;
    const oldAwayScore = match.awayScore;
    const wasPlayed = match.isPlayed;

    /** Live fixtures: score lines update; league table updates incrementally from liveLeagueStatsLast*. */
    if (effectiveMatchState(match) === 'live') {
      const leaguePrevH = match.competition === 'league' ? match.liveLeagueStatsLastHome : null;
      const leaguePrevA = match.competition === 'league' ? match.liveLeagueStatsLastAway : null;

      const allow = ['homeScore', 'awayScore', 'homePenalties', 'awayPenalties'];
      for (const key of allow) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          const v = req.body[key];
          match[key] = v === '' || v === null || v === undefined ? null : Number(v);
        }
      }
      match.isPlayed = false;
      match.matchState = 'live';

      if (match.competition === 'league') {
        const hadPrev = Number.isFinite(leaguePrevH) && Number.isFinite(leaguePrevA);
        await updateTeamStats(match, hadPrev ? leaguePrevH : null, hadPrev ? leaguePrevA : null, hadPrev);
        match.liveLeagueStatsLastHome = match.homeScore;
        match.liveLeagueStatsLastAway = match.awayScore;
      }

      const updatedMatch = await match.save();
      await updatedMatch.populate('homeTeam', 'name logo');
      await updatedMatch.populate('awayTeam', 'name logo');
      await logAdminAction(req, 'match_live_score_updated', {
        matchId: updatedMatch._id,
        competition: updatedMatch.competition,
        homeTeam: updatedMatch.homeTeam?.name,
        awayTeam: updatedMatch.awayTeam?.name,
        homeScore: updatedMatch.homeScore,
        awayScore: updatedMatch.awayScore,
      });
      return res.json(updatedMatch);
    }

    const body = { ...req.body };
    delete body.matchState;
    Object.assign(match, body);

    // Simple, explicit check: if both scores are numbers (including 0), mark as played
    const homeScore = match.homeScore;
    const awayScore = match.awayScore;

    if (typeof homeScore === 'number' && typeof awayScore === 'number' && homeScore >= 0 && awayScore >= 0) {
      match.isPlayed = true;
      match.matchState = 'ft';
      console.log(`✅ Match ${match._id} marked as PLAYED: ${homeScore}-${awayScore}`);
    } else {
      if (!match.isPlayed) {
        match.matchState = 'scheduled';
      } else {
        match.matchState = 'ft';
      }
      console.log(
        `❌ Match ${match._id} NOT marked as played. Scores: home=${homeScore} (${typeof homeScore}), away=${awayScore} (${typeof awayScore})`
      );
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

    // ACWPL: if champion is mathematically confirmed, void remaining unplayed fixtures
    if (match.competition === 'acwpl' && match.isPlayed) {
      await finalizeAcwplIfClinched();
    }

    if (match.competition === 'girls-super-cup' && match.isPlayed) {
      await finalizeGirlsSuperCupIfClosed();
    }

    const scoreChanged =
      oldHomeScore !== match.homeScore || oldAwayScore !== match.awayScore;
    await logAdminAction(req, scoreChanged ? 'match_score_updated' : 'match_updated', {
      matchId: updatedMatch._id,
      competition: updatedMatch.competition,
      homeTeam: updatedMatch.homeTeam?.name,
      awayTeam: updatedMatch.awayTeam?.name,
      homeScore: updatedMatch.homeScore,
      awayScore: updatedMatch.awayScore,
    });

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
    await logAdminAction(req, 'match_deleted', {
      matchId: match._id,
      competition: match.competition,
    });
    res.json({ message: 'Match deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate league fixtures
router.post('/generate-league', authenticateAdmin, async (req, res) => {
  try {
    const teams = await Team.find({ category: 'boys' }).sort({ name: 1 });
    if (teams.length !== 6) {
      const totalTeams = await Team.countDocuments();
      return res.status(400).json({
        message: `Exactly 6 boys league teams required for league fixtures (found ${teams.length} boys, ${totalTeams} total). Girls/ACWPL teams are excluded.`,
      });
    }

    // Clear existing league matches
    await Match.deleteMany({ competition: 'league' });
    await recalculateLeagueTeamStats();
    await resetFantasySeasonData();

    const fixtures = [];
    const fixtureSeason = await seasonNumberForNewFixtures();
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
          competition: 'league',
          seasonNumber: fixtureSeason,
        });
        
        fixtures.push(match);
      }
    }

    await Match.insertMany(fixtures);
    
    // Count matches for verification
    const totalMatches = fixtures.length;
    const expectedMatches = 30; // 6 teams, each plays 5 others twice = 30 matches
    
    await logAdminAction(req, 'fixtures_generated', {
      competition: 'league',
      count: totalMatches,
      matchweeks: fullSchedule.length,
    });
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
    const fixtureSeason = await seasonNumberForNewFixtures();
    
    const fixtures = [];
    
    // Semi-finals with randomized draw
    const semiFinal1 = new Match({
      homeTeam: shuffledTeams[0]._id,
      awayTeam: shuffledTeams[1]._id,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      time: '19:00',
      matchweek: 1,
      competition: 'cup',
      stage: 'semi-final',
      seasonNumber: fixtureSeason,
    });

    const semiFinal2 = new Match({
      homeTeam: shuffledTeams[2]._id,
      awayTeam: shuffledTeams[3]._id,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      time: '19:00',
      matchweek: 1,
      competition: 'cup',
      stage: 'semi-final',
      seasonNumber: fixtureSeason,
    });

    fixtures.push(semiFinal1, semiFinal2);

    // Note: Final match will be created automatically once semi-finals are completed

    await Match.insertMany(fixtures);
    await logAdminAction(req, 'fixtures_generated', {
      competition: 'cup',
      count: fixtures.length,
    });
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
    const fixtureSeason = await seasonNumberForNewFixtures();
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
      originalDoubleWinnerId: originalDoubleWinnerId || null, // Store if double winner
      seasonNumber: fixtureSeason,
    });
    await superCupMatch.save();
    await logAdminAction(req, 'fixtures_generated', {
      competition: 'super-cup',
      leagueWinner: leagueWinner.name,
      cupWinner: cupWinner.name,
    });
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

// Girls Super Cup: best-of-3 between ACWPL teams (Orion vs Firestorm); clinch at 2 wins voids remaining games
router.post('/generate-girls-super-cup', authenticateAdmin, async (req, res) => {
  try {
    let teams = await Team.find({ competition: 'acwpl' });
    if (teams.length !== 2) {
      await Team.deleteMany({ competition: 'acwpl' });
      await Team.insertMany([
        { name: 'Orion', logo: '/logos/Orion.png', competition: 'acwpl', category: 'girls' },
        { name: 'Firestorm', logo: '/logos/Firestorm.png', competition: 'acwpl', category: 'girls' },
      ]);
      teams = await Team.find({ competition: 'acwpl' });
    }
    if (teams.length !== 2) {
      return res.status(500).json({ message: 'Could not ensure Orion and Firestorm for Girls Super Cup.' });
    }

    await Match.deleteMany({ competition: 'girls-super-cup' });
    const fixtureSeason = await seasonNumberForNewFixtures();
    const teamIds = teams.map((t) => t._id);
    const fixtures = [];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 7);
    for (let week = 0; week < 3; week++) {
      const isHomeOrion = week % 2 === 0;
      const homeTeamId = isHomeOrion ? teamIds[0] : teamIds[1];
      const awayTeamId = isHomeOrion ? teamIds[1] : teamIds[0];
      const matchDate = new Date(baseDate);
      matchDate.setDate(matchDate.getDate() + week * 7);
      fixtures.push(
        new Match({
          homeTeam: homeTeamId,
          awayTeam: awayTeamId,
          date: matchDate,
          time: '16:00',
          matchweek: week + 1,
          competition: 'girls-super-cup',
          stage: 'final',
          seasonNumber: fixtureSeason,
        })
      );
    }
    await Match.insertMany(fixtures);
    await logAdminAction(req, 'fixtures_generated', {
      competition: 'girls-super-cup',
      count: fixtures.length,
    });
    res.json({
      message: 'Girls Super Cup best-of-3 fixtures generated (Orion vs Firestorm)',
      count: fixtures.length,
      matchweeks: 3,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Save fixtures for a competition (publish them)
router.post('/save-fixtures', authenticateAdmin, async (req, res) => {
  try {
    const { competition } = req.body;
    
    if (!competition || !['league', 'cup', 'super-cup', 'acwpl', 'girls-super-cup'].includes(competition)) {
      return res.status(400).json({ message: 'Valid competition required' });
    }

    // Mark all matches for this competition as published
    await Match.updateMany(
      { competition },
      { isPublished: true }
    );

    await logAdminAction(req, 'fixtures_published', { competition });
    res.json({ message: `${competition} fixtures saved successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reset fixtures for a competition (delete them)
router.post('/reset-fixtures', authenticateAdmin, async (req, res) => {
  try {
    const { competition } = req.body;
    
    if (!competition || !['league', 'cup', 'super-cup', 'acwpl', 'girls-super-cup'].includes(competition)) {
      return res.status(400).json({ message: 'Valid competition required' });
    }

    // Delete all matches for this competition
    await Match.deleteMany({ competition });

    if (competition === 'league') {
      await recalculateLeagueTeamStats();
      await resetFantasySeasonData();
    }

    await logAdminAction(req, 'fixtures_reset', { competition });
    res.json({ message: `${competition} fixtures reset successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Rebuild league standings from played fixtures (fixes stale table after bulk resets)
router.post('/recalculate-league-table', authenticateAdmin, async (req, res) => {
  try {
    await recalculateLeagueTeamStats();
    const teams = await Team.find({ competition: 'league' }).sort({
      points: -1,
      goalDifference: -1,
      goalsFor: -1,
    });
    await logAdminAction(req, 'league_table_recalculated');
    res.json({
      message: 'League table recalculated from finished fixtures.',
      teams,
    });
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

    const girlsSuperCupCount = await Match.countDocuments({ competition: 'girls-super-cup' });
    const girlsSuperCupPublished = await Match.countDocuments({ competition: 'girls-super-cup', isPublished: true });

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
      },
      'girls-super-cup': {
        hasFixtures: girlsSuperCupCount > 0,
        isPublished: girlsSuperCupPublished > 0,
        totalMatches: girlsSuperCupCount,
        publishedMatches: girlsSuperCupPublished
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Single match (must stay below static paths like /fixture-status)
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid match id' });
    }
    const match = await Match.findById(req.params.id)
      .populate('homeTeam', 'name logo')
      .populate('awayTeam', 'name logo')
      .populate('events.player', 'name number')
      .populate('events.assistPlayer', 'name number')
      .lean();
    if (!match) return res.status(404).json({ message: 'Match not found' });
    res.json(match);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper function to update cup progression after semi-finals
async function getAcwplClinchState() {
  const acwplMatches = await Match.find({ competition: 'acwpl' })
    .populate('homeTeam', 'name')
    .populate('awayTeam', 'name')
    .sort({ matchweek: 1, date: 1 })
    .lean();

  const teamNames = ['Orion', 'Firestorm'];
  const table = {
    Orion: { points: 0, wins: 0, played: 0 },
    Firestorm: { points: 0, wins: 0, played: 0 }
  };

  for (const match of acwplMatches) {
    if (!match.isPlayed || match.isVoided) continue;
    const home = match.homeTeam?.name;
    const away = match.awayTeam?.name;
    if (!teamNames.includes(home) || !teamNames.includes(away)) continue;

    table[home].played += 1;
    table[away].played += 1;

    if (match.homeScore > match.awayScore) {
      table[home].wins += 1;
      table[home].points += 3;
    } else if (match.awayScore > match.homeScore) {
      table[away].wins += 1;
      table[away].points += 3;
    } else {
      table[home].points += 1;
      table[away].points += 1;
    }
  }

  const [teamA, teamB] = teamNames;
  const remainingA = Math.max(0, 5 - table[teamA].played);
  const remainingB = Math.max(0, 5 - table[teamB].played);
  const maxA = table[teamA].points + (remainingA * 3);
  const maxB = table[teamB].points + (remainingB * 3);

  if (table[teamA].wins >= 3 || table[teamA].points > maxB) return { champion: teamA };
  if (table[teamB].wins >= 3 || table[teamB].points > maxA) return { champion: teamB };
  return { champion: null };
}

function resolvedWinnerSideFromScores(match) {
  if (!match || match.isVoided || !match.isPlayed) return null;
  const h = match.homeScore;
  const a = match.awayScore;
  if (typeof h !== 'number' || typeof a !== 'number') return null;
  if (h > a) return 'home';
  if (a > h) return 'away';
  const hp = match.homePenalties;
  const ap = match.awayPenalties;
  if (hp != null && ap != null && hp !== ap) return hp > ap ? 'home' : 'away';
  return null;
}

async function finalizeGirlsSuperCupIfClosed() {
  const series = await Match.find({ competition: 'girls-super-cup' }).sort({ matchweek: 1 }).lean();
  const winsByTeamId = {};
  for (const m of series) {
    if (!m.isPlayed || m.isVoided) continue;
    const side = resolvedWinnerSideFromScores(m);
    if (!side) continue;
    const tid = String(side === 'home' ? m.homeTeam : m.awayTeam);
    winsByTeamId[tid] = (winsByTeamId[tid] || 0) + 1;
  }
  const maxWins = Math.max(0, ...Object.values(winsByTeamId));
  if (maxWins < 2) return;

  await Match.updateMany(
    { competition: 'girls-super-cup', isPlayed: false, isVoided: { $ne: true } },
    {
      $set: {
        isVoided: true,
        voidReason: 'Girls Super Cup: a team reached two wins — remaining fixtures are void.',
      },
    }
  );
}

async function finalizeAcwplIfClinched() {
  const { champion } = await getAcwplClinchState();
  if (!champion) return;

  await Match.updateMany(
    {
      competition: 'acwpl',
      isPlayed: false,
      isVoided: { $ne: true }
    },
    {
      $set: {
        isVoided: true,
        voidReason: `ACWPL winner decided early: ${champion} clinched the series.`
      }
    }
  );
}

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
      const cupSeason =
        semiFinals[0].seasonNumber ??
        semiFinals[1].seasonNumber ??
        (await seasonNumberForNewFixtures());
      // Create the final match with actual winners
      const finalMatch = new Match({
        homeTeam: winners[0]._id,
        awayTeam: winners[1]._id,
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        time: '20:00',
        matchweek: 2,
        competition: 'cup',
        stage: 'final',
        isPublished: true, // Make sure it's published so it shows up
        seasonNumber: cupSeason,
      });

      await finalMatch.save();
      console.log(`Cup final created: ${winners[0].name} vs ${winners[1].name}`);
    }
  } catch (error) {
    console.error('Error updating cup progression:', error);
  }
}

/** Undo a single result snapshot from league team totals (used when abandoning live). */
async function revertTeamStatsOnly(match, oldHomeScore, oldAwayScore) {
  if (oldHomeScore === null || oldHomeScore === undefined || oldAwayScore === null || oldAwayScore === undefined) {
    return;
  }
  const homeTeam = await Team.findById(match.homeTeam);
  const awayTeam = await Team.findById(match.awayTeam);
  if (!homeTeam || !awayTeam) return;

  homeTeam.played--;
  awayTeam.played--;
  homeTeam.goalsFor -= oldHomeScore;
  homeTeam.goalsAgainst -= oldAwayScore;
  awayTeam.goalsFor -= oldAwayScore;
  awayTeam.goalsAgainst -= oldHomeScore;

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

  await homeTeam.save();
  await awayTeam.save();
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

// --- Live match workflow (start → score updates → full time / abandon) ---

router.post('/:id/start-live', authenticateAdmin, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Match not found' });
    if (match.isVoided) return res.status(400).json({ message: 'Void fixtures cannot go live.' });
    if (match.isPlayed || effectiveMatchState(match) === 'ft') {
      return res.status(400).json({ message: 'This match is already finished.' });
    }
    if (effectiveMatchState(match) === 'live') {
      return res.status(400).json({ message: 'This match is already live.' });
    }
    const { dateMidnightLocal, timeHHMM } = nearestQuarterLocalParts();
    match.date = dateMidnightLocal;
    match.time = timeHHMM;
    match.homeScore = 0;
    match.awayScore = 0;
    match.homePenalties = null;
    match.awayPenalties = null;
    match.events = [];
    match.eventsSyncedToStats = true;
    match.matchState = 'live';
    match.isPlayed = false;

    if (match.competition === 'league') {
      await updateTeamStats(match, null, null, false);
      match.liveLeagueStatsLastHome = 0;
      match.liveLeagueStatsLastAway = 0;
    } else {
      match.liveLeagueStatsLastHome = null;
      match.liveLeagueStatsLastAway = null;
    }

    await match.save();
    await match.populate('homeTeam', 'name logo');
    await match.populate('awayTeam', 'name logo');
    await logAdminAction(req, 'match_started_live', {
      matchId: match._id,
      competition: match.competition,
      homeTeam: match.homeTeam?.name,
      awayTeam: match.awayTeam?.name,
    });
    res.json(match);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/abandon-live', authenticateAdmin, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Match not found' });
    if (effectiveMatchState(match) !== 'live') {
      return res.status(400).json({ message: 'Only a live match can be abandoned.' });
    }

    const lh = match.liveLeagueStatsLastHome;
    const la = match.liveLeagueStatsLastAway;
    if (match.competition === 'league' && Number.isFinite(lh) && Number.isFinite(la)) {
      await revertTeamStatsOnly(match, lh, la);
    }

    match.matchState = 'scheduled';
    match.isPlayed = false;
    match.homeScore = null;
    match.awayScore = null;
    match.homePenalties = null;
    match.awayPenalties = null;
    match.events = [];
    match.eventsSyncedToStats = true;
    match.liveLeagueStatsLastHome = null;
    match.liveLeagueStatsLastAway = null;
    await match.save();
    await match.populate('homeTeam', 'name logo');
    await match.populate('awayTeam', 'name logo');
    await logAdminAction(req, 'match_abandoned_live', {
      matchId: match._id,
      competition: match.competition,
      homeTeam: match.homeTeam?.name,
      awayTeam: match.awayTeam?.name,
    });
    res.json(match);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/full-time', authenticateAdmin, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Match not found' });
    if (match.isVoided) return res.status(400).json({ message: 'Void fixtures cannot be completed.' });
    if (effectiveMatchState(match) !== 'live') {
      return res.status(400).json({ message: 'Only a live match can be marked full time.' });
    }

    const h = req.body.homeScore !== undefined ? Number(req.body.homeScore) : match.homeScore;
    const a = req.body.awayScore !== undefined ? Number(req.body.awayScore) : match.awayScore;
    if (typeof h !== 'number' || typeof a !== 'number' || Number.isNaN(h) || Number.isNaN(a) || h < 0 || a < 0) {
      return res.status(400).json({ message: 'Valid homeScore and awayScore (numbers ≥ 0) are required for full time.' });
    }

    const oldHomeScore = match.homeScore;
    const oldAwayScore = match.awayScore;
    const wasPlayed = match.isPlayed;
    const leagueLiveH = match.liveLeagueStatsLastHome;
    const leagueLiveA = match.liveLeagueStatsLastAway;

    match.homeScore = h;
    match.awayScore = a;
    if (req.body.homePenalties !== undefined) {
      match.homePenalties = req.body.homePenalties === '' || req.body.homePenalties == null ? null : Number(req.body.homePenalties);
    }
    if (req.body.awayPenalties !== undefined) {
      match.awayPenalties = req.body.awayPenalties === '' || req.body.awayPenalties == null ? null : Number(req.body.awayPenalties);
    }
    match.isPlayed = true;
    match.matchState = 'ft';

    await match.save();
    await match.populate('homeTeam', 'name logo');
    await match.populate('awayTeam', 'name logo');

    if (match.competition === 'league' && match.isPlayed) {
      if (Number.isFinite(leagueLiveH) && Number.isFinite(leagueLiveA)) {
        await updateTeamStats(match, leagueLiveH, leagueLiveA, true);
        match.liveLeagueStatsLastHome = null;
        match.liveLeagueStatsLastAway = null;
        await match.save();
      } else {
        await updateTeamStats(match, oldHomeScore, oldAwayScore, wasPlayed);
      }
    }
    if (match.competition === 'cup' && match.stage === 'semi-final' && match.isPlayed) {
      await updateCupProgression();
    }
    if (match.competition === 'acwpl' && match.isPlayed) {
      await finalizeAcwplIfClinched();
    }
    if (match.competition === 'girls-super-cup' && match.isPlayed) {
      await finalizeGirlsSuperCupIfClosed();
    }

    await logAdminAction(req, 'match_full_time', {
      matchId: match._id,
      competition: match.competition,
      homeTeam: match.homeTeam?.name,
      awayTeam: match.awayTeam?.name,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
    });
    res.json(match);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Record or replace match events for stats aggregation
router.post('/:id/events', authenticateAdmin, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Match not found' });

    const { events } = req.body;
    if (!Array.isArray(events)) return res.status(400).json({ message: 'events array required' });

    /** Live: persist events for user-facing display only; PlayerStats are applied after Full Time. */
    if (effectiveMatchState(match) === 'live') {
      match.events = events;
      match.eventsSyncedToStats = false;
      await match.save();
      const refreshed = await Match.findById(match._id)
        .populate('homeTeam', 'name logo')
        .populate('awayTeam', 'name logo')
        .populate('events.player', 'name number')
        .populate('events.assistPlayer', 'name number');
      await logAdminAction(req, 'match_events_updated', {
        matchId: match._id,
        competition: match.competition,
        eventsCount: events.length,
        live: true,
      });
      return res.json({
        message: 'Match events updated (live display)',
        matchId: match._id,
        eventsCount: events.length,
        match: refreshed,
      });
    }

    // Bucket = match.seasonNumber once set (at fixture generation), not "whatever season is active now"
    let seasonNumber = await resolveSeasonNumberForMatch(match);
    if (seasonNumber == null) {
      let season = await Season.findOne().sort({ seasonNumber: -1 });
      if (!season) {
        const nextSeasonNumber = 1;
        season = new Season({
          seasonNumber: nextSeasonNumber,
          name: `Season ${nextSeasonNumber}`,
          startDate: new Date(),
          endDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
          isActive: true,
        });
        await season.save();
      }
      await syncSeasonActiveFlagsToLatest();
      seasonNumber = season.seasonNumber;
    }
    const pinSeasonOnMatch = match.seasonNumber == null || Number.isNaN(Number(match.seasonNumber));

    const allowedTypes = ['GOAL', 'CLEAN_SHEET', 'YELLOW_CARD', 'RED_CARD'];
    const allowedSides = ['home', 'away'];

    // Team the player represented in this fixture (not Player.team — avoids wrong bucket after transfers)
    const teamIdForMatchSide = (side) => {
      const ref = side === 'home' ? match.homeTeam : match.awayTeam;
      if (!ref) throw new Error('Invalid match team reference');
      return ref instanceof mongoose.Types.ObjectId ? ref : ref._id;
    };

    const toPlayerObjectId = (ref) => {
      if (!ref) return null;
      if (ref instanceof mongoose.Types.ObjectId) return ref;
      if (typeof ref === 'object' && ref._id) return toPlayerObjectId(ref._id);
      const s = String(ref);
      if (!mongoose.Types.ObjectId.isValid(s)) return null;
      return new mongoose.Types.ObjectId(s);
    };

    // Helper to adjust stats for an event (delta=+1 or -1)
    const adjustStatsForEvent = async (ev, delta) => {
      if (!allowedTypes.includes(ev.type)) throw new Error('Invalid event type');
      if (!allowedSides.includes(ev.side)) throw new Error('Invalid event side');
      if (!ev.player) throw new Error('Event must include player');

      const playerOid = toPlayerObjectId(ev.player);
      if (!playerOid) throw new Error('Event must include valid player');

      const competition = match.competition;
      const statsTeamId = teamIdForMatchSide(ev.side);

      if (delta > 0) {
        const player = await Player.findById(playerOid).lean();
        if (!player) throw new Error('Player not found');
      }

      let statsDoc;
      if (delta < 0) {
        statsDoc = await PlayerStats.findOne({
          player: playerOid,
          team: statsTeamId,
          seasonNumber,
          competition,
        });
        if (!statsDoc) return;
      } else {
        statsDoc = await PlayerStats.findOneAndUpdate(
          { player: playerOid, team: statsTeamId, seasonNumber, competition },
          {},
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }

      const clampNonNeg = (n) => Math.max(0, n);
      const update = {};
      if (ev.type === 'GOAL') {
        if (ev.ownGoal) {
          const next = (statsDoc.ownGoals || 0) + delta;
          update.ownGoals = delta < 0 ? clampNonNeg(next) : next;
        } else {
          const nextG = (statsDoc.goals || 0) + delta;
          update.goals = delta < 0 ? clampNonNeg(nextG) : nextG;
          if (ev.assistPlayer) {
            const assistOid = toPlayerObjectId(ev.assistPlayer);
            if (assistOid) {
              if (delta > 0) {
                const assistPlayer = await Player.findById(assistOid).lean();
                if (assistPlayer) {
                  await PlayerStats.findOneAndUpdate(
                    { player: assistOid, team: statsTeamId, seasonNumber, competition },
                    { $inc: { assists: delta } },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                  );
                }
              } else {
                const aDoc = await PlayerStats.findOne({
                  player: assistOid,
                  team: statsTeamId,
                  seasonNumber,
                  competition,
                });
                if (aDoc) {
                  await PlayerStats.updateOne(
                    { _id: aDoc._id },
                    { $set: { assists: clampNonNeg((aDoc.assists || 0) + delta) } }
                  );
                }
              }
            }
          }
        }
      } else if (ev.type === 'CLEAN_SHEET') {
        const next = (statsDoc.cleanSheets || 0) + delta;
        update.cleanSheets = delta < 0 ? clampNonNeg(next) : next;
      } else if (ev.type === 'YELLOW_CARD') {
        const next = (statsDoc.yellowCards || 0) + delta;
        update.yellowCards = delta < 0 ? clampNonNeg(next) : next;
      } else if (ev.type === 'RED_CARD') {
        const next = (statsDoc.redCards || 0) + delta;
        update.redCards = delta < 0 ? clampNonNeg(next) : next;
      }

      await PlayerStats.updateOne({ _id: statsDoc._id }, { $set: update });
    };

    const statsAlreadySynced = match.eventsSyncedToStats !== false;

    // Reverse previous events only if they were already counted toward PlayerStats
    if (statsAlreadySynced) {
      for (const ev of match.events || []) {
        await adjustStatsForEvent(ev, -1);
      }
    }

    // Validate and apply new events
    for (const ev of events) {
      await adjustStatsForEvent(ev, +1);
    }

    match.events = events;
    match.eventsSyncedToStats = true;
    if (pinSeasonOnMatch) {
      match.seasonNumber = seasonNumber;
    }
    await match.save();

    if (match.competition === 'league' && (match.isPlayed || match.matchState === 'ft')) {
      try {
        await finalizeFantasyMatchScoring(match._id);
      } catch (fantasyErr) {
        console.error('Fantasy sync after match events:', fantasyErr);
      }
    }

    await logAdminAction(req, 'match_events_updated', {
      matchId: match._id,
      competition: match.competition,
      eventsCount: events.length,
    });
    res.json({ message: 'Match events updated', matchId: match._id, eventsCount: events.length });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
