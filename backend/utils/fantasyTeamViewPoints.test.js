const assert = require('assert');

function computeNetTeamPoints(rawPoints, transferHitPoints) {
  const raw = Number(rawPoints) || 0;
  const hit = Math.max(0, Number(transferHitPoints) || 0);
  return Math.max(0, raw - hit);
}

function run() {
  assert.strictEqual(computeNetTeamPoints(44, 0), 44);
  assert.strictEqual(computeNetTeamPoints(44, 4), 40);
  assert.strictEqual(computeNetTeamPoints(44, 44), 0);
  assert.strictEqual(computeNetTeamPoints(0, 0), 0);

  console.log('fantasyTeamViewPoints.test.js passed');
}

run();
