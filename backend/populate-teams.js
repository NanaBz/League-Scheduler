const mongoose = require('mongoose');
const Team = require('./models/Team');
const Player = require('./models/Player');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const teamsData = [
  {
    name: 'Dragons',
    competition: 'league',
    logo: '/logos/dragons-logo.png',
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: []
  },
  {
    name: 'Vikings',
    competition: 'league',
    logo: '/logos/vikings-logo.png',
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: []
  },
  {
    name: 'Warriors',
    competition: 'league',
    logo: '/logos/warriors-logo.png',
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: []
  },
  {
    name: 'Elites',
    competition: 'league',
    logo: '/logos/elites-logo.png',
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: []
  },
  {
    name: 'Falcons',
    competition: 'league',
    logo: '/logos/falcons-logo.png',
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: []
  },
  {
    name: 'Lions',
    competition: 'league',
    logo: '/logos/lions-logo.png',
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: []
  },
  {
    name: 'Orion',
    competition: 'acwpl',
    logo: '/logos/orion-logo.png',
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: []
  },
  {
    name: 'Firestorm',
    competition: 'acwpl',
    logo: '/logos/firestorm-logo.png',
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: []
  }
];

const playersData = [
  // Dragons
  { number: 1, name: 'Dragon Keeper', position: 'GK', teamName: 'Dragons' },
  { number: 7, name: 'Dragon Striker', position: 'ATT', teamName: 'Dragons' },
  { number: 10, name: 'Dragon Captain', position: 'MF', teamName: 'Dragons', isCaptain: true },
  { number: 9, name: 'Dragon Forward', position: 'ATT', teamName: 'Dragons' },
  { number: 5, name: 'Dragon Defender', position: 'DF', teamName: 'Dragons' },
  
  // Vikings
  { number: 1, name: 'Viking Guardian', position: 'GK', teamName: 'Vikings' },
  { number: 7, name: 'Viking Warrior', position: 'ATT', teamName: 'Vikings' },
  { number: 10, name: 'Viking Leader', position: 'MF', teamName: 'Vikings', isCaptain: true },
  { number: 9, name: 'Viking Axeman', position: 'ATT', teamName: 'Vikings' },
  { number: 5, name: 'Viking Raider', position: 'DF', teamName: 'Vikings' },
  
  // Warriors
  { number: 1, name: 'Warrior Protector', position: 'GK', teamName: 'Warriors' },
  { number: 7, name: 'Warrior Elite', position: 'ATT', teamName: 'Warriors' },
  { number: 10, name: 'Warrior Chief', position: 'MF', teamName: 'Warriors', isCaptain: true },
  { number: 9, name: 'Warrior Champion', position: 'ATT', teamName: 'Warriors' },
  { number: 5, name: 'Warrior Brave', position: 'DF', teamName: 'Warriors' },
  
  // Elites
  { number: 1, name: 'Elite Sentinel', position: 'GK', teamName: 'Elites' },
  { number: 7, name: 'Elite Ace', position: 'ATT', teamName: 'Elites' },
  { number: 10, name: 'Elite Maestro', position: 'MF', teamName: 'Elites', isCaptain: true },
  { number: 9, name: 'Elite Sharpshooter', position: 'ATT', teamName: 'Elites' },
  { number: 5, name: 'Elite Guard', position: 'DF', teamName: 'Elites' },
  
  // Falcons
  { number: 1, name: 'Falcon Watch', position: 'GK', teamName: 'Falcons' },
  { number: 7, name: 'Falcon Speedster', position: 'ATT', teamName: 'Falcons' },
  { number: 10, name: 'Falcon Scout', position: 'MF', teamName: 'Falcons', isCaptain: true },
  { number: 9, name: 'Falcon Flyer', position: 'ATT', teamName: 'Falcons' },
  { number: 5, name: 'Falcon Talon', position: 'DF', teamName: 'Falcons' },
  
  // Lions
  { number: 1, name: 'Lion Guard', position: 'GK', teamName: 'Lions' },
  { number: 7, name: 'Lion Pride', position: 'ATT', teamName: 'Lions' },
  { number: 10, name: 'Lion King', position: 'MF', teamName: 'Lions', isCaptain: true },
  { number: 9, name: 'Lion Roar', position: 'ATT', teamName: 'Lions' },
  { number: 5, name: 'Lion Claw', position: 'DF', teamName: 'Lions' },
  
  // Orion
  { number: 1, name: 'Orion Shield', position: 'GK', teamName: 'Orion' },
  { number: 7, name: 'Orion Star', position: 'ATT', teamName: 'Orion' },
  { number: 10, name: 'Orion Hunter', position: 'MF', teamName: 'Orion', isCaptain: true },
  { number: 9, name: 'Orion Striker', position: 'ATT', teamName: 'Orion' },
  { number: 5, name: 'Orion Guard', position: 'DF', teamName: 'Orion' },
  
  // Firestorm
  { number: 1, name: 'Storm Guard', position: 'GK', teamName: 'Firestorm' },
  { number: 7, name: 'Storm Blaze', position: 'ATT', teamName: 'Firestorm' },
  { number: 10, name: 'Storm Leader', position: 'MF', teamName: 'Firestorm', isCaptain: true },
  { number: 9, name: 'Storm Fire', position: 'ATT', teamName: 'Firestorm' },
  { number: 5, name: 'Storm Shield', position: 'DF', teamName: 'Firestorm' }
];

async function populateDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/league-scheduler');
    console.log('✅ Connected to MongoDB');

    // Clear existing teams and players
    await Team.deleteMany({});
    await Player.deleteMany({});
    console.log('🗑️  Cleared existing teams and players');

    // Insert teams
    const insertedTeams = await Team.insertMany(teamsData);
    console.log(`✅ Inserted ${insertedTeams.length} teams`);

    // Insert players with team references
    const playersWithTeamIds = playersData.map((playerData) => {
      const team = insertedTeams.find(t => t.name === playerData.teamName);
      return {
        name: playerData.name,
        number: playerData.number,
        position: playerData.position,
        team: team._id,
        isCaptain: playerData.isCaptain || false,
        isViceCaptain: playerData.isViceCaptain || false,
        active: true
      };
    });

    const insertedPlayers = await Player.insertMany(playersWithTeamIds);
    console.log(`✅ Inserted ${insertedPlayers.length} players`);

    console.log('\n✨ Database population complete!');
    console.log(`Teams: ${insertedTeams.length}`);
    console.log(`Players: ${insertedPlayers.length}`);

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error populating database:', error);
    process.exit(1);
  }
}

populateDatabase();
