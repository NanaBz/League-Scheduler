const assert = require('assert');
const mongoose = require('mongoose');
const {
  resolveFantasyCupFinalOutcome,
  buildAchievementDocs,
  snapshotCupTie,
} = require('./fantasySeasonArchiveSnapshot');

function oid(n) {
  return new mongoose.Types.ObjectId(String(n).padStart(24, '0'));
}

function run() {
  const homeId = oid(1);
  const awayId = oid(2);
  const finalTie = {
    round: 'F',
    gameweek: 10,
    resolved: true,
    homeFantasyUser: homeId,
    awayFantasyUser: awayId,
    homeTeamName: 'Akakpo FC',
    awayTeamName: 'Other FC',
    homePoints: 62,
    awayPoints: 55,
    winnerFantasyUser: homeId,
  };

  const userById = new Map([
    [String(homeId), { managerName: 'Akakpo' }],
    [String(awayId), { managerName: 'Other' }],
  ]);

  const outcome = resolveFantasyCupFinalOutcome(finalTie, userById);
  assert.strictEqual(outcome.winner.teamName, 'Akakpo FC');
  assert.strictEqual(outcome.runnerUp.teamName, 'Other FC');
  assert.strictEqual(String(outcome.runnerUp.fantasyUserId), String(awayId));

  const unresolved = resolveFantasyCupFinalOutcome({ round: 'F', resolved: false }, userById);
  assert.strictEqual(unresolved.winner, null);
  assert.strictEqual(unresolved.runnerUp, null);
  assert.strictEqual(unresolved.reason, 'final_not_resolved');

  const achievements = buildAchievementDocs({
    seasonNumber: 1,
    seasonName: '2025/2026 — First Semester',
    academicYear: '2025/2026',
    semester: 'first',
    leagueEntries: [
      { fantasyUserId: String(homeId), team: 'Akakpo FC', user: 'Akakpo', total: 1284, gw: 90, pos: 1 },
      { fantasyUserId: String(awayId), team: 'Other FC', user: 'Other', total: 1173, gw: 80, pos: 2 },
    ],
    cupOutcome: outcome,
  });

  assert.strictEqual(achievements.length, 4);
  const types = achievements.map((a) => a.achievementType).sort();
  assert.deepStrictEqual(types, [
    'fantasy_cup_champion',
    'fantasy_cup_runner_up',
    'fpl_champion',
    'fpl_runner_up',
  ]);

  const dupTypes = new Set(
    achievements.map((a) => `${a.competition}:${a.achievementType}:${String(a.fantasyUserId)}`)
  );
  assert.strictEqual(dupTypes.size, achievements.length);

  const tieSnap = snapshotCupTie({
    round: 'SF',
    gameweek: 9,
    bracketSlot: 0,
    homeFantasyUser: homeId,
    awayFantasyUser: awayId,
    homeTeamName: 'A',
    awayTeamName: 'B',
    resolved: true,
    winnerFantasyUser: homeId,
  });
  assert.strictEqual(tieSnap.round, 'SF');
  assert.strictEqual(tieSnap.resolved, true);
  assert.strictEqual(tieSnap.tiebreakMethod, undefined);

  const withTiebreak = snapshotCupTie({
    ...finalTie,
    round: 'F',
    tiebreakMethod: 'goals_scored',
  });
  assert.strictEqual(withTiebreak.tiebreakMethod, 'goals_scored');

  console.log('fantasySeasonArchiveSnapshot tests passed');
}

run();
