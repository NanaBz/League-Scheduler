const assert = require('assert');
const {
  validateMaxPlayersPerClubFromPlayers,
  findClubLimitViolation,
  countPlayersPerClub,
} = require('./fantasySquadValidation');

function run() {
  const teamA = 'teamA';
  const teamB = 'teamB';
  const playersById = new Map([
    ['p1', { _id: 'p1', team: { _id: teamA, name: 'Club A' } }],
    ['p2', { _id: 'p2', team: { _id: teamA, name: 'Club A' } }],
    ['p3', { _id: 'p3', team: { _id: teamA, name: 'Club A' } }],
    ['p4', { _id: 'p4', team: { _id: teamA, name: 'Club A' } }],
    ['p5', { _id: 'p5', team: { _id: teamB, name: 'Club B' } }],
  ]);

  // Replace p1 with p4: still 3 from Club A — allow
  let result = validateMaxPlayersPerClubFromPlayers(playersById, ['p4', 'p2', 'p3']);
  assert.strictEqual(result.ok, true);

  // Four distinct Club A players — reject
  result = validateMaxPlayersPerClubFromPlayers(playersById, ['p1', 'p2', 'p3', 'p4']);
  assert.strictEqual(result.ok, false);

  const { counts, names } = countPlayersPerClub(playersById, ['p1', 'p2', 'p3']);
  assert.strictEqual(counts.get(teamA), 3);
  assert.strictEqual(findClubLimitViolation(counts, names), null);

  console.log('fantasySquadValidation tests passed');
}

run();
