const FantasySquad = require('../models/FantasySquad');
const {
  squadIdsFromSlots,
  playerIdsFromLineup,
  countSquadSlots,
} = require('./fantasySquadFromSnapshot');

/** Strip chip flags from a restored pick-team payload. */
function sanitizeRestoredLineup(lineup) {
  if (!lineup) return null;
  const copy = JSON.parse(JSON.stringify(lineup));
  copy.chipUsed = null;
  return copy;
}

/** True when every lineup player is present in the restored 13-player squad. */
function lineupMatchesSquad(lineup, slots) {
  if (!lineup || !slots || countSquadSlots(slots) !== 13) return false;
  const squadSet = new Set(squadIdsFromSlots(slots));
  const lineupIds = playerIdsFromLineup(lineup);
  if (lineupIds.length !== 13) return false;
  return lineupIds.every((id) => squadSet.has(id));
}

/**
 * Find the most recent pre-gameweek lineup that matches a restored squad.
 * Used after Free Hit revert and for gameweek snapshot backfill.
 */
async function resolvePriorLineupForSquad(fantasyUserId, beforeMatchweek, slots) {
  const mw = Number(beforeMatchweek);
  if (!Number.isFinite(mw) || mw < 1) return null;
  if (!slots || countSquadSlots(slots) !== 13) return null;

  const snaps = await FantasySquad.find({
    fantasyUser: fantasyUserId,
    matchweek: { $lt: mw },
    chipUsed: { $ne: 'FH' },
  })
    .sort({ matchweek: -1 })
    .select('lineup matchweek')
    .lean();

  for (const snap of snaps) {
    if (lineupMatchesSquad(snap.lineup, slots)) {
      return sanitizeRestoredLineup(snap.lineup);
    }
  }

  return null;
}

module.exports = {
  sanitizeRestoredLineup,
  lineupMatchesSquad,
  resolvePriorLineupForSquad,
};
