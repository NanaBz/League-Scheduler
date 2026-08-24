const mongoose = require('mongoose');

const FantasyCupTieSchema = new mongoose.Schema(
  {
    seasonNumber: { type: Number, required: true },
    round: {
      type: String,
      enum: ['R32', 'R16', 'QF', 'SF', 'F'],
      required: true,
    },
    gameweek: { type: Number, required: true },
    bracketSlot: { type: Number, required: true },
    homeFantasyUser: { type: mongoose.Schema.Types.ObjectId, ref: 'FantasyUser', required: true },
    awayFantasyUser: { type: mongoose.Schema.Types.ObjectId, ref: 'FantasyUser', required: true },
    homeTeamName: { type: String, required: true },
    awayTeamName: { type: String, required: true },
    homePoints: { type: Number, default: null },
    awayPoints: { type: Number, default: null },
    winnerFantasyUser: { type: mongoose.Schema.Types.ObjectId, ref: 'FantasyUser', default: null },
    /** Set when gameweek points are tied — FPL-style tie-breaker used. */
    tiebreakMethod: {
      type: String,
      enum: ['goals_scored', 'goals_conceded', 'coin_toss'],
    },
    homeGoalsScored: { type: Number, default: null },
    awayGoalsScored: { type: Number, default: null },
    homeGoalsConceded: { type: Number, default: null },
    awayGoalsConceded: { type: Number, default: null },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

FantasyCupTieSchema.index({ seasonNumber: 1, round: 1, bracketSlot: 1 }, { unique: true });

module.exports = mongoose.model('FantasyCupTie', FantasyCupTieSchema);
