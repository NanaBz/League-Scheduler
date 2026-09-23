import {
  APPEARANCE_45PLUS,
  APPEARANCE_UNDER45,
  appearanceLabel,
  appearanceToMinutes,
  appearancesFromPerformances,
  buildSparseMinutesPayload,
  validateAppearancesBeforeSave,
  hasScoringEventStats,
} from './fantasyAppearance';
import { filterPlayersBySearch as searchByName } from './filterPlayersBySearch';

describe('fantasyAppearance', () => {
  test('untouched player maps to 0 minutes / DNP', () => {
    expect(appearanceToMinutes(undefined)).toBe(0);
    expect(appearanceLabel(undefined)).toBe('Did Not Play');
  });

  test('under 45 maps to +1 appearance point bucket', () => {
    expect(appearanceToMinutes(APPEARANCE_UNDER45)).toBe(1);
    expect(appearanceLabel(APPEARANCE_UNDER45)).toBe('<45');
  });

  test('45+ maps to +2 appearance point bucket', () => {
    expect(appearanceToMinutes(APPEARANCE_45PLUS)).toBe(45);
    expect(appearanceLabel(APPEARANCE_45PLUS)).toBe('45+');
  });

  test('loads saved performances into appearance state', () => {
    const map = appearancesFromPerformances([
      { player: 'a', minutesPlayed: 0 },
      { player: 'b', minutesPlayed: 12 },
      { player: 'c', minutesPlayed: 60 },
    ]);
    expect(map).toEqual({ b: APPEARANCE_UNDER45, c: APPEARANCE_45PLUS });
  });

  test('sparse payload only includes players who played', () => {
    const players = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }];
    const appearances = { b: APPEARANCE_UNDER45, c: APPEARANCE_45PLUS };
    expect(buildSparseMinutesPayload(players, appearances)).toEqual([
      { playerId: 'b', minutes: 1 },
      { playerId: 'c', minutes: 45 },
    ]);
  });

  test('blocks players with events left as DNP', () => {
    const players = [{ _id: '1', name: 'Chris' }];
    const perf = { goals: 1 };
    const result = validateAppearancesBeforeSave(
      players,
      {},
      { 1: perf }
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Chris/);
    expect(hasScoringEventStats(perf)).toBe(true);
  });

  test('search still filters eligible players by name', () => {
    const players = [{ _id: '1', name: 'Kofi Mensah' }];
    expect(searchByName(players, 'kofi')).toHaveLength(1);
  });
});
