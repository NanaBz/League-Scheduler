/**
 * PlayerStats are stored per (player, team, season, competition).
 * For team profile pages, totals must sum across every competition row for each player.
 */

function playerKey(row) {
  if (!row) return null;
  const p = row.player;
  if (p && p._id != null) return String(p._id);
  if (row.orphanedPlayerId) return String(row.orphanedPlayerId);
  return null;
}

/**
 * @param {Array<object>} statsRows - decorated rows from GET /stats?team=
 * @returns {Array<{ player: object|null, playerId: string, goals: number, assists: number, cleanSheets: number, yellowCards: number, redCards: number }>}
 */
export function aggregatePlayerStatsAcrossCompetitions(statsRows) {
  const map = new Map();
  for (const row of statsRows || []) {
    const key = playerKey(row);
    if (!key) continue;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        playerId: key,
        player: row.player || null,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        yellowCards: 0,
        redCards: 0,
      };
      map.set(key, entry);
    }
    entry.goals += Number(row.goals) || 0;
    entry.assists += Number(row.assists) || 0;
    entry.cleanSheets += Number(row.cleanSheets) || 0;
    entry.yellowCards += Number(row.yellowCards) || 0;
    entry.redCards += Number(row.redCards) || 0;
    if (!entry.player && row.player) entry.player = row.player;
    else if (entry.player && row.player && row.player.name && !entry.player.name) {
      entry.player = { ...entry.player, ...row.player };
    }
  }
  return [...map.values()];
}

/** Row with highest value for metric (ties: first wins). */
export function topByMetric(aggregated, metric) {
  if (!aggregated || aggregated.length === 0) return null;
  return aggregated.reduce((best, cur) => {
    const c = Number(cur[metric]) || 0;
    const b = Number(best[metric]) || 0;
    if (c > b) return cur;
    return best;
  }, aggregated[0]);
}
