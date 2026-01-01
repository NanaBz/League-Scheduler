const mongoose = require('mongoose');

const FantasySquadSchema = new mongoose.Schema({
  fantasyUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FantasyUser',
    required: true
  },
  matchweek: {
    type: Number,
    required: true
  },
  // Array of player IDs in the squad (11 players)
  players: [{
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true
    },
    isCaptain: {
      type: Boolean,
      default: false
    },
    isViceCaptain: {
      type: Boolean,
      default: false
    }
  }],
  // Transfers made this matchweek
  transfersIn: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player'
  }],
  transfersOut: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player'
  }],
  points: {
    type: Number,
    default: 0
  },
  isLocked: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

FantasySquadSchema.index({ fantasyUser: 1, matchweek: 1 }, { unique: true });

module.exports = mongoose.model('FantasySquad', FantasySquadSchema);
