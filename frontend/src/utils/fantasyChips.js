/** Fantasy chip availability — transfer chips (WC, FH) inactive in GW1. */

export const TRANSFER_CHIP_IDS = ['WC', 'FH'];

export const PICK_TEAM_CHIP_IDS = ['WC', 'BB', 'TC', 'FH', 'DC'];

export function transferChipsAvailableForGameweek(gameweek) {
  return (gameweek || 1) > 1;
}

export function isTransferChip(chipId) {
  return TRANSFER_CHIP_IDS.includes(chipId);
}

export function transferChipSummaryLabel(gameweek, chipUsed = false) {
  if (chipUsed === 'active') return 'Active';
  if (chipUsed === true || chipUsed === 'used') return 'Used';
  if (!transferChipsAvailableForGameweek(gameweek)) return 'Inactive';
  return 'Available';
}

/** Label for WC / FH in the transfers summary bar. */
export function transferChipDisplayLabel(chipId, { gameweek, chipState }) {
  if (!transferChipsAvailableForGameweek(gameweek)) return 'Inactive';
  if (chipState?.activeChip === chipId && chipState?.activeChipGameweek === gameweek) {
    return 'Active';
  }
  const usedGw = chipState?.usedGameweek?.[chipId];
  if (chipState?.used?.[chipId] || usedGw) {
    return usedGw ? `Used GW${usedGw}` : 'Used';
  }
  return 'Available';
}

export function freeTransfersDisplay(gameweek, chipState, transferState) {
  if (gameweek === 1 || chipState?.unlimitedTransfers || transferState?.unlimitedTransfers) {
    return '∞';
  }
  if (typeof transferState?.freeTransfers === 'number') {
    return String(transferState.freeTransfers);
  }
  return '1';
}

export function chipStatusLabel(status, chipId, chipState) {
  if (status === 'active') return 'Active';
  if (status === 'played') {
    const usedGw = chipState?.usedGameweek?.[chipId];
    return usedGw ? `Used GW${usedGw}` : 'Used';
  }
  if (status === 'inactive') return 'Inactive';
  return 'Available';
}

/** Merge persisted chip state with GW rules (GW1 locks WC + FH). */
export function buildChipStatusForGameweek(
  gameweek,
  prev = {},
  chipHistory = {},
  activeChipForGameweek = null,
  chipState = null
) {
  const transferOpen = transferChipsAvailableForGameweek(gameweek);
  const usedGameweek = chipState?.usedGameweek || {};
  const next = {
    WC: 'available',
    BB: 'available',
    TC: 'available',
    FH: 'available',
    DC: 'available',
    ...prev,
  };

  for (const [chipId, usedGw] of Object.entries(usedGameweek)) {
    if (!next[chipId]) continue;
    if (Number(usedGw) === gameweek && activeChipForGameweek === chipId) continue;
    next[chipId] = 'played';
  }

  for (const [gw, chip] of Object.entries(chipHistory || {})) {
    if (!chip || !next[chip]) continue;
    if (Number(gw) === gameweek && activeChipForGameweek === chip) continue;
    next[chip] = 'played';
  }

  if (activeChipForGameweek && next[activeChipForGameweek] !== 'played') {
    next[activeChipForGameweek] = 'active';
  }

  for (const id of TRANSFER_CHIP_IDS) {
    if (!transferOpen) {
      if (next[id] === 'available' || next[id] === 'inactive') {
        next[id] = 'inactive';
      }
    } else if (next[id] === 'inactive') {
      next[id] = 'available';
    }
  }

  return next;
}
