const FantasySquad = require('../models/FantasySquad');

const FULL_SQUAD_SIZE = 13;

async function loadLineupSnapshotsSorted(fantasyUserId) {
  return FantasySquad.find({
    fantasyUser: fantasyUserId,
    lineup: { $ne: null },
  })
    .sort({ matchweek: 1 })
    .select('matchweek transfersIn transfersOut points')
    .lean();
}

/**
 * GW1 snapshot backfilled from a GW2+ joiner's draft — not a real GW1 team.
 */
function detectPhantomGw1FromSnapshots(squads) {
  const gw1 = squads.find((s) => Number(s.matchweek) === 1);
  const gw2 = squads.find((s) => Number(s.matchweek) === 2);
  if (!gw1 || !gw2) return false;

  const g1ins = gw1.transfersIn?.length || 0;
  const g1outs = gw1.transfersOut?.length || 0;
  const g2ins = gw2.transfersIn?.length || 0;
  const g2outs = gw2.transfersOut?.length || 0;

  if (g1ins !== 0 || g1outs !== 0) return false;

  // GW2+ joiner signature: entire first squad mistaken as transfers (GW1 never records transfers).
  if (g2ins >= FULL_SQUAD_SIZE && g2outs === 0) return true;
  if (g2ins >= FULL_SQUAD_SIZE && g2outs >= FULL_SQUAD_SIZE) return true;

  return false;
}

/** First gameweek the manager actually entered Fantasy (ignores backfilled GW1). */
async function getManagerDebutGameweekForTransfers(fantasyUserId) {
  const squads = await loadLineupSnapshotsSorted(fantasyUserId);
  if (!squads.length) return null;
  if (detectPhantomGw1FromSnapshots(squads)) return 2;
  return Number(squads[0].matchweek);
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

async function hasRealLineupBeforeGameweek(fantasyUserId, gameweek) {
  const squads = await loadLineupSnapshotsSorted(fantasyUserId);
  const mw = Number(gameweek);
  const phantomGw1 = detectPhantomGw1FromSnapshots(squads);

  for (const snap of squads) {
    const smw = Number(snap.matchweek);
    if (smw >= mw) break;
    if (phantomGw1 && smw === 1) continue;
    return true;
  }
  return false;
}

async function shouldRecordSquadTransfers(fantasyUserId, gameweek, existingDraftPlayerCount) {
  const mw = Number(gameweek);
  if (mw <= 1) return false;
  return managerHadEstablishedSquadBeforeSave(fantasyUserId, mw, existingDraftPlayerCount);
}

async function managerHadEstablishedSquadBeforeSave(fantasyUserId, gameweek, existingDraftPlayerCount) {
  const mw = Number(gameweek);

  if (await hasRealLineupBeforeGameweek(fantasyUserId, mw)) return true;

  const currentGwLineup = await FantasySquad.exists({
    fantasyUser: fantasyUserId,
    matchweek: mw,
    lineup: { $ne: null },
  });
  if (currentGwLineup) return true;

  if (Number(existingDraftPlayerCount) >= FULL_SQUAD_SIZE) return true;

  return false;
}

/**
 * Transfers that count toward a hit (excludes misclassified initial squad construction).
 * Uses debut gameweek, not raw first lineup row (which may be a phantom GW1 backfill).
 */
function resolveTransfersMadeForPenalty(snapshot, debutGameweek) {
  if (!snapshot) return 0;
  const ins = snapshot.transfersIn?.length || 0;
  const outs = snapshot.transfersOut?.length || 0;
  const raw = Math.max(ins, outs);
  if (raw === 0) return 0;

  const mw = Number(snapshot.matchweek);
  if (debutGameweek == null) {
    return looksLikeMisclassifiedInitialSetup({ ...snapshot, matchweek: mw }, mw) ? 0 : 0;
  }
  if (mw === debutGameweek && looksLikeMisclassifiedInitialSetup(snapshot, debutGameweek)) {
    return 0;
  }
  return raw;
}

async function isManagerBuildingFirstSquad(fantasyUserId, gameweek) {
  const mw = Number(gameweek);
  if (await hasRealLineupBeforeGameweek(fantasyUserId, mw)) return false;

  const currentGwLineup = await FantasySquad.exists({
    fantasyUser: fantasyUserId,
    matchweek: mw,
    lineup: { $ne: null },
  });
  return !currentGwLineup;
}

function looksLikeMisclassifiedInitialSetup(snapshot, debutGw) {
  if (!snapshot || debutGw == null) return false;
  if (Number(snapshot.matchweek) !== debutGw) return false;
  const ins = snapshot.transfersIn?.length || 0;
  const outs = snapshot.transfersOut?.length || 0;
  if (ins >= FULL_SQUAD_SIZE && outs === 0) return true;
  if (ins >= FULL_SQUAD_SIZE && outs >= FULL_SQUAD_SIZE) return true;
  return false;
}

/** Strict scan — GW2 initial-squad transfer signature only (small set). */
async function findStrictPhantomGw1SquadRows() {
  const gw1Rows = await FantasySquad.find({
    matchweek: 1,
    lineup: { $ne: null },
  })
    .select('fantasyUser transfersIn transfersOut points')
    .lean();

  const phantoms = [];
  for (const gw1 of gw1Rows) {
    const squads = await loadLineupSnapshotsSorted(gw1.fantasyUser);
    if (detectPhantomGw1FromSnapshots(squads)) {
      phantoms.push({
        fantasyUserId: String(gw1.fantasyUser),
        squadId: String(gw1._id),
        points: gw1.points || 0,
        reason: 'gw2_initial_squad_transfer_signature',
      });
    }
  }
  return phantoms;
}

/**
 * GW1 rows to drop for managers receiving debut transfer repair (late GW2+ joiners).
 * Does not scan the whole league — only users already flagged for debut transfer fix.
 */
async function findPhantomGw1RowsForDebutRepairs(debutAnomalyUserIds) {
  const ids = [...new Set((debutAnomalyUserIds || []).map(String))];
  if (!ids.length) return [];

  const phantoms = [];
  for (const fantasyUserId of ids) {
    const gw1 = await FantasySquad.findOne({
      fantasyUser: fantasyUserId,
      matchweek: 1,
      lineup: { $ne: null },
    })
      .select('_id points transfersIn transfersOut')
      .lean();
    if (!gw1) continue;

    const g1ins = gw1.transfersIn?.length || 0;
    const g1outs = gw1.transfersOut?.length || 0;
    if (g1ins !== 0 || g1outs !== 0) continue;

    phantoms.push({
      fantasyUserId,
      squadId: String(gw1._id),
      points: gw1.points || 0,
      reason: 'debut_repair_companion_gw1',
    });
  }
  return phantoms;
}

module.exports = {
  FULL_SQUAD_SIZE,
  shouldRecordSquadTransfers,
  managerHadEstablishedSquadBeforeSave,
  getFirstLineupGameweek,
  getManagerDebutGameweekForTransfers,
  detectPhantomGw1FromSnapshots,
  hasRealLineupBeforeGameweek,
  resolveTransfersMadeForPenalty,
  isManagerBuildingFirstSquad,
  looksLikeMisclassifiedInitialSetup,
  findStrictPhantomGw1SquadRows,
  findPhantomGw1RowsForDebutRepairs,
};
