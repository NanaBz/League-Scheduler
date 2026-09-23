/**
 * Validates FPL-style match bonus assignments: exactly one player each for 3, 2, and 1.
 */
function validateMatchBonusAssignments(bonusAssignments) {
  if (!Array.isArray(bonusAssignments)) {
    return { ok: false, message: 'bonusAssignments array required' };
  }

  const byLevel = { 3: null, 2: null, 1: null };

  for (const entry of bonusAssignments) {
    const playerId = entry?.playerId;
    const bonusPoints = Number(entry?.bonusPoints);
    if (!playerId) {
      return { ok: false, message: 'Each bonus assignment must include playerId' };
    }
    if (![1, 2, 3].includes(bonusPoints)) {
      return { ok: false, message: 'Bonus points must be 1, 2, or 3' };
    }
    if (byLevel[bonusPoints]) {
      return { ok: false, message: `Only one player may receive +${bonusPoints} bonus points` };
    }
    byLevel[bonusPoints] = String(playerId);
  }

  const missing = [3, 2, 1].filter((level) => !byLevel[level]);
  if (missing.length) {
    return {
      ok: false,
      message: 'Please assign bonus points to all required players before saving.',
      missingLevels: missing,
    };
  }

  return { ok: true, assignments: byLevel };
}

module.exports = {
  validateMatchBonusAssignments,
};
