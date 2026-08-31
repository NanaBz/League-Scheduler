import {
  formatAcityPrice,
  formatAcityPriceLong,
  acityPriceAriaLabel,
} from './formatAcityPrice';

describe('formatAcityPrice', () => {
  test('formats standard prices', () => {
    expect(formatAcityPrice(7.5)).toBe('AC 7.5m');
    expect(formatAcityPrice(100)).toBe('AC 100.0m');
    expect(formatAcityPrice(92.5)).toBe('AC 92.5m');
    expect(formatAcityPrice(0)).toBe('AC 0.0m');
  });

  test('handles null, undefined, and invalid values', () => {
    expect(formatAcityPrice(null)).toBe('AC 0.0m');
    expect(formatAcityPrice(undefined)).toBe('AC 0.0m');
    expect(formatAcityPrice('')).toBe('AC 0.0m');
    expect(formatAcityPrice('abc')).toBe('AC 0.0m');
    expect(formatAcityPrice(NaN)).toBe('AC 0.0m');
    expect(formatAcityPrice(Infinity)).toBe('AC 0.0m');
  });

  test('does not modify the input value', () => {
    const price = 7.5;
    const formatted = formatAcityPrice(price);
    expect(price).toBe(7.5);
    expect(formatted).toBe('AC 7.5m');
  });
});

describe('formatAcityPriceLong', () => {
  test('formats long descriptive label', () => {
    expect(formatAcityPriceLong(7.5)).toBe('7.5 million Acity Coins');
    expect(formatAcityPriceLong(100)).toBe('100.0 million Acity Coins');
  });

  test('handles invalid values', () => {
    expect(formatAcityPriceLong(null)).toBe('0.0 million Acity Coins');
    expect(formatAcityPriceLong(undefined)).toBe('0.0 million Acity Coins');
  });
});

describe('acityPriceAriaLabel', () => {
  test('matches long form for screen readers', () => {
    expect(acityPriceAriaLabel(92.5)).toBe('92.5 million Acity Coins');
  });
});
