import {
  getArchivedCompetitionSummary,
  seasonSelectorLabel,
  sortArchivedSeasons,
} from './archiveSeasonModel';

describe('archiveSeasonModel', () => {
  const sampleSeason = {
    seasonNumber: 3,
    academicYear: '2025/2026',
    semester: 'first',
    archivedAt: '2026-01-15T00:00:00.000Z',
    competitions: {
      league: {
        winner: { teamId: '1', name: 'Lions', logo: '/logos/lions.svg' },
        standings: [
          { position: 1, teamName: 'Lions', teamLogo: '/logos/lions.svg', teamId: '1' },
          { position: 2, teamName: 'Warriors', teamLogo: '/logos/warriors.svg', teamId: '2' },
        ],
      },
      cup: {
        winner: { teamId: '1', name: 'Lions', logo: '/logos/lions.svg' },
        final: {
          homeTeamId: '1',
          homeTeamName: 'Lions',
          awayTeamId: '3',
          awayTeamName: 'Vikings',
        },
      },
    },
  };

  test('seasonSelectorLabel formats academic year and semester', () => {
    expect(seasonSelectorLabel(sampleSeason)).toBe('2025/2026 • First Semester');
  });

  test('sortArchivedSeasons prefers most recently archived', () => {
    const sorted = sortArchivedSeasons([
      { seasonNumber: 1, archivedAt: '2024-01-01T00:00:00.000Z' },
      { seasonNumber: 2, archivedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    expect(sorted[0].seasonNumber).toBe(2);
  });

  test('getArchivedCompetitionSummary reads snapshot winner and runner-up', () => {
    const league = getArchivedCompetitionSummary(sampleSeason, {
      id: 'league',
      archiveKey: 'league',
      legacyWinnerKey: 'league',
    });
    expect(league.winner.name).toBe('Lions');
    expect(league.runnerUp.name).toBe('Warriors');

    const cup = getArchivedCompetitionSummary(sampleSeason, {
      id: 'cup',
      archiveKey: 'cup',
      legacyWinnerKey: 'cup',
    });
    expect(cup.runnerUp.name).toBe('Vikings');
  });
});
