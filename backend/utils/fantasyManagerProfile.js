const Season = require('../models/Season');
const FantasyManagerSeasonResult = require('../models/FantasyManagerSeasonResult');
const { buildOverallLeagueEntries } = require('./fantasyOverallLeague');
const { getLiveSeasonStatsNumber } = require('./seasonContext');
const { mapHistoryRow } = require('./fantasyManagerHistory');

async function resolveCurrentSeasonMeta() {
  const seasonNumber = await getLiveSeasonStatsNumber();
  if (seasonNumber == null) {
    return { seasonNumber: null, seasonName: 'Current Season' };
  }

  const season = await Season.findOne({ seasonNumber }).select('seasonNumber name displayName').lean();
  return {
    seasonNumber,
    seasonName: season?.displayName || season?.name || `Season ${seasonNumber}`,
  };
}

function findUserOverallEntry(entries, fantasyUserId) {
  const id = String(fantasyUserId);
  return (entries || []).find((entry) => String(entry.fantasyUserId) === id) || null;
}

async function buildManagerProfilePayload(fantasyUserId) {
  const [historyDocs, league, seasonMeta] = await Promise.all([
    FantasyManagerSeasonResult.find({ fantasyUserId })
      .sort({ seasonNumber: -1 })
      .lean(),
    buildOverallLeagueEntries(),
    resolveCurrentSeasonMeta(),
  ]);

  const userEntry = findUserOverallEntry(league.entries, fantasyUserId);

  return {
    currentSeason: {
      seasonNumber: seasonMeta.seasonNumber,
      seasonName: seasonMeta.seasonName,
      totalPoints: userEntry?.total ?? 0,
      rank: userEntry?.pos ?? null,
      latestGameweekPoints: userEntry?.gw ?? 0,
      totalManagers: league.entries.length,
      preseason: league.preseason === true,
      seasonComplete: league.seasonComplete === true,
    },
    history: historyDocs.map(mapHistoryRow),
  };
}

module.exports = {
  resolveCurrentSeasonMeta,
  buildManagerProfilePayload,
};
