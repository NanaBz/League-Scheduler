const mongoose = require('mongoose');
const Team = require('./models/Team');
const Player = require('./models/Player');
const Match = require('./models/Match');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Online MongoDB connection string
const ONLINE_URI = 'mongodb+srv://leaguescheduler:Blacklip%2410@league-scheduler-cluste.q6rqkcl.mongodb.net/league-scheduler?retryWrites=true&w=majority&appName=league-scheduler-cluster';

// Local MongoDB connection string
const LOCAL_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/league-scheduler';

async function migrateData() {
  try {
    console.log('📡 Connecting to ONLINE database...');
    const onlineConn = await mongoose.createConnection(ONLINE_URI).asPromise();
    console.log('✅ Connected to online database');

    console.log('📡 Connecting to LOCAL database...');
    const localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
    console.log('✅ Connected to local database');

    // Get models for both connections
    const OnlineTeam = onlineConn.model('Team', Team.schema);
    const OnlinePlayer = onlineConn.model('Player', Player.schema);
    const OnlineMatch = onlineConn.model('Match', Match.schema);
    const LocalTeam = localConn.model('Team', Team.schema);
    const LocalPlayer = localConn.model('Player', Player.schema);
    const LocalMatch = localConn.model('Match', Match.schema);

    // Fetch all teams from online
    console.log('\n📥 Fetching teams from online database...');
    const onlineTeams = await OnlineTeam.find({}).lean();
    console.log(`Found ${onlineTeams.length} teams`);

    // Fetch all players from online
    console.log('📥 Fetching players from online database...');
    const onlinePlayers = await OnlinePlayer.find({}).lean();
    console.log(`Found ${onlinePlayers.length} players`);

    // Fetch all matches from online
    console.log('📥 Fetching matches from online database...');
    const onlineMatches = await OnlineMatch.find({}).lean();
    console.log(`Found ${onlineMatches.length} matches`);

    // Clear local database
    console.log('\n🗑️  Clearing local database...');
    await LocalPlayer.deleteMany({});
    await LocalMatch.deleteMany({});
    await LocalTeam.deleteMany({});
    console.log('✅ Local database cleared');

    // Insert teams into local database
    console.log('\n📤 Inserting teams into local database...');
    const teamIdMap = {};
    for (const team of onlineTeams) {
      const oldId = team._id.toString();
      delete team._id;
      const newTeam = await LocalTeam.create(team);
      teamIdMap[oldId] = newTeam._id;
      console.log(`  ✓ ${team.name}`);
    }
    console.log(`✅ Inserted ${onlineTeams.length} teams`);

    // Insert players into local database with updated team references
    console.log('\n📤 Inserting players into local database...');
    let playerCount = 0;
    const playerIdMap = {};
    for (const player of onlinePlayers) {
      const oldId = player._id.toString();
      delete player._id;
      // Update team reference to new local team ID
      const oldTeamId = player.team.toString();
      player.team = teamIdMap[oldTeamId];
      if (player.team) {
        const newPlayer = await LocalPlayer.create(player);
        playerIdMap[oldId] = newPlayer._id;
        playerCount++;
      } else {
        console.log(`  ⚠️  Skipping player ${player.name} - team not found`);
      }
    }
    console.log(`✅ Inserted ${playerCount} players`);

    // Insert matches into local database with updated team/player references
    console.log('\n📤 Inserting matches into local database...');
    let matchCount = 0;
    for (const match of onlineMatches) {
      delete match._id;
      
      // Update team references
      if (match.homeTeam && typeof match.homeTeam === 'object') {
        match.homeTeam = teamIdMap[match.homeTeam._id?.toString() || match.homeTeam];
      } else if (match.homeTeam) {
        match.homeTeam = teamIdMap[match.homeTeam.toString()];
      }
      
      if (match.awayTeam && typeof match.awayTeam === 'object') {
        match.awayTeam = teamIdMap[match.awayTeam._id?.toString() || match.awayTeam];
      } else if (match.awayTeam) {
        match.awayTeam = teamIdMap[match.awayTeam.toString()];
      }
      
      // Update player references in events if they exist
      if (match.events && Array.isArray(match.events)) {
        match.events = match.events.map(event => {
          if (event.player && typeof event.player === 'object') {
            event.player = playerIdMap[event.player._id?.toString() || event.player];
          } else if (event.player) {
            event.player = playerIdMap[event.player.toString()];
          }
          
          if (event.assistPlayer && typeof event.assistPlayer === 'object') {
            event.assistPlayer = playerIdMap[event.assistPlayer._id?.toString() || event.assistPlayer];
          } else if (event.assistPlayer) {
            event.assistPlayer = playerIdMap[event.assistPlayer.toString()];
          }
          
          return event;
        });
      }
      
      if (match.homeTeam && match.awayTeam) {
        await LocalMatch.create(match);
        matchCount++;
      } else {
        console.log(`  ⚠️  Skipping match - missing teams`);
      }
    }
    console.log(`✅ Inserted ${matchCount} matches`);

    // Close connections
    await onlineConn.close();
    await localConn.close();

    console.log('\n✨ Migration complete!');
    console.log(`   Teams: ${onlineTeams.length}`);
    console.log(`   Players: ${playerCount}`);
    console.log(`   Matches: ${matchCount}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateData();
