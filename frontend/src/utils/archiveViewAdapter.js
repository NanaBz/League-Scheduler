/**
 * Adapt archived season snapshot data into shapes compatible with existing UI patterns.
 * Never reads live API data — callers pass a Season document from GET /seasons/:n.
 */

const SLUG_TO_MATCH_COMPETITION = {
  league: 'league',
  cup: 'cup',
  'super-cup': 'super-cup',
  acwpl: 'acwpl',
  'girls-super-cup': 'girls-super-cup',
};

function teamRef(team) {
  if (!team) return null;
  if (typeof team === 'object') {
    return {
      _id: team._id || team.teamId,
      name: team.name || team.teamName || 'Unknown',
      logo: team.logo || team.teamLogo || '',
    };
  }
  return { _id: team, name: 'Unknown', logo: '' };
}

export function adaptStandingRow(row, index) {
  if (!row) return null;
  return {
    _id: row.teamId || row.team?._id || row.team || `standing-${index}`,
    name: row.teamName || row.team?.name || 'Unknown',
    logo: row.teamLogo || row.team?.logo || '',
    position: row.position ?? index + 1,
    played: row.played ?? 0,
    won: row.won ?? 0,
    drawn: row.drawn ?? 0,
    lost: row.lost ?? 0,
    goalsFor: row.goalsFor ?? 0,
    goalsAgainst: row.goalsAgainst ?? 0,
    goalDifference: row.goalDifference ?? 0,
    points: row.points ?? 0,
    form: row.form || [],
  };
}

export function adaptFixture(fx, competitionId, index = 0) {
  if (!fx) return null;
  return {
    _id: fx.matchId || fx._id || `archive-fixture-${competitionId}-${index}`,
    homeTeam: teamRef({
      _id: fx.homeTeamId,
      name: fx.homeTeamName,
      logo: fx.homeTeamLogo,
      team: fx.homeTeam,
    }),
    awayTeam: teamRef({
      _id: fx.awayTeamId,
      name: fx.awayTeamName,
      logo: fx.awayTeamLogo,
      team: fx.awayTeam,
    }),
    homeScore: fx.homeScore,
    awayScore: fx.awayScore,
    homePenalties: fx.homePenalties ?? null,
    awayPenalties: fx.awayPenalties ?? null,
    date: fx.date,
    time: fx.time || '',
    matchweek: fx.matchweek,
    stage: fx.stage || fx.round || '',
    competition: competitionId,
    isPlayed: fx.isPlayed !== false,
    isVoided: false,
    matchState: fx.matchState || 'ft',
    originalDoubleWinnerId: fx.originalDoubleWinnerId,
  };
}

function collectBlockFixtures(block, competitionId) {
  if (!block) return [];
  if (competitionId === 'cup') {
    return [...(block.semiFinals || []), ...(block.final ? [block.final] : [])];
  }
  if (competitionId === 'super-cup') {
    return block.final ? [block.final] : [];
  }
  return block.fixtures || [];
}

function adaptStatisticsRows(statistics) {
  const stats = statistics || {};
  const mapRows = (rows, metricKey) =>
    (rows || []).map((row) => ({
      player: { _id: row.playerId, name: row.playerName },
      orphanedPlayerId: row.playerId,
      team: { _id: row.teamId, name: row.teamName, logo: '' },
      [metricKey]: row[metricKey] ?? 0,
    }));

  return {
    goals: mapRows(stats.goals, 'goals'),
    assists: mapRows(stats.assists, 'assists'),
    cleanSheets: mapRows(stats.cleanSheets, 'cleanSheets'),
    yellowCards: mapRows(stats.yellowCards, 'yellowCards'),
    redCards: mapRows(stats.redCards, 'redCards'),
  };
}

function legacyMatchesForCompetition(season, competitionId) {
  const matchComp = SLUG_TO_MATCH_COMPETITION[competitionId];
  return (season.matches || []).filter((m) => m && m.competition === matchComp && !m.isVoided);
}

function legacyAdaptMatch(m, competitionId, index) {
  const home = teamRef(m.homeTeam);
  const away = teamRef(m.awayTeam);
  return {
    _id: m._id || `legacy-${index}`,
    homeTeam: home,
    awayTeam: away,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    homePenalties: m.homePenalties ?? null,
    awayPenalties: m.awayPenalties ?? null,
    date: m.date,
    time: m.time || '',
    matchweek: m.matchweek,
    stage: m.stage || '',
    competition: competitionId,
    isPlayed: m.isPlayed !== false,
    isVoided: false,
    matchState: m.matchState || (m.isPlayed ? 'ft' : 'scheduled'),
    originalDoubleWinnerId: m.originalDoubleWinnerId,
  };
}

function legacyStandings(season, competitionId) {
  if (competitionId !== 'league') return [];
  return (season.finalStandings || [])
    .slice()
    .sort((a, b) => (a.position || 99) - (b.position || 99))
    .map((row, index) =>
      adaptStandingRow(
        {
          teamId: row.team?._id || row.team,
          teamName: row.team?.name,
          teamLogo: row.team?.logo,
          position: row.position,
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDifference: row.goalDifference,
          points: row.points,
          form: row.form,
        },
        index
      )
    )
    .filter(Boolean);
}

/**
 * Build a view model for one archived competition from snapshot (+ legacy fallback).
 */
export function buildArchiveViewModel(season, competition) {
  const competitionId = competition.id;
  const block = season.competitions?.[competition.archiveKey] || null;

  let standings = (block?.standings || []).map(adaptStandingRow).filter(Boolean);
  let rawFixtures = collectBlockFixtures(block, competitionId);
  let fixtures = rawFixtures.map((fx, i) => adaptFixture(fx, competitionId, i)).filter(Boolean);
  let statistics = adaptStatisticsRows(block?.statistics);
  let winner = block?.winner ? teamRef(block.winner) : null;
  let winsByTeam = block?.winsByTeam || [];
  let format = block?.format || null;
  let originalDoubleWinnerId = block?.originalDoubleWinnerId || null;

  if (!block) {
    fixtures = legacyMatchesForCompetition(season, competitionId)
      .filter((m) => m.isPlayed)
      .map((m, i) => legacyAdaptMatch(m, competitionId, i));
    standings = legacyStandings(season, competitionId);
    const legacyWinner = season.winners?.[competition.legacyWinnerKey];
    winner = teamRef(legacyWinner);
  }

  if (competitionId === 'super-cup' && block) {
    originalDoubleWinnerId = block.originalDoubleWinnerId || originalDoubleWinnerId;
    if (block.final) {
      fixtures = [adaptFixture(block.final, competitionId, 0)].filter(Boolean);
    }
  }

  // Girls Super Cup / series: only played games are archived; sort by round
  if (competitionId === 'girls-super-cup' || competitionId === 'acwpl') {
    fixtures = fixtures
      .filter((m) => m.isPlayed)
      .sort((a, b) => (a.matchweek || 0) - (b.matchweek || 0));
  }

  const semiFinals =
    competitionId === 'cup' && block
      ? (block.semiFinals || []).map((fx, i) => adaptFixture(fx, competitionId, i)).filter(Boolean)
      : fixtures.filter((m) => m.stage === 'semi-final');
  const finalMatch =
    competitionId === 'cup' && block?.final
      ? adaptFixture(block.final, competitionId, 999)
      : fixtures.find((m) => m.stage === 'final') || (competitionId === 'super-cup' ? fixtures[0] : null) || null;

  return {
    competitionId,
    standings,
    fixtures,
    semiFinals,
    finalMatch,
    statistics,
    winner,
    winsByTeam,
    format,
    originalDoubleWinnerId,
    hasSnapshot: Boolean(block) || fixtures.length > 0 || standings.length > 0,
  };
}

export function groupScorersByPlayer(goalRows) {
  const grouped = {};
  (goalRows || []).forEach((row) => {
    const pid = row.player?._id || row.orphanedPlayerId;
    if (!pid) return;
    const key = String(pid);
    if (!grouped[key]) {
      grouped[key] = { player: row.player, teams: [], goals: 0 };
    }
    grouped[key].teams.push(row.team);
    grouped[key].goals += row.goals || 0;
  });
  return Object.values(grouped)
    .filter((r) => r.goals > 0)
    .sort((a, b) => b.goals - a.goals || a.player.name.localeCompare(b.player.name));
}
