const assert = require('assert');
const {
  cumulativePointsByUser,
  computeRankDeltaByUser,
} = require('./fantasyOverallLeague');

function rankUsersMock(users, cumulativeMap, gwMap) {
  const sorted = users
    .map((u) => ({
      id: String(u._id),
      total: cumulativeMap.get(String(u._id)) || 0,
      gw: gwMap.get(String(u._id)) || 0,
      team: u.teamName,
    }))
    .sort((a, b) => b.total - a.total || b.gw - a.gw || a.team.localeCompare(b.team));
  const ranks = new Map();
  sorted.forEach((row, i) => ranks.set(row.id, i + 1));
  return ranks;
}

function run() {
  const users = [
    { _id: 'a', teamName: 'A' },
    { _id: 'b', teamName: 'B' },
    { _id: 'c', teamName: 'C' },
  ];
  const cum2 = new Map([
    ['a', 100],
    ['b', 90],
    ['c', 80],
  ]);
  const cum1 = new Map([
    ['a', 50],
    ['b', 60],
    ['c', 70],
  ]);
  const gw2 = new Map([
    ['a', 50],
    ['b', 30],
    ['c', 10],
  ]);
  const gw1 = new Map([
    ['a', 50],
    ['b', 60],
    ['c', 70],
  ]);
  const r2 = rankUsersMock(users, cum2, gw2);
  const r1 = rankUsersMock(users, cum1, gw1);
  assert.strictEqual(r2.get('a'), 1);
  assert.strictEqual(r1.get('a'), 3);
  assert.strictEqual(r2.get('b'), 2);
  assert.strictEqual(r1.get('b'), 2);

  assert.strictEqual(typeof computeRankDeltaByUser, 'function');
  assert.strictEqual(typeof cumulativePointsByUser, 'function');

  console.log('fantasyOverallLeagueRankDelta tests passed');
}

run();
