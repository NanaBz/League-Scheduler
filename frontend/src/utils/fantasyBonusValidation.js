/**
 * Validates FPL-style match bonus: one player each for +3, +2, +1.
 */
export function validateMatchBonusAssignments(bonusAssignments) {
  const { bp3, bp2, bp1 } = bonusAssignments || {};
  const missing = [];
  if (!bp3) missing.push(3);
  if (!bp2) missing.push(2);
  if (!bp1) missing.push(1);

  if (missing.length) {
    return {
      ok: false,
      message: 'Please assign bonus points to all required players before saving.',
      missingLevels: missing,
    };
  }

  const ids = [String(bp3), String(bp2), String(bp1)];
  if (new Set(ids).size !== ids.length) {
    return {
      ok: false,
      message: 'Each bonus level (+3, +2, +1) must be assigned to a different player.',
    };
  }

  return { ok: true };
}

export function bonusAssignmentsFromState(bonusState) {
  const assignments = [];
  if (bonusState?.bp3) assignments.push({ playerId: bonusState.bp3, bonusPoints: 3 });
  if (bonusState?.bp2) assignments.push({ playerId: bonusState.bp2, bonusPoints: 2 });
  if (bonusState?.bp1) assignments.push({ playerId: bonusState.bp1, bonusPoints: 1 });
  return assignments;
}
