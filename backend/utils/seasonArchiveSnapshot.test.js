const assert = require('assert');
const {
  deriveAcademicYear,
  isArchivableFixture,
  isPlayedArchivableFixture,
  buildSeasonArchivePayload,
  buildLegacyMatches,
} = require('./seasonArchiveSnapshot');

function oid(n) {
  return String(n).padStart(24, '0');
}

function run() {
  assert.strictEqual(deriveAcademicYear(new Date('2026-03-01')), '2025/2026');
  assert.strictEqual(deriveAcademicYear(new Date('2026-09-01')), '2026/2027');

  assert.strictEqual(isArchivableFixture({ isVoided: true }), false);
  assert.strictEqual(isArchivableFixture({ isVoided: false }), true);
  assert.strictEqual(isPlayedArchivableFixture({ isVoided: false, isPlayed: false }), false);
  assert.strictEqual(isPlayedArchivableFixture({ isVoided: false, isPlayed: true }), true);

  const teams = [
    { _id: oid(1), name: 'Warriors', logo: '/w.svg', category: 'boys', competition: 'league', played: 2, won: 2, drawn: 0, lost: 0, goalsFor: 5, goalsAgainst: 1, goalDifference: 4, points: 6, form: ['W', 'W'] },
    { _id: oid(2), name: 'Lions', logo: '/l.svg', category: 'boys', competition: 'league', played: 2, won: 0, drawn: 0, lost: 2, goalsFor: 1, goalsAgainst: 5, goalDifference: -4, points: 0, form: ['L', 'L'] },
    { _id: oid(3), name: 'Orion', logo: '/o.svg', category: 'girls', competition: 'acwpl' },
    { _id: oid(4), name: 'Firestorm', logo: '/f.svg', category: 'girls', competition: 'acwpl' },
  ];

  const players = [
    { _id: oid(10), name: 'Striker One', number: 9, position: 'ATT', team: oid(1), isCaptain: true },
    { _id: oid(11), name: 'Keeper', number: 1, position: 'GK', team: oid(1) },
  ];

  const matches = [
    { _id: oid(100), competition: 'league', homeTeam: teams[0], awayTeam: teams[1], homeScore: 3, awayScore: 1, isPlayed: true, isVoided: false, date: new Date(), time: '15:00', matchweek: 1, matchState: 'ft' },
    { _id: oid(101), competition: 'girls-super-cup', homeTeam: teams[2], awayTeam: teams[3], homeScore: 2, awayScore: 0, isPlayed: true, isVoided: false, date: new Date(), time: '16:00', matchweek: 1, matchState: 'ft' },
    { _id: oid(102), competition: 'girls-super-cup', homeTeam: teams[3], awayTeam: teams[2], homeScore: 1, awayScore: 2, isPlayed: true, isVoided: false, date: new Date(), time: '16:00', matchweek: 2, matchState: 'ft' },
    { _id: oid(103), competition: 'girls-super-cup', homeTeam: teams[2], awayTeam: teams[3], homeScore: null, awayScore: null, isPlayed: false, isVoided: true, voidReason: 'clinched', date: new Date(), time: '16:00', matchweek: 3 },
    { _id: oid(104), competition: 'acwpl', homeTeam: teams[2], awayTeam: teams[3], homeScore: 2, awayScore: 0, isPlayed: true, isVoided: false, date: new Date(), time: '14:00', matchweek: 1, matchState: 'ft' },
    { _id: oid(106), competition: 'acwpl', homeTeam: teams[3], awayTeam: teams[2], homeScore: 0, awayScore: 1, isPlayed: true, isVoided: false, date: new Date(), time: '14:00', matchweek: 2, matchState: 'ft' },
    { _id: oid(107), competition: 'acwpl', homeTeam: teams[2], awayTeam: teams[3], homeScore: 3, awayScore: 1, isPlayed: true, isVoided: false, date: new Date(), time: '14:00', matchweek: 3, matchState: 'ft' },
    { _id: oid(105), competition: 'acwpl', homeTeam: teams[3], awayTeam: teams[2], homeScore: 0, awayScore: 0, isPlayed: false, isVoided: true, voidReason: 'clinched', date: new Date(), time: '14:00', matchweek: 4 },
  ];

  const playerStats = [
    { player: oid(10), team: oid(1), competition: 'league', goals: 2, assists: 1, cleanSheets: 0, yellowCards: 0, redCards: 0, ownGoals: 0 },
  ];

  const payload = buildSeasonArchivePayload({
    teams,
    matches,
    players,
    playerStats,
    seasonNumber: 2,
    meta: { displayName: '2025/2026 Season', academicYear: '2025/2026', archivedAt: new Date('2026-03-15T12:00:00.000Z') },
  });

  assert.strictEqual(payload.archiveVersion, 2);
  assert.strictEqual(payload.status, 'archived');
  assert.strictEqual(payload.displayName, '2025/2026 Season');
  assert.strictEqual(payload.academicYear, '2025/2026');
  assert.strictEqual(payload.participatingTeams.length, 4);
  assert.strictEqual(payload.participatingPlayers.length, 2);
  assert.strictEqual(payload.participatingPlayers[0].teamName, 'Warriors');

  assert.strictEqual(payload.competitions.league.standings.length, 2);
  assert.strictEqual(payload.competitions.league.standings[0].teamName, 'Warriors');
  assert.strictEqual(payload.competitions.league.statistics.goals.length, 1);
  assert.strictEqual(payload.competitions.league.statistics.goals[0].playerName, 'Striker One');

  const gsc = payload.competitions.girlsSuperCup;
  assert.strictEqual(gsc.fixtures.length, 2);
  assert.strictEqual(gsc.winner?.name, 'Orion');
  assert.strictEqual(gsc.winsByTeam.find((w) => w.wins >= 2)?.teamName, 'Orion');

  assert.strictEqual(payload.competitions.acwpl.fixtures.length, 3);
  assert.strictEqual(payload.competitions.acwpl.winner?.name, 'Orion');

  const legacy = buildLegacyMatches(matches, new Map(teams.map((t) => [String(t._id), t])));
  assert.strictEqual(legacy.length, 6);
  assert.ok(!legacy.some((m) => m.isVoided));

  assert.strictEqual(payload.finalStandings.length, 2);
  assert.strictEqual(payload.finalStandings[0].position, 1);

  console.log('seasonArchiveSnapshot tests passed');
}

run();
