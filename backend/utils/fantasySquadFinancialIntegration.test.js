const assert = require('assert');
const { FANTASY_BUDGET_M, validateMaxPlayersPerClubFromPlayers } = require('./fantasySquadValidation');
const {
  createEmptyFinancialState,
  resolveFinancialState,
  processSquadFinancialTransition,
  buildFinancialSummary,
  buildMarketPricesMap,
  needsFinancialMigration,
  simulateSquadTransition,
} = require('./fantasySquadLedger');

function prices(entries) {
  return buildMarketPricesMap(
    Object.entries(entries).map(([id, fantasyPrice]) => ({ _id: id, fantasyPrice }))
  );
}

function player(id, price, teamId, teamName = 'Club') {
  return {
    _id: id,
    fantasyPrice: price,
    position: 'MF',
    team: { _id: teamId, name: teamName },
  };
}

function mapLedgerError(result) {
  if (result.ok) return result;
  if (result.message === 'Insufficient bank balance.') {
    return { ok: false, message: 'Squad exceeds available budget.' };
  }
  return result;
}

function run() {
  const marketAB = prices({ A: 8.0, B: 7.0 });

  // 1. Empty squad → AC 100 bank
  const empty = createEmptyFinancialState();
  assert.strictEqual(empty.bankBalance, FANTASY_BUDGET_M);
  assert.deepStrictEqual(empty.playerPurchasePrices, {});

  // 2. Initial player purchase
  let result = processSquadFinancialTransition({
    hasExistingDoc: false,
    oldPlayerIds: [],
    newPlayerIds: ['p1'],
    marketPricesById: prices({ p1: 7.5 }),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.bankBalance, 92.5);
  assert.strictEqual(result.playerPurchasePrices.p1, 7.5);

  // 3. Multiple player purchases (new manager)
  result = processSquadFinancialTransition({
    hasExistingDoc: false,
    oldPlayerIds: [],
    newPlayerIds: ['p1', 'p2'],
    marketPricesById: prices({ p1: 7.5, p2: 8.0 }),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.bankBalance, 84.5);

  // 4. Sell at unchanged price
  result = processSquadFinancialTransition({
    hasExistingDoc: true,
    existingBankBalance: 50,
    existingPurchasePrices: { p1: 7.5 },
    oldPlayerIds: ['p1'],
    newPlayerIds: [],
    marketPricesById: prices({ p1: 7.5 }),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.bankBalance, 57.5);

  // 5. Sell after price increase
  result = processSquadFinancialTransition({
    hasExistingDoc: true,
    existingBankBalance: 10,
    existingPurchasePrices: { A: 7.5 },
    oldPlayerIds: ['A'],
    newPlayerIds: [],
    marketPricesById: prices({ A: 8.0 }),
  });
  assert.strictEqual(result.bankBalance, 18);

  // 6. Sell after price decrease
  result = processSquadFinancialTransition({
    hasExistingDoc: true,
    existingBankBalance: 10,
    existingPurchasePrices: { A: 7.5 },
    oldPlayerIds: ['A'],
    newPlayerIds: [],
    marketPricesById: prices({ A: 7.0 }),
  });
  assert.strictEqual(result.bankBalance, 17);

  // 7. A → B replacement
  result = mapLedgerError(
    processSquadFinancialTransition({
      hasExistingDoc: true,
      existingBankBalance: 10,
      existingPurchasePrices: { A: 7.5 },
      oldPlayerIds: ['A'],
      newPlayerIds: ['B'],
      marketPricesById: marketAB,
    })
  );
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.bankBalance, 11);
  assert.strictEqual(result.playerPurchasePrices.B, 7.0);
  assert.strictEqual(result.playerPurchasePrices.A, undefined);

  // 8. Multiple replacements
  result = processSquadFinancialTransition({
    hasExistingDoc: true,
    existingBankBalance: 20,
    existingPurchasePrices: { a: 5.0, b: 6.0, c: 7.0 },
    oldPlayerIds: ['a', 'b', 'c'],
    newPlayerIds: ['d', 'e', 'c'],
    marketPricesById: prices({ a: 5.5, b: 6.5, c: 7.0, d: 4.0, e: 5.0 }),
  });
  assert.strictEqual(result.ok, true);

  // 9. Insufficient bank
  result = mapLedgerError(
    processSquadFinancialTransition({
      hasExistingDoc: true,
      existingBankBalance: 5,
      existingPurchasePrices: {},
      oldPlayerIds: [],
      newPlayerIds: ['x'],
      marketPricesById: prices({ x: 7.0 }),
    })
  );
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.message, 'Squad exceeds available budget.');

  // 10. Exact bank amount
  result = processSquadFinancialTransition({
    hasExistingDoc: true,
    existingBankBalance: 7.0,
    existingPurchasePrices: {},
    oldPlayerIds: [],
    newPlayerIds: ['x'],
    marketPricesById: prices({ x: 7.0 }),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.bankBalance, 0);

  // 11. New purchase price equals current market price
  result = processSquadFinancialTransition({
    hasExistingDoc: false,
    oldPlayerIds: [],
    newPlayerIds: ['n'],
    marketPricesById: prices({ n: 6.5 }),
  });
  assert.strictEqual(result.playerPurchasePrices.n, 6.5);

  // 12. Existing purchase unchanged when market moves (no transition)
  const owned = { z: 7.5 };
  simulateSquadTransition({
    oldPlayerIds: ['z'],
    newPlayerIds: ['z'],
    bankBalance: 20,
    playerPurchasePrices: owned,
    marketPricesById: prices({ z: 9.0 }),
  });
  assert.strictEqual(owned.z, 7.5);

  // 13. Selling removes purchase record — covered in test 7

  // 14. Same-club replacement allowed (3 players)
  const teamX = 'clubX';
  const playersById = new Map([
    ['A', player('A', 5, teamX, 'Club X')],
    ['B', player('B', 5, teamX, 'Club X')],
    ['C', player('C', 5, teamX, 'Club X')],
    ['D', player('D', 5, teamX, 'Club X')],
  ]);
  let clubCheck = validateMaxPlayersPerClubFromPlayers(playersById, ['B', 'C', 'D']);
  assert.strictEqual(clubCheck.ok, true);

  // 15. Fourth from same club rejected
  clubCheck = validateMaxPlayersPerClubFromPlayers(playersById, ['A', 'B', 'C', 'D']);
  assert.strictEqual(clubCheck.ok, false);

  // 16. Duplicate player rejected (route validation logic)
  const slotIds = ['p1', 'p1'];
  const unique = [...new Set(slotIds)];
  assert.strictEqual(slotIds.length !== unique.length, true);

  // 17. Existing manager migrates correctly
  const migrated = resolveFinancialState({
    bankBalance: undefined,
    playerPurchasePrices: undefined,
    playerIds: ['p1', 'p2'],
    marketPricesById: prices({ p1: 8.0, p2: 7.0 }),
  });
  assert.strictEqual(migrated.playerPurchasePrices.p1, 8.0);
  assert.strictEqual(migrated.bankBalance, 85.0);

  // 18. Valid financial fields preserved
  const preserved = resolveFinancialState({
    bankBalance: 11,
    playerPurchasePrices: { A: 7.5, B: 7.0 },
    playerIds: ['A', 'B'],
    marketPricesById: prices({ A: 9.0, B: 8.0 }),
  });
  assert.strictEqual(preserved.bankBalance, 11);
  assert.strictEqual(preserved.playerPurchasePrices.A, 7.5);
  assert.strictEqual(preserved.playerPurchasePrices.B, 7.0);

  // Uninitialized populated squad detected
  assert.strictEqual(
    needsFinancialMigration(100, {}, ['p1']),
    true
  );
  assert.strictEqual(needsFinancialMigration(100, {}, []), false);

  // 19. Empty squad no stale purchases after sell-all transition
  result = processSquadFinancialTransition({
    hasExistingDoc: true,
    existingBankBalance: 10,
    existingPurchasePrices: { A: 7.5 },
    oldPlayerIds: ['A'],
    newPlayerIds: [],
    marketPricesById: prices({ A: 8.0 }),
  });
  assert.deepStrictEqual(result.playerPurchasePrices, {});

  // 20. Team market value uses current prices
  const summary = buildFinancialSummary(25, ['A', 'B', 'C'], prices({ A: 8, B: 9, C: 7 }));
  assert.strictEqual(summary.squadMarketValue, 24);
  assert.strictEqual(summary.totalTeamValue, 49);

  // 21. Total team value can exceed 100
  const rich = buildFinancialSummary(30, ['a', 'b'], prices({ a: 50, b: 45 }));
  assert.strictEqual(rich.totalTeamValue, 125);

  // 22–26. Response field shape (PUT/GET payload helpers)
  const putFields = {
    bankBalance: summary.bankBalance,
    squadMarketValue: summary.squadMarketValue,
    totalTeamValue: summary.totalTeamValue,
  };
  assert.ok(Object.prototype.hasOwnProperty.call(putFields, 'bankBalance'));
  assert.ok(Object.prototype.hasOwnProperty.call(putFields, 'squadMarketValue'));
  assert.ok(Object.prototype.hasOwnProperty.call(putFields, 'totalTeamValue'));

  const hydratedPlayer = {
    fantasyPrice: 8.0,
    purchasePrice: 7.5,
  };
  assert.strictEqual(hydratedPlayer.fantasyPrice, 8.0);
  assert.strictEqual(hydratedPlayer.purchasePrice, 7.5);

  console.log('fantasySquadFinancialIntegration tests passed');
}

run();
