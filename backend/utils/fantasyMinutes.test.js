const assert = require('assert');
const {
  FANTASY_MIN_MINUTES,
  FANTASY_MAX_MINUTES,
  parseFantasyMinutes,
  clampFantasyMinutes,
} = require('./fantasyMinutes');

assert.strictEqual(FANTASY_MIN_MINUTES, 0);
assert.strictEqual(FANTASY_MAX_MINUTES, 70);

assert.deepStrictEqual(parseFantasyMinutes(0), { ok: true, minutes: 0 });
assert.deepStrictEqual(parseFantasyMinutes(70), { ok: true, minutes: 70 });
assert.deepStrictEqual(parseFantasyMinutes(45.9), { ok: true, minutes: 45 });
assert.deepStrictEqual(parseFantasyMinutes(-1).ok, false);
assert.deepStrictEqual(parseFantasyMinutes(71).ok, false);
assert.deepStrictEqual(parseFantasyMinutes('abc').ok, false);

assert.strictEqual(clampFantasyMinutes(-5), 0);
assert.strictEqual(clampFantasyMinutes(70), 70);
assert.strictEqual(clampFantasyMinutes(100), 70);

console.log('fantasyMinutes tests passed');
