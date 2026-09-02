/**
 * Backend account route logic tests (validation helpers).
 */
const assert = require('assert');
const {
  validateManagerName,
  validateFantasyTeamName,
} = require('./fantasyProfileValidation');

const emptyManager = validateManagerName('');
assert.strictEqual(emptyManager.ok, false);

const longTeam = validateFantasyTeamName('T'.repeat(51));
assert.strictEqual(longTeam.ok, false);

console.log('fantasyAccount tests passed');
