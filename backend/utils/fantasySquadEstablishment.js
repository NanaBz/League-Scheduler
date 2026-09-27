const FantasySquad = require('../models/FantasySquad');

const FULL_SQUAD_SIZE = 13;

/**
 * Whether squad changes in this gameweek should be recorded as transfers (GW2+).
 * Initial first-ever squad setup is never recorded as transfers.
 */
async function shouldRecordSquadTransfers(fantasyUserId, gameweek, existingDraftPlayerCount) {
  const mw = Number(gameweek);
  if (mw <= 1) return false;
  return managerHadEstablishedSquadBeforeSave(fantasyUserId, mw, existingDraftPlayerCount);
}

/**
 * Established = prior-GW lineup snapshot, current-GW lineup already saved, or draft already held 13 players.
 */
async function managerHadEstablishedSquadBeforeSave(fantasyUserId, gameweek, existingDraftPlayerCount) {
  const mw = Number(gameweek);

  const priorGwLineup = await FantasySquad.exists({
    fantasyUser: fantasyUserId,
    matchweek: { $lt: mw },
    lineup: { $ne: null },
  });
  if (priorGwLineup) return true;

  const currentGwLineup = await FantasySquad.exists({
    fantasyUser: fantasyUserId,
    matchweek: mw,
    lineup: { $ne: null },
  });
  if (currentGwLineup) return true;

  if (Number(existingDraftPlayerCount) >= FULL_SQUAD_SIZE) return true;

  return false;
}

async function getFirstLineupGameweek(fantasyUserId) {
  const first = await FantasySquad.findOne({
    fantasyUser: fantasyUserId,
    lineup: { $ne: null },
  })
    .sort({ matchweek: 1 })
    .select('matchweek')
    .lean();
  if (!first) return null;
  return Number(first.matchweek);
}

/**
 * Transfers that count toward a hit (excludes misclassified initial squad construction).
 */
function resolveTransfersMadeForPenalty(snapshot, firstLineupGameweek) {
  if (!snapshot) return 0;
  const ins = snapshot.transfersIn?.length || 0;
  const outs = snapshot.transfersOut?.length || 0;
  const raw = Math.max(ins, outs);
  if (raw === 0) return 0;

  const mw = Number(snapshot.matchweek);
  if (firstLineupGameweek == null) {
    return looksLikeMisclassifiedInitialSetup({ ...snapshot, matchweek: mw }, mw) ? 0 : 0;
  }
  if (mw === firstLineupGameweek && looksLikeMisclassifiedInitialSetup(snapshot, firstLineupGameweek)) {
    return 0;
  }
  return raw;
}

/** UI hint: manager has not yet established a squad this season (no saved pick-team). */
async function isManagerBuildingFirstSquad(fantasyUserId, gameweek) {
  const mw = Number(gameweek);
  const priorGwLineup = await FantasySquad.exists({
    fantasyUser: fantasyUserId,
    matchweek: { $lt: mw },
    lineup: { $ne: null },
  });
  if (priorGwLineup) return false;

  const currentGwLineup = await FantasySquad.exists({
    fantasyUser: fantasyUserId,
    matchweek: mw,
    lineup: { $ne: null },
  });
  return !currentGwLineup;
}

/** Legacy rows: full initial squad mistaken for transfers (e.g. 13 players in, 0 out). */
function looksLikeMisclassifiedInitialSetup(snapshot, firstLineupGw) {
  if (!snapshot || firstLineupGw == null) return false;
  if (Number(snapshot.matchweek) !== firstLineupGw) return false;
  const ins = snapshot.transfersIn?.length || 0;
  const outs = snapshot.transfersOut?.length || 0;
  if (ins >= FULL_SQUAD_SIZE && outs === 0) return true;
  if (ins >= FULL_SQUAD_SIZE && outs >= FULL_SQUAD_SIZE) return true;
  return false;
}

module.exports = {
  FULL_SQUAD_SIZE,
  shouldRecordSquadTransfers,
  managerHadEstablishedSquadBeforeSave,
  getFirstLineupGameweek,
  resolveTransfersMadeForPenalty,
  isManagerBuildingFirstSquad,
  looksLikeMisclassifiedInitialSetup,
};
