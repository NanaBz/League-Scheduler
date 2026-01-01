const mongoose = require('mongoose');

const FantasyMatchPerformanceSchema = new mongoose.Schema({
  match: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true
  },
  matchweek: {
    type: Number,
    required: true
  },
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  // Minutes played assignment
  minutesPlayed: {
    type: Number,
    default: 0,
    min: 0,
    max: 70
  },
  minutesPoints: {
    type: Number,
    default: 0
  },
  // Bonus points (3, 2, or 1)
  bonusPoints: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  },
  // Special points (rare, out-of-position performance)
  specialPoints: {
    type: Number,
    default: 0
  },
  specialPointsReason: {
    type: String,
    default: ''
  },
  // Auto-calculated from match events (goals, assists, cleansheet)
  goals: {
    type: Number,
    default: 0
  },
  assists: {
    type: Number,
    default: 0
  },
  cleansheet: {
    type: Boolean,
    default: false
  },
  cleansheetPoints: {
    type: Number,
    default: 0
  },
  // Yellow/red cards (for suspension tracking)
  yellowCards: {
    type: Number,
    default: 0
  },
  redCards: {
    type: Number,
    default: 0
  },
  // Total fantasy points for this match
  totalPoints: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

FantasyMatchPerformanceSchema.index({ match: 1, player: 1 }, { unique: true });
FantasyMatchPerformanceSchema.index({ matchweek: 1, player: 1 });

module.exports = mongoose.model('FantasyMatchPerformance', FantasyMatchPerformanceSchema);
