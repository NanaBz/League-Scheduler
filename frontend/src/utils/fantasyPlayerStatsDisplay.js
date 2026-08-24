/** Safe display helpers for FPL player stats from the API. */

export function displayTotalPoints(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function displaySelectionPercentage(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.0';
  return n.toFixed(1);
}
