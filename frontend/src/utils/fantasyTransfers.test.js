import { countPendingTransfers, isStagedSquadDirty, squadsEqual } from './fantasyTransfers';

const player = (id, position = 'MF') => ({ _id: id, id, position, name: id });

const squad = (entries) => ({
  GK: [null, null],
  DF: [null, null, null, null],
  MF: [null, null, null, null],
  ATT: [null, null, null],
  ...entries,
});

describe('squadsEqual', () => {
  const saved = squad({
    MF: [player('a'), player('b'), player('c'), player('d')],
  });

  it('returns true for identical squads', () => {
    expect(squadsEqual(saved, saved)).toBe(true);
    expect(isStagedSquadDirty(saved, saved)).toBe(false);
  });

  it('returns false when a slot changes', () => {
    const staged = squad({
      MF: [player('x'), player('b'), player('c'), player('d')],
    });
    expect(squadsEqual(saved, staged)).toBe(false);
    expect(isStagedSquadDirty(saved, staged)).toBe(true);
  });

  it('returns true after reversing staged transfers back to saved state', () => {
    const step1 = squad({
      MF: [player('x'), player('b'), player('c'), player('d')],
    });
    const step2 = squad({
      MF: [player('x'), player('b'), player('y'), player('d')],
    });
    const step3 = squad({
      MF: [player('x'), player('e'), player('y'), player('d')],
    });

    expect(isStagedSquadDirty(saved, step1)).toBe(true);
    expect(isStagedSquadDirty(saved, step2)).toBe(true);
    expect(isStagedSquadDirty(saved, step3)).toBe(true);

    const restored = squad({
      MF: [player('a'), player('b'), player('c'), player('d')],
    });
    expect(isStagedSquadDirty(saved, restored)).toBe(false);
  });

  it('detects slot moves with the same player set', () => {
    const savedWithSlots = squad({
      MF: [player('a'), player('b'), null, null],
      ATT: [player('c'), null, null],
    });
    const moved = squad({
      MF: [player('b'), player('a'), null, null],
      ATT: [player('c'), null, null],
    });

    expect(countPendingTransfers(savedWithSlots, moved)).toBe(0);
    expect(isStagedSquadDirty(savedWithSlots, moved)).toBe(true);
  });
});
