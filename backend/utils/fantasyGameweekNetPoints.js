/** Gameweek total after transfer hit (may be negative, FPL-style). */
function computeGameweekNetPoints(rawLineupPoints, transferHitPoints) {
  const raw = Number(rawLineupPoints) || 0;
  const hit = Math.max(0, Number(transferHitPoints) || 0);
  return raw - hit;
}

module.exports = { computeGameweekNetPoints };
