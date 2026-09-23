/** Representative minutes for appearance buckets (scoring uses thresholds, not exact values). */
export const FANTASY_APPEARANCE_UNDER45_MINUTES = 1;
export const FANTASY_APPEARANCE_45PLUS_MINUTES = 45;

export const APPEARANCE_UNDER45 = 'under45';
export const APPEARANCE_45PLUS = '45plus';

export function appearanceToMinutes(appearance) {
  if (appearance === APPEARANCE_UNDER45) return FANTASY_APPEARANCE_UNDER45_MINUTES;
  if (appearance === APPEARANCE_45PLUS) return FANTASY_APPEARANCE_45PLUS_MINUTES;
  return 0;
}

export function minutesToAppearance(minutes) {
  const n = Number(minutes) || 0;
  if (n >= 45) return APPEARANCE_45PLUS;
  if (n >= 1) return APPEARANCE_UNDER45;
  return null;
}

export function appearanceLabel(appearance) {
  if (appearance === APPEARANCE_UNDER45) return '<45';
  if (appearance === APPEARANCE_45PLUS) return '45+';
  return 'Did Not Play';
}

export function appearancesFromPerformances(performances) {
  const map = {};
  (performances || []).forEach((row) => {
    const id = row.player?._id || row.player;
    if (!id) return;
    const appearance = minutesToAppearance(row.minutesPlayed);
    if (appearance) map[String(id)] = appearance;
  });
  return map;
}

export function appearancesFromLegacyMinutes(minutesMap) {
  const map = {};
  Object.entries(minutesMap || {}).forEach(([playerId, minutes]) => {
    const appearance = minutesToAppearance(minutes === '' ? 0 : minutes);
    if (appearance) map[String(playerId)] = appearance;
  });
  return map;
}

export function buildSparseMinutesPayload(allPlayers, playerAppearances) {
  const payload = [];
  (allPlayers || []).forEach((player) => {
    const minutes = appearanceToMinutes(playerAppearances[String(player._id)]);
    if (minutes > 0) {
      payload.push({ playerId: player._id, minutes });
    }
  });
  return payload;
}

export function countPlayedAppearances(playerAppearances) {
  return Object.values(playerAppearances || {}).filter(
    (a) => a === APPEARANCE_UNDER45 || a === APPEARANCE_45PLUS
  ).length;
}

export function validateAppearancesBeforeSave(allPlayers, playerAppearances, performanceByPlayer) {
  const offenders = [];
  (allPlayers || []).forEach((player) => {
    const perf = performanceByPlayer?.[String(player._id)];
    if (!perf || !hasScoringEventStats(perf)) return;
    const appearance = playerAppearances[String(player._id)];
    if (!appearance) {
      offenders.push(player.name || 'Player');
    }
  });

  if (offenders.length) {
    return {
      ok: false,
      message: `Please mark players with match events as Played <45 or 45+: ${offenders.join(', ')}.`,
    };
  }

  return { ok: true };
}

export function hasScoringEventStats(perf) {
  if (!perf) return false;
  return (
    (perf.goals || 0) > 0 ||
    (perf.assists || 0) > 0 ||
    (perf.ownGoals || 0) > 0 ||
    (perf.yellowCards || 0) > 0 ||
    (perf.redCards || 0) > 0
  );
}

export function filterPlayersByAppearance(players, playerAppearances, filter) {
  const list = Array.isArray(players) ? players : [];
  if (!filter || filter === 'all') return list;
  return list.filter((player) => {
    const appearance = playerAppearances[String(player._id)];
    if (filter === 'played') {
      return appearance === APPEARANCE_UNDER45 || appearance === APPEARANCE_45PLUS;
    }
    if (filter === 'dnp') return !appearance;
    if (filter === 'under45') return appearance === APPEARANCE_UNDER45;
    if (filter === '45plus') return appearance === APPEARANCE_45PLUS;
    return true;
  });
}
