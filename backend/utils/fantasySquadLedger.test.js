const assert = require('assert');
const { FANTASY_BUDGET_M } = require('./fantasySquadValidation');
const {
  roundPrice,
  createEmptyFinancialState,
  normalizePurchasePriceMap,
  migrateFinancialState,
  simulateSquadTransition,
  calculateSquadMarketValue,
  calculateTotalTeamValue,
  validateBankBalance,
  currentMarketPrice,
  buildFinancialMigrationAudit,
} = require('./fantasySquadLedger');

function prices(entries) {
  return new Map(Object.entries(entries).map(([k, v]) => [k, v]));
}

function run() {
  // 1. Empty financial state
  const empty = createEmptyFinancialState();
  assert.strictEqual(empty.bankBalance, FANTASY_BUDGET_M);
  assert.deepStrictEqual(empty.playerPurchasePrices, {});

  // 2. Initial purchase
  let market = prices({ p1: 7.5 });
  let result = simulateSquadTransition({
    oldPlayerIds: [],
    newPlayerIds: ['p1'],
    bankBalance: 100,
    playerPurchasePrices: {},
    marketPricesById: market,
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.bankBalance, 92.5);
  assert.strictEqual(result.playerPurchasePrices.p1, 7.5);

  // 3. Multiple purchases
  result = simulateSquadTransition({
    oldPlayerIds: ['p1'],
    newPlayerIds: ['p1', 'p2', 'p3'],
    bankBalance: 92.5,
    playerPurchasePrices: { p1: 7.5 },
    marketPricesById: prices({ p1: 7.5, p2: 8.0, p3: 6.0 }),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.bankBalance, roundPrice(92.5 - 8.0 - 6.0));
  assert.strictEqual(result.playerPurchasePrices.p2, 8.0);
  assert.strictEqual(result.playerPurchasePrices.p3, 6.0);
  assert.strictEqual(result.playerPurchasePrices.p1, 7.5);

  // 4. Sale at same price
  result = simulateSquadTransition({
    oldPlayerIds: ['p1'],
    newPlayerIds: [],
    bankBalance: 50,
    playerPurchasePrices: { p1: 7.5 },
    marketPricesById: prices({ p1: 7.5 }),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.bankBalance, 57.5);
  assert.strictEqual(result.playerPurchasePrices.p1, undefined);

  // 5. Sale after price increase
  result = simulateSquadTransition({
    oldPlayerIds: ['a'],
    newPlayerIds: [],
    bankBalance: 10,
    playerPurchasePrices: { a: 7.5 },
    marketPricesById: prices({ a: 9.0 }),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.bankBalance, 19);
  assert.strictEqual(result.playerPurchasePrices.a, undefined);

  // 6. Sale after price decrease
  result = simulateSquadTransition({
    oldPlayerIds: ['a'],
    newPlayerIds: [],
    bankBalance: 10,
    playerPurchasePrices: { a: 7.5 },
    marketPricesById: prices({ a: 6.5 }),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.bankBalance, 16.5);

  // 7. Multiple price changes — purchase price unchanged until sold
  const owned = { a: 7.5 };
  market = prices({ a: 8.0 });
  assert.strictEqual(owned.a, 7.5);
  market = prices({ a: 8.5 });
  assert.strictEqual(owned.a, 7.5);
  market = prices({ a: 9.0 });
  result = simulateSquadTransition({
    oldPlayerIds: ['a'],
    newPlayerIds: [],
    bankBalance: 10,
    playerPurchasePrices: owned,
    marketPricesById: market,
  });
  assert.strictEqual(result.bankBalance, 19);
  assert.strictEqual(owned.a, 7.5);

  // 8. A → B replacement (spec example)
  result = simulateSquadTransition({
    oldPlayerIds: ['A'],
    newPlayerIds: ['B'],
    bankBalance: 10,
    playerPurchasePrices: { A: 7.5 },
    marketPricesById: prices({ A: 8.0, B: 7.0 }),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.bankBalance, 11);
  assert.strictEqual(result.playerPurchasePrices.A, undefined);
  assert.strictEqual(result.playerPurchasePrices.B, 7.0);

  // 9. Multiple simultaneous replacements
  result = simulateSquadTransition({
    oldPlayerIds: ['a', 'b', 'c'],
    newPlayerIds: ['d', 'e', 'c'],
    bankBalance: 20,
    playerPurchasePrices: { a: 5.0, b: 6.0, c: 7.0 },
    marketPricesById: prices({ a: 5.5, b: 6.5, c: 7.0, d: 4.0, e: 5.0 }),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.bankBalance, roundPrice(20 + 5.5 + 6.5 - 4.0 - 5.0));
  assert.strictEqual(result.playerPurchasePrices.a, undefined);
  assert.strictEqual(result.playerPurchasePrices.b, undefined);
  assert.strictEqual(result.playerPurchasePrices.c, 7.0);
  assert.strictEqual(result.playerPurchasePrices.d, 4.0);
  assert.strictEqual(result.playerPurchasePrices.e, 5.0);

  // 10. Insufficient bank
  result = simulateSquadTransition({
    oldPlayerIds: [],
    newPlayerIds: ['x'],
    bankBalance: 5.0,
    playerPurchasePrices: {},
    marketPricesById: prices({ x: 7.0 }),
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.message, 'Insufficient bank balance.');

  // 11. Bank exactly equals purchase price
  result = simulateSquadTransition({
    oldPlayerIds: [],
    newPlayerIds: ['x'],
    bankBalance: 7.0,
    playerPurchasePrices: {},
    marketPricesById: prices({ x: 7.0 }),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.bankBalance, 0);
  assert.strictEqual(result.playerPurchasePrices.x, 7.0);

  // 12. Selling one player increases bank
  result = simulateSquadTransition({
    oldPlayerIds: ['sell'],
    newPlayerIds: [],
    bankBalance: 25,
    playerPurchasePrices: { sell: 10.0 },
    marketPricesById: prices({ sell: 12.0 }),
  });
  assert.strictEqual(result.bankBalance, 37);

  // 13. Purchase price remains after market change (no transition)
  const purchases = normalizePurchasePriceMap({ p: 7.5 });
  market = prices({ p: 10.0 });
  assert.strictEqual(purchases.p, 7.5);
  assert.strictEqual(currentMarketPrice(market, 'p'), 10.0);

  // 14. Sold player purchase price removed — covered in test 8

  // 15. New player receives current price as purchase price — covered in test 8

  // 16. Team value calculation
  assert.strictEqual(calculateSquadMarketValue(['a', 'b', 'c'], prices({ a: 8, b: 9, c: 7 })), 24);
  assert.strictEqual(
    calculateTotalTeamValue(25, ['a', 'b', 'c'], prices({ a: 8, b: 9, c: 7 })),
    49
  );

  // 17. Empty squad migration
  const migratedEmpty = migrateFinancialState({
    bankBalance: undefined,
    playerPurchasePrices: undefined,
    playerIds: [],
    marketPricesById: prices({}),
  });
  assert.strictEqual(migratedEmpty.bankBalance, FANTASY_BUDGET_M);
  assert.deepStrictEqual(migratedEmpty.playerPurchasePrices, {});

  // 18. Existing squad migration
  const migratedSquad = migrateFinancialState({
    bankBalance: undefined,
    playerPurchasePrices: undefined,
    playerIds: ['p1', 'p2'],
    marketPricesById: prices({ p1: 8.0, p2: 7.0 }),
  });
  assert.strictEqual(migratedSquad.playerPurchasePrices.p1, 8.0);
  assert.strictEqual(migratedSquad.playerPurchasePrices.p2, 7.0);
  assert.strictEqual(migratedSquad.bankBalance, 85.0);

  // Partial squad migration
  const migratedPartial = migrateFinancialState({
    bankBalance: undefined,
    playerPurchasePrices: undefined,
    playerIds: ['p1'],
    marketPricesById: prices({ p1: 4.5 }),
  });
  assert.strictEqual(migratedPartial.bankBalance, 95.5);

  // 19. Missing/null players
  result = simulateSquadTransition({
    oldPlayerIds: ['ghost'],
    newPlayerIds: [],
    bankBalance: 10,
    playerPurchasePrices: { ghost: 5.0 },
    marketPricesById: prices({}),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.bankBalance, 10);

  const migratedMissing = migrateFinancialState({
    bankBalance: undefined,
    playerPurchasePrices: undefined,
    playerIds: ['missing', null, ''],
    marketPricesById: prices({ missing: 6.0 }),
  });
  assert.strictEqual(migratedMissing.playerPurchasePrices.missing, 6.0);
  assert.strictEqual(migratedMissing.bankBalance, 94.0);

  // 20. Floating point precision
  assert.strictEqual(roundPrice(7.499999999), 7.5);
  assert.strictEqual(roundPrice(10.000000001), 10);
  result = simulateSquadTransition({
    oldPlayerIds: [],
    newPlayerIds: ['fp'],
    bankBalance: 10,
    playerPurchasePrices: {},
    marketPricesById: prices({ fp: 3.3333333 }),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.bankBalance, 6.7);
  assert.strictEqual(result.playerPurchasePrices.fp, 3.3);

  // normalizePurchasePriceMap
  assert.deepStrictEqual(
    normalizePurchasePriceMap({ '1': 7.5, 2: '8.0', bad: 'x' }),
    { '1': 7.5, '2': 8.0 }
  );

  // validateBankBalance
  assert.strictEqual(validateBankBalance(0).ok, true);
  assert.strictEqual(validateBankBalance(-0.1).ok, false);

  // buildFinancialMigrationAudit — no migration needed
  assert.strictEqual(
    buildFinancialMigrationAudit({
      bankBalance: 10,
      playerPurchasePrices: { p1: 7.5 },
      playerIds: ['p1'],
      marketPricesById: prices({ p1: 8.0 }),
    }),
    null
  );

  // buildFinancialMigrationAudit — existing squad with unknown purchase history
  const audit = buildFinancialMigrationAudit({
    bankBalance: 100,
    playerPurchasePrices: {},
    playerIds: ['p1', 'p2'],
    marketPricesById: prices({ p1: 7.5, p2: 8.0 }),
  });
  assert.strictEqual(audit.requiresMigration, true);
  assert.strictEqual(audit.inferredPurchasePrices.length, 2);
  assert.strictEqual(audit.inferredPurchasePrices[0].currentMarketPrice, 7.5);
  assert.ok(audit.warning.includes('Historical purchase prices are unknown'));

  console.log('fantasySquadLedger tests passed');
}

run();
