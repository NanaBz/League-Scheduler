import { semesterLabel } from './academicYear';

/** User-facing competition slugs → v2 archive keys on Season.competitions */
export const ARCHIVED_COMPETITIONS = [
  {
    id: 'league',
    archiveKey: 'league',
    legacyWinnerKey: 'league',
    label: 'League',
    tagline: 'Circle Method table',
  },
  {
    id: 'cup',
    archiveKey: 'cup',
    legacyWinnerKey: 'cup',
    label: 'Agha Cup',
    tagline: 'Knockout tournament',
  },
  {
    id: 'super-cup',
    archiveKey: 'superCup',
    legacyWinnerKey: 'superCup',
    label: 'Super Cup',
    tagline: 'Champions showcase',
  },
  {
    id: 'acwpl',
    archiveKey: 'acwpl',
    legacyWinnerKey: 'acwpl',
    label: 'ACWPL',
    tagline: 'Girls best-of-5 league',
  },
  {
    id: 'girls-super-cup',
    archiveKey: 'girlsSuperCup',
    legacyWinnerKey: 'girlsSuperCup',
    label: 'Girls Super Cup',
    tagline: 'Best-of-3 series',
  },
];

export function getCompetitionBySlug(slug) {
  return ARCHIVED_COMPETITIONS.find((c) => c.id === slug) || null;
}

export function archivedCompetitionPath(seasonNumber, competitionId) {
  return `/archived/${seasonNumber}/${competitionId}`;
}

function normalizeTeam(team) {
  if (!team) return null;
  if (typeof team === 'string') return null;
  const name = team.name || team.teamName;
  if (!name) return null;
  return {
    name,
    logo: team.logo || team.teamLogo || '',
    teamId: team.teamId || team._id,
  };
}

function winnerFromArchiveBlock(block) {
  if (!block) return null;
  return normalizeTeam(block.winner);
}

function winnerFromLegacy(season, legacyKey) {
  const raw = season.winners?.[legacyKey];
  return normalizeTeam(raw);
}

function runnerUpFromStandings(standings, winner) {
  if (!Array.isArray(standings) || standings.length < 2) return null;
  const sorted = [...standings].sort((a, b) => (a.position || 99) - (b.position || 99));
  const second = sorted.find((row) => row.position === 2) || sorted[1];
  if (!second) return null;
  const candidate = normalizeTeam({
    name: second.teamName,
    logo: second.teamLogo,
    teamId: second.teamId || second.team,
  });
  if (winner && candidate?.name === winner.name) return null;
  return candidate;
}

function runnerUpFromFinal(final, winner) {
  if (!final || !winner) return null;
  const winnerId = String(winner.teamId || '');
  const home = {
    name: final.homeTeamName,
    logo: final.homeTeamLogo,
    teamId: final.homeTeamId,
  };
  const away = {
    name: final.awayTeamName,
    logo: final.awayTeamLogo,
    teamId: final.awayTeamId,
  };
  if (String(home.teamId) === winnerId) return normalizeTeam(away);
  if (String(away.teamId) === winnerId) return normalizeTeam(home);
  return null;
}

function runnerUpFromWinsByTeam(winsByTeam, winner) {
  if (!Array.isArray(winsByTeam) || winsByTeam.length < 2) return null;
  const sorted = [...winsByTeam].sort((a, b) => b.wins - a.wins);
  const second = sorted[1];
  if (!second) return null;
  const candidate = normalizeTeam({ name: second.teamName, teamId: second.teamId });
  if (winner && candidate?.name === winner.name) return null;
  return candidate;
}

function legacyLeagueRunnerUp(season, winner) {
  const standings = season.finalStandings || [];
  if (standings.length < 2) return null;
  const sorted = [...standings].sort((a, b) => (a.position || 99) - (b.position || 99));
  const second = sorted.find((row) => row.position === 2) || sorted[1];
  const team = second?.team;
  const candidate = normalizeTeam(typeof team === 'object' ? team : { name: second?.teamName });
  if (winner && candidate?.name === winner.name) return null;
  return candidate;
}

/**
 * Summarize winner / runner-up for a competition card from archived snapshot only.
 */
export function getArchivedCompetitionSummary(season, competition) {
  const block = season.competitions?.[competition.archiveKey];
  let winner = winnerFromArchiveBlock(block) || winnerFromLegacy(season, competition.legacyWinnerKey);
  let runnerUp = null;

  if (block) {
    if (competition.id === 'league') {
      runnerUp = runnerUpFromStandings(block.standings, winner);
    } else if (competition.id === 'cup') {
      runnerUp = runnerUpFromFinal(block.final, winner);
    } else if (competition.id === 'super-cup') {
      runnerUp = runnerUpFromFinal(block.final, winner);
    } else if (competition.id === 'acwpl' || competition.id === 'girls-super-cup') {
      runnerUp =
        runnerUpFromStandings(block.standings, winner) ||
        runnerUpFromWinsByTeam(block.winsByTeam, winner);
    }
  }

  if (!runnerUp && competition.id === 'league') {
    runnerUp = legacyLeagueRunnerUp(season, winner);
  }

  const hasSnapshot = Boolean(block) || Boolean(winner);
  return { winner, runnerUp, hasSnapshot };
}

export function seasonSelectorLabel(season) {
  const parts = [];
  if (season.academicYear) parts.push(season.academicYear);
  if (season.semester && season.semester !== 'full') {
    parts.push(semesterLabel(season.semester));
  }
  if (parts.length > 0) return parts.join(' • ');
  if (season.displayName) return season.displayName;
  if (season.name) return season.name;
  return `Season ${season.seasonNumber}`;
}

export function seasonArchiveBadge(season) {
  if (season.academicYear && season.semester && season.semester !== 'full') {
    return `${season.academicYear} · ${semesterLabel(season.semester)}`;
  }
  if (season.archivedAt) {
    const d = new Date(season.archivedAt);
    if (!Number.isNaN(d.getTime())) {
      return `Archived ${d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
    }
  }
  return `Archive #${season.seasonNumber}`;
}

/** Most recent archived season first — never mixes with live data. */
export function sortArchivedSeasons(seasons) {
  return [...(seasons || [])].sort((a, b) => {
    const aTime = a.archivedAt ? new Date(a.archivedAt).getTime() : 0;
    const bTime = b.archivedAt ? new Date(b.archivedAt).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    return (b.seasonNumber || 0) - (a.seasonNumber || 0);
  });
}
