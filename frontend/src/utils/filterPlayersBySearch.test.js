import { filterPlayersBySearch } from './filterPlayersBySearch';

describe('filterPlayersBySearch', () => {
  const players = [
    { _id: '1', name: 'Kofi Mensah' },
    { _id: '2', name: 'Kofi Asare' },
    { _id: '3', name: 'John Doe' },
  ];

  test('returns all when query empty', () => {
    expect(filterPlayersBySearch(players, '')).toHaveLength(3);
  });

  test('matches partial case-insensitive names', () => {
    const results = filterPlayersBySearch(players, 'kofi');
    expect(results.map((p) => p.name)).toEqual(['Kofi Mensah', 'Kofi Asare']);
  });
});
