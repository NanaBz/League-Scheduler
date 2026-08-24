import { formatPercentRankLabel } from './fantasyManagerHistory';

describe('formatPercentRankLabel', () => {
  it('formats numeric percent rank', () => {
    expect(formatPercentRankLabel(90)).toBe('90.0%');
    expect(formatPercentRankLabel(62.5)).toBe('62.5%');
  });

  it('returns em dash for missing values', () => {
    expect(formatPercentRankLabel(null)).toBe('—');
    expect(formatPercentRankLabel(undefined)).toBe('—');
  });
});
