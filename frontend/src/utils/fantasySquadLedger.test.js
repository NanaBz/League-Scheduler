import {
  FANTASY_BUDGET_M,
  applyPlayerToSlot,
  createEmptyFinancialState,
  parseFinancialFromApiResponse,
  previewSquadFinancial,
  simulateSquadTransition,
} from './fantasySquadLedger';

const mockPlayer = (id, price, purchasePrice = price) => ({
  _id: id,
  name: `Player ${id}`,
  fantasyPrice: price,
  purchasePrice,
});

const emptySquad = () => ({
  GK: [null, null],
  DF: [null, null, null, null],
  MF: [null, null, null, null],
  ATT: [null, null, null],
});

describe('fantasySquadLedger preview', () => {
  test('new manager starts with AC 100 bank', () => {
    const empty = createEmptyFinancialState();
    expect(empty.bankBalance).toBe(FANTASY_BUDGET_M);
  });

  test('initial purchase reduces bank', () => {
    const squad = emptySquad();
    squad.GK[0] = mockPlayer('p1', 7.5);
    const preview = previewSquadFinancial({
      savedFinancial: createEmptyFinancialState(),
      savedSquad: emptySquad(),
      stagedSquad: squad,
    });
    expect(preview.ok).toBe(true);
    expect(preview.bankBalance).toBe(92.5);
  });

  test('replacement sells at current price not purchase price', () => {
    const saved = emptySquad();
    saved.GK[0] = mockPlayer('A', 8.0, 7.5);
    const staged = emptySquad();
    staged.GK[0] = mockPlayer('B', 7.0);

    const preview = previewSquadFinancial({
      savedFinancial: { bankBalance: 10, playerPurchasePrices: { A: 7.5 } },
      savedSquad: saved,
      stagedSquad: staged,
    });

    expect(preview.ok).toBe(true);
    expect(preview.bankBalance).toBe(11);
  });

  test('insufficient bank rejected in preview', () => {
    const staged = emptySquad();
    staged.GK[0] = mockPlayer('x', 12.0);
    const preview = previewSquadFinancial({
      savedFinancial: { bankBalance: 5, playerPurchasePrices: {} },
      savedSquad: emptySquad(),
      stagedSquad: staged,
    });
    expect(preview.ok).toBe(false);
  });

  test('total team value can exceed 100', () => {
    const saved = emptySquad();
    saved.GK[0] = mockPlayer('a', 50, 40);
    saved.GK[1] = mockPlayer('b', 50, 40);
    const preview = previewSquadFinancial({
      savedFinancial: { bankBalance: 20, playerPurchasePrices: { a: 40, b: 40 } },
      savedSquad: saved,
      stagedSquad: saved,
    });
    expect(preview.totalTeamValue).toBe(120);
  });

  test('parseFinancialFromApiResponse uses server fields', () => {
    const squad = emptySquad();
    squad.GK[0] = mockPlayer('p1', 8.0, 7.5);
    const financial = parseFinancialFromApiResponse({
      bankBalance: 25,
      squadMarketValue: 8,
      totalTeamValue: 33,
      squad,
    });
    expect(financial.bankBalance).toBe(25);
    expect(financial.squadMarketValue).toBe(8);
    expect(financial.totalTeamValue).toBe(33);
    expect(financial.playerPurchasePrices.p1).toBe(7.5);
  });

  test('staged slot replacement affordability accounts for outgoing sale', () => {
    const saved = emptySquad();
    saved.GK[0] = mockPlayer('out', 8.0, 7.5);
    const staged = emptySquad();
    staged.GK[0] = mockPlayer('out', 8.0, 7.5);

    const trial = applyPlayerToSlot(staged, { position: 'GK', index: 0 }, mockPlayer('in', 10.0));
    const preview = previewSquadFinancial({
      savedFinancial: { bankBalance: 5, playerPurchasePrices: { out: 7.5 } },
      savedSquad: saved,
      stagedSquad: trial,
    });
    expect(preview.ok).toBe(true);
    expect(preview.bankBalance).toBe(3);
  });

  test('simulate uses current price for sale after increase', () => {
    const market = new Map([
      ['A', 9.0],
    ]);
    const result = simulateSquadTransition({
      oldPlayerIds: ['A'],
      newPlayerIds: [],
      bankBalance: 10,
      playerPurchasePrices: { A: 7.5 },
      marketPricesById: market,
    });
    expect(result.bankBalance).toBe(19);
  });
});
