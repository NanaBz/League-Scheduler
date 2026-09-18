const FantasyUser = require('../models/FantasyUser');
const FantasySquad = require('../models/FantasySquad');
const FantasyDraftSquad = require('../models/FantasyDraftSquad');
const FantasyMatchPerformance = require('../models/FantasyMatchPerformance');
const PlayerAvailability = require('../models/PlayerAvailability');
const FantasyCup = require('../models/FantasyCup');
const FantasyCupTie = require('../models/FantasyCupTie');
const FantasyMatchweek = require('../models/FantasyMatchweek');

/**
 * Full fantasy reset for a clean season: removes all accounts and live gameplay state.
 * Preserves ACPL league data (teams, players, matches, playerstats, seasons, admins)
 * and optional FPL archive collections (manager results, achievements, cup archives, player stats).
 *
 * @param {object} options
 * @param {boolean} [options.deleteUsers=true]
 */
async function resetFantasyFull({ deleteUsers = true } = {}) {
  const [
    users,
    squads,
    drafts,
    performances,
    availability,
    cups,
    cupTies,
    matchweeks,
  ] = await Promise.all([
    deleteUsers ? FantasyUser.deleteMany({}) : { deletedCount: 0 },
    FantasySquad.deleteMany({}),
    FantasyDraftSquad.deleteMany({}),
    FantasyMatchPerformance.deleteMany({}),
    PlayerAvailability.deleteMany({}),
    FantasyCup.deleteMany({}),
    FantasyCupTie.deleteMany({}),
    FantasyMatchweek.deleteMany({}),
  ]);

  return {
    usersRemoved: users.deletedCount || 0,
    squadsRemoved: squads.deletedCount || 0,
    draftSquadsRemoved: drafts.deletedCount || 0,
    performancesRemoved: performances.deletedCount || 0,
    availabilityRemoved: availability.deletedCount || 0,
    cupsRemoved: cups.deletedCount || 0,
    cupTiesRemoved: cupTies.deletedCount || 0,
    matchweeksRemoved: matchweeks.deletedCount || 0,
  };
}

module.exports = { resetFantasyFull };
