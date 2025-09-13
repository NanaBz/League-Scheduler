const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Team = require('../models/Team');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/league-scheduler';
console.log('Connecting to:', MONGODB_URI);

async function resetAcwplTeams() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  // Remove Orion and Firestorm from ALL competitions
  await Team.deleteMany({ name: { $in: ['Orion', 'Firestorm'] } });
  // Add Orion and Firestorm as ACWPL teams
  const teams = [
    {
      name: 'Orion',
      logo: '/logos/Orion.png',
      competition: 'acwpl',
    },
    {
      name: 'Firestorm',
      logo: '/logos/Firestorm.png',
      competition: 'acwpl',
    },
  ];
  await Team.insertMany(teams);
  console.log('ACWPL teams reset to Orion and Firestorm.');
  await mongoose.disconnect();
}

resetAcwplTeams();