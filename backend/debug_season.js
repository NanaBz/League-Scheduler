const mongoose = require('mongoose');
const Season = require('./models/Season');

mongoose.connect('mongodb://localhost:27017/nba-league-scheduler');

async function checkLatestSeason() {
  try {
    const season = await Season.findOne().sort({ seasonNumber: -1 });
    console.log('Latest season (Season', season.seasonNumber, ') finalStandings:');
    season.finalStandings.forEach((standing, index) => {
      console.log(`Position ${standing.position} - Team:`, JSON.stringify(standing.team, null, 2));
    });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkLatestSeason();
