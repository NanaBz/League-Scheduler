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
  },
  // Stores the original double winner team ID for Super Cup runner-up logic
  originalDoubleWinnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  events: [{
    type: {
      type: String,
      enum: ['GOAL', 'CLEAN_SHEET', 'YELLOW_CARD', 'RED_CARD'],
      required: true
    },
    side: {
      type: String,
      enum: ['home', 'away'],
      required: true
    },
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true
    },
    assistPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player'
    },
    ownGoal: {
      type: Boolean,
      default: false
    },
    minute: {
      type: Number
    }
  }],
  startingLineup: {
    homeTeam: {
      gk: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      }],
      df: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      }],
      mf: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      }],
      att: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      }]
    },
    awayTeam: {
      gk: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      }],
      df: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      }],
      mf: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      }],
      att: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      }]
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Match', matchSchema);
