const assert = require('assert');
const {
  starterDidNotPlay,
  applyAutoSubstitutions,
} = require('./fantasyAutoSubstitutions');
const { scoreLineupFromSnapshot } = require('./fantasyScoring');
const { resolveScoringCaptainId } = require('./fantasyCaptainScoring');

function mapOf(entries) {
  return new Map(entries);
}

function lineup332(outId, mids, dfs, atts, bench, extras = {}) {
  return {
    formation: '3-3-2',
    starters: {
      gk: ['gk1'],
      df: dfs,
      mf: mids,
      att: atts,
    },
    bench,
    captainId: extras.captainId || null,
    viceCaptainId: extras.viceCaptainId || null,
  };
}

function positions(entries) {
  return new Map(entries);
}

function starterIds(result) {
  const s = result.effectiveLineup.starters;
  return [...s.gk, ...s.df, ...s.mf, ...s.att].map(String);
}

// 1. Starter 0 min + SUB1 eligible >0 pts → SUB1 enters
{
  const lineup = lineup332('out', ['m1', 'm2', 'm3'], ['d1', 'd2', 'd3'], ['out', 'a2'], ['sub1', 'sub2', 'sub3', 'sub4']);
  const mins = mapOf([
    ['out', 0], ['sub1', 0], ['sub2', 0], ['sub3', 0], ['sub4', 0],
    ['gk1', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['d1', 90], ['d2', 90], ['d3', 90], ['a2', 90],
    ['sub1', 0],
  ]);
  mins.set('sub1', 0);
  const pts = mapOf([
    ['out', 0], ['sub1', 3], ['sub2', 8], ['sub3', 0], ['sub4', 0],
    ['gk1', 2], ['m1', 1], ['m2', 1], ['m3', 1], ['d1', 1], ['d2', 1], ['d3', 1], ['a2', 1],
  ]);
  const pos = positions([
    ['gk1', 'GK'], ['d1', 'DF'], ['d2', 'DF'], ['d3', 'DF'],
    ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['out', 'ATT'], ['a2', 'ATT'],
    ['sub1', 'ATT'], ['sub2', 'ATT'], ['sub3', 'MF'], ['sub4', 'GK'],
  ]);
  const result = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true });
  assert.ok(starterIds(result).includes('sub1'));
  assert.ok(!starterIds(result).includes('out'));
  assert.strictEqual(result.substitutions[0].in, 'sub1');
}

// 2. Starter 0 min + SUB1 = 0 pts + SUB2 >0 pts → SUB2 enters
{
  const lineup = lineup332('out', ['m1', 'm2', 'm3'], ['d1', 'd2', 'd3'], ['out', 'a2'], ['sub1', 'sub2', 'sub3', 'sub4']);
  const mins = mapOf([
    ['out', 0], ['gk1', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['d1', 90], ['d2', 90], ['d3', 90], ['a2', 90],
    ['sub1', 0], ['sub2', 0], ['sub3', 0], ['sub4', 0],
  ]);
  const pts = mapOf([
    ['out', 0], ['sub1', 0], ['sub2', 4], ['sub3', 0], ['sub4', 0],
    ['gk1', 2], ['m1', 1], ['m2', 1], ['m3', 1], ['d1', 1], ['d2', 1], ['d3', 1], ['a2', 1],
  ]);
  const pos = positions([
    ['gk1', 'GK'], ['d1', 'DF'], ['d2', 'DF'], ['d3', 'DF'],
    ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['out', 'ATT'], ['a2', 'ATT'],
    ['sub1', 'ATT'], ['sub2', 'ATT'], ['sub3', 'MF'], ['sub4', 'GK'],
  ]);
  const result = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true });
  assert.strictEqual(result.substitutions[0].in, 'sub2');
}

// 3. Starter 0 min + SUB1/SUB2 = 0 + SUB3 >0 → SUB3 enters
{
  const lineup = lineup332('out', ['m1', 'm2', 'm3'], ['d1', 'd2', 'd3'], ['out', 'a2'], ['sub1', 'sub2', 'sub3', 'sub4']);
  const mins = mapOf([
    ['out', 0], ['gk1', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['d1', 90], ['d2', 90], ['d3', 90], ['a2', 90],
    ['sub1', 0], ['sub2', 0], ['sub3', 0], ['sub4', 0],
  ]);
  const pts = mapOf([
    ['out', 0], ['sub1', 0], ['sub2', 0], ['sub3', 2], ['sub4', 9],
    ['gk1', 2], ['m1', 1], ['m2', 1], ['m3', 1], ['d1', 1], ['d2', 1], ['d3', 1], ['a2', 1],
  ]);
  const pos = positions([
    ['gk1', 'GK'], ['d1', 'DF'], ['d2', 'DF'], ['d3', 'DF'],
    ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['out', 'ATT'], ['a2', 'ATT'],
    ['sub1', 'ATT'], ['sub2', 'ATT'], ['sub3', 'MF'], ['sub4', 'ATT'],
  ]);
  const result = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true });
  assert.strictEqual(result.substitutions[0].in, 'sub3');
}

// 4. Bench order beats higher points on SUB2
{
  const lineup = lineup332('out', ['m1', 'm2', 'm3'], ['d1', 'd2', 'd3'], ['out', 'a2'], ['sub1', 'sub2', 'sub3', 'sub4']);
  const mins = mapOf([
    ['out', 0], ['gk1', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['d1', 90], ['d2', 90], ['d3', 90], ['a2', 90],
    ['sub1', 0], ['sub2', 0], ['sub3', 0], ['sub4', 0],
  ]);
  const pts = mapOf([
    ['out', 0], ['sub1', 2], ['sub2', 10], ['sub3', 0], ['sub4', 0],
    ['gk1', 2], ['m1', 1], ['m2', 1], ['m3', 1], ['d1', 1], ['d2', 1], ['d3', 1], ['a2', 1],
  ]);
  const pos = positions([
    ['gk1', 'GK'], ['d1', 'DF'], ['d2', 'DF'], ['d3', 'DF'],
    ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['out', 'ATT'], ['a2', 'ATT'],
    ['sub1', 'ATT'], ['sub2', 'ATT'], ['sub3', 'MF'], ['sub4', 'GK'],
  ]);
  const result = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true });
  assert.strictEqual(result.substitutions[0].in, 'sub1');
}

// 5. Starter 90 min + 0 pts → no substitution
{
  const lineup = lineup332('played', ['m1', 'm2', 'm3'], ['d1', 'd2', 'd3'], ['played', 'a2'], ['sub1', 'sub2', 'sub3', 'sub4']);
  const mins = mapOf([['played', 90], ['sub1', 0], ['gk1', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['d1', 90], ['d2', 90], ['d3', 90], ['a2', 90]]);
  const pts = mapOf([['played', 0], ['sub1', 5], ['gk1', 2], ['m1', 1], ['m2', 1], ['m3', 1], ['d1', 1], ['d2', 1], ['d3', 1], ['a2', 1]]);
  const pos = positions([
    ['gk1', 'GK'], ['d1', 'DF'], ['d2', 'DF'], ['d3', 'DF'], ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['played', 'ATT'], ['a2', 'ATT'], ['sub1', 'ATT'], ['sub2', 'ATT'], ['sub3', 'MF'], ['sub4', 'GK'],
  ]);
  const result = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true });
  assert.strictEqual(result.changed, false);
  assert.ok(starterIds(result).includes('played'));
}

// 6. Starter 1 min + 0 pts → no substitution
{
  assert.strictEqual(starterDidNotPlay('p1', mapOf([['p1', 1]])), false);
}

// 7. GK starter 0 min + outfield SUB1 + GK SUB2 → GK SUB2 enters
{
  const lineup = {
    formation: '3-3-2',
    starters: { gk: ['gk-out'], df: ['d1', 'd2', 'd3'], mf: ['m1', 'm2', 'm3'], att: ['a1', 'a2'] },
    bench: ['sub1', 'sub2', 'sub3', 'sub4'],
  };
  const mins = mapOf([
    ['gk-out', 0], ['sub1', 0], ['sub2', 0], ['sub3', 0], ['sub4', 0],
    ['d1', 90], ['d2', 90], ['d3', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['a1', 90], ['a2', 90],
  ]);
  const pts = mapOf([
    ['gk-out', 0], ['sub1', 5], ['sub2', 8], ['sub3', 2], ['sub4', 0],
    ['d1', 1], ['d2', 1], ['d3', 1], ['m1', 1], ['m2', 1], ['m3', 1], ['a1', 1], ['a2', 1],
  ]);
  const pos = positions([
    ['gk-out', 'GK'], ['d1', 'DF'], ['d2', 'DF'], ['d3', 'DF'], ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['a1', 'ATT'], ['a2', 'ATT'], ['sub1', 'MF'], ['sub2', 'GK'], ['sub3', 'GK'], ['sub4', 'ATT'],
  ]);
  const result = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true });
  assert.strictEqual(result.substitutions[0].in, 'sub2');
  assert.ok(starterIds(result).includes('sub2'));
}

// 8. Invalid formation candidate skipped, next valid candidate used
{
  const lineup = {
    formation: '2-3-3',
    starters: { gk: ['gk1'], df: ['d-out', 'd2'], mf: ['m1', 'm2', 'm3'], att: ['a1', 'a2', 'a3'] },
    bench: ['sub1', 'sub2', 'sub3', 'sub4'],
  };
  const mins = mapOf([
    ['d-out', 0], ['gk1', 90], ['d2', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['a1', 90], ['a2', 90], ['a3', 90],
    ['sub1', 0], ['sub2', 0], ['sub3', 0], ['sub4', 0],
  ]);
  const pts = mapOf([
    ['d-out', 0], ['sub1', 4], ['sub2', 6], ['sub3', 0], ['sub4', 0],
    ['gk1', 2], ['d2', 1], ['m1', 1], ['m2', 1], ['m3', 1], ['a1', 1], ['a2', 1], ['a3', 1],
  ]);
  const pos = positions([
    ['gk1', 'GK'], ['d-out', 'DF'], ['d2', 'DF'], ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['a1', 'ATT'], ['a2', 'ATT'], ['a3', 'ATT'], ['sub1', 'MF'], ['sub2', 'DF'], ['sub3', 'MF'], ['sub4', 'GK'],
  ]);
  const result = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true });
  assert.strictEqual(result.substitutions[0].in, 'sub2');
}

// 9. Two starters 0 min → sequential subs
{
  const lineup = lineup332('out-a', ['m1', 'm2', 'm3'], ['d1', 'd2', 'd3'], ['out-a', 'out-b'], ['sub1', 'sub2', 'sub3', 'sub4']);
  const mins = mapOf([
    ['out-a', 0], ['out-b', 0], ['gk1', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['d1', 90], ['d2', 90], ['d3', 90],
    ['sub1', 0], ['sub2', 0], ['sub3', 0], ['sub4', 0],
  ]);
  const pts = mapOf([
    ['out-a', 0], ['out-b', 0], ['sub1', 2], ['sub2', 3], ['sub3', 0], ['sub4', 0],
    ['gk1', 2], ['m1', 1], ['m2', 1], ['m3', 1], ['d1', 1], ['d2', 1], ['d3', 1],
  ]);
  const pos = positions([
    ['gk1', 'GK'], ['d1', 'DF'], ['d2', 'DF'], ['d3', 'DF'], ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['out-a', 'ATT'], ['out-b', 'ATT'], ['sub1', 'ATT'], ['sub2', 'ATT'], ['sub3', 'MF'], ['sub4', 'GK'],
  ]);
  const result = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true });
  assert.strictEqual(result.substitutions.length, 2);
  assert.strictEqual(result.substitutions[0].in, 'sub1');
  assert.strictEqual(result.substitutions[1].in, 'sub2');
}

// 10. Same bench player cannot be used twice
{
  const lineup = lineup332('out-a', ['m1', 'm2', 'm3'], ['d1', 'd2', 'd3'], ['out-a', 'out-b'], ['sub1', 'sub2', 'sub3', 'sub4']);
  const mins = mapOf([
    ['out-a', 0], ['out-b', 0], ['gk1', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['d1', 90], ['d2', 90], ['d3', 90],
    ['sub1', 0], ['sub2', 0], ['sub3', 0], ['sub4', 0],
  ]);
  const pts = mapOf([
    ['out-a', 0], ['out-b', 0], ['sub1', 2], ['sub2', 0], ['sub3', 0], ['sub4', 0],
    ['gk1', 2], ['m1', 1], ['m2', 1], ['m3', 1], ['d1', 1], ['d2', 1], ['d3', 1],
  ]);
  const pos = positions([
    ['gk1', 'GK'], ['d1', 'DF'], ['d2', 'DF'], ['d3', 'DF'], ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['out-a', 'ATT'], ['out-b', 'ATT'], ['sub1', 'ATT'], ['sub2', 'ATT'], ['sub3', 'MF'], ['sub4', 'GK'],
  ]);
  const result = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true });
  assert.strictEqual(result.substitutions.length, 1);
}

// 11. No eligible substitute → starter remains
{
  const lineup = lineup332('out', ['m1', 'm2', 'm3'], ['d1', 'd2', 'd3'], ['out', 'a2'], ['sub1', 'sub2', 'sub3', 'sub4']);
  const mins = mapOf([
    ['out', 0], ['gk1', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['d1', 90], ['d2', 90], ['d3', 90], ['a2', 90],
    ['sub1', 0], ['sub2', 0], ['sub3', 0], ['sub4', 0],
  ]);
  const pts = mapOf([
    ['out', 0], ['sub1', 0], ['sub2', 0], ['sub3', 0], ['sub4', 0],
    ['gk1', 2], ['m1', 1], ['m2', 1], ['m3', 1], ['d1', 1], ['d2', 1], ['d3', 1], ['a2', 1],
  ]);
  const pos = positions([
    ['gk1', 'GK'], ['d1', 'DF'], ['d2', 'DF'], ['d3', 'DF'], ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['out', 'ATT'], ['a2', 'ATT'], ['sub1', 'ATT'], ['sub2', 'ATT'], ['sub3', 'MF'], ['sub4', 'GK'],
  ]);
  const result = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true });
  assert.strictEqual(result.changed, false);
  assert.ok(starterIds(result).includes('out'));
}

// 12. Full team played → no substitutions
{
  const lineup = lineup332('a1', ['m1', 'm2', 'm3'], ['d1', 'd2', 'd3'], ['a1', 'a2'], ['sub1', 'sub2', 'sub3', 'sub4']);
  const mins = mapOf([
    ['gk1', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['d1', 90], ['d2', 90], ['d3', 90], ['a1', 90], ['a2', 90],
    ['sub1', 0], ['sub2', 0], ['sub3', 0], ['sub4', 0],
  ]);
  const pts = mapOf([
    ['gk1', 2], ['m1', 1], ['m2', 1], ['m3', 1], ['d1', 1], ['d2', 1], ['d3', 1], ['a1', 1], ['a2', 1],
    ['sub1', 5], ['sub2', 5], ['sub3', 5], ['sub4', 5],
  ]);
  const pos = positions([
    ['gk1', 'GK'], ['d1', 'DF'], ['d2', 'DF'], ['d3', 'DF'], ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['a1', 'ATT'], ['a2', 'ATT'], ['sub1', 'ATT'], ['sub2', 'ATT'], ['sub3', 'MF'], ['sub4', 'GK'],
  ]);
  const result = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true });
  assert.strictEqual(result.changed, false);
}

// 13. Bench Boost → autosub skipped; all 13 score
{
  const lineup = lineup332('out', ['m1', 'm2', 'm3'], ['d1', 'd2', 'd3'], ['out', 'a2'], ['sub1', 'sub2', 'sub3', 'sub4']);
  const mins = mapOf([
    ['out', 0], ['gk1', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['d1', 90], ['d2', 90], ['d3', 90], ['a2', 90],
    ['sub1', 0], ['sub2', 0], ['sub3', 0], ['sub4', 0],
  ]);
  const pts = mapOf([
    ['out', 0], ['sub1', 3], ['sub2', 0], ['sub3', 0], ['sub4', 0],
    ['gk1', 2], ['m1', 1], ['m2', 1], ['m3', 1], ['d1', 1], ['d2', 1], ['d3', 1], ['a2', 1],
  ]);
  const pos = positions([
    ['gk1', 'GK'], ['d1', 'DF'], ['d2', 'DF'], ['d3', 'DF'], ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['out', 'ATT'], ['a2', 'ATT'], ['sub1', 'ATT'], ['sub2', 'ATT'], ['sub3', 'MF'], ['sub4', 'GK'],
  ]);
  const auto = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true, chipUsed: 'BB' });
  assert.strictEqual(auto.changed, false);
  assert.ok(starterIds(auto).includes('out'));

  const scored = scoreLineupFromSnapshot(
    {
      starters: {
        gk: [{ _id: 'gk1' }],
        df: [{ _id: 'd1' }, { _id: 'd2' }, { _id: 'd3' }],
        mf: [{ _id: 'm1' }, { _id: 'm2' }, { _id: 'm3' }],
        att: [{ _id: 'out' }, { _id: 'a2' }],
      },
      bench: [{ _id: 'sub1' }, { _id: 'sub2' }, { _id: 'sub3' }, { _id: 'sub4' }],
    },
    pts,
    { chipUsed: 'BB', playerMinutes: mins }
  );
  assert.strictEqual(scored.display.bench[0].points, 3);
  assert.strictEqual(scored.total, 2 + 1 + 1 + 1 + 1 + 1 + 1 + 0 + 1 + 3);
}

// 14. Captain DNP → vice promotion preserved
{
  const mins = mapOf([
    ['cap', 0], ['out', 0], ['vice', 90], ['gk1', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['a2', 90], ['sub1', 0],
  ]);
  const pts = mapOf([
    ['cap', 0], ['out', 0], ['vice', 5], ['sub1', 4], ['gk1', 2], ['m1', 1], ['m2', 1], ['m3', 1], ['a2', 1],
  ]);
  const promoted = resolveScoringCaptainId('cap', 'vice', pts, mins);
  assert.strictEqual(promoted.vicePromoted, true);

  const scored = scoreLineupFromSnapshot(
    {
      starters: {
        gk: [{ _id: 'gk1' }],
        df: [{ _id: 'd1' }, { _id: 'd2' }, { _id: 'd3' }],
        mf: [{ _id: 'm1' }, { _id: 'vice' }, { _id: 'm3' }],
        att: [{ _id: 'sub1' }, { _id: 'a2' }],
      },
      bench: [{ _id: 'cap' }],
    },
    pts,
    {
      captainId: 'cap',
      viceCaptainId: 'vice',
      playerMinutes: mins,
    }
  );
  assert.strictEqual(scored.display.mid.find((p) => p._id === 'vice').points, 10);
}

// 15. Captain replaced through autosub does not become captain
{
  const effective = {
    starters: {
      gk: [{ _id: 'gk1' }],
      df: [{ _id: 'd1' }, { _id: 'd2' }, { _id: 'd3' }],
      mf: [{ _id: 'm1' }, { _id: 'm2' }, { _id: 'm3' }],
      att: [{ _id: 'sub1' }, { _id: 'a2' }],
    },
    bench: [{ _id: 'cap' }],
  };
  const pts = mapOf([
    ['cap', 0], ['sub1', 4], ['gk1', 2], ['d1', 1], ['d2', 1], ['d3', 1], ['m1', 1], ['m2', 1], ['m3', 1], ['a2', 1],
  ]);
  const mins = mapOf([
    ['cap', 0], ['sub1', 90], ['gk1', 90], ['d1', 90], ['d2', 90], ['d3', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['a2', 90],
  ]);
  const scored = scoreLineupFromSnapshot(effective, pts, {
    captainId: 'cap',
    viceCaptainId: 'vice',
    playerMinutes: mins,
    autoSubInIds: new Set(['sub1']),
    autoSubOutIds: new Set(['cap']),
  });
  const subRow = scored.display.fwd.find((p) => p._id === 'sub1');
  assert.strictEqual(subRow.isCaptain, false);
  assert.strictEqual(subRow.points, 4);
}

// 16. Gameweek incomplete → autosub does not run
{
  const lineup = lineup332('out', ['m1', 'm2', 'm3'], ['d1', 'd2', 'd3'], ['out', 'a2'], ['sub1', 'sub2', 'sub3', 'sub4']);
  const mins = mapOf([['out', 0], ['sub1', 0], ['gk1', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['d1', 90], ['d2', 90], ['d3', 90], ['a2', 90]]);
  const pts = mapOf([['out', 0], ['sub1', 5], ['gk1', 2], ['m1', 1], ['m2', 1], ['m3', 1], ['d1', 1], ['d2', 1], ['d3', 1], ['a2', 1]]);
  const pos = positions([
    ['gk1', 'GK'], ['d1', 'DF'], ['d2', 'DF'], ['d3', 'DF'], ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['out', 'ATT'], ['a2', 'ATT'], ['sub1', 'ATT'], ['sub2', 'ATT'], ['sub3', 'MF'], ['sub4', 'GK'],
  ]);
  const result = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: false });
  assert.strictEqual(result.changed, false);
}

// 17. Gameweek complete → autosub runs
{
  const lineup = lineup332('out', ['m1', 'm2', 'm3'], ['d1', 'd2', 'd3'], ['out', 'a2'], ['sub1', 'sub2', 'sub3', 'sub4']);
  const mins = mapOf([['out', 0], ['sub1', 0], ['gk1', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['d1', 90], ['d2', 90], ['d3', 90], ['a2', 90]]);
  const pts = mapOf([['out', 0], ['sub1', 5], ['gk1', 2], ['m1', 1], ['m2', 1], ['m3', 1], ['d1', 1], ['d2', 1], ['d3', 1], ['a2', 1]]);
  const pos = positions([
    ['gk1', 'GK'], ['d1', 'DF'], ['d2', 'DF'], ['d3', 'DF'], ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['out', 'ATT'], ['a2', 'ATT'], ['sub1', 'ATT'], ['sub2', 'ATT'], ['sub3', 'MF'], ['sub4', 'GK'],
  ]);
  const result = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true });
  assert.strictEqual(result.changed, true);
}

// 18. Deterministic result
{
  const lineup = lineup332('out', ['m1', 'm2', 'm3'], ['d1', 'd2', 'd3'], ['out', 'a2'], ['sub1', 'sub2', 'sub3', 'sub4']);
  const mins = mapOf([['out', 0], ['sub1', 0], ['sub2', 0], ['gk1', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['d1', 90], ['d2', 90], ['d3', 90], ['a2', 90]]);
  const pts = mapOf([['out', 0], ['sub1', 2], ['sub2', 9], ['gk1', 2], ['m1', 1], ['m2', 1], ['m3', 1], ['d1', 1], ['d2', 1], ['d3', 1], ['a2', 1]]);
  const pos = positions([
    ['gk1', 'GK'], ['d1', 'DF'], ['d2', 'DF'], ['d3', 'DF'], ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['out', 'ATT'], ['a2', 'ATT'], ['sub1', 'ATT'], ['sub2', 'ATT'], ['sub3', 'MF'], ['sub4', 'GK'],
  ]);
  const first = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true });
  const second = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true });
  assert.deepStrictEqual(first.substitutions, second.substitutions);
  assert.deepStrictEqual(first.effectiveLineup.starters, second.effectiveLineup.starters);
}

// 19. Original saved lineup remains unchanged
{
  const lineup = lineup332('out', ['m1', 'm2', 'm3'], ['d1', 'd2', 'd3'], ['out', 'a2'], ['sub1', 'sub2', 'sub3', 'sub4']);
  const savedCopy = JSON.parse(JSON.stringify(lineup));
  const mins = mapOf([['out', 0], ['sub1', 0], ['gk1', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['d1', 90], ['d2', 90], ['d3', 90], ['a2', 90]]);
  const pts = mapOf([['out', 0], ['sub1', 4], ['gk1', 2], ['m1', 1], ['m2', 1], ['m3', 1], ['d1', 1], ['d2', 1], ['d3', 1], ['a2', 1]]);
  const pos = positions([
    ['gk1', 'GK'], ['d1', 'DF'], ['d2', 'DF'], ['d3', 'DF'], ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['out', 'ATT'], ['a2', 'ATT'], ['sub1', 'ATT'], ['sub2', 'ATT'], ['sub3', 'MF'], ['sub4', 'GK'],
  ]);
  applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true });
  assert.deepStrictEqual(lineup, savedCopy);
}

// 20. Effective lineup contains no duplicate players
{
  const lineup = lineup332('out', ['m1', 'm2', 'm3'], ['d1', 'd2', 'd3'], ['out', 'a2'], ['sub1', 'sub2', 'sub3', 'sub4']);
  const mins = mapOf([['out', 0], ['sub1', 0], ['sub2', 0], ['gk1', 90], ['m1', 90], ['m2', 90], ['m3', 90], ['d1', 90], ['d2', 90], ['d3', 90], ['a2', 90]]);
  const pts = mapOf([['out', 0], ['sub1', 2], ['sub2', 3], ['gk1', 2], ['m1', 1], ['m2', 1], ['m3', 1], ['d1', 1], ['d2', 1], ['d3', 1], ['a2', 1]]);
  const pos = positions([
    ['gk1', 'GK'], ['d1', 'DF'], ['d2', 'DF'], ['d3', 'DF'], ['m1', 'MF'], ['m2', 'MF'], ['m3', 'MF'],
    ['out', 'ATT'], ['a2', 'ATT'], ['sub1', 'ATT'], ['sub2', 'ATT'], ['sub3', 'MF'], ['sub4', 'GK'],
  ]);
  const result = applyAutoSubstitutions(lineup, pts, mins, pos, { gameweekComplete: true });
  const ids = [...starterIds(result), ...result.effectiveLineup.bench.map(String)];
  assert.strictEqual(new Set(ids).size, ids.filter(Boolean).length);
}

console.log('fantasyAutoSubstitutions tests passed');
