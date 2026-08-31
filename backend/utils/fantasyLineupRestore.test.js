const assert = require('assert');
const {
  sanitizeRestoredLineup,
  lineupMatchesSquad,
} = require('./fantasyLineupRestore');

const squadA = {
  GK: ['gk1', 'gk2'],
  DF: ['d1', 'd2', 'd3', 'd4'],
  MF: ['m1', 'm2', 'm3', 'm4'],
  ATT: ['a1', 'a2', 'a3'],
};

const lineupA = {
  formation: '3-4-1',
  starters: {
    gk: ['gk1'],
    df: ['d1', 'd2', 'd3'],
    mf: ['m1', 'm2', 'm3', 'm4'],
    att: ['a1'],
  },
  bench: ['gk2', 'd4', 'a2', 'a3'],
  captainId: 'm1',
  viceCaptainId: 'd1',
  chipUsed: 'FH',
};

assert.strictEqual(lineupMatchesSquad(lineupA, squadA), true);

const squadB = JSON.parse(JSON.stringify(squadA));
squadB.ATT[0] = 'x1';
assert.strictEqual(lineupMatchesSquad(lineupA, squadB), false);

const sanitized = sanitizeRestoredLineup(lineupA);
assert.strictEqual(sanitized.chipUsed, null);
assert.strictEqual(sanitized.captainId, 'm1');

const fhTempLineup = {
  formation: '4-3-2',
  starters: {
    gk: ['gk1'],
    df: ['d1', 'd2', 'd3', 'd4'],
    mf: ['m1', 'm2', 'm3'],
    att: ['x1', 'x2'],
  },
  bench: ['gk2', 'm4', 'x3', 'x4'],
  chipUsed: 'FH',
};

assert.strictEqual(lineupMatchesSquad(fhTempLineup, squadA), false);
assert.strictEqual(lineupMatchesSquad(lineupA, squadA), true);

const ids = [
  ...lineupA.starters.gk,
  ...lineupA.starters.df,
  ...lineupA.starters.mf,
  ...lineupA.starters.att,
  ...lineupA.bench,
];
assert.strictEqual(ids.length, 13);
assert.strictEqual(new Set(ids).size, 13);

console.log('fantasyLineupRestore tests passed');
