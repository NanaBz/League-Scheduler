const mongoose = require('mongoose');
const Match = require('./models/Match');
const Team = require('./models/Team');

mongoose.connect('mongodb://localhost:27017/league-scheduler')
  .then(async () => {
    console.log('🔍 COMPREHENSIVE FIXTURE VERIFICATION');
    console.log('=====================================\n');
    
    // Get all teams
    const teams = await Team.find({}, 'name');
    console.log(`DEBUG: Found ${teams.length} teams`);
    const teamNames = teams.reduce((acc, team) => {
      acc[team._id.toString()] = team.name;
      return acc;
    }, {});
    
    console.log('📋 TEAMS:');
    teams.forEach((team, index) => {
      console.log(`${index + 1}. ${team.name}`);
    });
    console.log('');
    
    // Get all league matches
    const matches = await Match.find({ competition: 'league' })
      .populate('homeTeam', 'name')
      .populate('awayTeam', 'name')
      .sort({ matchweek: 1, date: 1 });
    
    console.log(`DEBUG: Found ${matches.length} matches`);
    console.log(`📊 TOTAL MATCHES: ${matches.length} (Expected: 30)\n`);
    
    // Group by matchweek
    const weekData = {};
    matches.forEach(match => {
      if (!weekData[match.matchweek]) {
        weekData[match.matchweek] = [];
      }
      weekData[match.matchweek].push({
        home: match.homeTeam.name,
        away: match.awayTeam.name,
        fixture: `${match.homeTeam.name} vs ${match.awayTeam.name}`
      });
    });
    
    console.log('📅 FIXTURES BY MATCHWEEK:');
    Object.keys(weekData).forEach(week => {
      const round = week <= 5 ? 'Round 1' : 'Round 2';
      console.log(`MW${week} (${round}): ${weekData[week].map(m => m.fixture).join(', ')}`);
    });
    console.log('');
    
    // Verification 1: Check for duplicates within each round
    console.log('🔍 VERIFICATION 1: DUPLICATES WITHIN ROUNDS');
    const firstRoundFixtures = new Set();
    const secondRoundFixtures = new Set();
    let duplicatesFound = false;
    
    matches.forEach(match => {
      const fixture = `${match.homeTeam.name}-${match.awayTeam.name}`;
      const reverseFixture = `${match.awayTeam.name}-${match.homeTeam.name}`;
      
      if (match.matchweek <= 5) {
        if (firstRoundFixtures.has(fixture) || firstRoundFixtures.has(reverseFixture)) {
          console.log(`❌ DUPLICATE in Round 1 (MW1-5): ${fixture}`);
          duplicatesFound = true;
        }
        firstRoundFixtures.add(fixture);
      } else {
        if (secondRoundFixtures.has(fixture) || secondRoundFixtures.has(reverseFixture)) {
          console.log(`❌ DUPLICATE in Round 2 (MW6-10): ${fixture}`);
          duplicatesFound = true;
        }
        secondRoundFixtures.add(fixture);
      }
    });
    
    if (!duplicatesFound) {
      console.log('✅ No duplicates found within each round - PERFECT!');
    }
    
    console.log(`Round 1 unique fixtures: ${firstRoundFixtures.size} (Expected: 15)`);
    console.log(`Round 2 unique fixtures: ${secondRoundFixtures.size} (Expected: 15)`);
    console.log('');
    
    // Verification 2: Check home/away reversal between rounds
    console.log('🔍 VERIFICATION 2: HOME/AWAY REVERSAL BETWEEN ROUNDS');
    const firstRoundArray = Array.from(firstRoundFixtures);
    const secondRoundArray = Array.from(secondRoundFixtures);
    
    let reversalCorrect = true;
    let reversalCount = 0;
    
    firstRoundArray.forEach(fixture => {
      const [home, away] = fixture.split('-');
      const reverseFixture = `${away}-${home}`;
      if (secondRoundArray.includes(reverseFixture)) {
        reversalCount++;
      } else {
        console.log(`❌ Missing reverse fixture: ${reverseFixture} (original: ${fixture})`);
        reversalCorrect = false;
      }
    });
    
    if (reversalCorrect) {
      console.log(`✅ Home/away reversal between rounds is PERFECT! (${reversalCount}/15 fixtures correctly reversed)`);
    }
    console.log('');
    
    // Verification 3: Check that each team plays every other team exactly twice
    console.log('🔍 VERIFICATION 3: EACH TEAM PLAYS EVERY OTHER TEAM EXACTLY TWICE');
    const teamFixtures = {};
    
    // Initialize
    teams.forEach(team1 => {
      teamFixtures[team1.name] = {};
      teams.forEach(team2 => {
        if (team1.name !== team2.name) {
          teamFixtures[team1.name][team2.name] = { total: 0, home: 0, away: 0 };
        }
      });
    });
    
    // Count fixtures
    matches.forEach(match => {
      const home = match.homeTeam.name;
      const away = match.awayTeam.name;
      
      teamFixtures[home][away].total++;
      teamFixtures[home][away].home++;
      teamFixtures[away][home].total++;
      teamFixtures[away][home].away++;
    });
    
    let allCorrect = true;
    teams.forEach(team1 => {
      teams.forEach(team2 => {
        if (team1.name !== team2.name) {
          const fixture = teamFixtures[team1.name][team2.name];
          if (fixture.total !== 2) {
            console.log(`❌ ${team1.name} vs ${team2.name}: ${fixture.total} matches (Expected: 2)`);
            allCorrect = false;
          } else if (fixture.home !== 1 || fixture.away !== 1) {
            console.log(`❌ ${team1.name} vs ${team2.name}: Home=${fixture.home}, Away=${fixture.away} (Expected: Home=1, Away=1)`);
            allCorrect = false;
          }
        }
      });
    });
    
    if (allCorrect) {
      console.log('✅ Each team plays every other team exactly twice (once home, once away) - PERFECT!');
    }
    console.log('');
    
    // Verification 4: Check that no team plays twice in the same week
    console.log('🔍 VERIFICATION 4: NO TEAM PLAYS TWICE IN SAME WEEK');
    let weeklyConflicts = false;
    
    Object.keys(weekData).forEach(week => {
      const teamsThisWeek = new Set();
      weekData[week].forEach(match => {
        if (teamsThisWeek.has(match.home)) {
          console.log(`❌ MW${week}: ${match.home} plays twice in same week!`);
          weeklyConflicts = true;
        }
        if (teamsThisWeek.has(match.away)) {
          console.log(`❌ MW${week}: ${match.away} plays twice in same week!`);
          weeklyConflicts = true;
        }
        teamsThisWeek.add(match.home);
        teamsThisWeek.add(match.away);
      });
    });
    
    if (!weeklyConflicts) {
      console.log('✅ No team plays twice in the same week - PERFECT!');
    }
    console.log('');
    
    // Final Summary
    console.log('🏆 FINAL VERIFICATION SUMMARY:');
    console.log('==============================');
    
    const allVerificationsPassed = !duplicatesFound && reversalCorrect && allCorrect && !weeklyConflicts;
    
    if (allVerificationsPassed) {
      console.log('🎉 ALL VERIFICATIONS PASSED! 🎉');
      console.log('✅ Double round-robin logic is PERFECTLY implemented!');
      console.log('✅ No duplicate fixtures within rounds');
      console.log('✅ Proper home/away reversal between rounds');
      console.log('✅ Each team plays every other team exactly twice');
      console.log('✅ No scheduling conflicts within weeks');
    } else {
      console.log('❌ SOME VERIFICATIONS FAILED - NEEDS FIXING!');
    }
    
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
