/** ACFPL fantasy match minutes — admin-assigned per fixture (not real-world 90). */
const FANTASY_MIN_MINUTES = 0;
const FANTASY_MAX_MINUTES = 70;

function parseFantasyMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return { ok: false, error: 'Minutes must be a number' };
  }
  if (n < FANTASY_MIN_MINUTES || n > FANTASY_MAX_MINUTES) {
    return {
      ok: false,
      error: `Minutes must be between ${FANTASY_MIN_MINUTES} and ${FANTASY_MAX_MINUTES}`,
    };
  }
  return { ok: true, minutes: Math.trunc(n) };
}

/** Clamp for display/legacy rows — API writes should use parseFantasyMinutes and reject invalid values. */
function clampFantasyMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return FANTASY_MIN_MINUTES;
  return Math.min(FANTASY_MAX_MINUTES, Math.max(FANTASY_MIN_MINUTES, Math.trunc(n)));
}

module.exports = {
  FANTASY_MIN_MINUTES,
  FANTASY_MAX_MINUTES,
  parseFantasyMinutes,
  clampFantasyMinutes,
};
