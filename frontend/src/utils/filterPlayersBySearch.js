/**
 * Case-insensitive partial name search for live-season player lists.
 */
export function filterPlayersBySearch(players, query) {
  const list = Array.isArray(players) ? players : [];
  const term = String(query || '').trim().toLowerCase();
  if (!term) return list;
  return list.filter((player) => String(player?.name || '').toLowerCase().includes(term));
}
