const Season = require('../models/Season');
const Team = require('../models/Team');
const Match = require('../models/Match');
const Player = require('../models/Player');
const PlayerStats = require('../models/PlayerStats');
const Competition = require('../models/Competition');
const { getLiveSeasonStatsNumber, syncSeasonActiveFlagsToLatest } = require('./seasonContext');
const { buildSeasonArchivePayload } = require('./seasonArchiveSnapshot');
const { semesterLabel } = require('./academicYear');
const {
  buildFantasySeasonArchiveSnapshot,
  persistFantasySeasonArchive,
  verifyFantasySeasonArchive,
  rollbackFantasySeasonArchive,
} = require('./fantasySeasonArchiveSnapshot');
const { resetFantasySeasonData } = require('./resetFantasySeason');

/** Stats bucket for the live season being archived (from fixtures/stats, not the next live bucket). */
async function resolveClosingLiveStatsSeasonNumber(matches) {
  const fromMatches = matches
    .map((m) => m.seasonNumber)
    .filter((n) => n != null && !Number.isNaN(Number(n)));
  if (fromMatches.length) return Math.max(...fromMatches.map(Number));

  const latestStats = await PlayerStats.findOne().sort({ seasonNumber: -1 }).select('seasonNumber').lean();
  if (latestStats) return latestStats.seasonNumber;

  return getLiveSeasonStatsNumber();
}

/** Include active players plus inactive players who have stats in the closing season. */
async function loadSeasonPlayers(statsSeasonNumber) {
  const [activePlayers, statsPlayerIds] = await Promise.all([
    Player.find({ active: { $ne: false } }).lean(),
    PlayerStats.distinct('player', { seasonNumber: statsSeasonNumber }),
  ]);

  const activeIds = new Set(activePlayers.map((p) => String(p._id)));
  const missingIds = statsPlayerIds.filter((id) => !activeIds.has(String(id)));

  if (!missingIds.length) {
    return activePlayers;
  }

  const inactiveWithHistory = await Player.find({ _id: { $in: missingIds } }).lean();
  const byId = new Map();
  for (const p of [...activePlayers, ...inactiveWithHistory]) {
    byId.set(String(p._id), p);
  }
  return [...byId.values()];
}

async function loadLiveSeasonData() {
  const [teams, matches] = await Promise.all([
    Team.find().lean(),
    Match.find()
      .populate('homeTeam', 'name logo category competition')
      .populate('awayTeam', 'name logo category competition')
      .lean(),
  ]);
  const statsSeasonNumber = await resolveClosingLiveStatsSeasonNumber(matches);
  const [players, playerStats] = await Promise.all([
    loadSeasonPlayers(statsSeasonNumber),
    PlayerStats.find({ seasonNumber: statsSeasonNumber }).lean(),
  ]);
  return { teams, matches, players, playerStats, statsSeasonNumber };
}

/**
 * Clears live competition state for a new season.
 * Preserves Team documents (names, logos, staff) and Player rosters.
 */
async function resetLiveSeasonData({ clearStatsSeasonNumber } = {}) {
  await Team.updateMany(
    {},
    {
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: [],
    }
  );
  await Match.deleteMany({});
  if (clearStatsSeasonNumber != null) {
    await PlayerStats.deleteMany({ seasonNumber: clearStatsSeasonNumber });
  }
  await Competition.updateMany({}, { winner: null, isCompleted: false });
}

async function getNextArchiveSeasonNumber() {
  const lastSeason = await Season.findOne().sort({ seasonNumber: -1 }).select('seasonNumber').lean();
  return lastSeason ? lastSeason.seasonNumber + 1 : 1;
}

function validateArchiveRequest({ academicYear, semester }) {
  if (!academicYear || String(academicYear).trim() === '') {
    return { ok: false, code: 'missing_academic_year', message: 'Academic year is required.' };
  }
  if (!/^\d{4}\/\d{4}$/.test(String(academicYear).trim())) {
    return { ok: false, code: 'invalid_academic_year', message: 'Academic year must be in YYYY/YYYY format.' };
  }
  if (!semester || String(semester).trim() === '') {
    return { ok: false, code: 'missing_semester', message: 'Semester is required.' };
  }
  if (!['first', 'second'].includes(semester)) {
    return { ok: false, code: 'invalid_semester', message: 'Semester must be first or second.' };
  }
  return { ok: true };
}

async function findDuplicateArchive(academicYear, semester) {
  return Season.findOne({ academicYear: String(academicYear).trim(), semester }).lean();
}

function buildSchoolArchivePayload({
  teams,
  matches,
  players,
  playerStats,
  seasonNumber,
  academicYear,
  semester,
  displayName,
  archivedAt,
}) {
  return buildSeasonArchivePayload({
    teams,
    matches,
    players,
    playerStats,
    seasonNumber,
    meta: { academicYear, semester, displayName, archivedAt },
  });
}

async function verifySchoolArchive(savedArchive, liveData) {
  if (!savedArchive?._id) {
    const err = new Error('School archive verification failed.');
    err.code = 'school_archive_verify_failed';
    throw err;
  }
  if (!savedArchive.participatingTeams?.length && liveData.teams.length) {
    const err = new Error('School archive is missing team snapshots.');
    err.code = 'school_archive_verify_failed';
    throw err;
  }
  return { ok: true, seasonNumber: savedArchive.seasonNumber };
}

async function rollbackUnifiedArchive({ schoolArchiveId, fplSeasonNumber }) {
  const tasks = [];
  if (schoolArchiveId) {
    tasks.push(Season.deleteOne({ _id: schoolArchiveId }));
  }
  if (fplSeasonNumber != null) {
    tasks.push(rollbackFantasySeasonArchive(fplSeasonNumber));
  }
  await Promise.all(tasks);
}

async function createSeasonArchive({ academicYear, semester, displayName }) {
  const validation = validateArchiveRequest({ academicYear, semester });
  if (!validation.ok) {
    const err = new Error(validation.message);
    err.code = validation.code;
    err.status = 400;
    throw err;
  }

  const normalizedYear = String(academicYear).trim();
  const duplicate = await findDuplicateArchive(normalizedYear, semester);
  if (duplicate) {
    const err = new Error(
      `An archive already exists for ${normalizedYear} (${semesterLabel(semester)}).`
    );
    err.code = 'duplicate_archive';
    err.status = 409;
    err.existingSeasonNumber = duplicate.seasonNumber;
    throw err;
  }

  const liveData = await loadLiveSeasonData();
  if (liveData.teams.length === 0) {
    const err = new Error('No season data to archive.');
    err.code = 'no_season_data';
    err.status = 400;
    throw err;
  }

  const nextSeasonNumber = await getNextArchiveSeasonNumber();
  const finalDisplayName =
    displayName || `${normalizedYear} — ${semesterLabel(semester)}`;

  const archivePayload = buildSchoolArchivePayload({
    ...liveData,
    seasonNumber: nextSeasonNumber,
    academicYear: normalizedYear,
    semester,
    displayName: finalDisplayName,
    archivedAt: new Date(),
  });

  const archivedSeason = new Season(archivePayload);
  await archivedSeason.save();
  return archivedSeason;
}

async function resetSeasonWithoutArchive() {
  const liveSeasonNumber = await getLiveSeasonStatsNumber();
  await resetLiveSeasonData({ clearStatsSeasonNumber: liveSeasonNumber });
  return { archived: false, mode: 'testing', liveSeasonNumber, rostersPreserved: true };
}

/**
 * Unified archive + reset: school competitions and FPL coordinated in one workflow.
 * Staged: validate → build snapshots → persist → verify → reset live data.
 */
async function archiveAndResetSeason({ academicYear, semester, displayName }) {
  const validation = validateArchiveRequest({ academicYear, semester });
  if (!validation.ok) {
    const err = new Error(validation.message);
    err.code = validation.code;
    err.status = 400;
    throw err;
  }

  const normalizedYear = String(academicYear).trim();
  const duplicate = await findDuplicateArchive(normalizedYear, semester);
  if (duplicate) {
    const err = new Error(
      `An archive already exists for ${normalizedYear} (${semesterLabel(semester)}).`
    );
    err.code = 'duplicate_archive';
    err.status = 409;
    err.existingSeasonNumber = duplicate.seasonNumber;
    throw err;
  }

  const liveData = await loadLiveSeasonData();
  if (liveData.teams.length === 0) {
    const err = new Error('No season data to archive.');
    err.code = 'no_season_data';
    err.status = 400;
    throw err;
  }

  const archiveSeasonNumber = await getNextArchiveSeasonNumber();
  const finalDisplayName =
    displayName || `${normalizedYear} — ${semesterLabel(semester)}`;
  const archivedAt = new Date();
  const fplLiveSeasonNumber = liveData.statsSeasonNumber;

  const fplContext = {
    seasonNumber: archiveSeasonNumber,
    fplLiveSeasonNumber,
    seasonName: finalDisplayName,
    academicYear: normalizedYear,
    semester,
    archivedAt,
  };

  const schoolPayload = buildSchoolArchivePayload({
    ...liveData,
    seasonNumber: archiveSeasonNumber,
    academicYear: normalizedYear,
    semester,
    displayName: finalDisplayName,
    archivedAt,
  });

  const fplSnapshot = await buildFantasySeasonArchiveSnapshot(fplContext);

  let savedArchive = null;
  let fplArchiveResult = null;

  try {
    savedArchive = await new Season(schoolPayload).save();
    await verifySchoolArchive(savedArchive, liveData);

    fplArchiveResult = await persistFantasySeasonArchive(fplSnapshot);
    if (fplArchiveResult.reason === 'already_archived') {
      const schoolExists = await Season.exists({
        seasonNumber: archiveSeasonNumber,
        academicYear: normalizedYear,
        semester,
      });
      const err = new Error(
        schoolExists
          ? `This season is already fully archived (${finalDisplayName}).`
          : `FPL data for season ${archiveSeasonNumber} is already archived. Aborting to prevent a double reset.`
      );
      err.code = 'fpl_duplicate_archive';
      err.status = 409;
      throw err;
    }
    if (fplArchiveResult.archived) {
      await verifyFantasySeasonArchive(archiveSeasonNumber, fplSnapshot);
    }

    await syncSeasonActiveFlagsToLatest();

    const nextLiveSeasonNumber = archiveSeasonNumber + 1;
    await resetLiveSeasonData({ clearStatsSeasonNumber: nextLiveSeasonNumber });

    const fplResetResult = await resetFantasySeasonData({
      skipArchive: true,
      fplSeasonNumber: fplLiveSeasonNumber,
    });

    return {
      archived: true,
      mode: 'archive',
      seasonNumber: savedArchive.seasonNumber,
      displayName: savedArchive.displayName,
      academicYear: savedArchive.academicYear,
      semester: savedArchive.semester,
      archiveVersion: savedArchive.archiveVersion,
      nextSeasonNumber: nextLiveSeasonNumber,
      liveSeasonNumber: nextLiveSeasonNumber,
      rostersPreserved: true,
      fpl: {
        archived: fplArchiveResult?.archived === true,
        reason: fplArchiveResult?.reason || null,
        managerCount: fplArchiveResult?.managerCount || 0,
        achievementCount: fplArchiveResult?.achievementCount || 0,
        fantasyCupArchived: fplArchiveResult?.fantasyCupArchived === true,
        cupWinner: fplArchiveResult?.cupWinner || null,
        cupRunnerUp: fplArchiveResult?.cupRunnerUp || null,
        reset: fplResetResult,
      },
    };
  } catch (error) {
    await rollbackUnifiedArchive({
      schoolArchiveId: savedArchive?._id,
      fplSeasonNumber: fplSnapshot?.hasFplProgress ? archiveSeasonNumber : null,
    });
    throw error;
  }
}

module.exports = {
  validateArchiveRequest,
  findDuplicateArchive,
  loadLiveSeasonData,
  loadSeasonPlayers,
  resetLiveSeasonData,
  createSeasonArchive,
  resetSeasonWithoutArchive,
  archiveAndResetSeason,
  getNextArchiveSeasonNumber,
  resolveClosingLiveStatsSeasonNumber,
};
