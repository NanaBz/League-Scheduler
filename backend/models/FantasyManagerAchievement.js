const mongoose = require('mongoose');

/** Season-specific FPL achievement — not a permanent manager badge. */
const FantasyManagerAchievementSchema = new mongoose.Schema(
  {
    fantasyUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FantasyUser',
      required: true,
    },
    seasonNumber: { type: Number, required: true, index: true },
    seasonName: { type: String, required: true, trim: true },
    academicYear: { type: String, trim: true },
    semester: { type: String, enum: ['first', 'second', 'full'], trim: true },
    /** `overall-league` or `fantasy-cup` (ACFPL Fantasy Cup — not school Agha Cup). */
    competition: {
      type: String,
      enum: ['overall-league', 'fantasy-cup'],
      required: true,
    },
    achievementType: {
      type: String,
      enum: ['fpl_champion', 'fpl_runner_up', 'fantasy_cup_champion', 'fantasy_cup_runner_up'],
      required: true,
    },
    teamName: { type: String, required: true, trim: true },
    managerName: { type: String, default: '', trim: true },
    finalRank: { type: Number, default: null },
    archivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

FantasyManagerAchievementSchema.index(
  { fantasyUserId: 1, seasonNumber: 1, competition: 1, achievementType: 1 },
  { unique: true }
);

module.exports = mongoose.model('FantasyManagerAchievement', FantasyManagerAchievementSchema);
