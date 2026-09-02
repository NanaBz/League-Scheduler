const assert = require('assert');
const {
  validateManagerName,
  validateFantasyTeamName,
  MAX_MANAGER_NAME_LENGTH,
  MAX_TEAM_NAME_LENGTH,
} = require('./fantasyProfileValidation');

assert.strictEqual(validateManagerName('  Kobina  ').ok, true);
assert.strictEqual(validateManagerName('  Kobina  ').value, 'Kobina');
assert.strictEqual(validateManagerName('').ok, false);
assert.strictEqual(validateManagerName('   ').ok, false);
assert.strictEqual(
  validateManagerName('x'.repeat(MAX_MANAGER_NAME_LENGTH + 1)).ok,
  false
);

assert.strictEqual(validateFantasyTeamName('Kobina FC').ok, true);
assert.strictEqual(validateFantasyTeamName('').ok, false);
assert.strictEqual(
  validateFantasyTeamName('x'.repeat(MAX_TEAM_NAME_LENGTH + 1)).ok,
  false
);

console.log('fantasyProfileValidation tests passed');
