const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const Team = require('../models/Team');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/league-scheduler';

async function setLeagueCompetition() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  // Update all teams that are not ACWPL to have competition: 'league'
  const result = await Team.updateMany(
    { competition: { $exists: false } },
    { $set: { competition: 'league' } }
  );
  console.log(`Updated ${result.nModified || result.modifiedCount} teams to competition: 'league'.`);
  await mongoose.disconnect();
}

setLeagueCompetition();
