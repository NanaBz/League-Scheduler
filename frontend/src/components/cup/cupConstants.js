/** ACFPL Cup round metadata — mirrors backend schedule (GW6–GW10). */
export const ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'F'];

export const ROUND_META = {
  R32: { label: 'Round of 32', short: 'R32', managersIn: 32, managersOut: 16 },
  R16: { label: 'Round of 16', short: 'R16', managersIn: 16, managersOut: 8 },
  QF: { label: 'Quarter-Final', short: 'QF', managersIn: 8, managersOut: 4 },
  SF: { label: 'Semi-Final', short: 'SF', managersIn: 4, managersOut: 2 },
  F: { label: 'Final', short: 'FINAL', managersIn: 2, managersOut: 1 },
};

export const PROGRESS_STEPS = ROUND_ORDER.map((key) => ({
  key,
  short: ROUND_META[key].short,
  label: ROUND_META[key].label,
}));
