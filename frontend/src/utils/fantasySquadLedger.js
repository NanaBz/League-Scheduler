/** Client-side ledger preview — mirrors backend/utils/fantasySquadLedger.js */

export const FANTASY_BUDGET_M = 100.0;

export function roundPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

export function normalizePlayerIds(playerIds) {
  return [...new Set((playerIds || []).filter(Boolean).map(String))];
}

export function normalizePurchasePriceMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key == null || key === '') continue;
    const price = roundPrice(value);
    if (price > 0) out[String(key)] = price;
  }
  return out;
}

function currentMarketPrice(marketPricesById, playerId) {
  if (!playerId) return 0;
  const id = String(playerId);
  if (marketPricesById instanceof Map) {
    return roundPrice(marketPricesById.get(id));
  }
  if (marketPricesById && typeof marketPricesById === 'object') {
    return roundPrice(marketPricesById[id]);
  }
  return 0;
}

export function createEmptyFinancialState() {
  return {
    bankBalance: roundPrice(FANTASY_BUDGET_M),
    playerPurchasePrices: {},
  };
}

export function squadPlayerIdsFromShape(squad) {
  return Object.values(squad || {})
    .flat()
    .filter(Boolean)
    .map((p) => String(p._id || p.id));
}

/** Collect current market prices from hydrated squad player objects. */
export function buildMarketPricesFromSquads(...squads) {
  const map = new Map();
  for (const squad of squads) {
    if (!squad) continue;
    for (const player of Object.values(squad).flat().filter(Boolean)) {
      const id = String(player._id || player.id);
      if (!id) continue;
      map.set(id, roundPrice(player.fantasyPrice));
    }
  }
  return map;
}

export function purchasePricesFromSquad(squad) {
  const map = {};
  for (const player of Object.values(squad || {}).flat().filter(Boolean)) {
    const id = String(player._id || player.id);
    if (player.purchasePrice != null) {
      map[id] = roundPrice(player.purchasePrice);
    }
  }
  return normalizePurchasePriceMap(map);
}

export function calculateSquadMarketValue(playerIds, marketPricesById) {
  const ids = normalizePlayerIds(playerIds);
  let total = 0;
  for (const id of ids) {
    total += currentMarketPrice(marketPricesById, id);
  }
  return roundPrice(total);
}

export function calculateTotalTeamValue(bankBalance, playerIds, marketPricesById) {
  const bank = roundPrice(bankBalance);
  const squadMarket = calculateSquadMarketValue(playerIds, marketPricesById);
  return roundPrice(bank + squadMarket);
}

export function simulateSquadTransition({
  oldPlayerIds,
  newPlayerIds,
  bankBalance,
  playerPurchasePrices,
  marketPricesById,
}) {
  const oldIds = normalizePlayerIds(oldPlayerIds);
  const newIds = normalizePlayerIds(newPlayerIds);
  const oldSet = new Set(oldIds);
  const newSet = new Set(newIds);

  const outs = oldIds.filter((id) => !newSet.has(id));
  const ins = newIds.filter((id) => !oldSet.has(id));

  let bank = roundPrice(bankBalance ?? 0);
  const purchases = normalizePurchasePriceMap(playerPurchasePrices);

  for (const id of outs) {
    bank = roundPrice(bank + currentMarketPrice(marketPricesById, id));
    delete purchases[id];
  }

  for (const id of ins) {
    const buyPrice = currentMarketPrice(marketPricesById, id);
    if (buyPrice <= 0) {
      return { ok: false, message: 'One or more players have an invalid current price.' };
    }
    if (bank < buyPrice) {
      return { ok: false, message: 'Insufficient bank balance.' };
    }
    bank = roundPrice(bank - buyPrice);
    purchases[id] = buyPrice;
  }

  if (bank < 0) {
    return { ok: false, message: 'Insufficient bank balance.' };
  }

  return {
    ok: true,
    bankBalance: bank,
    playerPurchasePrices: purchases,
    outs,
    ins,
  };
}

/** Preview financial state for staged squad vs last saved squad. */
export function previewSquadFinancial({
  savedFinancial,
  savedSquad,
  stagedSquad,
}) {
  const baseline = savedFinancial || createEmptyFinancialState();
  const savedBaseline = savedSquad || {};
  const marketPricesById = buildMarketPricesFromSquads(savedBaseline, stagedSquad);

  const transition = simulateSquadTransition({
    oldPlayerIds: squadPlayerIdsFromShape(savedBaseline),
    newPlayerIds: squadPlayerIdsFromShape(stagedSquad),
    bankBalance: baseline.bankBalance,
    playerPurchasePrices: baseline.playerPurchasePrices,
    marketPricesById,
  });

  if (!transition.ok) {
    return {
      ok: false,
      message: transition.message,
      bankBalance: baseline.bankBalance,
      squadMarketValue: calculateSquadMarketValue(
        squadPlayerIdsFromShape(stagedSquad),
        marketPricesById
      ),
      totalTeamValue: calculateTotalTeamValue(
        baseline.bankBalance,
        squadPlayerIdsFromShape(stagedSquad),
        marketPricesById
      ),
    };
  }

  const stagedIds = squadPlayerIdsFromShape(stagedSquad);
  const squadMarketValue = calculateSquadMarketValue(stagedIds, marketPricesById);
  const totalTeamValue = calculateTotalTeamValue(
    transition.bankBalance,
    stagedIds,
    marketPricesById
  );

  return {
    ok: true,
    bankBalance: transition.bankBalance,
    playerPurchasePrices: transition.playerPurchasePrices,
    squadMarketValue,
    totalTeamValue,
  };
}

export function applyPlayerToSlot(squad, { position, index }, player) {
  const copy = {
    GK: [...(squad?.GK || [])],
    DF: [...(squad?.DF || [])],
    MF: [...(squad?.MF || [])],
    ATT: [...(squad?.ATT || [])],
  };
  const arr = [...copy[position]];
  arr[index] = player;
  copy[position] = arr;
  return copy;
}

export function parseFinancialFromApiResponse(data) {
  const squad = data?.squad || {};
  const playerIds = squadPlayerIdsFromShape(squad);
  const marketPricesById = buildMarketPricesFromSquads(squad);
  const bankBalance =
    data?.bankBalance != null ? roundPrice(data.bankBalance) : roundPrice(FANTASY_BUDGET_M);
  const squadMarketValue =
    data?.squadMarketValue != null
      ? roundPrice(data.squadMarketValue)
      : calculateSquadMarketValue(playerIds, marketPricesById);
  const totalTeamValue =
    data?.totalTeamValue != null
      ? roundPrice(data.totalTeamValue)
      : calculateTotalTeamValue(bankBalance, playerIds, marketPricesById);

  return {
    bankBalance,
    playerPurchasePrices: purchasePricesFromSquad(squad),
    squadMarketValue,
    totalTeamValue,
  };
}

export function mapLedgerErrorMessage(message) {
  if (message === 'Insufficient bank balance.') {
    return 'Squad exceeds available budget.';
  }
  return message;
}
