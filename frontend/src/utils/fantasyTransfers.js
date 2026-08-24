const HIT_POINTS_PER_TRANSFER = 4;
const SQUAD_POSITIONS = ['GK', 'DF', 'MF', 'ATT'];

export function squadPlayerIds(squad) {
  if (!squad) return [];
  return Object.values(squad)
    .flat()
    .filter(Boolean)
    .map((p) => String(p._id || p.id));
}

function slotPlayerId(player) {
  if (!player) return null;
  return String(player._id || player.id);
}

/** Compare staged vs saved squads slot-by-slot (not transfer action count). */
export function squadsEqual(savedSquad, stagedSquad) {
  if (!savedSquad && !stagedSquad) return true;
  if (!savedSquad || !stagedSquad) return false;

  for (const position of SQUAD_POSITIONS) {
    const savedSlots = savedSquad[position] || [];
    const stagedSlots = stagedSquad[position] || [];
    const slotCount = Math.max(savedSlots.length, stagedSlots.length);

    for (let index = 0; index < slotCount; index += 1) {
      const savedId = slotPlayerId(savedSlots[index]);
      const stagedId = slotPlayerId(stagedSlots[index]);
      if (savedId !== stagedId) return false;
    }
  }

  return true;
}

export function isStagedSquadDirty(savedSquad, stagedSquad) {
  return !squadsEqual(savedSquad, stagedSquad);
}

/** Count unsaved player changes vs the last saved squad. */
export function countPendingTransfers(savedSquad, currentSquad) {
  if (!savedSquad || !currentSquad) return 0;
  const saved = new Set(squadPlayerIds(savedSquad));
  const current = new Set(squadPlayerIds(currentSquad));
  let out = 0;
  for (const id of saved) {
    if (!current.has(id)) out += 1;
  }
  return out;
}

export function previewTransferSummary(transferState, pendingTransfers = 0) {
  if (!transferState) {
    return {
      freeTransfersLabel: '1',
      transfersThisGameweek: pendingTransfers,
      extraTransfers: 0,
      transferCost: 0,
    };
  }

  if (transferState.unlimitedTransfers) {
    return {
      freeTransfersLabel: '∞',
      transfersThisGameweek: pendingTransfers,
      extraTransfers: 0,
      transferCost: 0,
    };
  }

  const freeTransfers = transferState.freeTransfers ?? 1;
  const transfersThisGameweek = (transferState.transfersMade ?? 0) + pendingTransfers;
  const extraTransfers = Math.max(0, transfersThisGameweek - freeTransfers);
  const transferCost = extraTransfers * HIT_POINTS_PER_TRANSFER;

  return {
    freeTransfersLabel: String(freeTransfers),
    transfersThisGameweek,
    extraTransfers,
    transferCost,
  };
}

export { HIT_POINTS_PER_TRANSFER };
