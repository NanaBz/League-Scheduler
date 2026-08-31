import {
  buildGirlsSuperCupSeries,
  resolveGscMatchWinnerName,
  GSC_WINS_TO_CLINCH,
} from './girlsSuperCupSeries';

const orion = { name: 'Orion', _id: 'o1' };
const firestorm = { name: 'Firestorm', _id: 'f1' };

function gscMatch(overrides) {
  return {
    competition: 'girls-super-cup',
    homeTeam: orion,
    awayTeam: firestorm,
    isPlayed: true,
    isVoided: false,
    homeScore: 2,
    awayScore: 1,
    matchweek: 1,
    ...overrides,
  };
}

describe('girlsSuperCupSeries', () => {
  it('resolves regulation and penalty winners', () => {
    expect(resolveGscMatchWinnerName(gscMatch({ homeScore: 2, awayScore: 0 }))).toBe('Orion');
    expect(
      resolveGscMatchWinnerName(
        gscMatch({ homeScore: 1, awayScore: 1, homePenalties: 4, awayPenalties: 5 })
      )
    ).toBe('Firestorm');
  });

  it('clinches at two wins and ignores void games', () => {
    const matches = [
      gscMatch({ matchweek: 1, homeScore: 2, awayScore: 0 }),
      gscMatch({
        matchweek: 2,
        homeTeam: firestorm,
        awayTeam: orion,
        homeScore: 0,
        awayScore: 2,
      }),
      gscMatch({
        matchweek: 3,
        isPlayed: false,
        isVoided: true,
        homeScore: null,
        awayScore: null,
      }),
    ];
    const { winsByTeam, champion } = buildGirlsSuperCupSeries(matches);
    expect(winsByTeam.Orion).toBe(2);
    expect(winsByTeam.Firestorm).toBe(0);
    expect(champion).toBe('Orion');
  });

  it('reports wins needed before clinch', () => {
    const { champion, winsByTeam } = buildGirlsSuperCupSeries([
      gscMatch({ matchweek: 1, homeScore: 1, awayScore: 0 }),
    ]);
    expect(champion).toBeNull();
    expect(winsByTeam.Orion).toBe(1);
    expect(GSC_WINS_TO_CLINCH - winsByTeam.Orion).toBe(1);
  });
});
