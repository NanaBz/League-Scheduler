/** Derive active fantasy gameweek from league fixtures (earliest MW with unplayed matches). */
function deriveCurrentGameweekFromMatches(matches, { competition = 'league' } = {}) {
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

function toMatchDateTime(dateStr, timeStr) {
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

/** Gameweek number + deadline (1h before first kickoff in that week). */
function deriveGameweekInfoFromMatches(matches, { competition = 'league' } = {}) {
  const week = deriveCurrentGameweekFromMatches(matches, { competition });
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
  const deadline = new Date(earliest.dt.getTime() - 60 * 60 * 1000);
  return { week, deadline };
}

function leagueHasFinishedMatches(matches) {
  return (matches || []).some(
    (m) => m && m.competition === 'league' && m.isPlayed && m.isVoided !== true
  );
}

module.exports = {
  deriveCurrentGameweekFromMatches,
  deriveGameweekInfoFromMatches,
  leagueHasFinishedMatches,
};
