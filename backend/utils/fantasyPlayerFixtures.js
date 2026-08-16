const { deriveCurrentGameweekFromMatches } = require('./fantasyGameweek');

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

function teamIdFromEntity(team) {
  if (!team) return null;
  if (typeof team === 'string') return team;
  return team._id || team.id || null;
}

function nextFixturesForTeam(
  matches,
  teamId,
  { competition = 'league', limit = 3, fromMatchweek = 1 } = {}
) {
  if (!teamId) return [];
  const tid = String(teamId);

  return (matches || [])
    .filter(
      (m) =>
        m &&
        m.competition === competition &&
        m.isVoided !== true &&
        !m.isPlayed &&
        m.matchState !== 'ft' &&
        Number(m.matchweek) >= Number(fromMatchweek) &&
        (String(m.homeTeam?._id || m.homeTeam) === tid ||
          String(m.awayTeam?._id || m.awayTeam) === tid)
    )
    .sort((a, b) => {
      const mw = Number(a.matchweek) - Number(b.matchweek);
      if (mw !== 0) return mw;
      const ta = toMatchDateTime(a.date, a.time)?.getTime() ?? 0;
      const tb = toMatchDateTime(b.date, b.time)?.getTime() ?? 0;
      return ta - tb;
    })
    .slice(0, limit)
    .map((m) => {
      const isHome = String(m.homeTeam?._id || m.homeTeam) === tid;
      const opponentTeam = isHome ? m.awayTeam : m.homeTeam;
      const opponentName =
        opponentTeam?.name || (typeof opponentTeam === 'string' ? opponentTeam : 'TBC');
      return {
        date: m.date,
        opponent: opponentName,
        matchweek: m.matchweek,
      };
    });
}

function attachNextThreeToPlayers(players, matches, currentGameweek) {
  return players.map((p) => {
    if (!p) return null;
    const teamId = teamIdFromEntity(p.team);
    return {
      ...p,
      nextThree: nextFixturesForTeam(matches, teamId, {
        fromMatchweek: currentGameweek,
        limit: 3,
      }),
    };
  });
}

function hydrateSquadWithFixtures(hydrated, matches) {
  const currentGameweek = deriveCurrentGameweekFromMatches(matches);
  const out = {};
  for (const [pos, arr] of Object.entries(hydrated)) {
    out[pos] = attachNextThreeToPlayers(arr, matches, currentGameweek);
  }
  return out;
}

module.exports = {
  nextFixturesForTeam,
  attachNextThreeToPlayers,
  hydrateSquadWithFixtures,
};
