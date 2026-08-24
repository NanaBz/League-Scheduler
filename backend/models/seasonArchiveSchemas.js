const mongoose = require('mongoose');

/** Denormalized team — readable without live Team collection. */
const archivedTeamSnapshotSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    logo: { type: String, default: '' },
    category: { type: String, enum: ['boys', 'girls'] },
    competition: { type: String, enum: ['league', 'acwpl'] },
    staff: [
      {
        role: { type: String, enum: ['Coach', 'Assistant'] },
        name: String,
      },
    ],
  },
  { _id: false }
);

/** Denormalized player roster entry for historical team views. */
const archivedPlayerSnapshotSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    number: { type: Number, default: null },
    position: { type: String, enum: ['GK', 'DF', 'MF', 'ATT'], required: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, required: true },
    teamName: { type: String, required: true },
    isCaptain: { type: Boolean, default: false },
    isViceCaptain: { type: Boolean, default: false },
  },
  { _id: false }
);

/** Denormalized winner — no live Team lookup required. */
const archivedWinnerSnapshotSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId },
    name: String,
    logo: String,
  },
  { _id: false }
);

const archivedStandingRowSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, required: true },
    teamName: { type: String, required: true },
    teamLogo: String,
    position: { type: Number, required: true },
    played: { type: Number, default: 0 },
    won: { type: Number, default: 0 },
    drawn: { type: Number, default: 0 },
    lost: { type: Number, default: 0 },
    goalsFor: { type: Number, default: 0 },
    goalsAgainst: { type: Number, default: 0 },
    goalDifference: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    form: { type: [String], default: [] },
  },
  { _id: false }
);

/** Fixture snapshot — only non-void, historically relevant matches. */
const archivedFixtureSchema = new mongoose.Schema(
  {
    matchId: { type: mongoose.Schema.Types.ObjectId },
    homeTeamId: { type: mongoose.Schema.Types.ObjectId, required: true },
    homeTeamName: { type: String, required: true },
    homeTeamLogo: String,
    awayTeamId: { type: mongoose.Schema.Types.ObjectId, required: true },
    awayTeamName: { type: String, required: true },
    awayTeamLogo: String,
    homeScore: { type: Number, default: null },
    awayScore: { type: Number, default: null },
    homePenalties: { type: Number, default: null },
    awayPenalties: { type: Number, default: null },
    date: Date,
    time: String,
    matchweek: Number,
    stage: String,
    round: String,
    isPlayed: { type: Boolean, default: false },
    matchState: { type: String, enum: ['scheduled', 'live', 'ft'] },
    winnerTeamId: { type: mongoose.Schema.Types.ObjectId },
    winnerTeamName: String,
  },
  { _id: false }
);

const archivedPlayerStatRowSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    playerName: { type: String, required: true },
    playerNumber: { type: Number, default: null },
    playerPosition: { type: String, enum: ['GK', 'DF', 'MF', 'ATT'] },
    teamId: { type: mongoose.Schema.Types.ObjectId, required: true },
    teamName: { type: String, required: true },
    goals: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    cleanSheets: { type: Number, default: 0 },
    yellowCards: { type: Number, default: 0 },
    redCards: { type: Number, default: 0 },
    ownGoals: { type: Number, default: 0 },
  },
  { _id: false }
);

const archivedStatisticsSchema = new mongoose.Schema(
  {
    goals: { type: [archivedPlayerStatRowSchema], default: [] },
    assists: { type: [archivedPlayerStatRowSchema], default: [] },
    cleanSheets: { type: [archivedPlayerStatRowSchema], default: [] },
    yellowCards: { type: [archivedPlayerStatRowSchema], default: [] },
    redCards: { type: [archivedPlayerStatRowSchema], default: [] },
  },
  { _id: false }
);

const leagueArchiveSchema = new mongoose.Schema(
  {
    standings: { type: [archivedStandingRowSchema], default: [] },
    fixtures: { type: [archivedFixtureSchema], default: [] },
    winner: archivedWinnerSnapshotSchema,
    statistics: archivedStatisticsSchema,
  },
  { _id: false }
);

const cupArchiveSchema = new mongoose.Schema(
  {
    participants: { type: [archivedTeamSnapshotSchema], default: [] },
    semiFinals: { type: [archivedFixtureSchema], default: [] },
    final: archivedFixtureSchema,
    winner: archivedWinnerSnapshotSchema,
    statistics: archivedStatisticsSchema,
  },
  { _id: false }
);

const superCupArchiveSchema = new mongoose.Schema(
  {
    participants: { type: [archivedTeamSnapshotSchema], default: [] },
    final: archivedFixtureSchema,
    winner: archivedWinnerSnapshotSchema,
    originalDoubleWinnerId: { type: mongoose.Schema.Types.ObjectId },
    statistics: archivedStatisticsSchema,
  },
  { _id: false }
);

/** Best-of series (ACWPL best-of-5, Girls Super Cup best-of-3). */
const seriesArchiveSchema = new mongoose.Schema(
  {
    format: { type: String, enum: ['best-of-3', 'best-of-5'] },
    participants: { type: [archivedTeamSnapshotSchema], default: [] },
    standings: { type: [archivedStandingRowSchema], default: [] },
    fixtures: { type: [archivedFixtureSchema], default: [] },
    winner: archivedWinnerSnapshotSchema,
    winsByTeam: [
      {
        teamId: { type: mongoose.Schema.Types.ObjectId, required: true },
        teamName: { type: String, required: true },
        wins: { type: Number, default: 0 },
      },
    ],
    statistics: archivedStatisticsSchema,
  },
  { _id: false }
);

const competitionsArchiveSchema = new mongoose.Schema(
  {
    league: leagueArchiveSchema,
    cup: cupArchiveSchema,
    superCup: superCupArchiveSchema,
    acwpl: seriesArchiveSchema,
    girlsSuperCup: seriesArchiveSchema,
  },
  { _id: false }
);

module.exports = {
  archivedTeamSnapshotSchema,
  archivedPlayerSnapshotSchema,
  archivedWinnerSnapshotSchema,
  archivedStandingRowSchema,
  archivedFixtureSchema,
  archivedPlayerStatRowSchema,
  archivedStatisticsSchema,
  leagueArchiveSchema,
  cupArchiveSchema,
  superCupArchiveSchema,
  seriesArchiveSchema,
  competitionsArchiveSchema,
};
