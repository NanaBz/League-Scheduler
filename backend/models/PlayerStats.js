const mongoose = require('mongoose');

const playerStatsSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  seasonNumber: {
    type: Number,
    required: true
  },
  competition: {
    type: String,
    enum: ['league', 'cup', 'super-cup', 'acwpl'],
    required: true
  },
  goals: { type: Number, default: 0 },
  assists: { type: Number, default: 0 },
  cleanSheets: { type: Number, default: 0 },
  yellowCards: { type: Number, default: 0 },
  redCards: { type: Number, default: 0 },
  ownGoals: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Unique per player per season and competition
playerStatsSchema.index({ player: 1, seasonNumber: 1, competition: 1 }, { unique: true });
// Lookup indexes
playerStatsSchema.index({ competition: 1, seasonNumber: 1 });

module.exports = mongoose.model('PlayerStats', playerStatsSchema);
