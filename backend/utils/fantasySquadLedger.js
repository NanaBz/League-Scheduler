const { FANTASY_BUDGET_M } = require('./fantasySquadValidation');

/** Round to one decimal place — matches AC Xm display precision. */
function roundPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

/** Normalize an array of player ids (deduped, string keys). */
function normalizePlayerIds(playerIds) {
  return [...new Set((playerIds || []).filter(Boolean).map(String))];
}

/** Normalize purchase-price map keys/values without mutating input. */
function normalizePurchasePriceMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key == null || key === '') continue;
    const price = roundPrice(value);
    if (price > 0) {
      out[String(key)] = price;
    }
  }
  return out;
}

/** Authoritative current market price from a prices map (Map or plain object). */
function currentMarketPrice(marketPricesById, playerId) {
  if (!playerId) return 0;
  const id = String(playerId);
  const map = marketPricesById;
  if (map instanceof Map) {
    return roundPrice(map.get(id));
  }
  if (map && typeof map === 'object') {
    return roundPrice(map[id]);
  }
  return 0;
}

function cloneFinancialState(state) {
  return {
    bankBalance: roundPrice(state?.bankBalance ?? 0),
    playerPurchasePrices: normalizePurchasePriceMap(state?.playerPurchasePrices),
  };
}

/** Empty manager financial state at season start. */
function createEmptyFinancialState() {
  return {
    bankBalance: roundPrice(FANTASY_BUDGET_M),
    playerPurchasePrices: {},
  };
}

function isMissingBankBalance(bankBalance) {
  return bankBalance == null || !Number.isFinite(Number(bankBalance));
}

function isMissingPurchasePrices(playerPurchasePrices) {
  return playerPurchasePrices == null;
}

/** True when populated squad has schema defaults or missing/incomplete financial fields. */
function needsFinancialMigration(bankBalance, playerPurchasePrices, playerIds) {
  const ids = normalizePlayerIds(playerIds);

  if (isMissingBankBalance(bankBalance) || playerPurchasePrices == null) {
    return true;
  }

  if (ids.length === 0) {
    return false;
  }

  const purchases = normalizePurchasePriceMap(playerPurchasePrices);
  const bank = roundPrice(bankBalance);

  if (Object.keys(purchases).length === 0 && bank === roundPrice(FANTASY_BUDGET_M)) {
    return true;
  }

  for (const id of ids) {
    if (purchases[id] == null) {
      return true;
    }
  }

  return false;
}

/**
 * Describe what a pre-ledger squad migration will infer — for logging/ops visibility.
 * Does not mutate state. Returns null when no migration is required.
 */
function buildFinancialMigrationAudit({
  bankBalance,
  playerPurchasePrices,
  playerIds,
  marketPricesById,
}) {
  if (!needsFinancialMigration(bankBalance, playerPurchasePrices, playerIds)) {
    return null;
  }

  const ids = normalizePlayerIds(playerIds);
  const purchases =
    playerPurchasePrices != null ? normalizePurchasePriceMap(playerPurchasePrices) : {};
  const reasons = [];

  if (isMissingBankBalance(bankBalance)) {
    reasons.push('missing_bank_balance');
  }
  if (isMissingPurchasePrices(playerPurchasePrices)) {
    reasons.push('missing_purchase_prices_map');
  }
  if (
    ids.length > 0 &&
    Object.keys(purchases).length === 0 &&
    roundPrice(bankBalance) === roundPrice(FANTASY_BUDGET_M)
  ) {
    reasons.push('uninitialized_purchase_map_with_full_budget');
  }

  for (const id of ids) {
    if (purchases[id] == null) {
      reasons.push(`missing_purchase_price:${id}`);
    }
  }

  const inferredPurchasePrices = ids
    .filter((id) => purchases[id] == null)
    .map((id) => ({
      playerId: id,
      inferredFrom: 'current_market_price',
      currentMarketPrice: currentMarketPrice(marketPricesById, id),
    }));

  let inferredBankBalance = null;
  if (isMissingBankBalance(bankBalance)) {
    const squadMarket = calculateSquadMarketValue(ids, marketPricesById);
    inferredBankBalance = roundPrice(FANTASY_BUDGET_M - squadMarket);
  }

  return {
    requiresMigration: true,
    reasons: [...new Set(reasons)],
    playerCount: ids.length,
    inferredPurchasePrices,
    inferredBankBalance,
    warning:
      'Historical purchase prices are unknown for pre-ledger squads. Purchase prices are estimated from current market prices at migration time — not original acquisition prices.',
  };
}

/** Build a Map of playerId → current market price from Player docs or plain entries. */
function buildMarketPricesMap(entries) {
  const map = new Map();
  for (const entry of entries || []) {
    if (!entry) continue;
    const id = String(entry._id || entry.id || entry.playerId || '');
    if (!id) continue;
    map.set(id, roundPrice(entry.fantasyPrice ?? entry.price));
  }
  return map;
}

/**
 * Resolve stored financial state — migrate only when missing or uninitialized.
 * Preserves valid existing bankBalance + playerPurchasePrices.
 */
function resolveFinancialState({ bankBalance, playerPurchasePrices, playerIds, marketPricesById }) {
  if (!needsFinancialMigration(bankBalance, playerPurchasePrices, playerIds)) {
    return {
      bankBalance: roundPrice(bankBalance),
      playerPurchasePrices: normalizePurchasePriceMap(playerPurchasePrices),
    };
  }

  const ids = normalizePlayerIds(playerIds);
  const uninitializedPurchases =
    isMissingPurchasePrices(playerPurchasePrices) ||
    (ids.length > 0 &&
      Object.keys(normalizePurchasePriceMap(playerPurchasePrices)).length === 0 &&
      roundPrice(bankBalance) === roundPrice(FANTASY_BUDGET_M));

  return migrateFinancialState({
    bankBalance: isMissingBankBalance(bankBalance)
      ? undefined
      : uninitializedPurchases && ids.length > 0
        ? undefined
        : bankBalance,
    playerPurchasePrices: uninitializedPurchases ? undefined : playerPurchasePrices,
    playerIds: ids,
    marketPricesById,
  });
}

/**
 * Orchestrate financial transition for PUT /my-squad (no DB writes).
 * @returns simulated bank + purchase map, or { ok: false, message }
 */
function processSquadFinancialTransition({
  hasExistingDoc,
  existingBankBalance,
  existingPurchasePrices,
  oldPlayerIds,
  newPlayerIds,
  marketPricesById,
}) {
  const oldIds = normalizePlayerIds(oldPlayerIds);
  let financial;

  if (!hasExistingDoc) {
    financial = createEmptyFinancialState();
  } else {
    financial = resolveFinancialState({
      bankBalance: existingBankBalance,
      playerPurchasePrices: existingPurchasePrices,
      playerIds: oldIds,
      marketPricesById,
    });
  }

  return simulateSquadTransition({
    oldPlayerIds: oldIds,
    newPlayerIds,
    bankBalance: financial.bankBalance,
    playerPurchasePrices: financial.playerPurchasePrices,
    marketPricesById,
  });
}

function buildFinancialSummary(bankBalance, playerIds, marketPricesById) {
  const ids = normalizePlayerIds(playerIds);
  const bank = roundPrice(bankBalance);
  const squadMarketValue = calculateSquadMarketValue(ids, marketPricesById);
  const totalTeamValue = calculateTotalTeamValue(bank, ids, marketPricesById);
  return { bankBalance: bank, squadMarketValue, totalTeamValue };
}

/**
 * One-time compatibility for FantasyDraftSquad docs without financial fields.
 * Does not mutate input; returns a normalized financial state.
 */
function migrateFinancialState({
  bankBalance,
  playerPurchasePrices,
  playerIds,
  marketPricesById,
}) {
  const ids = normalizePlayerIds(playerIds);
  let purchases = isMissingPurchasePrices(playerPurchasePrices)
    ? {}
    : normalizePurchasePriceMap(playerPurchasePrices);
  let bank = bankBalance;

  if (isMissingPurchasePrices(playerPurchasePrices)) {
    for (const id of ids) {
      purchases[id] = currentMarketPrice(marketPricesById, id);
    }
  } else {
    for (const id of ids) {
      if (purchases[id] == null) {
        purchases[id] = currentMarketPrice(marketPricesById, id);
      }
    }
  }

  if (isMissingBankBalance(bankBalance)) {
    const squadMarket = calculateSquadMarketValue(ids, marketPricesById);
    bank = roundPrice(FANTASY_BUDGET_M - squadMarket);
  } else {
    bank = roundPrice(bank);
  }

  return {
    bankBalance: bank,
    playerPurchasePrices: normalizePurchasePriceMap(purchases),
  };
}

/** Sum of current Player.fantasyPrice for owned player ids. */
function calculateSquadMarketValue(playerIds, marketPricesById) {
  const ids = normalizePlayerIds(playerIds);
  let total = 0;
  for (const id of ids) {
    total += currentMarketPrice(marketPricesById, id);
  }
  return roundPrice(total);
}

/** bankBalance + squad market value. */
function calculateTotalTeamValue(bankBalance, playerIds, marketPricesById) {
  const bank = roundPrice(bankBalance);
  const squadMarket = calculateSquadMarketValue(playerIds, marketPricesById);
  return roundPrice(bank + squadMarket);
}

function validateBankBalance(bankBalance) {
  const bank = roundPrice(bankBalance);
  if (bank < 0) {
    return { ok: false, message: 'Insufficient bank balance.' };
  }
  return { ok: true, bankBalance: bank };
}

/**
 * Simulate old squad → new squad ledger transition without DB writes.
 * Sale value = current market price; purchase price set at acquisition price.
 */
function simulateSquadTransition({
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
    const saleValue = currentMarketPrice(marketPricesById, id);
    bank = roundPrice(bank + saleValue);
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

  const bankCheck = validateBankBalance(bank);
  if (!bankCheck.ok) {
    return bankCheck;
  }

  return {
    ok: true,
    bankBalance: bankCheck.bankBalance,
    playerPurchasePrices: purchases,
    outs,
    ins,
  };
}

module.exports = {
  roundPrice,
  normalizePlayerIds,
  normalizePurchasePriceMap,
  createEmptyFinancialState,
  needsFinancialMigration,
  buildFinancialMigrationAudit,
  resolveFinancialState,
  migrateFinancialState,
  processSquadFinancialTransition,
  buildMarketPricesMap,
  buildFinancialSummary,
  simulateSquadTransition,
  calculateSquadMarketValue,
  calculateTotalTeamValue,
  validateBankBalance,
  currentMarketPrice,
  cloneFinancialState,
};
