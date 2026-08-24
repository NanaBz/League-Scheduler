const assert = require('assert');

/**
 * Pure helper mirroring getLiveSeasonStatsNumber logic for unit tests without MongoDB.
 */
function computeLiveSeasonStatsNumber({ latestArchiveSeasonNumber, latestStatsSeasonNumber }) {
  if (latestArchiveSeasonNumber != null) {
    return latestArchiveSeasonNumber + 1;
  }
  return latestStatsSeasonNumber ?? 1;
}

function run() {
  assert.strictEqual(computeLiveSeasonStatsNumber({ latestArchiveSeasonNumber: null, latestStatsSeasonNumber: null }), 1);
  assert.strictEqual(computeLiveSeasonStatsNumber({ latestArchiveSeasonNumber: null, latestStatsSeasonNumber: 3 }), 3);
  assert.strictEqual(computeLiveSeasonStatsNumber({ latestArchiveSeasonNumber: 1, latestStatsSeasonNumber: 1 }), 2);
  assert.strictEqual(computeLiveSeasonStatsNumber({ latestArchiveSeasonNumber: 5, latestStatsSeasonNumber: 5 }), 6);

  console.log('seasonContext live stats bucket tests passed');
}

run();
