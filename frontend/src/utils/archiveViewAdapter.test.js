import { buildArchiveViewModel, groupScorersByPlayer } from './archiveViewAdapter';

describe('archiveViewAdapter', () => {
  const season = {
    seasonNumber: 2,
    competitions: {
      league: {
        standings: [
          { position: 1, teamId: 'a', teamName: 'Lions', teamLogo: '/l.png', points: 30, played: 10, won: 9, drawn: 1, lost: 0, goalsFor: 20, goalsAgainst: 5, goalDifference: 15, form: ['W'] },
        ],
        fixtures: [
          {
            matchId: 'm1',
            homeTeamId: 'a',
            homeTeamName: 'Lions',
            awayTeamId: 'b',
            awayTeamName: 'Warriors',
            homeScore: 2,
            awayScore: 1,
            matchweek: 1,
            isPlayed: true,
            matchState: 'ft',
          },
        ],
        statistics: {
          goals: [
            { playerId: 'p1', playerName: 'Striker', teamId: 'a', teamName: 'Lions', goals: 5 },
          ],
        },
      },
      girlsSuperCup: {
        format: 'best-of-3',
        fixtures: [
          {
            matchId: 'g1',
            homeTeamId: 'o',
            homeTeamName: 'Orion',
            awayTeamId: 'f',
            awayTeamName: 'Firestorm',
            homeScore: 2,
            awayScore: 0,
            matchweek: 1,
            isPlayed: true,
          },
          {
            matchId: 'g2',
            homeTeamId: 'f',
            homeTeamName: 'Firestorm',
            awayTeamId: 'o',
            awayTeamName: 'Orion',
            homeScore: 1,
            awayScore: 2,
            matchweek: 2,
            isPlayed: true,
          },
        ],
        winsByTeam: [
          { teamId: 'o', teamName: 'Orion', wins: 2 },
          { teamId: 'f', teamName: 'Firestorm', wins: 0 },
        ],
        winner: { teamId: 'o', name: 'Orion' },
      },
    },
  };

  test('buildArchiveViewModel maps league snapshot', () => {
    const vm = buildArchiveViewModel(season, {
      id: 'league',
      archiveKey: 'league',
      legacyWinnerKey: 'league',
    });
    expect(vm.standings[0].name).toBe('Lions');
    expect(vm.fixtures).toHaveLength(1);
    expect(vm.statistics.goals[0].goals).toBe(5);
  });

  test('girls super cup only includes played archive fixtures', () => {
    const vm = buildArchiveViewModel(season, {
      id: 'girls-super-cup',
      archiveKey: 'girlsSuperCup',
      legacyWinnerKey: 'girlsSuperCup',
    });
    expect(vm.fixtures).toHaveLength(2);
    expect(vm.winner.name).toBe('Orion');
  });

  test('groupScorersByPlayer ranks scorers', () => {
    const ranked = groupScorersByPlayer([
      { player: { _id: 'p1', name: 'A' }, team: { name: 'Lions' }, goals: 3 },
      { player: { _id: 'p2', name: 'B' }, team: { name: 'Warriors' }, goals: 5 },
    ]);
    expect(ranked[0].player.name).toBe('B');
    expect(ranked[0].goals).toBe(5);
  });
});
