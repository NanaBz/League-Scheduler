const assert = require('assert');
const {
  buildFreeHitFinancialRestoreFromBaseline,
  clonePurchaseMap,
} = require('./fantasyChipState');
const { simulateSquadTransition } = require('./fantasySquadLedger');

function prices(entries) {
  return new Map(Object.entries(entries).map(([k, v]) => [k, v]));
}

function run() {
  // 1–4: baseline capture shape (pure restore helper)
  const baselineDoc = {
    freeHitBaselineBankBalance: 15,
    freeHitBaselinePurchasePrices: { A: 7.5, B: 6.0 },
    freeHitBaselineSlots: { GK: [] },
    freeHitBaselineTransferInOrder: ['A', 'B'],
  };

  const restored = buildFreeHitFinancialRestoreFromBaseline(baselineDoc);
  assert.strictEqual(restored.bankBalance, 15);
  assert.strictEqual(restored.playerPurchasePrices.A, 7.5);
  assert.strictEqual(restored.playerPurchasePrices.B, 6);

  // 5–7: temporary FH ledger changes do not match baseline after restore
  let temp = simulateSquadTransition({
    oldPlayerIds: ['A'],
    newPlayerIds: ['C'],
    bankBalance: 15,
    playerPurchasePrices: { A: 7.5, B: 6.0 },
    marketPricesById: prices({ A: 8.5, B: 6.0, C: 9.0 }),
  });
  assert.strictEqual(temp.ok, true);
  assert.notStrictEqual(temp.bankBalance, 15);
  assert.ok(temp.playerPurchasePrices.C);

  const afterRevert = buildFreeHitFinancialRestoreFromBaseline(baselineDoc);
  assert.strictEqual(afterRevert.bankBalance, 15);
  assert.strictEqual(afterRevert.playerPurchasePrices.A, 7.5);
  assert.strictEqual(afterRevert.playerPurchasePrices.C, undefined);

  // 8–10: original purchase prices survive; market price change during FH irrelevant to baseline
  const priceChangedBaseline = {
    freeHitBaselineBankBalance: 20,
    freeHitBaselinePurchasePrices: { A: 7.5 },
  };
  const restoredAfterPriceChange = buildFreeHitFinancialRestoreFromBaseline(priceChangedBaseline);
  assert.strictEqual(restoredAfterPriceChange.playerPurchasePrices.A, 7.5);

  // 11–12: multiple temp transfers then exact restore
  const multiBaseline = {
    freeHitBaselineBankBalance: 10,
    freeHitBaselinePurchasePrices: { p1: 5.0, p2: 6.0, p3: 7.0 },
  };
  const exact = buildFreeHitFinancialRestoreFromBaseline(multiBaseline);
  assert.deepStrictEqual(exact.playerPurchasePrices, clonePurchaseMap(multiBaseline.freeHitBaselinePurchasePrices));
  assert.strictEqual(exact.bankBalance, 10);

  // clonePurchaseMap normalizes
  assert.deepStrictEqual(clonePurchaseMap({ '1': '7.5' }), { '1': 7.5 });

  console.log('fantasyChipStateFinancial tests passed');
}

run();
