const express = require('express');
const router = express.Router();
const Season = require('../models/Season');
const Team = require('../models/Team');
const Match = require('../models/Match');

// Get all seasons
router.get('/', async (req, res) => {
  try {
    const seasons = await Season.find()
      .populate('winners.league', 'name logo')
      .populate('winners.cup', 'name logo')
      .populate('winners.superCup', 'name logo')
      .sort({ seasonNumber: -1 });
    res.json(seasons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get specific season details
router.get('/:seasonNumber', async (req, res) => {
  try {
    const season = await Season.findOne({ seasonNumber: req.params.seasonNumber })
      .populate('finalStandings.team', 'name logo')
      .populate('matches.homeTeam', 'name logo')
      .populate('matches.awayTeam', 'name logo')
      .populate('winners.league', 'name logo')
      .populate('winners.cup', 'name logo')
      .populate('winners.superCup', 'name logo');
    
    if (!season) {
      return res.status(404).json({ message: 'Season not found' });
    }
    
    // Add debugging to check the populated data
    console.log(`📊 Season ${season.seasonNumber} data check:`);
    console.log('- finalStandings length:', season.finalStandings?.length);
    console.log('- teams array length:', season.teams?.length);
    
    if (season.finalStandings?.length > 0) {
      season.finalStandings.forEach((standing, index) => {
        console.log(`  Position ${standing.position}: team=${standing.team?.name || 'NOT_POPULATED'}, teamId=${standing.team?._id || standing.team}`);
      });
    }
    
    res.json(season);
  } catch (error) {
    console.error('Error fetching season details:', error);
    res.status(500).json({ message: error.message });
  }
});

// Archive current season and start new one
router.post('/reset', async (req, res) => {
  try {
    // Get current season number (highest + 1)
    const lastSeason = await Season.findOne().sort({ seasonNumber: -1 });
    const nextSeasonNumber = lastSeason ? lastSeason.seasonNumber + 1 : 1;
    
    console.log('Last season number:', lastSeason?.seasonNumber);
    console.log('Next season number to create:', nextSeasonNumber);
    
    // Check if this season number already exists
    const existingSeason = await Season.findOne({ seasonNumber: nextSeasonNumber });
    if (existingSeason) {
      console.log('❌ Duplicate season detected:', nextSeasonNumber);
      
      // Try to delete existing season and continue
      await Season.deleteOne({ seasonNumber: nextSeasonNumber });
      console.log('🗑️ Deleted existing duplicate season:', nextSeasonNumber);
    }
    
    // Get all current data
    const teams = await Team.find().sort({ points: -1, goalDifference: -1, goalsFor: -1 });
    const matches = await Match.find()
      .populate('homeTeam', 'name logo')
      .populate('awayTeam', 'name logo');
    
    console.log('Found teams:', teams.length);
    console.log('Found matches:', matches.length);
    
    // Debug: Show all teams with their current stats
    console.log('📊 Current team standings from database:');
    teams.forEach((team, index) => {
      console.log(`${index + 1}. ${team.name}: ${team.points} pts (${team.won}W-${team.drawn}D-${team.lost}L, GD: ${team.goalDifference}) - ID: ${team._id}`);
    });
    
    // SPECIFIC DEBUG: Track Dragons and Falcons data corruption
    console.log('🐉🦅 DRAGONS/FALCONS DEBUG - Original database data:');
    const dragonsTeam = teams.find(t => t.name.toLowerCase().includes('dragon'));
    const falconsTeam = teams.find(t => t.name.toLowerCase().includes('falcon'));
    
    if (dragonsTeam) {
      console.log(`🐉 DRAGONS ORIGINAL: Name="${dragonsTeam.name}", ID="${dragonsTeam._id}", Logo="${dragonsTeam.logo}", Points=${dragonsTeam.points}`);
    }
    if (falconsTeam) {
      console.log(`🦅 FALCONS ORIGINAL: Name="${falconsTeam.name}", ID="${falconsTeam._id}", Logo="${falconsTeam.logo}", Points=${falconsTeam.points}`);
    }
    
    // Check for duplicate team names
    const teamNames = teams.map(t => t.name);
    const duplicateNames = teamNames.filter((name, index) => teamNames.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
      console.log('🚨 DUPLICATE TEAM NAMES FOUND:', duplicateNames);
    }
    
    // Verify the actual sorting is working correctly
    const sortedTeams = [...teams].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });
    
    console.log('🔄 Re-sorted teams for verification:');
    sortedTeams.forEach((team, index) => {
      console.log(`${index + 1}. ${team.name}: ${team.points} pts (${team.won}W-${team.drawn}D-${team.lost}L, GD: ${team.goalDifference}) - ID: ${team._id}`);
    });
    
    // SPECIFIC DEBUG: Track Dragons and Falcons after sorting
    console.log('🐉🦅 DRAGONS/FALCONS DEBUG - After sorting:');
    const sortedDragons = sortedTeams.find(t => t.name.toLowerCase().includes('dragon'));
    const sortedFalcons = sortedTeams.find(t => t.name.toLowerCase().includes('falcon'));
    
    if (sortedDragons) {
      console.log(`🐉 DRAGONS SORTED: Name="${sortedDragons.name}", ID="${sortedDragons._id}", Logo="${sortedDragons.logo}", Points=${sortedDragons.points}`);
    }
    if (sortedFalcons) {
      console.log(`🦅 FALCONS SORTED: Name="${sortedFalcons.name}", ID="${sortedFalcons._id}", Logo="${sortedFalcons.logo}", Points=${sortedFalcons.points}`);
    }
    
    // Only proceed if there's data to archive
    if (teams.length === 0) {
      return res.status(400).json({ message: 'No season data to archive' });
    }
    
    // Determine winners
    const leagueWinner = teams[0]; // Top team in standings
    console.log('🏆 League winner should be:', leagueWinner?.name, 'with', leagueWinner?.points, 'points');
    console.log('📊 All teams order:', teams.map(t => `${t.name}(${t.points}pts)`));
    
    // Find cup winner
    let cupWinner = null;
    try {
      const cupFinal = await Match.findOne({ 
        competition: 'cup', 
        stage: 'final', 
        isPlayed: true 
      });
      
      console.log('🏆 Cup final match:', cupFinal ? `${cupFinal.homeTeam?.name || cupFinal.homeTeam} vs ${cupFinal.awayTeam?.name || cupFinal.awayTeam}` : 'Not found');
      
      if (cupFinal) {
        if (cupFinal.homeScore > cupFinal.awayScore) {
          cupWinner = await Team.findById(cupFinal.homeTeam);
        } else if (cupFinal.awayScore > cupFinal.homeScore) {
          cupWinner = await Team.findById(cupFinal.awayTeam);
        } else {
          // Check penalties
          if (cupFinal.homePenalties > cupFinal.awayPenalties) {
            cupWinner = await Team.findById(cupFinal.homeTeam);
          } else if (cupFinal.awayPenalties > cupFinal.homePenalties) {
            cupWinner = await Team.findById(cupFinal.awayTeam);
          }
        }
      }
      console.log('🏆 Cup winner determined:', cupWinner?.name || 'None');
    } catch (error) {
      console.log('Error finding cup winner:', error);
    }

    // Find super cup winner
    let superCupWinner = null;
    try {
      const superCupMatch = await Match.findOne({ 
        competition: 'super-cup', 
        isPlayed: true 
      });
      
      console.log('🏆 Super Cup match:', superCupMatch ? `${superCupMatch.homeTeam?.name || superCupMatch.homeTeam} vs ${superCupMatch.awayTeam?.name || superCupMatch.awayTeam}` : 'Not found');
      
      if (superCupMatch) {
        if (superCupMatch.homeScore > superCupMatch.awayScore) {
          superCupWinner = await Team.findById(superCupMatch.homeTeam);
        } else if (superCupMatch.awayScore > superCupMatch.homeScore) {
          superCupWinner = await Team.findById(superCupMatch.awayTeam);
        } else {
          // Check penalties
          if (superCupMatch.homePenalties > superCupMatch.awayPenalties) {
            superCupWinner = await Team.findById(superCupMatch.homeTeam);
          } else if (superCupMatch.awayPenalties > superCupMatch.homePenalties) {
            superCupWinner = await Team.findById(superCupMatch.awayTeam);
          }
        }
      }
      console.log('🏆 Super Cup winner determined:', superCupWinner?.name || 'None');
    } catch (error) {
      console.log('Error finding super cup winner:', error);
    }

    // Create archived season
    console.log('Creating archived season with data:');
    console.log('- League winner:', leagueWinner?.name);
    console.log('- Cup winner:', cupWinner?.name);
    console.log('- Super Cup winner:', superCupWinner?.name);
    
    // Use the re-sorted teams for accurate final standings
    const finalTeams = sortedTeams.length > 0 ? sortedTeams : teams;
    
    console.log('💾 Final teams being saved to archive:');
    finalTeams.forEach((team, index) => {
      console.log(`  ${index + 1}. ${team.name} (ID: ${team._id}) - ${team.points} pts`);
    });
    
    // SPECIFIC DEBUG: Track Dragons and Falcons in final archive data
    console.log('🐉🦅 DRAGONS/FALCONS DEBUG - Final archive data:');
    const finalDragons = finalTeams.find(t => t.name.toLowerCase().includes('dragon'));
    const finalFalcons = finalTeams.find(t => t.name.toLowerCase().includes('falcon'));
    
    if (finalDragons) {
      console.log(`🐉 DRAGONS FINAL: Name="${finalDragons.name}", ID="${finalDragons._id}", Logo="${finalDragons.logo}", Points=${finalDragons.points}`);
    }
    if (finalFalcons) {
      console.log(`🦅 FALCONS FINAL: Name="${finalFalcons.name}", ID="${finalFalcons._id}", Logo="${finalFalcons.logo}", Points=${finalFalcons.points}`);
    }
    
    const archivedSeason = new Season({
      seasonNumber: nextSeasonNumber,
      name: `Season ${nextSeasonNumber}`,
      startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Approximate start date
      endDate: new Date(),
      isActive: false,
      finalStandings: finalTeams.map((team, index) => {
        const standingEntry = {
          team: team._id, // Store ObjectId reference, not embedded object
          position: index + 1,
          played: team.played,
          won: team.won,
          drawn: team.drawn,
          lost: team.lost,
          goalsFor: team.goalsFor,
          goalsAgainst: team.goalsAgainst,
          goalDifference: team.goalDifference,
          points: team.points,
          form: team.form || []
        };
        
        // SPECIFIC DEBUG: Log Dragons and Falcons mapping
        if (team.name.toLowerCase().includes('dragon') || team.name.toLowerCase().includes('falcon')) {
          console.log(`🔄 MAPPING ${team.name.toUpperCase()}: Original={Name:"${team.name}", ID:"${team._id}", Logo:"${team.logo}"} → Archive={TeamRef:"${standingEntry.team}", Position:${standingEntry.position}}`);
        }
        
        return standingEntry;
      }),
      // Store embedded team data for easy access
      teams: finalTeams.map(team => ({
        _id: team._id,
        name: team.name,
        logo: team.logo
      })),
      
    });
    
    // DEBUG: Log the teams array being saved
    console.log('🏗️ Teams array being saved to archive:');
    archivedSeason.teams.forEach((team, index) => {
      console.log(`  ${index + 1}. ID: ${team._id}, Name: ${team.name}, Logo: ${team.logo}`);
    });

    // Add the rest of the season data
    archivedSeason.winners = {
      league: leagueWinner?._id,
      cup: cupWinner?._id,
      superCup: superCupWinner?._id
    };
    
    archivedSeason.matches = matches.map(match => ({
      _id: match._id,
      homeTeam: match.homeTeam._id, // Store ObjectId reference
      awayTeam: match.awayTeam._id,  // Store ObjectId reference
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      homePenalties: match.homePenalties,
      awayPenalties: match.awayPenalties,
      date: match.date,
      time: match.time,
      matchweek: match.matchweek,
      competition: match.competition,
      stage: match.stage,
      isPlayed: match.isPlayed
    }));

    // Save archived season
    console.log('Saving archived season...');
    await archivedSeason.save();
    console.log('Archived season saved successfully');

    // Reset current season data
    console.log('Resetting team data...');
    await Team.updateMany({}, {
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: []
    });

    // Delete all matches
    console.log('Deleting matches...');
    await Match.deleteMany({});

    res.json({ 
      message: 'Season reset successfully', 
      archivedSeason: nextSeasonNumber,
      nextSeason: nextSeasonNumber + 1
    });
  } catch (error) {
    console.error('Error resetting season:', error);
    res.status(500).json({ message: error.message });
  }
});

// Utility route to clean up duplicate seasons (for debugging)
router.delete('/cleanup-duplicates', async (req, res) => {
  try {
    const seasons = await Season.find().sort({ seasonNumber: 1, createdAt: 1 });
    const seenNumbers = new Set();
    const duplicatesToDelete = [];
    
    for (const season of seasons) {
      if (seenNumbers.has(season.seasonNumber)) {
        duplicatesToDelete.push(season._id);
      } else {
        seenNumbers.add(season.seasonNumber);
      }
    }
    
    if (duplicatesToDelete.length > 0) {
      await Season.deleteMany({ _id: { $in: duplicatesToDelete } });
      res.json({ 
        message: `Cleaned up ${duplicatesToDelete.length} duplicate seasons`,
        deletedSeasons: duplicatesToDelete.length
      });
    } else {
      res.json({ message: 'No duplicate seasons found' });
    }
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete a specific season (admin feature)
router.delete('/:seasonNumber', async (req, res) => {
  try {
    const seasonNumber = parseInt(req.params.seasonNumber);
    
    console.log(`🗑️ Admin request to delete Season ${seasonNumber}`);
    
    const seasonToDelete = await Season.findOne({ seasonNumber });
    
    if (!seasonToDelete) {
      return res.status(404).json({ message: `Season ${seasonNumber} not found` });
    }
    
    // Delete the season
    await Season.deleteOne({ seasonNumber });
    
    console.log(`✅ Successfully deleted Season ${seasonNumber}`);
    
    res.json({ 
      message: `Season ${seasonNumber} deleted successfully`,
      deletedSeason: seasonNumber
    });
  } catch (error) {
    console.error('Error deleting season:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete all seasons (admin feature for complete reset)
router.delete('/', async (req, res) => {
  try {
    console.log('🗑️ Admin request to delete ALL seasons');
    
    const result = await Season.deleteMany({});
    
    console.log(`✅ Successfully deleted ${result.deletedCount} seasons`);
    
    res.json({ 
      message: `All seasons deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting all seasons:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
