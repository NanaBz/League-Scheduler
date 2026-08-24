const FantasySquad = require('../models/FantasySquad');

const MAX_FREE_TRANSFERS = 2;
const BASE_FREE_TRANSFER = 1;
const HIT_POINTS_PER_TRANSFER = 4;
const TRANSFER_CHIPS = new Set(['WC', 'FH']);

function isUnlimitedTransferChip(chip) {
  return TRANSFER_CHIPS.has(chip);
}

/** Count transfer events in a gameweek snapshot (each in/out pair = 1). */
function countTransfersFromSnapshot(snapshot) {
  if (!snapshot) return 0;
  const ins = snapshot.transfersIn?.length || 0;
  const outs = snapshot.transfersOut?.length || 0;
  return Math.max(ins, outs);
}

/**
 * Free transfers available at the start of `gameweek` (GW2+).
 * Each week: bank = min(2, bank - used + 1).
 * WC/FH weeks do not consume transfers for hits, but also forfeit rollover — next GW starts at 1.
 */
function computeFreeTransferBankAtGameweek(priorSnapshots, gameweek) {
  const gw = Number(gameweek);
  if (gw <= 1) return BASE_FREE_TRANSFER;
  if (gw === 2) return BASE_FREE_TRANSFER;

  let bank = BASE_FREE_TRANSFER;
  for (let w = 2; w < gw; w += 1) {
    const snap = (priorSnapshots || []).find((s) => Number(s.matchweek) === w);
    if (isUnlimitedTransferChip(snap?.chipUsed)) {
      bank = BASE_FREE_TRANSFER;
      continue;
    }
    const used = countTransfersFromSnapshot(snap);
    bank = Math.min(MAX_FREE_TRANSFERS, bank - used + BASE_FREE_TRANSFER);
  }
  return bank;
}

function computeTransferHitPoints(transfersMade, freeAllowance, unlimitedTransfers) {
  if (unlimitedTransfers || transfersMade <= 0) return 0;
  const extra = Math.max(0, transfersMade - freeAllowance);
  return extra * HIT_POINTS_PER_TRANSFER;
}

async function loadPriorTransferSnapshots(fantasyUserId, beforeGameweek) {
  const gw = Number(beforeGameweek);
  if (gw <= 2) return [];
  return FantasySquad.find({
    fantasyUser: fantasyUserId,
    matchweek: { $gte: 2, $lt: gw },
  })
    .select('matchweek transfersIn transfersOut chipUsed')
    .sort({ matchweek: 1 })
    .lean();
}

async function getTransferStateForUser(fantasyUserId, currentGameweek, chipState = null) {
  const gw = Number(currentGameweek);
  if (gw <= 1) {
    return {
      freeTransfers: null,
      unlimitedTransfers: true,
      transfersMade: 0,
      extraTransfers: 0,
      transferCost: 0,
    };
  }

  const unlimitedTransfers = chipState?.unlimitedTransfers === true;
  const priorSnapshots = await loadPriorTransferSnapshots(fantasyUserId, gw);
  const freeTransfers = computeFreeTransferBankAtGameweek(priorSnapshots, gw);

  const currentSnap = await FantasySquad.findOne({
    fantasyUser: fantasyUserId,
    matchweek: gw,
  })
    .select('transfersIn transfersOut chipUsed')
    .lean();

  const transfersMade = unlimitedTransfers ? 0 : countTransfersFromSnapshot(currentSnap);
  const extraTransfers = unlimitedTransfers
    ? 0
    : Math.max(0, transfersMade - freeTransfers);
  const transferCost = computeTransferHitPoints(transfersMade, freeTransfers, unlimitedTransfers);

  return {
    freeTransfers: unlimitedTransfers ? null : freeTransfers,
    unlimitedTransfers,
    transfersMade,
    extraTransfers,
    transferCost,
  };
}

async function getTransferCostForGameweek(fantasyUserId, matchweek) {
  const mw = Number(matchweek);
  if (mw <= 1) return 0;

  const snap = await FantasySquad.findOne({
    fantasyUser: fantasyUserId,
    matchweek: mw,
  })
    .select('transfersIn transfersOut chipUsed')
    .lean();

  if (!snap) return 0;
  if (isUnlimitedTransferChip(snap.chipUsed)) return 0;

  const priorSnapshots = await loadPriorTransferSnapshots(fantasyUserId, mw);
  const freeAllowance = computeFreeTransferBankAtGameweek(priorSnapshots, mw);
  const transfersMade = countTransfersFromSnapshot(snap);
  return computeTransferHitPoints(transfersMade, freeAllowance, false);
}

module.exports = {
  MAX_FREE_TRANSFERS,
  BASE_FREE_TRANSFER,
  HIT_POINTS_PER_TRANSFER,
  isUnlimitedTransferChip,
  countTransfersFromSnapshot,
  computeFreeTransferBankAtGameweek,
  computeTransferHitPoints,
  getTransferStateForUser,
  getTransferCostForGameweek,
};
