const assert = require('assert');
const { resolveScoringCaptainId, captainDidNotPlay } = require('./fantasyCaptainScoring');
const { scoreLineupFromSnapshot } = require('./fantasyScoring');

function mapOf(entries) {
  return new Map(entries);
}

const lineup = {
  starters: {
    gk: [{ _id: 'gk1', name: 'GK' }],
    df: [{ _id: 'cap', name: 'Captain' }],
    mf: [{ _id: 'vice', name: 'Vice' }],
    att: [{ _id: 'a1', name: 'A1' }],
  },
  bench: [],
  formation: '1-1-1-1',
};

const points = mapOf([
  ['cap', 0],
  ['vice', 5],
  ['gk1', 2],
  ['a1', 3],
]);
const mins = mapOf([
  ['cap', 0],
  ['vice', 90],
  ['gk1', 90],
  ['a1', 90],
]);

const promoted = resolveScoringCaptainId('cap', 'vice', points, mins);
assert.strictEqual(promoted.vicePromoted, true);
assert.strictEqual(promoted.scoringCaptainId, 'vice');

const scored = scoreLineupFromSnapshot(lineup, points, {
  captainId: 'cap',
  viceCaptainId: 'vice',
  chipUsed: null,
  playerMinutes: mins,
});

assert.strictEqual(scored.display.mid[0].points, 10, 'vice should receive 2x as acting captain');
assert.strictEqual(scored.display.def[0].points, 0, 'blank captain stays at 0');
assert.strictEqual(scored.display.captainBlanked, true);

const played = resolveScoringCaptainId('cap', 'vice', mapOf([['cap', 2], ['vice', 5]]), mapOf([['cap', 90], ['vice', 90]]));
assert.strictEqual(played.vicePromoted, false);

console.log('fantasyCaptainScoring integration checks passed');
