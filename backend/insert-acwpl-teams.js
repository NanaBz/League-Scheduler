const mongoose = require('mongoose');
const Team = require('./models/Team');

const teams = [
  {
    name: 'Orion',
    competition: 'acwpl',
    category: 'girls',
    logo: '/logos/Orion.png'
  },
  {
    name: 'Firestorm',
    competition: 'acwpl',
    category: 'girls',
    logo: '/logos/Firestorm.png'
  }
];

async function insertTeams() {
  await mongoose.connect('mongodb://localhost:27017/league-scheduler');
  for (const team of teams) {
    await Team.updateOne(
      { name: team.name },
      { $set: team },
      { upsert: true }
    );
    console.log(`Upserted: ${team.name}`);
  }
  await mongoose.disconnect();
  console.log('Done!');
}

insertTeams();
