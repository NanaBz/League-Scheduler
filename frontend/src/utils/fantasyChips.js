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
  if (chipState?.activeChip === chipId) return 'Active';
  if (chipState?.used?.[chipId]) return 'Used';
  return 'Available';
}

export function freeTransfersDisplay(gameweek, chipState) {
  if (gameweek === 1 || chipState?.unlimitedTransfers) return '∞';
  return '1';
}

export function chipStatusLabel(status) {
  if (status === 'active') return 'Active';
  if (status === 'played') return 'Played';
  if (status === 'inactive') return 'Inactive';
  return 'Available';
}

/** Merge persisted chip state with GW rules (GW1 locks WC + FH). */
export function buildChipStatusForGameweek(gameweek, prev = {}, chipHistory = {}, activeChipForGameweek = null) {
  const transferOpen = transferChipsAvailableForGameweek(gameweek);
  const next = {
    WC: 'available',
    BB: 'available',
    TC: 'available',
    FH: 'available',
    DC: 'available',
    ...prev,
  };

  for (const chip of Object.values(chipHistory)) {
    if (chip && next[chip]) {
      next[chip] = 'played';
    }
  }

  if (activeChipForGameweek && next[activeChipForGameweek]) {
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
