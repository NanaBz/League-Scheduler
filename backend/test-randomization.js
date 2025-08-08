const mongoose = require('mongoose');
const Team = require('./models/Team');

mongoose.connect('mongodb://localhost:27017/league-scheduler')
  .then(async () => {
    console.log('🔗 Testing Randomized Circle Method');
    console.log('=====================================\n');
    
    const teams = await Team.find();
    const teamIds = teams.map(team => team._id);
    const teamNames = teams.map(team => team.name);
    
    console.log('Original team order:', teamNames);
    console.log('');
    
    // Test 3 different randomizations
    for (let test = 1; test <= 3; test++) {
      console.log(`🎲 Test ${test}:`);
      
      // Shuffle teams
      const shuffledTeams = [...teamIds];
      for (let i = shuffledTeams.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledTeams[i], shuffledTeams[j]] = [shuffledTeams[j], shuffledTeams[i]];
      }
      
      // Show shuffled order
      const shuffledNames = shuffledTeams.map(id => 
        teams.find(t => t._id.equals(id)).name
      );
      console.log('Shuffled order:', shuffledNames);
      
      // Generate first matchweek with this order
      const team_list = shuffledTeams.slice(0, -1);
      const fixed = shuffledTeams[shuffledTeams.length - 1];
      
      const matchweek = [];
      matchweek.push([team_list[0], fixed]);
      
      for (let i = 1; i < 3; i++) {
        const home = team_list[i];
        const away = team_list[team_list.length - i];
        matchweek.push([home, away]);
      }
      
      // Convert back to names for display
      const mw1Fixtures = matchweek.map(([homeId, awayId]) => {
        const homeName = teams.find(t => t._id.equals(homeId)).name;
        const awayName = teams.find(t => t._id.equals(awayId)).name;
        return `${homeName} vs ${awayName}`;
      });
      
      console.log('MW1 fixtures:', mw1Fixtures.join(', '));
      console.log('');
    }
    
    console.log('🎯 As you can see, each generation produces different MW1 fixtures!');
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
