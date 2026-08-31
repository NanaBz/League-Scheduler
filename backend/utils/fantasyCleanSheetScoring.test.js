const assert = require('assert');
const {
  cleansheetPointsForPosition,
  teamCleanSheetFlags,
  fantasyCleanSheetForPlayer,
  teamKeptCleanSheetForPlayerTeam,
  buildEventStatsByPlayer,
} = require('./fantasyMatchEventsSync');
const { recalcPerformanceTotal } = require('./fantasyScoring');

const HOME = 'homeTeamId';
const AWAY = 'awayTeamId';

function csForSide({ homeScore, awayScore, side, minutes, position }) {
  const flags = teamCleanSheetFlags(homeScore, awayScore);
  const teamKeptCleanSheet =
    side === 'home'
      ? teamKeptCleanSheetForPlayerTeam(HOME, HOME, AWAY, flags)
      : teamKeptCleanSheetForPlayerTeam(AWAY, HOME, AWAY, flags);
  return fantasyCleanSheetForPlayer({ minutesPlayed: minutes, position, teamKeptCleanSheet });
}

function assertCs(actual, expectedPoints, label) {
  assert.strictEqual(
    actual.cleansheetPoints,
    expectedPoints,
    `${label}: expected ${expectedPoints} CS points, got ${actual.cleansheetPoints}`
  );
}

// --- teamCleanSheetFlags ---

assert.deepStrictEqual(teamCleanSheetFlags(2, 0), { homeKeptCleanSheet: true, awayKeptCleanSheet: false });
assert.deepStrictEqual(teamCleanSheetFlags(0, 2), { homeKeptCleanSheet: false, awayKeptCleanSheet: true });
assert.deepStrictEqual(teamCleanSheetFlags(0, 0), { homeKeptCleanSheet: true, awayKeptCleanSheet: true });
assert.deepStrictEqual(teamCleanSheetFlags(2, 1), { homeKeptCleanSheet: false, awayKeptCleanSheet: false });
assert.deepStrictEqual(teamCleanSheetFlags(1, 0), { homeKeptCleanSheet: true, awayKeptCleanSheet: false });
assert.deepStrictEqual(teamCleanSheetFlags(null, 0), { homeKeptCleanSheet: false, awayKeptCleanSheet: false });

// --- position points ---

assert.strictEqual(cleansheetPointsForPosition('GK'), 4);
assert.strictEqual(cleansheetPointsForPosition('DF'), 4);
assert.strictEqual(cleansheetPointsForPosition('MF'), 1);
assert.strictEqual(cleansheetPointsForPosition('ATT'), 0);

// --- Test 1: 2–0 home clean sheet ---

assertCs(csForSide({ homeScore: 2, awayScore: 0, side: 'home', minutes: 70, position: 'GK' }), 4, '2-0 home GK 70');
assertCs(csForSide({ homeScore: 2, awayScore: 0, side: 'home', minutes: 70, position: 'DF' }), 4, '2-0 home DF 70');
assertCs(csForSide({ homeScore: 2, awayScore: 0, side: 'home', minutes: 70, position: 'MF' }), 1, '2-0 home MF 70');
assertCs(csForSide({ homeScore: 2, awayScore: 0, side: 'home', minutes: 70, position: 'ATT' }), 0, '2-0 home ATT 70');
assertCs(csForSide({ homeScore: 2, awayScore: 0, side: 'away', minutes: 70, position: 'GK' }), 0, '2-0 away GK 70');

// --- Test 2: 0–2 away clean sheet ---

assertCs(csForSide({ homeScore: 0, awayScore: 2, side: 'away', minutes: 70, position: 'GK' }), 4, '0-2 away GK 70');
assertCs(csForSide({ homeScore: 0, awayScore: 2, side: 'away', minutes: 70, position: 'DF' }), 4, '0-2 away DF 70');
assertCs(csForSide({ homeScore: 0, awayScore: 2, side: 'away', minutes: 70, position: 'MF' }), 1, '0-2 away MF 70');
assertCs(csForSide({ homeScore: 0, awayScore: 2, side: 'home', minutes: 70, position: 'GK' }), 0, '0-2 home GK 70');

// --- Test 3: 0–0 both teams ---

assertCs(csForSide({ homeScore: 0, awayScore: 0, side: 'home', minutes: 70, position: 'GK' }), 4, '0-0 home GK');
assertCs(csForSide({ homeScore: 0, awayScore: 0, side: 'home', minutes: 70, position: 'MF' }), 1, '0-0 home MF');
assertCs(csForSide({ homeScore: 0, awayScore: 0, side: 'away', minutes: 70, position: 'DF' }), 4, '0-0 away DF');
assertCs(csForSide({ homeScore: 0, awayScore: 0, side: 'away', minutes: 70, position: 'MF' }), 1, '0-0 away MF');

// --- Test 4: 2–1 no clean sheets ---

assertCs(csForSide({ homeScore: 2, awayScore: 1, side: 'home', minutes: 70, position: 'GK' }), 0, '2-1 home GK');
assertCs(csForSide({ homeScore: 2, awayScore: 1, side: 'away', minutes: 70, position: 'DF' }), 0, '2-1 away DF');

// --- Tests 5–8: minutes thresholds on clean-sheet team ---

assertCs(csForSide({ homeScore: 2, awayScore: 0, side: 'home', minutes: 0, position: 'GK' }), 0, '0 min GK');
assertCs(csForSide({ homeScore: 2, awayScore: 0, side: 'home', minutes: 44, position: 'DF' }), 0, '44 min DF');
assertCs(csForSide({ homeScore: 2, awayScore: 0, side: 'home', minutes: 45, position: 'GK' }), 4, '45 min GK');
assertCs(csForSide({ homeScore: 2, awayScore: 0, side: 'home', minutes: 45, position: 'MF' }), 1, '45 min MF');
assertCs(csForSide({ homeScore: 2, awayScore: 0, side: 'home', minutes: 70, position: 'GK' }), 4, '70 min GK');
assertCs(csForSide({ homeScore: 2, awayScore: 0, side: 'home', minutes: 70, position: 'MF' }), 1, '70 min MF');
assertCs(csForSide({ homeScore: 2, awayScore: 0, side: 'home', minutes: 70, position: 'ATT' }), 0, '70 min ATT');

// --- Test 9: CLEAN_SHEET event selects GK only; teammates still eligible via score ---

const eventsGkOnly = [
  { type: 'CLEAN_SHEET', side: 'home', player: { _id: 'gk1', position: 'GK' } },
];
const statsGkOnly = buildEventStatsByPlayer(eventsGkOnly);
assert.strictEqual(statsGkOnly.get('gk1')?.cleansheetPoints || 0, 0, 'CLEAN_SHEET event must not set Fantasy CS on GK');
assert.strictEqual(statsGkOnly.has('df1'), false, 'DF not in event stats map');

const dfCs = csForSide({ homeScore: 2, awayScore: 0, side: 'home', minutes: 70, position: 'DF' });
assertCs(dfCs, 4, 'DF teammate still gets CS from score');

const mfCs = csForSide({ homeScore: 2, awayScore: 0, side: 'home', minutes: 60, position: 'MF' });
assertCs(mfCs, 1, 'MF teammate still gets CS from score');

// --- Test 10: Fixture CS player is midfielder (registered position used) ---

const selectedMidCs = fantasyCleanSheetForPlayer({
  minutesPlayed: 70,
  position: 'MF',
  teamKeptCleanSheet: true,
});
assertCs(selectedMidCs, 1, 'selected MF gets +1 by registered position');

const gkCs = csForSide({ homeScore: 1, awayScore: 0, side: 'home', minutes: 70, position: 'GK' });
assertCs(gkCs, 4, 'registered GK still +4 when MF selected in fixture');

// --- Test 11: No CLEAN_SHEET event — score alone drives Fantasy CS ---

const noEventStats = buildEventStatsByPlayer([]);
assert.strictEqual(noEventStats.size, 0);
assertCs(csForSide({ homeScore: 2, awayScore: 0, side: 'home', minutes: 70, position: 'DF' }), 4, 'no event DF CS');

// --- Test 12: stale value removal (recompute to zero) ---

const stale = fantasyCleanSheetForPlayer({
  minutesPlayed: 30,
  position: 'GK',
  teamKeptCleanSheet: true,
});
assertCs(stale, 0, 'stale: minutes dropped below 45');

const staleTeam = fantasyCleanSheetForPlayer({
  minutesPlayed: 70,
  position: 'GK',
  teamKeptCleanSheet: false,
});
assertCs(staleTeam, 0, 'stale: team no longer kept CS');

// --- Test 13: idempotency (pure function returns same value twice) ---

const input = { minutesPlayed: 70, position: 'DF', teamKeptCleanSheet: true };
const first = fantasyCleanSheetForPlayer(input);
const second = fantasyCleanSheetForPlayer(input);
assert.deepStrictEqual(first, second, 'idempotent recompute');

// --- Test 14: CLEAN_SHEET events ignored in buildEventStatsByPlayer ---

const mixedEvents = [
  { type: 'GOAL', player: { _id: 'p1', position: 'ATT' }, ownGoal: false },
  { type: 'CLEAN_SHEET', side: 'home', player: { _id: 'gk1', position: 'GK' } },
  { type: 'YELLOW_CARD', player: { _id: 'p2', position: 'MF' } },
];
const mixed = buildEventStatsByPlayer(mixedEvents);
assert.strictEqual(mixed.get('p1')?.goals, 1);
assert.strictEqual(mixed.get('gk1')?.cleansheetPoints || 0, 0);
assert.strictEqual(mixed.get('gk1')?.cleansheet || false, false);
assert.strictEqual(mixed.get('p2')?.yellowCards, 1);

// --- Test 15: recalcPerformanceTotal belt-and-braces ---

const totalWithCsButLowMinutes = recalcPerformanceTotal(
  {
    minutesPlayed: 44,
    minutesPoints: 1,
    cleansheetPoints: 4,
    goals: 0,
    assists: 0,
    bonusPoints: 0,
    specialPoints: 0,
    ownGoals: 0,
    yellowCards: 0,
    redCards: 0,
  },
  'GK'
);
assert.strictEqual(totalWithCsButLowMinutes, 1, 'recalcPerformanceTotal ignores CS when minutes < 45');

const totalWithCsAndMinutes = recalcPerformanceTotal(
  {
    minutesPlayed: 45,
    minutesPoints: 2,
    cleansheetPoints: 4,
    goals: 0,
    assists: 0,
    bonusPoints: 0,
    specialPoints: 0,
    ownGoals: 0,
    yellowCards: 0,
    redCards: 0,
  },
  'GK'
);
assert.strictEqual(totalWithCsAndMinutes, 6, 'recalcPerformanceTotal includes CS when minutes >= 45');

console.log('fantasyCleanSheetScoring tests passed');
