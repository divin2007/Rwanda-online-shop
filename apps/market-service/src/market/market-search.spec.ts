import { MarketService } from './market.service';

// Builds a model whose find().sort().limit().lean().exec() chain resolves to `rows`,
// and a plain find().limit().lean().exec() for the no-query path.
function buildMarketModel(rows: any[]) {
  const chain: any = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(rows),
  };
  return { find: jest.fn(() => chain) };
}

const cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() } as any;

describe('MarketService.searchMarkets sponsored cap', () => {
  it('labels at most MAX_SPONSORED_SLOTS_PER_PAGE premium markets as sponsored', async () => {
    // 5 premium markets, all with identical high text score.
    const rows = Array.from({ length: 5 }).map((_, i) => ({
      _id: `m${i}`,
      name: `Tomato market ${i}`,
      rating: 4,
      premiumTier: 'spotlight',
      score: 1,
      location: { coordinates: [30, -1.9] },
    }));
    const service = new MarketService(buildMarketModel(rows) as any, cache);

    const results = await service.searchMarkets({ q: 'tomato' });
    const sponsored = results.filter((m: any) => m.isSponsored);
    expect(sponsored.length).toBe(3);
    expect(MarketService.MAX_SPONSORED_SLOTS_PER_PAGE).toBe(3);
  });

  it('drops a premium market that fails the relevance threshold', async () => {
    const rows = [
      { _id: 'rel', name: 'Tomato hub', rating: 3, premiumTier: 'none', score: 10, location: { coordinates: [30, -1.9] } },
      // Premium but irrelevant: text score is a tiny fraction of the max → below 0.1 threshold.
      { _id: 'irrelevant', name: 'Shoe bazaar', rating: 5, premiumTier: 'spotlight', score: 0.5, location: { coordinates: [30, -1.9] } },
    ];
    const service = new MarketService(buildMarketModel(rows) as any, cache);

    const results = await service.searchMarkets({ q: 'tomato' });
    const ids = results.map((m: any) => m._id);
    expect(ids).toContain('rel');
    expect(ids).not.toContain('irrelevant');
  });

  it('marks no markets sponsored when none are premium', async () => {
    const rows = [
      { _id: 'a', name: 'Tomato a', rating: 4, premiumTier: 'none', score: 1, location: { coordinates: [30, -1.9] } },
      { _id: 'b', name: 'Tomato b', rating: 3, premiumTier: 'none', score: 0.8, location: { coordinates: [30, -1.9] } },
    ];
    const service = new MarketService(buildMarketModel(rows) as any, cache);

    const results = await service.searchMarkets({ q: 'tomato' });
    expect(results.every((m: any) => !m.isSponsored)).toBe(true);
  });
});
