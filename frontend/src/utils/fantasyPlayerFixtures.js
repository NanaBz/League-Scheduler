import { toMatchDateTime } from './fantasyGameweek';

export function teamIdFromEntity(team) {
  if (!team) return null;
  if (typeof team === 'string') return team;
  return team._id || team.id || null;
}

/** Upcoming league fixtures for a real team, from the active gameweek onward. */
export function nextFixturesForTeam(
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

export function refreshPlayerFixtures(player, matches, currentGameweek) {
  if (!player) return null;
  const teamId = teamIdFromEntity(player.team);
  const nextThree = nextFixturesForTeam(matches, teamId, {
    fromMatchweek: currentGameweek,
    limit: 3,
  });
  return { ...player, nextThree };
}

export function refreshSquadFixtures(squad, matches, currentGameweek) {
  if (!squad || !matches?.length) return squad;
  const out = {};
  for (const [pos, arr] of Object.entries(squad)) {
    out[pos] = (arr || []).map((p) =>
      p ? refreshPlayerFixtures(p, matches, currentGameweek) : null
    );
  }
  return out;
}

/** FPL-style second line: opponent code + active gameweek fixture. */
export function formatPitchFixture(player, matches, currentGameweek) {
  const teamId = teamIdFromEntity(player?.team);
  const live = nextFixturesForTeam(matches, teamId, {
    fromMatchweek: currentGameweek,
    limit: 1,
  })[0];
  const n = live || player?.nextThree?.[0];
  if (!n?.opponent) return 'Fixture TBC';
  const raw = String(n.opponent).trim();
  const compact = raw.replace(/\s+/g, '');
  const code = compact.length <= 4 ? compact.toUpperCase() : compact.slice(0, 3).toUpperCase();
  const gw = live?.matchweek ?? currentGameweek;
  if (gw != null && gw !== '') return `${code} · GW${gw}`;
  return code;
}
