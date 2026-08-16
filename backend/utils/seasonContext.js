const Season = require('../models/Season');
const PlayerStats = require('../models/PlayerStats');

/**
 * Current season for stats, fantasy, and new fixtures: the **highest seasonNumber** among
 * `Season` documents. `isActive` flags are kept in sync via syncSeasonActiveFlagsToLatest().
 */
async function getPrimaryActiveSeasonNumber() {
  const latest = await Season.findOne().sort({ seasonNumber: -1 }).select('seasonNumber').lean();
  return latest?.seasonNumber ?? null;
}

/** Set isActive=true only on the latest Season (by seasonNumber); all others false. */
async function syncSeasonActiveFlagsToLatest() {
  const latest = await Season.findOne().sort({ seasonNumber: -1 }).select('seasonNumber').lean();
  if (!latest) return null;
  await Season.updateMany({}, { $set: { isActive: false } });
  await Season.updateOne({ seasonNumber: latest.seasonNumber }, { $set: { isActive: true } });
  return latest.seasonNumber;
}

/**
 * Prefer an explicitly active season; otherwise use the highest seasonNumber that
 * already has PlayerStats rows (covers databases where `isActive` was never set).
 */
async function resolveStatsSeasonNumber({ competition, team } = {}) {
  const activeNumber = await getPrimaryActiveSeasonNumber();
  if (activeNumber != null) return activeNumber;

  const statsFilter = {};
  if (competition) statsFilter.competition = competition;
  if (team) statsFilter.team = team;

  const latestStats = await PlayerStats.findOne(statsFilter)
    .sort({ seasonNumber: -1 })
    .select('seasonNumber')
    .lean();
  if (latestStats) return latestStats.seasonNumber;

  const latestSeason = await Season.findOne().sort({ seasonNumber: -1 }).lean();
  return latestSeason ? latestSeason.seasonNumber : null;
}

/**
 * PlayerStats bucket for a fixture: use the match's season once set (at fixture generation
 * or first pinned save); otherwise align with public stats resolution for that competition.
 */
async function resolveSeasonNumberForMatch(match) {
  if (match.seasonNumber != null && match.seasonNumber !== '' && !Number.isNaN(Number(match.seasonNumber))) {
    return Number(match.seasonNumber);
  }
  return resolveStatsSeasonNumber({ competition: match.competition });
}

/** Season number to stamp on newly generated fixtures */
async function seasonNumberForNewFixtures() {
  const sn = await getPrimaryActiveSeasonNumber();
  if (sn != null) return sn;
  const latest = await Season.findOne().sort({ seasonNumber: -1 }).lean();
  return latest?.seasonNumber ?? 1;
}

module.exports = {
  getPrimaryActiveSeasonNumber,
  syncSeasonActiveFlagsToLatest,
  resolveStatsSeasonNumber,
  resolveSeasonNumberForMatch,
  seasonNumberForNewFixtures,
};
