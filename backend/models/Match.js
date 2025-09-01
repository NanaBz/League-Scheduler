const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  homeTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  awayTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  homeScore: {
    type: Number,
    default: null
  },
  awayScore: {
    type: Number,
    default: null
  },
  homePenalties: {
    type: Number,
    default: null
  },
  awayPenalties: {
    type: Number,
    default: null
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  matchweek: {
    type: Number,
    required: true
  },
  competition: {
    type: String,
    enum: ['league', 'cup', 'super-cup', 'acwpl'],
    required: true
  },
  stage: {
    type: String,
    enum: ['group', 'semi-final', 'final'],
    default: 'group'
  },
  round: {
    type: String,
    enum: ['semi-final', 'final']
  },
  leagueWinner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  cupWinner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  isPlayed: {
    type: Boolean,
    default: false
  },
  isPublished: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Match', matchSchema);
