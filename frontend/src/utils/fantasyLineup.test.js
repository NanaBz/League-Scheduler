import { lineupPayloadsEqual, normalizeLineupPayload } from './fantasyLineup';

describe('lineupPayloadsEqual', () => {
  const saved = {
    formation: '3-3-2',
    starters: {
      gk: ['gk1'],
      df: ['d1', 'd2', 'd3'],
      mf: ['m1', 'm2', 'm3'],
      att: ['a1', 'a2'],
    },
    bench: ['b1', 'b2', 'b3', 'b4'],
    captainId: 'm1',
    viceCaptainId: 'd1',
    chipUsed: null,
  };

  it('returns true for identical payloads', () => {
    expect(lineupPayloadsEqual(saved, saved)).toBe(true);
  });

  it('returns false when a starter changes', () => {
    const changed = {
      ...saved,
      starters: {
        ...saved.starters,
        att: ['a1', 'x1'],
      },
    };
    expect(lineupPayloadsEqual(saved, changed)).toBe(false);
  });

  it('returns true after reversing a swap back to saved state', () => {
    const swapped = {
      ...saved,
      starters: {
        ...saved.starters,
        att: ['x1', 'a2'],
      },
    };
    expect(lineupPayloadsEqual(saved, swapped)).toBe(false);
    expect(lineupPayloadsEqual(saved, saved)).toBe(true);
  });

  it('normalizes id types consistently', () => {
    const withNumbers = normalizeLineupPayload({
      ...saved,
      captainId: 101,
      bench: [201, 202, 203, 204],
    });
    const withStrings = normalizeLineupPayload({
      ...saved,
      captainId: '101',
      bench: ['201', '202', '203', '204'],
    });
    expect(lineupPayloadsEqual(withNumbers, withStrings)).toBe(true);
  });
});
