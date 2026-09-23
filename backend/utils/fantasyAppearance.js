const { calculateMinutesPoints } = require('./fantasyScoring');

/** Representative minutes for appearance buckets (scoring uses thresholds, not exact values). */
const FANTASY_APPEARANCE_UNDER45_MINUTES = 1;
const FANTASY_APPEARANCE_45PLUS_MINUTES = 45;

const APPEARANCE_UNDER45 = 'under45';
const APPEARANCE_45PLUS = '45plus';

function appearanceToMinutes(appearance) {
  if (appearance === APPEARANCE_UNDER45) return FANTASY_APPEARANCE_UNDER45_MINUTES;
  if (appearance === APPEARANCE_45PLUS) return FANTASY_APPEARANCE_45PLUS_MINUTES;
  return 0;
}

function minutesToAppearance(minutes) {
  const n = Number(minutes) || 0;
  if (n >= 45) return APPEARANCE_45PLUS;
  if (n >= 1) return APPEARANCE_UNDER45;
  return null;
}

function appearanceLabel(appearance) {
  if (appearance === APPEARANCE_UNDER45) return '<45';
  if (appearance === APPEARANCE_45PLUS) return '45+';
  return 'Did Not Play';
}

function minutesPointsForAppearance(appearance) {
  return calculateMinutesPoints(appearanceToMinutes(appearance));
}

module.exports = {
  APPEARANCE_UNDER45,
  APPEARANCE_45PLUS,
  FANTASY_APPEARANCE_UNDER45_MINUTES,
  FANTASY_APPEARANCE_45PLUS_MINUTES,
  appearanceToMinutes,
  minutesToAppearance,
  appearanceLabel,
  minutesPointsForAppearance,
};
