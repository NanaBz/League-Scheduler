/** Captain blanked = 0 gameweek minutes and 0 gameweek fantasy points. */
function captainDidNotPlay(playerId, playerPoints, playerMinutes) {
  if (!playerId) return false;
  const id = String(playerId);
  const points = playerPoints?.get?.(id) ?? 0;
  const minutes = playerMinutes?.get?.(id) ?? 0;
  return points === 0 && minutes === 0;
}

/**
 * When the named captain did not play, the vice-captain wears the armband for scoring (2× / 3×).
 * Returns the player id that receives the captain multiplier.
 */
function resolveScoringCaptainId(captainId, viceCaptainId, playerPoints, playerMinutes) {
  const cap = captainId ? String(captainId) : null;
  const vice = viceCaptainId ? String(viceCaptainId) : null;

  if (!cap) {
    return { scoringCaptainId: null, captainBlanked: false, vicePromoted: false };
  }

  if (captainDidNotPlay(cap, playerPoints, playerMinutes) && vice && vice !== cap) {
    return { scoringCaptainId: vice, captainBlanked: true, vicePromoted: true };
  }

  return { scoringCaptainId: cap, captainBlanked: false, vicePromoted: false };
}

/** Stats that require the player to have been on the pitch (min 1 minute). */
function performanceHasScoringEventStats(row) {
  if (!row) return false;
  return (
    (row.goals || 0) > 0 ||
    (row.assists || 0) > 0 ||
    (row.ownGoals || 0) > 0 ||
    (row.yellowCards || 0) > 0 ||
    (row.redCards || 0) > 0
  );
}

function defaultMinutesForPerformance(row) {
  const played = Number(row?.minutesPlayed) || 0;
  if (played > 0) return played;
  if (performanceHasScoringEventStats(row)) return 1;
  return 0;
}

module.exports = {
  captainDidNotPlay,
  resolveScoringCaptainId,
  performanceHasScoringEventStats,
  defaultMinutesForPerformance,
};
