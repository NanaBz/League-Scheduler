const mongoose = require('mongoose');

const QualifiedTeamSchema = new mongoose.Schema(
  {
    fantasyUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'FantasyUser', required: true },
    teamName: { type: String, required: true },
    managerName: { type: String, default: '' },
    seed: { type: Number, required: true },
    qualificationPoints: { type: Number, default: 0 },
  },
  { _id: false }
);

const FantasyCupSchema = new mongoose.Schema(
  {
    seasonNumber: { type: Number, required: true, unique: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed'],
      default: 'pending',
    },
    qualificationGameweek: { type: Number, default: 5 },
    qualifiedTeams: { type: [QualifiedTeamSchema], default: [] },
    excludedTeams: { type: [QualifiedTeamSchema], default: [] },
    winnerFantasyUser: { type: mongoose.Schema.Types.ObjectId, ref: 'FantasyUser', default: null },
    winnerTeamName: { type: String, default: null },
    winnerManagerName: { type: String, default: null },
    bracketGeneratedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FantasyCup', FantasyCupSchema);
