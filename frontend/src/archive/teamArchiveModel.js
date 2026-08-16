export const DEFAULT_TEAM_LOGOS = {
  Warriors: '/logos/warriors.svg',
  Falcons: '/logos/falcons.svg',
  Lions: '/logos/lions.svg',
  Vikings: '/logos/vikings.svg',
  Elites: '/logos/elites.svg',
  Dragons: '/logos/dragons.svg',
};

export const COMP_ROWS = [
  { id: 'league', label: 'League' },
  { id: 'cup', label: 'Agha Cup' },
  { id: 'super-cup', label: 'Super Cup' },
  { id: 'acwpl', label: 'ACWPL' },
  { id: 'girls-super-cup', label: 'Girls Super Cup' },
];

/** Normalize any team ref (ObjectId, string, populated doc, { $oid }) to string id or null */
export function teamRefId(ref) {
  if (ref == null) return null;
  if (typeof ref === 'string' || typeof ref === 'number') return String(ref);
  if (typeof ref === 'object') {
    if (ref.$oid) return String(ref.$oid);
    if (ref._id != null) return String(ref._id);
  }
  return null;
}

export function normalizeLogoUrl(logo) {
  if (logo == null || typeof logo !== 'string') return null;
  const t = logo.trim();
  if (!t) return null;
  if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('/')) return t;
  return `/${t}`;
}

export function defaultLogoForName(name) {
  if (!name || typeof name !== 'string') return null;
  return DEFAULT_TEAM_LOGOS[name] || null;
}

function sideNameLogo(side) {
  if (!side || typeof side !== 'object') return { name: null, logo: null };
  const name = side.name && String(side.name).trim() ? String(side.name).trim() : null;
  const logo = side.logo != null && side.logo !== '' ? side.logo : null;
  return { name, logo };
}

export function buildTeamByIdMap(season, liveTeams = []) {
  const m = new Map();
  const merge = (idStr, name, logo) => {
    if (!idStr) return;
    const prev = m.get(idStr) || { name: null, logo: null };
    const n = name && String(name).trim() ? String(name).trim() : prev.name;
    const lg = normalizeLogoUrl(logo) || prev.logo;
    m.set(idStr, { name: n, logo: lg });
  };

  (season.teams || []).forEach((t) => {
    if (!t) return;
    const id = teamRefId(t._id != null ? t._id : t);
    if (id) merge(id, t.name, t.logo);
  });

  (liveTeams || []).forEach((t) => {
    if (!t || t._id == null) return;
    merge(String(t._id), t.name, t.logo);
  });

  const W = season.winners || {};
  [W.league, W.cup, W.superCup].forEach((w) => {
    if (w && typeof w === 'object') merge(teamRefId(w._id || w), w.name, w.logo);
  });

  (season.finalStandings || []).forEach((s) => {
    const id = teamRefId(s.team);
    if (!id) return;
    const t = s.team && typeof s.team === 'object' ? s.team : null;
    const { name, logo } = sideNameLogo(t);
    merge(id, name, logo);
  });

  (season.matches || []).forEach((match) => {
    const hid = teamRefId(match.homeTeam);
    if (hid && (match.homeTeamName || match.homeTeamLogo)) {
      merge(hid, match.homeTeamName, match.homeTeamLogo);
    }
    const aid = teamRefId(match.awayTeam);
    if (aid && (match.awayTeamName || match.awayTeamLogo)) {
      merge(aid, match.awayTeamName, match.awayTeamLogo);
    }
    [match.homeTeam, match.awayTeam].forEach((side) => {
      const id = teamRefId(side);
      if (!id) return;
      const { name, logo } = sideNameLogo(typeof side === 'object' ? side : null);
      merge(id, name, logo);
    });
  });

  return m;
}

export function resolveTeamFromMap(map, ref) {
  if (ref && typeof ref === 'object' && ref.name) {
    const name = String(ref.name).trim();
    const logo = normalizeLogoUrl(ref.logo) || defaultLogoForName(name);
    return { name, logo };
  }
  const id = teamRefId(ref);
  if (id && map.has(id)) {
    const row = map.get(id);
    const name = row.name && String(row.name).trim() ? row.name : 'Unknown';
    const logo = row.logo || defaultLogoForName(name);
    return { name, logo };
  }
  return { name: 'Unknown', logo: null };
}

/**
 * Prefer populated team, then denormalized archive fields, then ID map.
 */
export function resolveMatchSide(match, side, map) {
  if (side === 'home') {
    const ref = match.homeTeam;
    if (ref && typeof ref === 'object' && ref.name) {
      const name = String(ref.name).trim();
      const logo = normalizeLogoUrl(ref.logo) || defaultLogoForName(name);
      return { name, logo };
    }
    if (match.homeTeamName && String(match.homeTeamName).trim()) {
      const name = String(match.homeTeamName).trim();
      const logo = normalizeLogoUrl(match.homeTeamLogo) || defaultLogoForName(name);
      return { name, logo };
    }
    const r = resolveTeamFromMap(map, ref);
    if (r.name !== 'Unknown') return r;
    return { name: 'Unknown Team', logo: r.logo };
  }
  const ref = match.awayTeam;
  if (ref && typeof ref === 'object' && ref.name) {
    const name = String(ref.name).trim();
    const logo = normalizeLogoUrl(ref.logo) || defaultLogoForName(name);
    return { name, logo };
  }
  if (match.awayTeamName && String(match.awayTeamName).trim()) {
    const name = String(match.awayTeamName).trim();
    const logo = normalizeLogoUrl(match.awayTeamLogo) || defaultLogoForName(name);
    return { name, logo };
  }
  const r = resolveTeamFromMap(map, ref);
  if (r.name !== 'Unknown') return r;
  return { name: 'Unknown Team', logo: r.logo };
}

/** If finalStandings is short vs league fixtures, append missing teams (zeros) so all league sides appear */
export function mergeLeagueStandings(season, map) {
  const base = [...(season.finalStandings || [])].sort((a, b) => (a.position || 0) - (b.position || 0));
  const seen = new Set();
  base.forEach((s) => {
    const id = teamRefId(s.team);
    if (id) seen.add(id);
  });

  let nextPos = base.reduce((max, s) => Math.max(max, s.position || 0), 0);
  const leagueMatches = (season.matches || []).filter((m) => m.competition === 'league');
  leagueMatches.forEach((m) => {
    [m.homeTeam, m.awayTeam].forEach((ref) => {
      const id = teamRefId(ref);
      if (!id || seen.has(id)) return;
      const fromList = (season.teams || []).find((t) => String(t._id) === id);
      const resolved = resolveTeamFromMap(map, ref);
      const name = fromList?.name || resolved.name;
      if (!name || name === 'Unknown') return;
      seen.add(id);
      nextPos += 1;
      base.push({
        team: fromList || { _id: id, name },
        position: nextPos,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        form: [],
        _synthetic: true,
      });
    });
  });

  return base;
}

export function competitionHasArchiveData(season, id) {
  const matches = season.matches || [];
  if (id === 'league') {
    return (season.finalStandings && season.finalStandings.length > 0) || matches.some((m) => m.competition === 'league');
  }
  return matches.some((m) => m.competition === id);
}

export function groupStatsItems(items, metricKey, limit = 5) {
  const grouped = {};
  (items || []).forEach((row) => {
    const pid = row.player?._id || row.orphanedPlayerId;
    if (!pid) return;
    const key = String(pid);
    if (!grouped[key]) {
      grouped[key] = { player: row.player, orphanedPlayerId: row.orphanedPlayerId, teams: [], stat: 0 };
    }
    grouped[key].teams.push(row.team);
    grouped[key].stat += row[metricKey] || 0;
  });
  return Object.values(grouped)
    .filter((row) => row.stat > 0)
    .sort((a, b) => b.stat - a.stat)
    .slice(0, limit);
}

export function getTeamLogoClass(teamName) {
  if (!teamName) return 'team-logo';
  const baseClass = 'team-logo';
  const teamClass = `${String(teamName).toLowerCase().replace(/\s+/g, '-')}-logo`;
  return `${baseClass} ${teamClass}`;
}
