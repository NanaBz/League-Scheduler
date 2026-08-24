const mongoose = require('mongoose');

const GameweekPointsSchema = new mongoose.Schema(
  {
    matchweek: { type: Number, required: true },
    points: { type: Number, default: 0 },
  },
  { _id: false }
);

/** Historical FPL player statistics for a completed season. */
const FantasyPlayerSeasonStatsSchema = new mongoose.Schema(
  {
    seasonNumber: { type: Number, required: true, index: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    playerName: { type: String, required: true, trim: true },
    position: { type: String, enum: ['GK', 'DF', 'MF', 'ATT'], required: true },
    fantasyPrice: { type: Number, default: 4.5 },
    totalPoints: { type: Number, default: 0 },
    selectionPercentage: { type: Number, default: 0 },
    gameweekPoints: { type: [GameweekPointsSchema], default: [] },
    archivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

FantasyPlayerSeasonStatsSchema.index({ seasonNumber: 1, playerId: 1 }, { unique: true });

module.exports = mongoose.model('FantasyPlayerSeasonStats', FantasyPlayerSeasonStatsSchema);
