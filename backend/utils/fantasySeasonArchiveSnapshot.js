/**
 * Build, persist, verify, and roll back FPL season archives.
 * Separate from school Agha Cup — Fantasy Cup only (ACFPL).
 */

const mongoose = require('mongoose');
const FantasySquad = require('../models/FantasySquad');
const FantasyCup = require('../models/FantasyCup');
const FantasyCupTie = require('../models/FantasyCupTie');
const FantasyUser = require('../models/FantasyUser');
const Player = require('../models/Player');
const FantasyMatchPerformance = require('../models/FantasyMatchPerformance');
const FantasyManagerSeasonResult = require('../models/FantasyManagerSeasonResult');
const FantasyManagerAchievement = require('../models/FantasyManagerAchievement');
const FantasyCupSeasonArchive = require('../models/FantasyCupSeasonArchive');
const FantasyPlayerSeasonStats = require('../models/FantasyPlayerSeasonStats');
const { buildOverallLeagueEntries } = require('./fantasyOverallLeague');
const { getLiveSeasonStatsNumber } = require('./seasonContext');
const { loadPlayerStatsMaps } = require('./fantasyPlayerStats');
const {
  rankEntriesForArchive,
  buildManagerSeasonResultDocs,
} = require('./fantasySeasonArchiveHelpers');

function snapshotCupTie(tie) {
  const snap = {
    round: tie.round,
    gameweek: tie.gameweek,
    bracketSlot: tie.bracketSlot,
    homeFantasyUser: tie.homeFantasyUser,
    awayFantasyUser: tie.awayFantasyUser,
    homeTeamName: tie.homeTeamName,
    awayTeamName: tie.awayTeamName,
    homePoints: tie.homePoints ?? null,
    awayPoints: tie.awayPoints ?? null,
    winnerFantasyUser: tie.winnerFantasyUser ?? null,
    resolved: Boolean(tie.resolved),
  };
  if (tie.tiebreakMethod) {
    snap.tiebreakMethod = tie.tiebreakMethod;
  }
  return snap;
}

/**
 * Derive Fantasy Cup champion and runner-up from the completed final tie.
 * Returns null runner-up if the final is not resolved — never guesses from league rank.
 */
function resolveFantasyCupFinalOutcome(finalTie, userById = new Map()) {
  if (!finalTie || !finalTie.resolved || !finalTie.winnerFantasyUser) {
    return {
      winner: null,
      runnerUp: null,
      reason: 'final_not_resolved',
    };
  }

  const winnerId = String(finalTie.winnerFantasyUser);
  const winnerIsHome = String(finalTie.homeFantasyUser) === winnerId;
  const runnerUpUserId = winnerIsHome ? finalTie.awayFantasyUser : finalTie.homeFantasyUser;
  const winnerUser = userById.get(winnerId);
  const runnerUser = userById.get(String(runnerUpUserId));

  return {
    winner: {
      fantasyUserId: finalTie.winnerFantasyUser,
      teamName: winnerIsHome ? finalTie.homeTeamName : finalTie.awayTeamName,
      managerName: winnerUser?.managerName || '',
    },
    runnerUp: {
      fantasyUserId: runnerUpUserId,
      teamName: winnerIsHome ? finalTie.awayTeamName : finalTie.homeTeamName,
      managerName: runnerUser?.managerName || '',
    },
    reason: null,
  };
}

function buildAchievementDocs({
  seasonNumber,
  seasonName,
  academicYear,
  semester,
  leagueEntries,
  cupOutcome,
  archivedAt = new Date(),
}) {
  const docs = [];
  const ranked = rankEntriesForArchive(leagueEntries || []);
  const champion = ranked.find((e) => e.pos === 1);
  const runnerUp = ranked.find((e) => e.pos === 2);

  if (champion) {
    docs.push({
      fantasyUserId: new mongoose.Types.ObjectId(champion.fantasyUserId),
      seasonNumber,
      seasonName,
      academicYear,
      semester,
      competition: 'overall-league',
      achievementType: 'fpl_champion',
      teamName: champion.team,
      managerName: champion.user,
      finalRank: 1,
      archivedAt,
    });
  }

  if (runnerUp) {
    docs.push({
      fantasyUserId: new mongoose.Types.ObjectId(runnerUp.fantasyUserId),
      seasonNumber,
      seasonName,
      academicYear,
      semester,
      competition: 'overall-league',
      achievementType: 'fpl_runner_up',
      teamName: runnerUp.team,
      managerName: runnerUp.user,
      finalRank: 2,
      archivedAt,
    });
  }

  if (cupOutcome?.winner) {
    docs.push({
      fantasyUserId: cupOutcome.winner.fantasyUserId,
      seasonNumber,
      seasonName,
      academicYear,
      semester,
      competition: 'fantasy-cup',
      achievementType: 'fantasy_cup_champion',
      teamName: cupOutcome.winner.teamName,
      managerName: cupOutcome.winner.managerName,
      archivedAt,
    });
  }

  if (cupOutcome?.runnerUp) {
    docs.push({
      fantasyUserId: cupOutcome.runnerUp.fantasyUserId,
      seasonNumber,
      seasonName,
      academicYear,
      semester,
      competition: 'fantasy-cup',
      achievementType: 'fantasy_cup_runner_up',
      teamName: cupOutcome.runnerUp.teamName,
      managerName: cupOutcome.runnerUp.managerName,
      archivedAt,
    });
  }

  return docs;
}

async function buildGameweekPointsByPlayer() {
  const rows = await FantasyMatchPerformance.aggregate([
    {
      $group: {
        _id: { player: '$player', matchweek: '$matchweek' },
        points: { $sum: '$totalPoints' },
      },
    },
  ]);

  const byPlayer = new Map();
  for (const row of rows) {
    const pid = String(row._id.player);
    if (!byPlayer.has(pid)) byPlayer.set(pid, []);
    byPlayer.get(pid).push({
      matchweek: row._id.matchweek,
      points: row.points || 0,
    });
  }

  for (const [, gws] of byPlayer) {
    gws.sort((a, b) => a.matchweek - b.matchweek);
  }
  return byPlayer;
}

async function buildFantasyPlayerStatsSnapshot(seasonNumber) {
  const [{ totalPointsMap, selectionPercentageMap }, players, gwByPlayer] = await Promise.all([
    loadPlayerStatsMaps(),
    Player.find().select('name position fantasyPrice').lean(),
    buildGameweekPointsByPlayer(),
  ]);

  return players.map((p) => {
    const id = String(p._id);
    return {
      seasonNumber,
      playerId: p._id,
      playerName: p.name,
      position: p.position,
      fantasyPrice: p.fantasyPrice ?? 4.5,
      totalPoints: totalPointsMap.get(id) ?? 0,
      selectionPercentage: selectionPercentageMap.get(id) ?? 0,
      gameweekPoints: gwByPlayer.get(id) || [],
    };
  });
}

async function resolveFplArchiveContext(explicitContext = null) {
  if (explicitContext?.seasonNumber != null) {
    return {
      archiveSeasonNumber: explicitContext.seasonNumber,
      fplLiveSeasonNumber: explicitContext.fplLiveSeasonNumber ?? explicitContext.seasonNumber,
      seasonName: explicitContext.seasonName,
      academicYear: explicitContext.academicYear,
      semester: explicitContext.semester,
    };
  }

  const fplLiveSeasonNumber = await getLiveSeasonStatsNumber();
  return {
    archiveSeasonNumber: fplLiveSeasonNumber,
    fplLiveSeasonNumber,
    seasonName: `Season ${fplLiveSeasonNumber}`,
    academicYear: undefined,
    semester: undefined,
  };
}

/** Build in-memory FPL archive snapshot without persisting. */
async function buildFantasySeasonArchiveSnapshot(context = null) {
  const hasFplProgress = await FantasySquad.exists({});
  if (!hasFplProgress) {
    return { hasFplProgress: false, reason: 'no_fpl_progress' };
  }

  const ctx = await resolveFplArchiveContext(context);
  const { archiveSeasonNumber, fplLiveSeasonNumber, seasonName, academicYear, semester } = ctx;
  const archivedAt = context?.archivedAt || new Date();

  const league = await buildOverallLeagueEntries();
  const managerDocs = league.entries.length
    ? buildManagerSeasonResultDocs(league.entries, {
        seasonNumber: archiveSeasonNumber,
        seasonName,
        archivedAt,
      }).map((doc) => ({ ...doc, academicYear, semester }))
    : [];

  const [cupDoc, cupTies, users] = await Promise.all([
    FantasyCup.findOne({ seasonNumber: fplLiveSeasonNumber }).lean(),
    FantasyCupTie.find({ seasonNumber: fplLiveSeasonNumber }).sort({ gameweek: 1, bracketSlot: 1 }).lean(),
    FantasyUser.find({}).select('teamName managerName').lean(),
  ]);

  const userById = new Map(users.map((u) => [String(u._id), u]));
  const finalTie = cupTies.find((t) => t.round === 'F') || null;
  const cupOutcome = resolveFantasyCupFinalOutcome(finalTie, userById);

  const cupArchive = cupDoc || cupTies.length
    ? {
        seasonNumber: archiveSeasonNumber,
        fplLiveSeasonNumber,
        seasonName,
        academicYear,
        semester,
        status: cupDoc?.status || (cupOutcome.winner ? 'completed' : 'active'),
        qualifiedTeams: cupDoc?.qualifiedTeams || [],
        excludedTeams: cupDoc?.excludedTeams || [],
        ties: cupTies.map(snapshotCupTie),
        winner: cupOutcome.winner,
        runnerUp: cupOutcome.runnerUp,
        archivedAt,
      }
    : null;

  const achievementDocs = buildAchievementDocs({
    seasonNumber: archiveSeasonNumber,
    seasonName,
    academicYear,
    semester,
    leagueEntries: league.entries,
    cupOutcome,
    archivedAt,
  });

  const playerStatsDocs = await buildFantasyPlayerStatsSnapshot(archiveSeasonNumber);

  return {
    hasFplProgress: true,
    archiveSeasonNumber,
    fplLiveSeasonNumber,
    seasonName,
    academicYear,
    semester,
    league,
    managerDocs,
    cupArchive,
    cupOutcome,
    achievementDocs,
    playerStatsDocs,
    archivedAt,
  };
}

async function isFantasySeasonArchiveComplete(seasonNumber, snapshot) {
  const managerCount = await FantasyManagerSeasonResult.countDocuments({ seasonNumber });
  if (!managerCount) return false;

  if (snapshot?.cupArchive) {
    const cupExists = await FantasyCupSeasonArchive.exists({ seasonNumber });
    if (!cupExists) return false;
  }

  if (snapshot?.achievementDocs?.length) {
    const achievementCount = await FantasyManagerAchievement.countDocuments({ seasonNumber });
    if (achievementCount < snapshot.achievementDocs.length) return false;
  }

  if (snapshot?.playerStatsDocs?.length) {
    const playerStatsCount = await FantasyPlayerSeasonStats.countDocuments({ seasonNumber });
    if (playerStatsCount < snapshot.playerStatsDocs.length) return false;
  }

  return true;
}

async function persistFantasySeasonArchive(snapshot) {
  if (!snapshot?.hasFplProgress) {
    return { archived: false, reason: snapshot?.reason || 'no_fpl_progress' };
  }

  const { archiveSeasonNumber } = snapshot;

  const alreadyHasManagers = await FantasyManagerSeasonResult.exists({ seasonNumber: archiveSeasonNumber });
  if (alreadyHasManagers) {
    const complete = await isFantasySeasonArchiveComplete(archiveSeasonNumber, snapshot);
    if (complete) {
      return {
        archived: false,
        reason: 'already_archived',
        seasonNumber: archiveSeasonNumber,
        seasonName: snapshot.seasonName,
      };
    }
    await rollbackFantasySeasonArchive(archiveSeasonNumber);
  }

  try {
    if (snapshot.managerDocs.length) {
      await FantasyManagerSeasonResult.insertMany(snapshot.managerDocs, { ordered: true });
    }

    if (snapshot.cupArchive) {
      await FantasyCupSeasonArchive.create(snapshot.cupArchive);
    }

    if (snapshot.achievementDocs.length) {
      await FantasyManagerAchievement.insertMany(snapshot.achievementDocs, { ordered: true });
    }

    if (snapshot.playerStatsDocs.length) {
      await FantasyPlayerSeasonStats.insertMany(snapshot.playerStatsDocs, { ordered: true });
    }
  } catch (error) {
    await rollbackFantasySeasonArchive(archiveSeasonNumber);
    throw error;
  }

  return {
    archived: true,
    seasonNumber: archiveSeasonNumber,
    seasonName: snapshot.seasonName,
    managerCount: snapshot.managerDocs.length,
    achievementCount: snapshot.achievementDocs.length,
    playerStatsCount: snapshot.playerStatsDocs.length,
    fantasyCupArchived: Boolean(snapshot.cupArchive),
    cupWinner: snapshot.cupOutcome?.winner?.teamName || null,
    cupRunnerUp: snapshot.cupOutcome?.runnerUp?.teamName || null,
    seasonComplete: snapshot.league?.seasonComplete === true,
    recoveredPartialArchive: Boolean(alreadyHasManagers),
  };
}

async function verifyFantasySeasonArchive(seasonNumber, snapshot) {
  if (!snapshot?.hasFplProgress) return { ok: true, skipped: true };

  const managerCount = await FantasyManagerSeasonResult.countDocuments({ seasonNumber });
  if (snapshot.managerDocs.length && managerCount < snapshot.managerDocs.length) {
    const err = new Error('FPL manager history verification failed.');
    err.code = 'fpl_archive_verify_failed';
    throw err;
  }

  if (snapshot.cupArchive) {
    const cupDoc = await FantasyCupSeasonArchive.findOne({ seasonNumber }).lean();
    if (!cupDoc) {
      const err = new Error('Fantasy Cup archive verification failed.');
      err.code = 'fpl_cup_archive_verify_failed';
      throw err;
    }
  }

  const achievementCount = await FantasyManagerAchievement.countDocuments({ seasonNumber });
  if (snapshot.achievementDocs.length && achievementCount < snapshot.achievementDocs.length) {
    const err = new Error('FPL achievement archive verification failed.');
    err.code = 'fpl_achievement_verify_failed';
    throw err;
  }

  return { ok: true, managerCount, achievementCount };
}

async function rollbackFantasySeasonArchive(seasonNumber) {
  if (seasonNumber == null) return;
  await Promise.all([
    FantasyManagerSeasonResult.deleteMany({ seasonNumber }),
    FantasyCupSeasonArchive.deleteOne({ seasonNumber }),
    FantasyManagerAchievement.deleteMany({ seasonNumber }),
    FantasyPlayerSeasonStats.deleteMany({ seasonNumber }),
  ]);
}

/** Full FPL archive: build → persist → verify. Idempotent when already archived. */
async function archiveFantasySeasonFull(context = null) {
  const snapshot = await buildFantasySeasonArchiveSnapshot(context);
  if (!snapshot.hasFplProgress) {
    return { archived: false, reason: 'no_fpl_progress' };
  }

  const result = await persistFantasySeasonArchive(snapshot);
  if (result.archived) {
    await verifyFantasySeasonArchive(snapshot.archiveSeasonNumber, snapshot);
  }
  return { ...result, snapshot };
}

module.exports = {
  snapshotCupTie,
  resolveFantasyCupFinalOutcome,
  buildAchievementDocs,
  buildFantasySeasonArchiveSnapshot,
  persistFantasySeasonArchive,
  verifyFantasySeasonArchive,
  rollbackFantasySeasonArchive,
  isFantasySeasonArchiveComplete,
  archiveFantasySeasonFull,
};
