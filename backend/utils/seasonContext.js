const Season = require('../models/Season');
const PlayerStats = require('../models/PlayerStats');

/**
 * Highest archived season number (Season collection). Used for archive UI flags only —
 * not for live fixtures or PlayerStats buckets.
 */
async function getPrimaryActiveSeasonNumber() {
  const latest = await Season.findOne().sort({ seasonNumber: -1 }).select('seasonNumber').lean();
  return latest?.seasonNumber ?? null;
}

/**
 * Live PlayerStats / fixture season bucket. After an archive exists, live play uses
 * archive.seasonNumber + 1 so new stats do not collide with archived snapshots.
 */
async function getLiveSeasonStatsNumber() {
  const latestArchive = await Season.findOne().sort({ seasonNumber: -1 }).select('seasonNumber').lean();
  if (latestArchive) {
    return latestArchive.seasonNumber + 1;
  }
  const latestStats = await PlayerStats.findOne().sort({ seasonNumber: -1 }).select('seasonNumber').lean();
  return latestStats?.seasonNumber ?? 1;
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
  return getLiveSeasonStatsNumber();
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
  return getLiveSeasonStatsNumber();
}

module.exports = {
  getPrimaryActiveSeasonNumber,
  getLiveSeasonStatsNumber,
  syncSeasonActiveFlagsToLatest,
  resolveStatsSeasonNumber,
  resolveSeasonNumberForMatch,
  seasonNumberForNewFixtures,
};
