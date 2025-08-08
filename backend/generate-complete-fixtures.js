const mongoose = require('mongoose');
const Match = require('./models/Match');
const Team = require('./models/Team');

mongoose.connect('mongodb://localhost:27017/league-scheduler')
  .then(async () => {
    console.log('🔗 Connected to MongoDB');
    
    // Clear existing matches
    await Match.deleteMany({ competition: 'league' });
    console.log('🗑️ Cleared existing league matches');
    
    // Get all teams
    const teams = await Team.find().sort({ _id: 1 });
    const teamIds = teams.map(team => team._id);
    
    console.log('📋 Teams:', teams.map(t => t.name));
    
    // 🎯 CIRCLE METHOD - Complete Implementation
    function generateCircleMethodSchedule(teamIds) {
      const teamsArray = [...teamIds]; // Copy the array
      const n = teamsArray.length; // Should be 6
      const half = n / 2; // Should be 3
      const rounds = n - 1; // Should be 5
      const firstRoundFixtures = [];
      
      // Round 1 (first leg)
      const team_list = teamsArray.slice(0, -1); // All except last
      const fixed = teamsArray[teamsArray.length - 1]; // Last team
      
      console.log('🔄 Circle Method - Fixed team:', teams.find(t => t._id.equals(fixed)).name);
      
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
        
        firstRoundFixtures.push(matchweek);
        console.log(`Round ${round + 1}: ${matchweek.length} matches`);
        
        // Rotate clockwise (except fixed team)
        const lastTeam = team_list.pop(); // Remove last
        team_list.unshift(lastTeam); // Add to beginning
      }
      
      // Generate second round by reversing home/away
      const secondRoundFixtures = firstRoundFixtures.map(round => 
        round.map(([home, away]) => [away, home])
      );
      
      return { 
        firstRoundSchedule: firstRoundFixtures, 
        secondRoundSchedule: secondRoundFixtures 
      };
    }
    
    // Generate complete schedule
    const { firstRoundSchedule, secondRoundSchedule } = generateCircleMethodSchedule(teamIds);
    
    console.log('\n🎯 GENERATING COMPLETE DOUBLE ROUND-ROBIN:');
    console.log(`✅ First round: ${firstRoundSchedule.length} rounds`);
    console.log(`✅ Second round: ${secondRoundSchedule.length} rounds`);
    
    // Combine both rounds
    const fullSchedule = [...firstRoundSchedule, ...secondRoundSchedule];
    
    // Create match documents
    const fixtures = [];
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
    
    // Save all fixtures
    await Match.insertMany(fixtures);
    
    console.log(`\n🎉 SUCCESS: Generated ${fixtures.length} fixtures!`);
    console.log(`📊 Expected: 30 matches (15 per round × 2 rounds)`);
    console.log(`📅 Matchweeks: ${fullSchedule.length} (5 first round + 5 second round)`);
    console.log(`⚽ Matches per week: ${fixtures.length / fullSchedule.length}`);
    
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
