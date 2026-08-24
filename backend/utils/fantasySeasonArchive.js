const { getLiveSeasonStatsNumber } = require('./seasonContext');
const { archiveFantasySeasonFull } = require('./fantasySeasonArchiveSnapshot');
const {
  rankEntriesForArchive,
  buildManagerSeasonResultDocs,
} = require('./fantasySeasonArchiveHelpers');

async function resolveFantasyArchiveSeasonMeta() {
  const seasonNumber = await getLiveSeasonStatsNumber();
  return { seasonNumber, seasonName: `Season ${seasonNumber}` };
}

/**
 * Snapshot current FPL season before wipe.
 * Delegates to archiveFantasySeasonFull for manager history, Fantasy Cup, achievements, and player stats.
 */
async function archiveFantasySeasonHistory(context = null) {
  const result = await archiveFantasySeasonFull(context);
  if (!result.archived) {
    return result;
  }
  return {
    archived: true,
    seasonNumber: result.seasonNumber,
    seasonName: result.seasonName,
    managerCount: result.managerCount,
    seasonComplete: result.seasonComplete,
    achievementCount: result.achievementCount,
    fantasyCupArchived: result.fantasyCupArchived,
  };
}

module.exports = {
  rankEntriesForArchive,
  buildManagerSeasonResultDocs,
  resolveFantasyArchiveSeasonMeta,
  archiveFantasySeasonHistory,
};
