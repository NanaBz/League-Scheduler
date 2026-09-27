const assert = require('assert');
const { scoreLineupFromSnapshot } = require('./fantasyScoring');

function run() {
  const playerPoints = new Map([
    ['a', 5],
    ['b', 2],
    ['c', 8],
  ]);
  const playerMinutes = new Map([
    ['a', 90],
    ['b', 90],
    ['c', 90],
  ]);

  const lineup = {
    formation: '2-4-2',
    starters: {
      gk: [{ _id: 'a', name: 'A', position: 'GK' }],
      df: [],
      mf: [{ _id: 'b', name: 'B', position: 'MF' }],
      att: [{ _id: 'c', name: 'C', position: 'ATT' }],
    },
    bench: [],
  };

  const first = scoreLineupFromSnapshot(lineup, playerPoints, {
    captainId: 'c',
    viceCaptainId: 'b',
    playerMinutes,
  });
  const second = scoreLineupFromSnapshot(lineup, playerPoints, {
    captainId: 'c',
    viceCaptainId: 'b',
    playerMinutes,
  });

  assert.strictEqual(first.total, second.total);
  assert.strictEqual(first.total, 5 + 2 + 8 * 2);

  console.log('fantasySaveIdempotency.test.js passed');
}

run();
