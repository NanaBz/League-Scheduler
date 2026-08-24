const mongoose = require('mongoose');
const Season = require('../models/Season');
const FantasySquad = require('../models/FantasySquad');
const FantasyManagerSeasonResult = require('../models/FantasyManagerSeasonResult');
const { buildOverallLeagueEntries } = require('./fantasyOverallLeague');
const { getPrimaryActiveSeasonNumber } = require('./seasonContext');

function rankEntriesForArchive(entries) {
  const sorted = [...entries].sort(
    (a, b) => b.total - a.total || b.gw - a.gw || a.team.localeCompare(b.team)
  );
  return sorted.map((row, index) => ({
    ...row,
    pos: index + 1,
  }));
}

/** Build immutable manager-season rows from live overall-league entries. */
function buildManagerSeasonResultDocs(entries, { seasonNumber, seasonName, archivedAt = new Date() }) {
  const ranked = rankEntriesForArchive(entries);
  const totalManagers = ranked.length;

  return ranked.map((entry) => ({
    fantasyUserId: new mongoose.Types.ObjectId(entry.fantasyUserId),
    teamName: entry.team,
    managerName: entry.user,
    seasonNumber,
    seasonName,
    finalPoints: entry.total,
    finalRank: entry.pos,
    totalManagers,
    archivedAt,
  }));
}

async function resolveFantasyArchiveSeasonMeta() {
  const seasonNumber = await getPrimaryActiveSeasonNumber();
  if (seasonNumber != null) {
    const season = await Season.findOne({ seasonNumber }).select('seasonNumber name').lean();
    return {
      seasonNumber,
      seasonName: season?.name || `Season ${seasonNumber}`,
    };
  }

  const latestSeason = await Season.findOne().sort({ seasonNumber: -1 }).select('seasonNumber name').lean();
  if (latestSeason) {
    return {
      seasonNumber: latestSeason.seasonNumber,
      seasonName: latestSeason.name || `Season ${latestSeason.seasonNumber}`,
    };
  }

  return { seasonNumber: 1, seasonName: 'Season 1' };
}

/**
 * Snapshot current FPL overall-league standings before season data is wiped.
 * Idempotent per seasonNumber — existing archived rows are never overwritten.
 */
async function archiveFantasySeasonHistory() {
  const hasFplProgress = await FantasySquad.exists({});
  if (!hasFplProgress) {
    return { archived: false, reason: 'no_fpl_progress' };
  }

  const { seasonNumber, seasonName } = await resolveFantasyArchiveSeasonMeta();

  const alreadyArchived = await FantasyManagerSeasonResult.exists({ seasonNumber });
  if (alreadyArchived) {
    return { archived: false, reason: 'already_archived', seasonNumber, seasonName };
  }

  const league = await buildOverallLeagueEntries();
  if (!league.entries.length) {
    return { archived: false, reason: 'no_managers', seasonNumber, seasonName };
  }

  const docs = buildManagerSeasonResultDocs(league.entries, { seasonNumber, seasonName });
  await FantasyManagerSeasonResult.insertMany(docs, { ordered: true });

  return {
    archived: true,
    seasonNumber,
    seasonName,
    managerCount: docs.length,
    seasonComplete: league.seasonComplete === true,
  };
}

module.exports = {
  rankEntriesForArchive,
  buildManagerSeasonResultDocs,
  resolveFantasyArchiveSeasonMeta,
  archiveFantasySeasonHistory,
};
