const assert = require('assert');
const { calculateMinutesPoints } = require('./fantasyScoring');
const {
  appearanceToMinutes,
  minutesToAppearance,
  minutesPointsForAppearance,
  APPEARANCE_UNDER45,
  APPEARANCE_45PLUS,
} = require('./fantasyAppearance');

assert.strictEqual(appearanceToMinutes(null), 0);
assert.strictEqual(appearanceToMinutes(APPEARANCE_UNDER45), 1);
assert.strictEqual(appearanceToMinutes(APPEARANCE_45PLUS), 45);

assert.strictEqual(minutesToAppearance(0), null);
assert.strictEqual(minutesToAppearance(44), APPEARANCE_UNDER45);
assert.strictEqual(minutesToAppearance(45), APPEARANCE_45PLUS);
assert.strictEqual(minutesToAppearance(70), APPEARANCE_45PLUS);

assert.strictEqual(minutesPointsForAppearance(null), 0);
assert.strictEqual(minutesPointsForAppearance(APPEARANCE_UNDER45), 1);
assert.strictEqual(minutesPointsForAppearance(APPEARANCE_45PLUS), 2);
assert.strictEqual(calculateMinutesPoints(appearanceToMinutes(APPEARANCE_UNDER45)), 1);
assert.strictEqual(calculateMinutesPoints(appearanceToMinutes(APPEARANCE_45PLUS)), 2);

console.log('fantasyAppearance.test.js passed');
