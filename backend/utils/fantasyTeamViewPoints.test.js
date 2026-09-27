const assert = require('assert');
const { computeGameweekNetPoints } = require('./fantasyGameweekNetPoints');

function run() {
  assert.strictEqual(computeGameweekNetPoints(44, 0), 44);
  assert.strictEqual(computeGameweekNetPoints(44, 4), 40);
  assert.strictEqual(computeGameweekNetPoints(46, 54), -8);
  assert.strictEqual(computeGameweekNetPoints(44, 44), 0);
  assert.strictEqual(computeGameweekNetPoints(0, 0), 0);

  console.log('fantasyTeamViewPoints tests passed');
}

run();
