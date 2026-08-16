export function toMatchDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (timeStr) {
      const [h, m] = String(timeStr).split(':').map(Number);
      d.setHours(h || 0, m || 0, 0, 0);
    }
    return d;
  } catch {
    return null;
  }
}

/** Earliest matchweek with at least one unplayed league fixture. */
export function deriveCurrentGameweek(matches, { competition = 'league' } = {}) {
  const list = (matches || []).filter(
    (m) => m && m.competition === competition && m.isVoided !== true
  );
  if (!list.length) return 1;

  const unplayedWeeks = list
    .filter((m) => !m.isPlayed && m.matchState !== 'ft')
    .map((m) => m.matchweek)
    .filter((w) => w != null && w > 0);

  if (unplayedWeeks.length) {
    return Math.min(...unplayedWeeks);
  }

  const playedWeeks = list.filter((m) => m.isPlayed).map((m) => m.matchweek).filter(Boolean);
  if (playedWeeks.length) return Math.max(...playedWeeks);
  return 1;
}

/** { week, deadline } — deadline is 1 hour before the first unplayed kickoff in the active gameweek. */
export function deriveGameweekInfo(matches, { competition = 'league' } = {}) {
  const week = deriveCurrentGameweek(matches, { competition });
  const inWeek = (matches || [])
    .filter(
      (m) =>
        m &&
        m.competition === competition &&
        m.isVoided !== true &&
        Number(m.matchweek) === week &&
        !m.isPlayed &&
        m.matchState !== 'ft'
    )
    .map((m) => ({ ...m, dt: toMatchDateTime(m.date, m.time) }))
    .filter((m) => m.dt && !Number.isNaN(m.dt.getTime()))
    .sort((a, b) => a.dt - b.dt);

  if (!inWeek.length) {
    return { week, deadline: null };
  }

  const earliest = inWeek[0];
  return { week, deadline: new Date(earliest.dt.getTime() - 60 * 60 * 1000) };
}

export function clearFantasyClientSeasonKeys() {
  try {
    localStorage.removeItem('fantasyCurrentGameweek');
    localStorage.removeItem('fantasyOverallRankingLive');
    Object.keys(localStorage)
      .filter((k) => k.startsWith('fantasySquad:'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
