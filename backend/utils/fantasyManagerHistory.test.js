const assert = require('assert');
const {
  calculateHistoricalPercentRank,
  formatHistoricalPercentRank,
} = require('./fantasyManagerHistory');

function run() {
  assert.strictEqual(calculateHistoricalPercentRank(1, 10), 90);
  assert.strictEqual(calculateHistoricalPercentRank(2, 10), 80);
  assert.strictEqual(calculateHistoricalPercentRank(5, 10), 50);
  assert.strictEqual(calculateHistoricalPercentRank(10, 10), 0);
  assert.strictEqual(formatHistoricalPercentRank(1, 10), '90.0%');
  assert.strictEqual(formatHistoricalPercentRank(3, 8), '62.5%');

  assert.strictEqual(calculateHistoricalPercentRank(1, 1), 0);
  assert.strictEqual(calculateHistoricalPercentRank(0, 10), null);
  assert.strictEqual(calculateHistoricalPercentRank(1, 0), null);
  assert.strictEqual(calculateHistoricalPercentRank(null, 10), null);
  assert.strictEqual(calculateHistoricalPercentRank(2, null), null);

  console.log('fantasyManagerHistory tests passed');
}

run();
