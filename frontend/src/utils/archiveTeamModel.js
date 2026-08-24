import { ordinal } from './teamTablePosition';
import { seasonSelectorLabel } from './archiveSeasonModel';
import { aggregatePlayerStatsAcrossCompetitions, topByMetric } from './aggregateTeamPlayerStats';

export function archivedTeamPath(seasonNumber, teamId) {
  return `/archived/${seasonNumber}/teams/${teamId}`;
}

export function archivedTeamsListPath(seasonNumber) {
  return `/archived/${seasonNumber}/teams`;
}

function adaptTeam(team, index = 0) {
  if (!team) return null;
  const id = team.teamId || team._id;
  if (!id && !team.name) return null;
  return {
    _id: id || `archive-team-${index}`,
    name: team.name || 'Unknown',
    logo: team.logo || '',
    category: team.category,
    competition: team.competition,
    staff: team.staff || [],
  };
}

function adaptPlayer(player) {
  if (!player) return null;
  return {
    _id: player.playerId || player._id,
    name: player.name || player.playerName || 'Unknown',
    number: player.number ?? player.playerNumber ?? null,
    position: player.position || player.playerPosition,
    teamId: player.teamId,
    teamName: player.teamName,
    isCaptain: Boolean(player.isCaptain),
    isViceCaptain: Boolean(player.isViceCaptain),
  };
}

/** All teams frozen in the archive — never reads live Team collection. */
export function getArchivedTeams(season) {
  const raw = season.participatingTeams?.length
    ? season.participatingTeams
    : (season.teams || []);
  const teams = raw.map(adaptTeam).filter(Boolean);
  const leagueStandings = season.competitions?.league?.standings || [];
  const posMap = new Map(leagueStandings.map((r) => [String(r.teamId), r.position]));

  return teams.slice().sort((a, b) => {
    const pa = posMap.get(String(a._id)) ?? 999;
    const pb = posMap.get(String(b._id)) ?? 999;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

export function getArchivedTeam(season, teamId) {
  return getArchivedTeams(season).find((t) => String(t._id) === String(teamId)) || null;
}

/** Squad exactly as archived — not current roster. */
export function getArchivedSquad(season, teamId) {
  const players = (season.participatingPlayers || [])
    .map(adaptPlayer)
    .filter((p) => p && String(p.teamId) === String(teamId));

  const order = { GK: 0, DF: 1, MF: 2, ATT: 3 };
  return players.sort((a, b) => {
    const po = (order[a.position] ?? 9) - (order[b.position] ?? 9);
    if (po !== 0) return po;
    const na = a.number ?? 999;
    const nb = b.number ?? 999;
    if (na !== nb) return na - nb;
    return a.name.localeCompare(b.name);
  });
}

function statsRowsForTeam(season, teamId) {
  const byPlayer = new Map();
  Object.values(season.competitions || {}).forEach((block) => {
    const stats = block?.statistics;
    if (!stats) return;
    ['goals', 'assists', 'cleanSheets', 'yellowCards', 'redCards'].forEach((metric) => {
      (stats[metric] || []).forEach((row) => {
        if (String(row.teamId) !== String(teamId)) return;
        const key = String(row.playerId);
        let entry = byPlayer.get(key);
        if (!entry) {
          entry = {
            player: { _id: row.playerId, name: row.playerName },
            orphanedPlayerId: row.playerId,
            team: { _id: row.teamId, name: row.teamName },
            goals: 0,
            assists: 0,
            cleanSheets: 0,
            yellowCards: 0,
            redCards: 0,
          };
          byPlayer.set(key, entry);
        }
        entry[metric] += row[metric] || 0;
      });
    });
  });
  return [...byPlayer.values()];
}

export function getArchivedTeamAggregatedStats(season, teamId) {
  return aggregatePlayerStatsAcrossCompetitions(statsRowsForTeam(season, teamId));
}

function standingPosition(standings, teamId) {
  const row = (standings || []).find((s) => String(s.teamId) === String(teamId));
  return row?.position ?? null;
}

function finalParticipantId(final, teamId) {
  if (!final) return false;
  return String(final.homeTeamId) === String(teamId) || String(final.awayTeamId) === String(teamId);
}

function cupRole(block, teamId) {
  if (!block) return null;
  if (block.winner?.teamId && String(block.winner.teamId) === String(teamId)) {
    return 'Champions';
  }
  if (finalParticipantId(block.final, teamId)) {
    const wId = block.winner?.teamId;
    if (wId && String(wId) !== String(teamId)) return 'Runners-up';
  }
  const inSemi = (block.semiFinals || []).some(
    (fx) => String(fx.homeTeamId) === String(teamId) || String(fx.awayTeamId) === String(teamId)
  );
  if (inSemi) return 'Semi-finalists';
  return null;
}

function seriesRole(block, teamId, label) {
  if (!block) return null;
  if (block.winner?.teamId && String(block.winner.teamId) === String(teamId)) {
    return `${label} Champions`;
  }
  const pos = standingPosition(block.standings, teamId);
  if (pos === 2) return `${label} Runners-up`;
  const wins = (block.winsByTeam || []).find((w) => String(w.teamId) === String(teamId));
  if (wins?.wins > 0) return `${label} · ${wins.wins} series win${wins.wins === 1 ? '' : 's'}`;
  if ((block.fixtures || []).some((fx) => finalParticipantId(fx, teamId))) {
    return `${label} participant`;
  }
  return null;
}

/** Competition results for this team from archived snapshots only. */
export function getArchivedTeamPerformance(season, teamId) {
  const comps = season.competitions || {};
  const items = [];

  const leaguePos = standingPosition(comps.league?.standings, teamId);
  if (leaguePos != null) {
    items.push({ competition: 'League', summary: `${ordinal(leaguePos)} place` });
  }

  const cup = cupRole(comps.cup, teamId);
  if (cup) items.push({ competition: 'Agha Cup', summary: cup });

  if (comps.superCup?.winner?.teamId) {
    const role =
      String(comps.superCup.winner.teamId) === String(teamId) ? 'Champions' : null;
    if (role) items.push({ competition: 'Super Cup', summary: role });
    else if (finalParticipantId(comps.superCup.final, teamId)) {
      items.push({ competition: 'Super Cup', summary: 'Finalists' });
    }
  }

  const acwplPos = standingPosition(comps.acwpl?.standings, teamId);
  if (acwplPos != null) {
    items.push({ competition: 'ACWPL', summary: `${ordinal(acwplPos)} place` });
  } else {
    const acwpl = seriesRole(comps.acwpl, teamId, 'ACWPL');
    if (acwpl) items.push({ competition: 'ACWPL', summary: acwpl });
  }

  const gsc = seriesRole(comps.girlsSuperCup, teamId, 'Girls Super Cup');
  if (gsc) items.push({ competition: 'Girls Super Cup', summary: gsc });

  return items;
}

export function getArchivedTeamHeroSubtitle(season, team) {
  const parts = [seasonSelectorLabel(season)];
  const leaguePos = standingPosition(season.competitions?.league?.standings, team._id);
  if (team.competition === 'league' && leaguePos != null) {
    parts.push(`League · ${ordinal(leaguePos)}`);
  } else if (team.competition === 'acwpl' || ['Orion', 'Firestorm'].includes(team.name)) {
    const acwplPos = standingPosition(season.competitions?.acwpl?.standings, team._id);
    if (acwplPos != null) parts.push(`ACWPL · ${ordinal(acwplPos)}`);
  }
  return parts.join(' · ');
}

export function groupArchivedSquadByPosition(players) {
  const g = { GK: [], DF: [], MF: [], ATT: [] };
  (players || []).forEach((p) => {
    if (g[p.position]) g[p.position].push(p);
  });
  return g;
}

export function getArchivedTeamLeaders(season, teamId, squad) {
  const aggregated = getArchivedTeamAggregatedStats(season, teamId);
  const captain = squad.find((p) => p.isCaptain);
  const viceCaptain = squad.find((p) => p.isViceCaptain);
  const topScorer = topByMetric(aggregated, 'goals');
  const topAssister = topByMetric(aggregated, 'assists');
  return {
    captain,
    viceCaptain,
    topScorer: topScorer && (topScorer.goals || 0) > 0 ? topScorer : null,
    topAssister: topAssister && (topAssister.assists || 0) > 0 ? topAssister : null,
  };
}
