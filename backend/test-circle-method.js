const mongoose = require('mongoose');
const Match = require('./models/Match');
const Team = require('./models/Team');

mongoose.connect('mongodb://localhost:27017/league-scheduler')
  .then(async () => {
    console.log('🔗 Connected to MongoDB');
    
    // Get all teams
    const teams = await Team.find().sort({ _id: 1 });
    const teamIds = teams.map(team => team._id);
    
    console.log('📋 Teams:', teams.map(t => t.name));
    console.log('🔢 Team IDs:', teamIds);
    
    // 🎯 CIRCLE METHOD - Using Exact Pseudocode
    function generateCircleMethodSchedule(teamIds) {
      const teams = [...teamIds]; // Copy the array
      const n = teams.length; // Should be 6
      const half = n / 2; // Should be 3
      const rounds = n - 1; // Should be 5
      const fixtures = [];
      
      // Round 1 (first leg)
      const team_list = teams.slice(0, -1); // All except last [0,1,2,3,4]
      const fixed = teams[teams.length - 1]; // Last team [5]
      
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
        console.log(`Round ${round + 1}: ${matchweek.length} matches`);
        
        // Rotate clockwise (except fixed team)
        const lastTeam = team_list.pop(); // Remove last
        team_list.unshift(lastTeam); // Add to beginning
      }
      
      return fixtures;
    }
    
    // Generate first round only for testing
    const firstRound = generateCircleMethodSchedule(teamIds);
    
    console.log('\n🎯 FIRST ROUND SCHEDULE:');
    firstRound.forEach((round, index) => {
      console.log(`Round ${index + 1}:`, round.length, 'matches');
      round.forEach(([home, away], matchIndex) => {
        const homeTeam = teams.find(t => t._id.equals(home));
        const awayTeam = teams.find(t => t._id.equals(away));
        console.log(`  Match ${matchIndex + 1}: ${homeTeam.name} vs ${awayTeam.name}`);
      });
    });
    
    const totalMatches = firstRound.reduce((sum, round) => sum + round.length, 0);
    console.log(`\n📊 TOTAL FIRST ROUND MATCHES: ${totalMatches} (Expected: 15)`);
    console.log(`📅 ROUNDS: ${firstRound.length} (Expected: 5)`);
    console.log(`⚽ MATCHES PER ROUND: ${totalMatches / firstRound.length} (Expected: 3)`);
    
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
