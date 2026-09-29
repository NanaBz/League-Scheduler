const assert = require('assert');
const {
  validateClubLimitTransition,
  validateInactivePlayerTransition,
  validateSquadPlayerLifecycle,
} = require('./fantasyPlayerSquadIntegrity');

const teamA = 'clubA';
const teamB = 'clubB';

function player(id, teamId, name, active = true) {
  return {
    _id: id,
    name,
    active,
    team: { _id: teamId, name: teamId === teamA ? 'Club A' : 'Club B' },
    position: 'MF',
  };
}

function mapPlayers(entries) {
  return new Map(entries.map(([id, p]) => [id, p]));
}

function run() {
  const p1 = player('p1', teamA, 'A1');
  const p2 = player('p2', teamA, 'A2');
  const p3 = player('p3', teamA, 'A3');
  const p4 = player('p4', teamA, 'A4');
  const p5 = player('p5', teamB, 'B1');
  const inactive = player('in', teamB, 'Inactive', false);
  const byId = mapPlayers([
    ['p1', p1],
    ['p2', p2],
    ['p3', p3],
    ['p4', p4],
    ['p5', p5],
    ['in', inactive],
  ]);

  // TEST 10/11/14: corrective club sell
  const fourA = ['p1', 'p2', 'p3', 'p4'];
  const threeA = ['p1', 'p2', 'p3', 'p5'];
  assert.strictEqual(validateClubLimitTransition(byId, fourA, threeA).ok, true);
  assert.strictEqual(validateClubLimitTransition(byId, fourA, fourA).ok, false);
  assert.strictEqual(validateClubLimitTransition(byId, threeA, fourA).ok, false);

  // TEST 12: buy another A while at 4
  assert.strictEqual(validateClubLimitTransition(byId, fourA, ['p1', 'p2', 'p3', 'p4']).ok, false);

  // Inactive: cannot add
  assert.strictEqual(validateInactivePlayerTransition(byId, threeA, [...threeA, 'in']).ok, false);
  // Inactive owned: cannot keep on save
  assert.strictEqual(validateInactivePlayerTransition(byId, [...threeA, 'in'], [...threeA, 'in']).ok, false);
  // Removal allowed (not in next)
  assert.strictEqual(validateInactivePlayerTransition(byId, [...threeA, 'in'], threeA).ok, true);

  // Combined lifecycle: removal of inactive + legal squad
  assert.strictEqual(validateSquadPlayerLifecycle(byId, [...threeA, 'in'], threeA).ok, true);

  console.log('fantasyPlayerSquadIntegrity tests passed');
}

run();
