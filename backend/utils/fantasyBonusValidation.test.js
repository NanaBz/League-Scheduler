const assert = require('assert');
const { validateMatchBonusAssignments } = require('./fantasyBonusValidation');

async function run() {
  const missingArray = validateMatchBonusAssignments(null);
  assert.strictEqual(missingArray.ok, false);

  const incomplete = validateMatchBonusAssignments([
    { playerId: 'a', bonusPoints: 3 },
    { playerId: 'b', bonusPoints: 2 },
  ]);
  assert.strictEqual(incomplete.ok, false);
  assert.match(incomplete.message, /assign bonus points/i);
  assert.deepStrictEqual(incomplete.missingLevels, [1]);

  const complete = validateMatchBonusAssignments([
    { playerId: 'a', bonusPoints: 3 },
    { playerId: 'b', bonusPoints: 2 },
    { playerId: 'c', bonusPoints: 1 },
  ]);
  assert.strictEqual(complete.ok, true);

  const duplicate = validateMatchBonusAssignments([
    { playerId: 'a', bonusPoints: 3 },
    { playerId: 'b', bonusPoints: 3 },
    { playerId: 'c', bonusPoints: 1 },
  ]);
  assert.strictEqual(duplicate.ok, false);
}

run()
  .then(() => {
    console.log('fantasyBonusValidation.test.js passed');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
