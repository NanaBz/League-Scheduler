const assert = require('assert');
const { shouldPreserveLockedAutosubs } = require('./fantasyScoring');

function run() {
  assert.strictEqual(
    shouldPreserveLockedAutosubs({ gameweekComplete: true, isLocked: true, forceAutosubRecalc: false }),
    true
  );
  assert.strictEqual(
    shouldPreserveLockedAutosubs({ gameweekComplete: true, isLocked: true, forceAutosubRecalc: true }),
    false
  );
  assert.strictEqual(
    shouldPreserveLockedAutosubs({ gameweekComplete: true, isLocked: false, forceAutosubRecalc: false }),
    false
  );
  assert.strictEqual(
    shouldPreserveLockedAutosubs({ gameweekComplete: false, isLocked: true, forceAutosubRecalc: false }),
    false
  );

  console.log('fantasyRescoreLocked tests passed');
}

run();
