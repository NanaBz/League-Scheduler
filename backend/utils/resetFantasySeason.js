const FantasySquad = require('../models/FantasySquad');
const FantasyDraftSquad = require('../models/FantasyDraftSquad');
const FantasyMatchPerformance = require('../models/FantasyMatchPerformance');
const PlayerAvailability = require('../models/PlayerAvailability');
const FantasyCup = require('../models/FantasyCup');
const FantasyCupTie = require('../models/FantasyCupTie');
const FantasyMatchweek = require('../models/FantasyMatchweek');
const { archiveFantasySeasonFull } = require('./fantasySeasonArchiveSnapshot');
const { getLiveSeasonStatsNumber } = require('./seasonContext');

/**
 * Wipe fantasy progress so the season restarts at gameweek 1. Keeps FantasyUser accounts.
 * @param {object} options
 * @param {boolean} [options.skipArchive=false] — when true, assumes archive already persisted (unified reset)
 * @param {number} [options.fplSeasonNumber] — live FPL season bucket for matchweek cleanup
 * @param {object} [options.archiveContext] — passed to archive when skipArchive is false
 */
async function resetFantasySeasonData({
  skipArchive = false,
  fplSeasonNumber = null,
  archiveContext = null,
} = {}) {
  let archiveResult = { archived: false, reason: 'skipped' };

  if (!skipArchive) {
    archiveResult = await archiveFantasySeasonFull(archiveContext);
  }

  const closingSeasonNumber = fplSeasonNumber ?? archiveContext?.fplLiveSeasonNumber ?? (await getLiveSeasonStatsNumber());

  const [squads, drafts, performances, availability, cups, cupTies, matchweeks] = await Promise.all([
    FantasySquad.deleteMany({}),
    FantasyDraftSquad.deleteMany({}),
    FantasyMatchPerformance.deleteMany({}),
    PlayerAvailability.deleteMany({}),
    FantasyCup.deleteMany({}),
    FantasyCupTie.deleteMany({}),
    FantasyMatchweek.deleteMany({ seasonNumber: closingSeasonNumber }),
  ]);

  return {
    archiveResult,
    fplSeasonNumber: closingSeasonNumber,
    squadsRemoved: squads.deletedCount || 0,
    draftSquadsRemoved: drafts.deletedCount || 0,
    performancesRemoved: performances.deletedCount || 0,
    availabilityRemoved: availability.deletedCount || 0,
    cupsRemoved: cups.deletedCount || 0,
    cupTiesRemoved: cupTies.deletedCount || 0,
    matchweeksRemoved: matchweeks.deletedCount || 0,
  };
}

module.exports = { resetFantasySeasonData };
