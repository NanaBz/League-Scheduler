/**
 * League / ACWPL table positions for team profile hero subtitles.
 * Mirrors UserView ordering: boys league = points, GD, GF; ACWPL = from played matches only.
 */

export function ordinal(n) {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

function compareByName(a, b) {
  return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
}

function compareByStandings(a, b) {
  return (
    (b.points || 0) - (a.points || 0) ||
    (b.goalDifference || 0) - (a.goalDifference || 0) ||
    (b.goalsFor || 0) - (a.goalsFor || 0) ||
    compareByName(a, b)
  );
}

/** League table order: alphabetical before any fixture is played, then points/GD/GF. */
export function sortLeagueTeams(teams) {
  const leagueTeams = (teams || []).filter((t) => t && t.competition === 'league');
  const seasonStarted = leagueTeams.some((t) => (t.played || 0) > 0);
  return [...leagueTeams].sort(seasonStarted ? compareByStandings : compareByName);
}

/** True once any league side has played a league fixture (recorded on Team). */
export function leagueTableHasResults(teams) {
  return (teams || []).some((t) => t && t.competition === 'league' && (t.played || 0) > 0);
}

/**
 * @returns {number|null} 1-based position, or null if table not started or team not in league.
 */
export function boysLeaguePosition(teamId, allTeams) {
  if (!teamId) return null;
  const leagueTeams = sortLeagueTeams(allTeams);
  if (!leagueTableHasResults(allTeams)) return null;
  const idx = leagueTeams.findIndex((t) => String(t._id) === String(teamId));
  if (idx < 0) return null;
  return idx + 1;
}

const ACWPL_NAMES = ['Orion', 'Firestorm'];

/** Build ACWPL mini-table from matches (same rules as UserView getAcwplTable). */
export function buildAcwplTableFromMatches(matches, acwplTeamDocs = []) {
  const strict = (acwplTeamDocs || []).filter((t) => t && ACWPL_NAMES.includes(t.name));
  const seed = strict.length ? strict : ACWPL_NAMES.map((name) => ({ name }));
  const base = seed.map((team) => ({
    ...team,
    name: team.name,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: [],
  }));

  const acwplMatches = (matches || []).filter(
    (m) =>
      m &&
      m.competition === 'acwpl' &&
      m.homeTeam &&
      m.awayTeam &&
      ACWPL_NAMES.includes(m.homeTeam.name) &&
      ACWPL_NAMES.includes(m.awayTeam.name)
  );

  for (const match of acwplMatches) {
    if (!match.isPlayed || match.isVoided) continue;
    const home = base.find((t) => t.name === match.homeTeam.name);
    const away = base.find((t) => t.name === match.awayTeam.name);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;
    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;
    if (match.homeScore > match.awayScore) {
      home.won++;
      home.points += 3;
      home.form.unshift('W');
      away.lost++;
      away.form.unshift('L');
    } else if (match.homeScore < match.awayScore) {
      away.won++;
      away.points += 3;
      away.form.unshift('W');
      home.lost++;
      home.form.unshift('L');
    } else {
      home.drawn++;
      away.drawn++;
      home.points += 1;
      away.points += 1;
      home.form.unshift('D');
      away.form.unshift('D');
    }
  }

  const seasonStarted = base.some((t) => (t.played || 0) > 0);
  return base.sort(seasonStarted ? compareByStandings : compareByName);
}

export function acwplTableHasResults(matches) {
  const table = buildAcwplTableFromMatches(matches);
  return table.some((t) => (t.played || 0) > 0);
}

/**
 * @returns {number|null} 1-based position in ACWPL table from matches.
 */
export function acwplPosition(teamName, matches, acwplTeamDocs = []) {
  if (!teamName || !ACWPL_NAMES.includes(teamName)) return null;
  if (!acwplTableHasResults(matches)) return null;
  const table = buildAcwplTableFromMatches(matches, acwplTeamDocs);
  const idx = table.findIndex((t) => t.name === teamName);
  if (idx < 0) return null;
  return idx + 1;
}
