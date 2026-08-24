const FantasySquad = require('../models/FantasySquad');
const FantasyDraftSquad = require('../models/FantasyDraftSquad');
const FantasyMatchPerformance = require('../models/FantasyMatchPerformance');
const PlayerAvailability = require('../models/PlayerAvailability');
const FantasyCup = require('../models/FantasyCup');
const FantasyCupTie = require('../models/FantasyCupTie');
const { archiveFantasySeasonHistory } = require('./fantasySeasonArchive');

/** Wipe fantasy progress so the season restarts at gameweek 1. Keeps FantasyUser accounts. */
async function resetFantasySeasonData() {
  const archiveResult = await archiveFantasySeasonHistory();

  const [squads, drafts, performances, availability, cups, cupTies] = await Promise.all([
    FantasySquad.deleteMany({}),
    FantasyDraftSquad.deleteMany({}),
    FantasyMatchPerformance.deleteMany({}),
    PlayerAvailability.deleteMany({}),
    FantasyCup.deleteMany({}),
    FantasyCupTie.deleteMany({}),
  ]);
  return {
    archiveResult,
    squadsRemoved: squads.deletedCount || 0,
    draftSquadsRemoved: drafts.deletedCount || 0,
    performancesRemoved: performances.deletedCount || 0,
    availabilityRemoved: availability.deletedCount || 0,
    cupsRemoved: cups.deletedCount || 0,
    cupTiesRemoved: cupTies.deletedCount || 0,
  };
}

module.exports = { resetFantasySeasonData };
