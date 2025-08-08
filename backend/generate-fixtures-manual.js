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
    const teams = await Team.find();
    if (teams.length !== 6) {
      console.log('❌ Exactly 6 teams required for league');
      return;
    }

    const fixtures = [];
    const teamIds = teams.map(team => team._id);
    
    // 🎯 CIRCLE METHOD - Corrected Implementation
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
      const team_list = teams.slice(0, -1); // All except last
      const fixed = teams[teams.length - 1]; // Last team
      
      console.log('🔀 Teams shuffled for unique fixture generation');
      console.log('🔄 Circle Method - Fixed team index:', teams.indexOf(fixed), 'Rotating teams:', team_list.length);
      
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
        const lastTeam = team_list.pop();
        team_list.unshift(lastTeam);
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
      
      console.log('🔀 Shuffled second round to avoid mirror pattern');
      
      return { 
        firstRoundSchedule: fixtures, 
        secondRoundSchedule: shuffledSecondRound 
      };
    }
    
    // Generate fixtures
    const { firstRoundSchedule, secondRoundSchedule } = generateCircleMethodSchedule(teamIds);
    
    console.log('✅ Circle Method - First round weeks:', firstRoundSchedule.length);
    console.log('✅ Circle Method - Second round weeks:', secondRoundSchedule.length);
    
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
    
    console.log(`\n🎯 League fixtures generated with CIRCLE METHOD (Round Robin Algorithm)`);
    console.log(`📊 Total matches: ${fixtures.length}`);
    console.log(`📅 Matchweeks: ${fullSchedule.length}`);
    console.log(`⚽ Games per week: ${fixtures.length / fullSchedule.length}`);
    
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
