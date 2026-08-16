const mongoose = require('mongoose');

const seasonSchema = new mongoose.Schema({
  seasonNumber: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  },
  // Archived data from when season ended
  finalStandings: [{
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    position: Number,
    played: Number,
    won: Number,
    drawn: Number,
    lost: Number,
    goalsFor: Number,
    goalsAgainst: Number,
    goalDifference: Number,
    points: Number,
    form: [String]
  }],
  winners: {
    league: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    cup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    superCup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    }
  },
  // Archive all matches for this season
  matches: [{
    homeTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    awayTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    /** Denormalized at archive time so historical fixtures stay readable even if teams change. */
    homeTeamName: String,
    homeTeamLogo: String,
    awayTeamName: String,
    awayTeamLogo: String,
    homeScore: Number,
    awayScore: Number,
    homePenalties: Number,
    awayPenalties: Number,
    date: Date,
    time: String,
    matchweek: Number,
    competition: String,
    stage: String,
    isPlayed: Boolean,
    isVoided: { type: Boolean, default: false },
    matchState: { type: String, enum: ['scheduled', 'live', 'ft'] },
  }],
  // Teams that participated in this season (for reference)
  teams: [{
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    logo: String
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Season', seasonSchema);
