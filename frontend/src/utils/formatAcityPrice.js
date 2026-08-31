/** Format a numeric fantasy price (millions) as compact Acity Coins display. */
export function formatAcityPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'AC 0.0m';
  return `AC ${n.toFixed(1)}m`;
}

/** Long-form label for accessibility / tooltips. */
export function formatAcityPriceLong(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.0 million Acity Coins';
  return `${n.toFixed(1)} million Acity Coins`;
}

/** aria-label helper for price elements. */
export function acityPriceAriaLabel(value) {
  return formatAcityPriceLong(value);
}
