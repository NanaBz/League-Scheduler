import {
  getArchivedSquad,
  getArchivedTeamPerformance,
  getArchivedTeams,
  groupArchivedSquadByPosition,
} from './archiveTeamModel';

describe('archiveTeamModel', () => {
  const season = {
    seasonNumber: 4,
    academicYear: '2025/2026',
    semester: 'first',
    participatingTeams: [
      { teamId: 't1', name: 'Lions', logo: '/lions.svg', competition: 'league', staff: [{ role: 'Coach', name: 'Alex' }] },
      { teamId: 't2', name: 'Warriors', logo: '/warriors.svg', competition: 'league' },
    ],
    participatingPlayers: [
      { playerId: 'p1', name: 'Keeper', number: 1, position: 'GK', teamId: 't1', teamName: 'Lions', isCaptain: true },
      { playerId: 'p2', name: 'Striker', number: 9, position: 'ATT', teamId: 't1', teamName: 'Lions', isViceCaptain: true },
      { playerId: 'p3', name: 'Other', number: 5, position: 'MF', teamId: 't2', teamName: 'Warriors' },
    ],
    competitions: {
      league: {
        standings: [
          { teamId: 't1', teamName: 'Lions', position: 1, points: 30 },
          { teamId: 't2', teamName: 'Warriors', position: 2, points: 24 },
        ],
        statistics: {
          goals: [
            { playerId: 'p2', playerName: 'Striker', teamId: 't1', teamName: 'Lions', goals: 12 },
          ],
        },
      },
      cup: {
        winner: { teamId: 't1', name: 'Lions' },
        semiFinals: [],
        final: {
          homeTeamId: 't1',
          homeTeamName: 'Lions',
          awayTeamId: 't2',
          awayTeamName: 'Warriors',
          homeScore: 2,
          awayScore: 1,
        },
      },
    },
  };

  test('getArchivedTeams returns snapshot teams sorted by league position', () => {
    const teams = getArchivedTeams(season);
    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Lions');
  });

  test('getArchivedSquad returns only players from snapshot for team', () => {
    const squad = getArchivedSquad(season, 't1');
    expect(squad).toHaveLength(2);
    expect(squad.map((p) => p.name)).toEqual(['Keeper', 'Striker']);
    expect(squad[0].number).toBe(1);
    expect(squad[0].position).toBe('GK');
  });

  test('groupArchivedSquadByPosition preserves GK/DF/MF/ATT groups', () => {
    const grouped = groupArchivedSquadByPosition(getArchivedSquad(season, 't1'));
    expect(grouped.GK).toHaveLength(1);
    expect(grouped.ATT).toHaveLength(1);
  });

  test('getArchivedTeamPerformance reads archived competition results', () => {
    const perf = getArchivedTeamPerformance(season, 't1');
    expect(perf.some((p) => p.competition === 'League' && p.summary === '1st place')).toBe(true);
    expect(perf.some((p) => p.competition === 'Agha Cup' && p.summary === 'Champions')).toBe(true);
  });

  test('squad is isolated per archive and unaffected by other seasons conceptually', () => {
    const otherSeason = {
      ...season,
      participatingPlayers: [
        { playerId: 'p99', name: 'New Signing', number: 7, position: 'MF', teamId: 't1', teamName: 'Lions' },
      ],
    };
    expect(getArchivedSquad(season, 't1')).toHaveLength(2);
    expect(getArchivedSquad(otherSeason, 't1')).toHaveLength(1);
    expect(getArchivedSquad(otherSeason, 't1')[0].name).toBe('New Signing');
  });
});
