/**
 * Build self-contained season archive snapshots from live documents at reset time.
 * Pure snapshot logic — does not mutate live season data or scoring rules.
 */

const {
  archivedTeamSnapshotSchema,
  archivedPlayerSnapshotSchema,
  competitionsArchiveSchema,
} = require('../models/seasonArchiveSchemas');

const COMPETITION_IDS = ['league', 'cup', 'super-cup', 'acwpl', 'girls-super-cup'];
const STAT_METRICS = ['goals', 'assists', 'cleanSheets', 'yellowCards', 'redCards'];

const {
  deriveAcademicYear,
} = require('./academicYear');

function teamDocId(team) {
  if (!team) return null;
  return team._id || team.teamId || team;
}

function teamDisplay(team, teamById) {
  if (!team) return { teamId: null, name: 'Unknown', logo: '' };
  if (typeof team === 'object' && team.name) {
    return {
      teamId: teamDocId(team),
      name: team.name,
      logo: team.logo || '',
    };
  }
  const id = String(team);
  const row = teamById.get(id);
  return {
    teamId: team,
    name: row?.name || 'Unknown',
    logo: row?.logo || '',
  };
}

function resolvedWinnerSideFromScores(match) {
  if (!match || match.isVoided || !match.isPlayed) return null;
  const h = match.homeScore;
  const a = match.awayScore;
  if (typeof h !== 'number' || typeof a !== 'number') return null;
  if (h > a) return 'home';
  if (a > h) return 'away';
  const hp = match.homePenalties;
  const ap = match.awayPenalties;
  if (hp != null && ap != null && hp !== ap) return hp > ap ? 'home' : 'away';
  return null;
}

/** Voided fixtures are never part of the historical record. */
function isArchivableFixture(match) {
  return Boolean(match && !match.isVoided);
}

/** Series competitions archive only games that were actually played. */
function isPlayedArchivableFixture(match) {
  return isArchivableFixture(match) && Boolean(match.isPlayed);
}

function snapshotTeam(team) {
  return {
    teamId: team._id,
    name: team.name,
    logo: team.logo || '',
    category: team.category,
    competition: team.competition,
    staff: (team.staff || []).map((s) => ({ role: s.role, name: s.name })),
  };
}

function snapshotPlayer(player, teamById) {
  const teamId = String(player.team?._id || player.team);
  const team = teamById.get(teamId);
  return {
    playerId: player._id,
    name: player.name,
    number: player.number ?? null,
    position: player.position,
    teamId: player.team?._id || player.team,
    teamName: team?.name || 'Unknown',
    isCaptain: Boolean(player.isCaptain),
    isViceCaptain: Boolean(player.isViceCaptain),
  };
}

function snapshotFixture(match, teamById) {
  const home = teamDisplay(match.homeTeam, teamById);
  const away = teamDisplay(match.awayTeam, teamById);
  const winnerSide = resolvedWinnerSideFromScores(match);
  const winner = winnerSide === 'home' ? home : winnerSide === 'away' ? away : null;

  return {
    matchId: match._id,
    homeTeamId: home.teamId,
    homeTeamName: home.name,
    homeTeamLogo: home.logo,
    awayTeamId: away.teamId,
    awayTeamName: away.name,
    awayTeamLogo: away.logo,
    homeScore: match.homeScore ?? null,
    awayScore: match.awayScore ?? null,
    homePenalties: match.homePenalties ?? null,
    awayPenalties: match.awayPenalties ?? null,
    date: match.date,
    time: match.time,
    matchweek: match.matchweek,
    stage: match.stage,
    round: match.round,
    isPlayed: Boolean(match.isPlayed),
    matchState: match.matchState || (match.isPlayed ? 'ft' : 'scheduled'),
    winnerTeamId: winner?.teamId || undefined,
    winnerTeamName: winner?.name || undefined,
  };
}

function winnerSnapshotFromTeam(team) {
  if (!team) return undefined;
  return {
    teamId: team._id || team.teamId,
    name: team.name,
    logo: team.logo || '',
  };
}

function winnerSnapshotFromMatch(match, teamById) {
  const side = resolvedWinnerSideFromScores(match);
  if (!side) return undefined;
  const team = side === 'home' ? teamDisplay(match.homeTeam, teamById) : teamDisplay(match.awayTeam, teamById);
  return winnerSnapshotFromTeam(team);
}

function sortStandings(rows) {
  return [...rows].sort(
    (a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor
  );
}

function buildLeagueStandings(leagueTeams) {
  const rows = leagueTeams.map((team) => ({
    teamId: team._id,
    teamName: team.name,
    teamLogo: team.logo || '',
    played: team.played || 0,
    won: team.won || 0,
    drawn: team.drawn || 0,
    lost: team.lost || 0,
    goalsFor: team.goalsFor || 0,
    goalsAgainst: team.goalsAgainst || 0,
    goalDifference: team.goalDifference ?? (team.goalsFor || 0) - (team.goalsAgainst || 0),
    points: team.points || 0,
    form: team.form || [],
  }));
  return sortStandings(rows).map((row, index) => ({ ...row, position: index + 1 }));
}

function buildAcwplStandings(acwplMatches, teamById) {
  const teamNames = ['Orion', 'Firestorm'];
  const table = {
    Orion: { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
    Firestorm: { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
  };

  for (const match of acwplMatches.filter(isPlayedArchivableFixture)) {
    const home = teamDisplay(match.homeTeam, teamById);
    const away = teamDisplay(match.awayTeam, teamById);
    if (!teamNames.includes(home.name) || !teamNames.includes(away.name)) continue;

    const h = match.homeScore;
    const a = match.awayScore;
    table[home.name].played += 1;
    table[away.name].played += 1;
    table[home.name].goalsFor += h || 0;
    table[home.name].goalsAgainst += a || 0;
    table[away.name].goalsFor += a || 0;
    table[away.name].goalsAgainst += h || 0;

    if (h > a) {
      table[home.name].won += 1;
      table[home.name].points += 3;
      table[away.name].lost += 1;
    } else if (a > h) {
      table[away.name].won += 1;
      table[away.name].points += 3;
      table[home.name].lost += 1;
    } else {
      table[home.name].drawn += 1;
      table[away.name].drawn += 1;
      table[home.name].points += 1;
      table[away.name].points += 1;
    }
  }

  const rows = teamNames.map((name) => {
    const idEntry = [...teamById.values()].find((t) => t.name === name);
    const stats = table[name];
    return {
      teamId: idEntry?._id,
      teamName: name,
      teamLogo: idEntry?.logo || '',
      position: 0,
      played: stats.played,
      won: stats.won,
      drawn: stats.drawn,
      lost: stats.lost,
      goalsFor: stats.goalsFor,
      goalsAgainst: stats.goalsAgainst,
      goalDifference: stats.goalsFor - stats.goalsAgainst,
      points: stats.points,
      form: [],
    };
  });

  return sortStandings(rows).map((row, index) => ({ ...row, position: index + 1 }));
}

function resolveAcwplWinner(acwplMatches, teamById) {
  const standings = buildAcwplStandings(acwplMatches, teamById);
  const byName = Object.fromEntries(standings.map((r) => [r.teamName, r]));
  const teamA = 'Orion';
  const teamB = 'Firestorm';
  const remainingA = Math.max(0, 5 - (byName[teamA]?.played || 0));
  const remainingB = Math.max(0, 5 - (byName[teamB]?.played || 0));
  const maxA = (byName[teamA]?.points || 0) + remainingA * 3;
  const maxB = (byName[teamB]?.points || 0) + remainingB * 3;

  let championName = null;
  if ((byName[teamA]?.won || 0) >= 3 || (byName[teamA]?.points || 0) > maxB) championName = teamA;
  else if ((byName[teamB]?.won || 0) >= 3 || (byName[teamB]?.points || 0) > maxA) championName = teamB;

  if (!championName) return undefined;
  const team = [...teamById.values()].find((t) => t.name === championName);
  return winnerSnapshotFromTeam(team);
}

function buildSeriesWins(matches, teamById) {
  const winsByTeamId = new Map();
  for (const match of matches.filter(isPlayedArchivableFixture)) {
    const side = resolvedWinnerSideFromScores(match);
    if (!side) continue;
    const winner = side === 'home' ? teamDisplay(match.homeTeam, teamById) : teamDisplay(match.awayTeam, teamById);
    const key = String(winner.teamId);
    winsByTeamId.set(key, (winsByTeamId.get(key) || 0) + 1);
  }
  return [...winsByTeamId.entries()].map(([teamId, wins]) => {
    const team = teamById.get(teamId);
    return { teamId, teamName: team?.name || 'Unknown', wins };
  });
}

function resolveGirlsSuperCupWinner(gscMatches, teamById) {
  const wins = buildSeriesWins(gscMatches, teamById);
  const champion = wins.find((w) => w.wins >= 2);
  if (!champion) return undefined;
  const team = teamById.get(String(champion.teamId));
  return winnerSnapshotFromTeam(team);
}

function snapshotPlayerStatRow(stat, playerById, teamById) {
  const pid = String(stat.player?._id || stat.player);
  const tid = String(stat.team?._id || stat.team);
  const player = playerById.get(pid);
  const team = teamById.get(tid);
  return {
    playerId: stat.player?._id || stat.player,
    playerName: player?.name || 'Unknown',
    playerNumber: player?.number ?? null,
    playerPosition: player?.position,
    teamId: stat.team?._id || stat.team,
    teamName: team?.name || 'Unknown',
    goals: stat.goals || 0,
    assists: stat.assists || 0,
    cleanSheets: stat.cleanSheets || 0,
    yellowCards: stat.yellowCards || 0,
    redCards: stat.redCards || 0,
    ownGoals: stat.ownGoals || 0,
  };
}

function buildStatisticsSnapshot(playerStats, competition, playerById, teamById) {
  const rows = playerStats
    .filter((s) => s.competition === competition)
    .map((s) => snapshotPlayerStatRow(s, playerById, teamById));

  const statistics = {};
  for (const metric of STAT_METRICS) {
    statistics[metric] = rows
      .filter((r) => (r[metric] || 0) > 0)
      .sort((a, b) => b[metric] - a[metric] || a.playerName.localeCompare(b.playerName));
  }
  return statistics;
}

function uniqueParticipantsFromFixtures(fixtures, teamById) {
  const seen = new Set();
  const out = [];
  for (const fx of fixtures) {
    for (const side of [fx.homeTeamId, fx.awayTeamId]) {
      const id = String(side);
      if (seen.has(id)) continue;
      seen.add(id);
      const team = teamById.get(id);
      if (team) out.push(snapshotTeam(team));
    }
  }
  return out;
}

function buildCompetitionSnapshots({ teams, matches, playerStats, teamById, playerById }) {
  const leagueTeams = teams.filter((t) => t.competition === 'league');
  const leagueMatches = matches.filter((m) => m.competition === 'league' && isArchivableFixture(m));
  const cupMatches = matches.filter((m) => m.competition === 'cup' && isArchivableFixture(m));
  const superCupMatches = matches.filter((m) => m.competition === 'super-cup' && isArchivableFixture(m));
  const acwplMatches = matches.filter((m) => m.competition === 'acwpl');
  const gscMatches = matches.filter((m) => m.competition === 'girls-super-cup');

  const leagueStandings = buildLeagueStandings(leagueTeams);
  const leagueFixtures = leagueMatches.map((m) => snapshotFixture(m, teamById));
  const leagueWinner = leagueStandings[0]
    ? winnerSnapshotFromTeam(teamById.get(String(leagueStandings[0].teamId)))
    : undefined;

  const cupSemiFinals = cupMatches
    .filter((m) => m.stage === 'semi-final' || m.round === 'semi-final')
    .map((m) => snapshotFixture(m, teamById));
  const cupFinalMatch = cupMatches.find((m) => m.stage === 'final' || m.round === 'final');
  const cupFinal = cupFinalMatch ? snapshotFixture(cupFinalMatch, teamById) : undefined;
  const cupFixtures = [...cupSemiFinals, ...(cupFinal ? [cupFinal] : [])];

  const superCupMatch = superCupMatches.find(isPlayedArchivableFixture) || superCupMatches[0];
  const superCupFinal = superCupMatch ? snapshotFixture(superCupMatch, teamById) : undefined;

  const acwplFixtures = acwplMatches.filter(isPlayedArchivableFixture).map((m) => snapshotFixture(m, teamById));
  const gscFixtures = gscMatches.filter(isPlayedArchivableFixture).map((m) => snapshotFixture(m, teamById));

  const acwplParticipants = teams.filter((t) => t.competition === 'acwpl').map(snapshotTeam);
  const gscParticipants = acwplParticipants.length ? acwplParticipants : teams.filter((t) => t.category === 'girls').map(snapshotTeam);

  return {
    league: {
      standings: leagueStandings,
      fixtures: leagueFixtures,
      winner: leagueWinner,
      statistics: buildStatisticsSnapshot(playerStats, 'league', playerById, teamById),
    },
    cup: {
      participants: uniqueParticipantsFromFixtures(cupFixtures, teamById),
      semiFinals: cupSemiFinals,
      final: cupFinal,
      winner: cupFinalMatch ? winnerSnapshotFromMatch(cupFinalMatch, teamById) : undefined,
      statistics: buildStatisticsSnapshot(playerStats, 'cup', playerById, teamById),
    },
    superCup: {
      participants: uniqueParticipantsFromFixtures(superCupFinal ? [superCupFinal] : [], teamById),
      final: superCupFinal,
      winner: superCupMatch ? winnerSnapshotFromMatch(superCupMatch, teamById) : undefined,
      originalDoubleWinnerId: superCupMatch?.originalDoubleWinnerId,
      statistics: buildStatisticsSnapshot(playerStats, 'super-cup', playerById, teamById),
    },
    acwpl: {
      format: 'best-of-5',
      participants: acwplParticipants,
      standings: buildAcwplStandings(acwplMatches, teamById),
      fixtures: acwplFixtures,
      winner: resolveAcwplWinner(acwplMatches, teamById),
      winsByTeam: buildSeriesWins(acwplMatches, teamById),
      statistics: buildStatisticsSnapshot(playerStats, 'acwpl', playerById, teamById),
    },
    girlsSuperCup: {
      format: 'best-of-3',
      participants: gscParticipants,
      standings: [],
      fixtures: gscFixtures,
      winner: resolveGirlsSuperCupWinner(gscMatches, teamById),
      winsByTeam: buildSeriesWins(gscMatches, teamById),
      statistics: buildStatisticsSnapshot(playerStats, 'girls-super-cup', playerById, teamById),
    },
  };
}

/** Legacy flat match list — non-void only, for backward-compatible API fields. */
function buildLegacyMatches(matches, teamById) {
  return matches.filter(isArchivableFixture).map((match) => {
    const fx = snapshotFixture(match, teamById);
    return {
      _id: fx.matchId,
      homeTeam: fx.homeTeamId,
      awayTeam: fx.awayTeamId,
      homeTeamName: fx.homeTeamName,
      homeTeamLogo: fx.homeTeamLogo,
      awayTeamName: fx.awayTeamName,
      awayTeamLogo: fx.awayTeamLogo,
      homeScore: fx.homeScore,
      awayScore: fx.awayScore,
      homePenalties: fx.homePenalties,
      awayPenalties: fx.awayPenalties,
      date: fx.date,
      time: fx.time,
      matchweek: fx.matchweek,
      competition: match.competition,
      stage: fx.stage,
      isPlayed: fx.isPlayed,
      isVoided: false,
      matchState: fx.matchState,
    };
  });
}

/** Legacy finalStandings — boys league only. */
function buildLegacyFinalStandings(leagueStandings) {
  return leagueStandings.map((row) => ({
    team: row.teamId,
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
  }));
}

function buildLegacyWinners(competitions) {
  return {
    league: competitions.league?.winner?.teamId,
    cup: competitions.cup?.winner?.teamId,
    superCup: competitions.superCup?.winner?.teamId,
    acwpl: competitions.acwpl?.winner?.teamId,
    girlsSuperCup: competitions.girlsSuperCup?.winner?.teamId,
  };
}

function buildLegacyTeams(participatingTeams) {
  return participatingTeams.map((t) => ({
    _id: t.teamId,
    name: t.name,
    logo: t.logo,
  }));
}

/**
 * Build a complete Season document payload from live collections.
 * @param {object} input
 * @param {Array} input.teams - Team documents
 * @param {Array} input.matches - Match documents (populated teams optional)
 * @param {Array} input.players - Player documents
 * @param {Array} input.playerStats - PlayerStats documents for the live stats bucket
 * @param {number} input.seasonNumber
 * @param {object} [input.meta]
 */
function buildSeasonArchivePayload({
  teams,
  matches,
  players,
  playerStats,
  seasonNumber,
  meta = {},
}) {
  const archivedAt = meta.archivedAt || new Date();
  const academicYear = meta.academicYear || deriveAcademicYear(archivedAt);
  const semester = meta.semester || 'full';
  const displayName = meta.displayName || `Season ${seasonNumber}`;

  const teamById = new Map(teams.map((t) => [String(t._id), t]));
  const playerById = new Map(players.map((p) => [String(p._id), p]));

  const participatingTeams = teams.map(snapshotTeam);
  const participatingPlayers = players.filter((p) => p.active !== false).map((p) => snapshotPlayer(p, teamById));
  const competitions = buildCompetitionSnapshots({ teams, matches, playerStats, teamById, playerById });

  return {
    seasonNumber,
    name: displayName,
    displayName,
    academicYear,
    semester,
    archivedAt,
    status: 'archived',
    archiveVersion: 2,
    startDate: meta.startDate || new Date(archivedAt.getTime() - 365 * 24 * 60 * 60 * 1000),
    endDate: meta.endDate || archivedAt,
    isActive: false,
    participatingTeams,
    participatingPlayers,
    competitions,
    // Legacy fields — derived from snapshot for existing API consumers
    teams: buildLegacyTeams(participatingTeams),
    finalStandings: buildLegacyFinalStandings(competitions.league.standings),
    winners: buildLegacyWinners(competitions),
    matches: buildLegacyMatches(matches, teamById),
  };
}

module.exports = {
  COMPETITION_IDS,
  deriveAcademicYear,
  isArchivableFixture,
  isPlayedArchivableFixture,
  buildSeasonArchivePayload,
  buildCompetitionSnapshots,
  buildLegacyMatches,
  buildLegacyFinalStandings,
  buildAcwplStandings,
  resolveGirlsSuperCupWinner,
  snapshotFixture,
  archivedTeamSnapshotSchema,
  archivedPlayerSnapshotSchema,
  competitionsArchiveSchema,
};
