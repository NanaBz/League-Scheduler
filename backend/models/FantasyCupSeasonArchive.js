const mongoose = require('mongoose');

const CupParticipantSchema = new mongoose.Schema(
  {
    fantasyUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'FantasyUser', required: true },
    teamName: { type: String, required: true },
    managerName: { type: String, default: '' },
    seed: { type: Number, default: null },
    qualificationPoints: { type: Number, default: 0 },
  },
  { _id: false }
);

const CupManagerSnapshotSchema = new mongoose.Schema(
  {
    fantasyUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'FantasyUser', required: true },
    teamName: { type: String, required: true },
    managerName: { type: String, default: '' },
  },
  { _id: false }
);

const ArchivedFantasyCupTieSchema = new mongoose.Schema(
  {
    round: { type: String, enum: ['R32', 'R16', 'QF', 'SF', 'F'], required: true },
    gameweek: { type: Number, required: true },
    bracketSlot: { type: Number, required: true },
    homeFantasyUser: { type: mongoose.Schema.Types.ObjectId, ref: 'FantasyUser', required: true },
    awayFantasyUser: { type: mongoose.Schema.Types.ObjectId, ref: 'FantasyUser', required: true },
    homeTeamName: { type: String, required: true },
    awayTeamName: { type: String, required: true },
    homePoints: { type: Number, default: null },
    awayPoints: { type: Number, default: null },
    winnerFantasyUser: { type: mongoose.Schema.Types.ObjectId, ref: 'FantasyUser', default: null },
    tiebreakMethod: {
      type: String,
      enum: ['goals_scored', 'goals_conceded', 'coin_toss'],
      required: false,
    },
    resolved: { type: Boolean, default: false },
  },
  { _id: false }
);

/** Immutable ACFPL Fantasy Cup snapshot — separate from school Agha Cup archive. */
const FantasyCupSeasonArchiveSchema = new mongoose.Schema(
  {
    seasonNumber: { type: Number, required: true, unique: true },
    fplLiveSeasonNumber: { type: Number, required: true },
    seasonName: { type: String, required: true, trim: true },
    academicYear: { type: String, trim: true },
    semester: { type: String, enum: ['first', 'second', 'full'] },
    status: { type: String, enum: ['pending', 'active', 'completed'], default: 'completed' },
    qualifiedTeams: { type: [CupParticipantSchema], default: [] },
    excludedTeams: { type: [CupParticipantSchema], default: [] },
    ties: { type: [ArchivedFantasyCupTieSchema], default: [] },
    winner: { type: CupManagerSnapshotSchema, default: null },
    runnerUp: { type: CupManagerSnapshotSchema, default: null },
    archivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FantasyCupSeasonArchive', FantasyCupSeasonArchiveSchema);
