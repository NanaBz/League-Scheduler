const assert = require('assert');
const {
  computeFreeTransferBankAtGameweek,
  computeTransferHitPoints,
  countTransfersFromSnapshot,
} = require('./fantasyFreeTransfers');
const {
  looksLikeMisclassifiedInitialSetup,
  resolveTransfersMadeForPenalty,
  FULL_SQUAD_SIZE,
} = require('./fantasySquadEstablishment');

function run() {
  assert.strictEqual(countTransfersFromSnapshot({ transfersIn: [1, 2, 3], transfersOut: [] }), 3);
  assert.strictEqual(computeTransferHitPoints(13, 1, false), 48);

  const misclassified = {
    matchweek: 2,
    transfersIn: new Array(FULL_SQUAD_SIZE).fill('a'),
    transfersOut: [],
  };
  assert.strictEqual(looksLikeMisclassifiedInitialSetup(misclassified, 2), true);
  assert.strictEqual(resolveTransfersMadeForPenalty(misclassified, 2), 0);
  assert.strictEqual(resolveTransfersMadeForPenalty(misclassified, null), 0);

  const realGw2Transfers = {
    matchweek: 2,
    transfersIn: ['a', 'b'],
    transfersOut: ['c', 'd'],
  };
  assert.strictEqual(looksLikeMisclassifiedInitialSetup(realGw2Transfers, 2), false);
  assert.strictEqual(resolveTransfersMadeForPenalty(realGw2Transfers, 2), 2);
  assert.strictEqual(computeTransferHitPoints(2, 1, false), 4);

  const gw5DebutThenTransfer = {
    matchweek: 5,
    transfersIn: ['x'],
    transfersOut: ['y'],
  };
  assert.strictEqual(resolveTransfersMadeForPenalty(gw5DebutThenTransfer, 5), 1);

  assert.strictEqual(computeFreeTransferBankAtGameweek([], 2), 1);

  console.log('fantasyFreeTransfers tests passed');
}

run();
