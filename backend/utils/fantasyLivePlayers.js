/**
 * Live-season Fantasy eligibility: active players only.
 * Historical/archive views must not use this filter.
 */
function liveFantasyPlayerFilter() {
  return { active: { $ne: false } };
}

function isLiveFantasyEligiblePlayer(player) {
  return player && player.active !== false;
}

module.exports = {
  liveFantasyPlayerFilter,
  isLiveFantasyEligiblePlayer,
};
