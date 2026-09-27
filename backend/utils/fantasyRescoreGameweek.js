const Match = require('../models/Match');
const FantasySquad = require('../models/FantasySquad');
const { FANTASY_MATCH_COMPETITION } = require('./fantasyLeagueScope');
const { isMatchweekComplete } = require('./fantasyMatchweek');
const { rescoreGameweek } = require('./fantasyScoring');
const { backfillMissingSnapshotsForGameweek } = require('./fantasyGameweekSnapshot');
const { syncFantasyPerformanceForGameweek } = require('./fantasyMatchEventsSync');

/** Remove invalid squad rows that break unique (fantasyUser, matchweek) upserts. */
async function cleanupOrphanFantasySquads() {
  return FantasySquad.deleteMany({
    $or: [
      { matchweek: null },
      { matchweek: undefined },
      { matchweek: { $exists: false } },
    ],
  });
}

/**
 * Deterministic gameweek rescore from authoritative performance rows.
 * Safe to run multiple times — replaces squad.points, does not increment.
 */
async function runGameweekRescore(matchweek, options = {}) {
  const mw = Number(matchweek);
  if (!Number.isFinite(mw) || mw < 1) {
    return { ok: false, message: 'Invalid matchweek.' };
  }

  const { forceAutosubRecalc = true } = options;
  await cleanupOrphanFantasySquads();

  const matches = await Match.find({
    competition: FANTASY_MATCH_COMPETITION,
    isPublished: true,
  })
    .select('matchweek isPlayed matchState isVoided competition isPublished')
    .lean();

  const backfilled = await backfillMissingSnapshotsForGameweek(mw);
  const eventSynced = await syncFantasyPerformanceForGameweek(mw);
  await rescoreGameweek(mw, matches, { forceAutosubRecalc });

  return {
    ok: true,
    matchweek: mw,
    backfilled,
    eventSynced,
    complete: isMatchweekComplete(matches, mw),
  };
}

module.exports = {
  cleanupOrphanFantasySquads,
  runGameweekRescore,
};
