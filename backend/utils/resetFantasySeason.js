const FantasySquad = require('../models/FantasySquad');
const FantasyDraftSquad = require('../models/FantasyDraftSquad');
const FantasyMatchPerformance = require('../models/FantasyMatchPerformance');
const PlayerAvailability = require('../models/PlayerAvailability');

/** Wipe fantasy progress so the season restarts at gameweek 1. Keeps FantasyUser accounts. */
async function resetFantasySeasonData() {
  const [squads, drafts, performances, availability] = await Promise.all([
    FantasySquad.deleteMany({}),
    FantasyDraftSquad.deleteMany({}),
    FantasyMatchPerformance.deleteMany({}),
    PlayerAvailability.deleteMany({}),
  ]);
  return {
    squadsRemoved: squads.deletedCount || 0,
    draftSquadsRemoved: drafts.deletedCount || 0,
    performancesRemoved: performances.deletedCount || 0,
    availabilityRemoved: availability.deletedCount || 0,
  };
}

module.exports = { resetFantasySeasonData };
