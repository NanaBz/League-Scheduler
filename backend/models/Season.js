const mongoose = require('mongoose');
const {
  archivedTeamSnapshotSchema,
  archivedPlayerSnapshotSchema,
  competitionsArchiveSchema,
} = require('./seasonArchiveSchemas');

const seasonSchema = new mongoose.Schema({
  /** Monotonic archive / season identifier (unique). */
  seasonNumber: {
    type: Number,
    required: true,
    unique: true,
  },
  /** @deprecated Prefer displayName — kept for backward compatibility. */
  name: {
    type: String,
    required: true,
  },
  displayName: {
    type: String,
  },
  academicYear: {
    type: String,
  },
  semester: {
    type: String,
    enum: ['first', 'second', 'full'],
    default: 'full',
  },
  archivedAt: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['archived'],
    default: 'archived',
  },
  /** Schema version: 1 = legacy flat embed, 2 = self-contained competition snapshots. */
  archiveVersion: {
    type: Number,
    default: 1,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  /** Full team snapshots — self-contained roster metadata. */
  participatingTeams: {
    type: [archivedTeamSnapshotSchema],
    default: [],
  },
  /** Full player snapshots — self-contained roster for historical team views. */
  participatingPlayers: {
    type: [archivedPlayerSnapshotSchema],
    default: [],
  },
  /** Structured competition snapshots (v2). */
  competitions: competitionsArchiveSchema,
  // --- Legacy embedded fields (kept for backward-compatible reads) ---
  finalStandings: [{
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
    },
    position: Number,
    played: Number,
    won: Number,
    drawn: Number,
    lost: Number,
    goalsFor: Number,
    goalsAgainst: Number,
    goalDifference: Number,
    points: Number,
    form: [String],
  }],
  winners: {
    league: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    cup: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    superCup: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    acwpl: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    girlsSuperCup: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  },
  matches: [{
    homeTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    awayTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    homeTeamName: String,
    homeTeamLogo: String,
    awayTeamName: String,
    awayTeamLogo: String,
    homeScore: Number,
    awayScore: Number,
    homePenalties: Number,
    awayPenalties: Number,
    date: Date,
    time: String,
    matchweek: Number,
    competition: String,
    stage: String,
    isPlayed: Boolean,
    isVoided: { type: Boolean, default: false },
    matchState: { type: String, enum: ['scheduled', 'live', 'ft'] },
  }],
  /** @deprecated Prefer participatingTeams — kept for backward compatibility. */
  teams: [{
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    logo: String,
  }],
}, {
  timestamps: true,
});

seasonSchema.index(
  { academicYear: 1, semester: 1 },
  {
    unique: true,
    partialFilterExpression: {
      academicYear: { $type: 'string' },
      semester: { $in: ['first', 'second'] },
    },
  }
);

module.exports = mongoose.model('Season', seasonSchema);
