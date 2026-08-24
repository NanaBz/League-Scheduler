const mongoose = require('mongoose');

/** Immutable per-manager FPL overall-league result for a completed season. */
const FantasyManagerSeasonResultSchema = new mongoose.Schema(
  {
    fantasyUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FantasyUser',
      required: true,
    },
    teamName: { type: String, required: true, trim: true },
    managerName: { type: String, required: true, trim: true },
    seasonNumber: { type: Number, required: true, index: true },
    seasonName: { type: String, required: true, trim: true },
    finalPoints: { type: Number, default: 0 },
    finalRank: { type: Number, required: true, min: 1 },
    totalManagers: { type: Number, required: true, min: 1 },
    archivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

FantasyManagerSeasonResultSchema.index({ fantasyUserId: 1, seasonNumber: 1 }, { unique: true });
FantasyManagerSeasonResultSchema.index({ seasonNumber: 1, finalRank: 1 });

module.exports = mongoose.model('FantasyManagerSeasonResult', FantasyManagerSeasonResultSchema);
