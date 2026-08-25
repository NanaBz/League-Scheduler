import {
  captainDidNotPlay,
  resolveScoringCaptainId,
  performanceHasScoringEventStats,
  defaultMinutesForPerformance,
} from './fantasyCaptainScoring';

describe('fantasyCaptainScoring', () => {
  const points = (entries) => new Map(entries);
  const minutes = (entries) => new Map(entries);

  it('detects captain who did not play', () => {
    const pts = points([['cap', 0]]);
    const mins = minutes([['cap', 0]]);
    expect(captainDidNotPlay('cap', pts, mins)).toBe(true);
  });

  it('does not blank captain with points but zero minutes', () => {
    const pts = points([['cap', -1]]);
    const mins = minutes([['cap', 0]]);
    expect(captainDidNotPlay('cap', pts, mins)).toBe(false);
  });

  it('promotes vice when captain blanked', () => {
    const pts = points([
      ['cap', 0],
      ['vice', 6],
    ]);
    const mins = minutes([
      ['cap', 0],
      ['vice', 90],
    ]);
    const result = resolveScoringCaptainId('cap', 'vice', pts, mins);
    expect(result.vicePromoted).toBe(true);
    expect(result.scoringCaptainId).toBe('vice');
  });

  it('keeps captain when they played', () => {
    const pts = points([['cap', 2]]);
    const mins = minutes([['cap', 90]]);
    const result = resolveScoringCaptainId('cap', 'vice', pts, mins);
    expect(result.vicePromoted).toBe(false);
    expect(result.scoringCaptainId).toBe('cap');
  });

  it('defaults minutes to 1 when player has event stats', () => {
    expect(defaultMinutesForPerformance({ goals: 1, minutesPlayed: 0 })).toBe(1);
    expect(defaultMinutesForPerformance({ minutesPlayed: 0 })).toBe(0);
  });

  it('recognises scoring event stats', () => {
    expect(performanceHasScoringEventStats({ assists: 1 })).toBe(true);
    expect(performanceHasScoringEventStats({ cleansheetPoints: 4 })).toBe(false);
  });
});
