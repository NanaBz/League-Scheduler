const assert = require('assert');
const { detectPhantomGw1FromSnapshots, FULL_SQUAD_SIZE } = require('./fantasySquadEstablishment');

function run() {
  const phantom = [
    { matchweek: 1, transfersIn: [], transfersOut: [], points: 88 },
    {
      matchweek: 2,
      transfersIn: new Array(FULL_SQUAD_SIZE).fill('x'),
      transfersOut: [],
      points: 0,
    },
  ];
  assert.strictEqual(detectPhantomGw1FromSnapshots(phantom), true);

  const real = [
    { matchweek: 1, transfersIn: ['a'], transfersOut: ['b'], points: 40 },
    { matchweek: 2, transfersIn: [], transfersOut: [], points: 50 },
  ];
  assert.strictEqual(detectPhantomGw1FromSnapshots(real), false);

  console.log('fantasySquadEstablishment tests passed');
}

run();
