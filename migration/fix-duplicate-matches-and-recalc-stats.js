// migration/fix-duplicate-matches-and-recalc-stats.js
// Script to remove duplicate matches and recalculate team stats based on the latest fixture changes

const mongoose = require('mongoose');

// Define minimal schemas for direct model registration
const matchSchema = new mongoose.Schema({
  homeTeam: mongoose.Schema.Types.ObjectId,
  awayTeam: mongoose.Schema.Types.ObjectId,
  homeScore: Number,
  awayScore: Number,
  matchweek: Number,
  competition: String,
  isPlayed: Boolean,
  date: Date,
  updatedAt: Date
}, { collection: 'matches', timestamps: true });

const teamSchema = new mongoose.Schema({
  name: String,
  played: Number,
  won: Number,
  drawn: Number,
  lost: Number,
  goalsFor: Number,
  goalsAgainst: Number,
  points: Number,
  form: [String]
}, { collection: 'teams', timestamps: true });

const Match = mongoose.model('Match', matchSchema);
const Team = mongoose.model('Team', teamSchema);

async function main() {
  await mongoose.connect('mongodb://localhost:27017/league-scheduler');
  console.log('Connected to DB');

  // 1. Find and keep only the most recently updated match for each fixture (home, away, matchweek, competition)
  const allMatches = await Match.find({ competition: 'league' }).sort({ updatedAt: -1 });
  const uniqueKey = m => `${m.homeTeam}_${m.awayTeam}_${m.matchweek}_${m.competition}`;
  const seen = new Set();
  const toDelete = [];

  for (const match of allMatches) {
    const key = uniqueKey(match);
    if (seen.has(key)) {
      toDelete.push(match._id);
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length > 0) {
    await Match.deleteMany({ _id: { $in: toDelete } });
    console.log(`Deleted ${toDelete.length} duplicate matches.`);
  } else {
    console.log('No duplicate matches found.');
  }

  // 2. Reset all team stats
  const teams = await Team.find();
  for (const team of teams) {
    team.played = 0;
    team.won = 0;
    team.drawn = 0;
    team.lost = 0;
    team.goalsFor = 0;
    team.goalsAgainst = 0;
    team.points = 0;
    team.form = [];
    await team.save();
  }
  console.log('Reset all team stats.');

  // 3. Recalculate stats from remaining matches (in matchweek order)
  const matches = await Match.find({ competition: 'league', isPlayed: true }).sort({ matchweek: 1, date: 1 });
  for (const match of matches) {
    const homeTeam = await Team.findById(match.homeTeam);
    const awayTeam = await Team.findById(match.awayTeam);
    if (!homeTeam || !awayTeam) continue;

    homeTeam.played++;
    awayTeam.played++;
    homeTeam.goalsFor += match.homeScore;
    homeTeam.goalsAgainst += match.awayScore;
    awayTeam.goalsFor += match.awayScore;
    awayTeam.goalsAgainst += match.homeScore;

    let homeResult, awayResult;
    if (match.homeScore > match.awayScore) {
      homeTeam.won++;
      homeTeam.points += 3;
      awayTeam.lost++;
      homeResult = 'W';
      awayResult = 'L';
    } else if (match.homeScore < match.awayScore) {
      awayTeam.won++;
      awayTeam.points += 3;
      homeTeam.lost++;
      homeResult = 'L';
      awayResult = 'W';
    } else {
      homeTeam.drawn++;
      awayTeam.drawn++;
      homeTeam.points++;
      awayTeam.points++;
      homeResult = 'D';
      awayResult = 'D';
    }
    homeTeam.form.unshift(homeResult);
    if (homeTeam.form.length > 3) homeTeam.form.pop();
    awayTeam.form.unshift(awayResult);
    if (awayTeam.form.length > 3) awayTeam.form.pop();
    await homeTeam.save();
    await awayTeam.save();
  }
  console.log('Recalculated all team stats from unique matches.');

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
