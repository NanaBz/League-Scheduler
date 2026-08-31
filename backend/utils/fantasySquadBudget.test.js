const assert = require('assert');
const {
  FANTASY_BUDGET_M,
  validateSquadBudgetFromPlayers,
  calculateSquadTotalCost,
  validateMaxPlayersPerClubFromPlayers,
} = require('./fantasySquadValidation');

function player(id, price, teamId = 'teamA', teamName = 'Club A', position = 'MF') {
  return {
    _id: id,
    fantasyPrice: price,
    position,
    team: { _id: teamId, name: teamName },
  };
}

function run() {
  const teamA = 'teamA';
  const teamB = 'teamB';
  const teamC = 'teamC';
  const teamD = 'teamD';
  const teamE = 'teamE';
  const teamF = 'teamF';

  // TEST 1 — comfortably below budget
  let playersById = new Map([
    ['p1', player('p1', 8.0, teamA, 'Club A', 'GK')],
    ['p2', player('p2', 7.5, teamB, 'Club B', 'GK')],
    ['p3', player('p3', 6.0, teamC, 'Club C', 'DF')],
  ]);
  let result = validateSquadBudgetFromPlayers(playersById, ['p1', 'p2', 'p3']);
  assert.strictEqual(result.ok, true);

  // TEST 2 — exactly equals budget
  playersById = new Map([
    ['a', player('a', 50.0, teamA, 'Club A', 'GK')],
    ['b', player('b', 50.0, teamB, 'Club B', 'GK')],
  ]);
  result = validateSquadBudgetFromPlayers(playersById, ['a', 'b']);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(calculateSquadTotalCost(playersById, ['a', 'b']), FANTASY_BUDGET_M);

  // TEST 3 — exceeds budget
  playersById = new Map([
    ['a', player('a', 60.0, teamA, 'Club A', 'GK')],
    ['b', player('b', 50.0, teamB, 'Club B', 'GK')],
  ]);
  result = validateSquadBudgetFromPlayers(playersById, ['a', 'b']);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.message, 'Squad exceeds available budget.');

  // TEST 4 — transfer creates squad above budget (final state)
  playersById = new Map([
    ['out', player('out', 7.5, teamA, 'Club A', 'MF')],
    ['in', player('in', 12.0, teamB, 'Club B', 'MF')],
    ['keep', player('keep', 92.0, teamC, 'Club C', 'DF')],
  ]);
  result = validateSquadBudgetFromPlayers(playersById, ['in', 'keep']);
  assert.strictEqual(result.ok, false);

  // TEST 5 — expensive out, cheaper in
  playersById = new Map([
    ['cheap', player('cheap', 4.5, teamA, 'Club A', 'MF')],
    ['mid', player('mid', 8.0, teamB, 'Club B', 'MF')],
    ['rest', player('rest', 87.5, teamC, 'Club C', 'DF')],
  ]);
  result = validateSquadBudgetFromPlayers(playersById, ['cheap', 'mid', 'rest']);
  assert.strictEqual(result.ok, true);

  // TEST 6 — cheaper out, expensive in within budget
  playersById = new Map([
    ['new', player('new', 10.0, teamA, 'Club A', 'MF')],
    ['rest', player('rest', 90.0, teamB, 'Club B', 'DF')],
  ]);
  result = validateSquadBudgetFromPlayers(playersById, ['new', 'rest']);
  assert.strictEqual(result.ok, true);

  // TEST 7 — transfer exceeds budget
  playersById = new Map([
    ['new', player('new', 15.0, teamA, 'Club A', 'MF')],
    ['rest', player('rest', 86.1, teamB, 'Club B', 'DF')],
  ]);
  result = validateSquadBudgetFromPlayers(playersById, ['new', 'rest']);
  assert.strictEqual(result.ok, false);

  // TEST 8 — ignores missing client-side totals (utility only uses DB prices)
  assert.strictEqual(
    calculateSquadTotalCost(playersById, ['new', 'rest']),
    101.1
  );

  // TEST 9 — authoritative prices from player docs (not client-supplied fields)
  playersById = new Map([
    ['x', { _id: 'x', fantasyPrice: 99.0, team: { _id: teamA, name: 'Club A' } }],
  ]);
  result = validateSquadBudgetFromPlayers(playersById, ['x']);
  assert.strictEqual(result.ok, true);
  playersById.set('y', { _id: 'y', fantasyPrice: 2.0, team: { _id: teamB, name: 'Club B' } });
  result = validateSquadBudgetFromPlayers(playersById, ['x', 'y']);
  assert.strictEqual(result.ok, false);

  // Empty squad allowed
  result = validateSquadBudgetFromPlayers(playersById, []);
  assert.strictEqual(result.ok, true);

  // TEST 11 — club limit still works alongside budget
  playersById = new Map([
    ['p1', player('p1', 5.0, teamA, 'Club A', 'MF')],
    ['p2', player('p2', 5.0, teamA, 'Club A', 'MF')],
    ['p3', player('p3', 5.0, teamA, 'Club A', 'MF')],
    ['p4', player('p4', 5.0, teamA, 'Club A', 'MF')],
  ]);
  result = validateMaxPlayersPerClubFromPlayers(playersById, ['p1', 'p2', 'p3', 'p4']);
  assert.strictEqual(result.ok, false);

  // 13-player squad at budget with spread clubs
  const squadIds = [];
  playersById = new Map();
  const teams = [
    [teamA, 'Club A'],
    [teamB, 'Club B'],
    [teamC, 'Club C'],
    [teamD, 'Club D'],
    [teamE, 'Club E'],
    [teamF, 'Club F'],
  ];
  let remaining = FANTASY_BUDGET_M;
  for (let i = 0; i < 13; i += 1) {
    const id = `s${i}`;
    const price = i === 12 ? remaining : 7.5;
    remaining -= price;
    const [tid, tname] = teams[i % teams.length];
    playersById.set(id, player(id, price, tid, tname, 'MF'));
    squadIds.push(id);
  }
  result = validateSquadBudgetFromPlayers(playersById, squadIds);
  assert.strictEqual(result.ok, true);

  console.log('fantasySquadBudget tests passed');
}

run();
