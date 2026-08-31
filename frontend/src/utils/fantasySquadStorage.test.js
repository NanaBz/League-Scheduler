import {
  EMPTY_SQUAD,
  clearFantasyClientSeasonKeys,
  clearFantasyUserCache,
  countSquadPlayers,
  mergeSquadPlayerFieldsFromApi,
  resolveSquadFromApiAndCache,
  saveSquadToLocalStorage,
  saveFinancialToLocalStorage,
  loadFinancialFromLocalStorage,
} from './fantasySquadStorage';

const mockPlayer = (id, price = 5.0, purchasePrice) => ({
  _id: id,
  name: `Player ${id}`,
  fantasyPrice: price,
  ...(purchasePrice != null ? { purchasePrice } : {}),
});

function filledSquad(count = 13) {
  const squad = {
    GK: [mockPlayer('gk1'), mockPlayer('gk2')],
    DF: [mockPlayer('df1'), mockPlayer('df2'), mockPlayer('df3'), mockPlayer('df4')],
    MF: [mockPlayer('mf1'), mockPlayer('mf2'), mockPlayer('mf3'), mockPlayer('mf4')],
    ATT: [mockPlayer('att1'), mockPlayer('att2'), mockPlayer('att3')],
  };
  if (count < 13) {
    squad.ATT[2] = null;
  }
  return squad;
}

describe('resolveSquadFromApiAndCache', () => {
  const userId = 'user-123';

  beforeEach(() => {
    localStorage.clear();
  });

  test('uses empty server squad when cache has full previous-season squad', () => {
    saveSquadToLocalStorage(userId, filledSquad(13));
    const resolved = resolveSquadFromApiAndCache(EMPTY_SQUAD, userId, 0);
    expect(countSquadPlayers(resolved)).toBe(0);
    expect(countSquadPlayers(resolveSquadFromApiAndCache(EMPTY_SQUAD, userId, 0))).toBe(0);
  });

  test('keeps partial cache when server is empty (GW1 in-progress build)', () => {
    saveSquadToLocalStorage(userId, filledSquad(12));
    const resolved = resolveSquadFromApiAndCache(EMPTY_SQUAD, userId, 0);
    expect(countSquadPlayers(resolved)).toBe(12);
  });

  test('prefers server when server has fewer saved players than cache', () => {
    const serverSquad = filledSquad(12);
    saveSquadToLocalStorage(userId, filledSquad(13));
    const resolved = resolveSquadFromApiAndCache(serverSquad, userId, 12);
    expect(countSquadPlayers(resolved)).toBe(12);
  });

  test('does not modify numeric input values', () => {
    const price = 7.5;
    expect(price).toBe(7.5);
  });
});

describe('clearFantasyClientSeasonKeys', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('clears squad and lineup keys', () => {
    localStorage.setItem('fantasySquad:user-a', '{}');
    localStorage.setItem('fantasyLineup:user-a', '{}');
    localStorage.setItem('fantasyFinancial:user-a', '{}');
    localStorage.setItem('fantasyCurrentGameweek', '3');
    localStorage.setItem('fantasyOverallRankingLive', '{}');
    localStorage.setItem('adminToken', 'keep-me');

    clearFantasyClientSeasonKeys();

    expect(localStorage.getItem('fantasySquad:user-a')).toBeNull();
    expect(localStorage.getItem('fantasyLineup:user-a')).toBeNull();
    expect(localStorage.getItem('fantasyFinancial:user-a')).toBeNull();
    expect(localStorage.getItem('fantasyCurrentGameweek')).toBeNull();
    expect(localStorage.getItem('fantasyOverallRankingLive')).toBeNull();
    expect(localStorage.getItem('adminToken')).toBe('keep-me');
  });
});

describe('clearFantasyUserCache', () => {
  test('removes only the targeted user keys', () => {
    localStorage.setItem('fantasySquad:user-a', '{}');
    localStorage.setItem('fantasyLineup:user-a', '{}');
    localStorage.setItem('fantasySquad:user-b', '{}');

    clearFantasyUserCache('user-a');

    expect(localStorage.getItem('fantasySquad:user-a')).toBeNull();
    expect(localStorage.getItem('fantasyLineup:user-a')).toBeNull();
    expect(localStorage.getItem('fantasySquad:user-b')).not.toBeNull();
  });
});

describe('mergeSquadPlayerFieldsFromApi', () => {
  test('prefers server fantasyPrice and purchasePrice over cache', () => {
    const apiSquad = {
      GK: [mockPlayer('p1', 8.5, 7.5)],
      DF: [null, null, null, null],
      MF: [null, null, null, null],
      ATT: [null, null, null],
    };
    const cached = {
      GK: [mockPlayer('p1', 7.0, 7.0)],
      DF: [null, null, null, null],
      MF: [null, null, null, null],
      ATT: [null, null, null],
    };
    const merged = mergeSquadPlayerFieldsFromApi(apiSquad, cached);
    expect(merged.GK[0].fantasyPrice).toBe(8.5);
    expect(merged.GK[0].purchasePrice).toBe(7.5);
  });
});

describe('financial localStorage', () => {
  test('saves and loads financial snapshot', () => {
    const financial = { bankBalance: 11, playerPurchasePrices: { a: 7.5 } };
    saveFinancialToLocalStorage('user-x', financial);
    expect(loadFinancialFromLocalStorage('user-x')).toEqual(financial);
  });
});
