import { bonusAssignmentsFromState, validateMatchBonusAssignments } from './fantasyBonusValidation';

describe('validateMatchBonusAssignments (frontend)', () => {
  test('blocks save when a bonus slot is blank', () => {
    const result = validateMatchBonusAssignments({ bp3: 'a', bp2: 'b', bp1: null });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/assign bonus points/i);
  });

  test('allows all three slots filled', () => {
    const result = validateMatchBonusAssignments({ bp3: 'a', bp2: 'b', bp1: 'c' });
    expect(result.ok).toBe(true);
  });

  test('builds API payload from state', () => {
    const payload = bonusAssignmentsFromState({ bp3: 'a', bp2: 'b', bp1: 'c' });
    expect(payload).toEqual([
      { playerId: 'a', bonusPoints: 3 },
      { playerId: 'b', bonusPoints: 2 },
      { playerId: 'c', bonusPoints: 1 },
    ]);
  });
});
