import { ErrandService } from './errand.service';

const KIGALI = { address: 'A', coordinates: { lat: -1.9441, lng: 30.0619 } };
// ~ a few km away so ceil(km/5) >= 1.
const REMOTE = { address: 'B', coordinates: { lat: -1.98, lng: 30.10 } };

function buildErrandModel(created: any) {
  return {
    create: jest.fn(async (doc: any) => ({ ...doc, _id: 'e1', toObject: () => ({ ...doc, _id: 'e1' }) })),
    find: jest.fn(() => ({ sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([]) })),
  };
}

function makeService(errandModel: any, riderModel: any, gateway: any) {
  const service = new ErrandService(errandModel as any, riderModel as any, gateway as any);
  return service;
}

describe('ErrandService person pickup (Phase 3)', () => {
  it('computes a distance-based fee with a 90/10 split and broadcasts only to premium riders', async () => {
    const premiumRiders = [
      { userId: 'r1', premiumUntil: new Date(Date.now() + 86400000) },
      { userId: 'r2', premiumUntil: null },
    ];
    const riderModel = {
      find: jest.fn(() => ({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(premiumRiders) })),
    };
    const gateway = { broadcastErrand: jest.fn() };
    const errandModel = buildErrandModel(null);
    const service = makeService(errandModel, riderModel, gateway);

    const result = await service.create('buyer1', {
      description: 'pick up my friend',
      pickupLocation: KIGALI,
      dropLocation: REMOTE,
      errandType: 'person_pickup',
      paymentMethod: 'platform',
    });

    expect(result.errandType).toBe('person_pickup');
    // Fee is a positive multiple of 500.
    expect(result.agreedFee % 500).toBe(0);
    expect(result.agreedFee).toBeGreaterThan(0);
    // Rider earns 90%.
    expect(result.riderEarnings).toBe(Math.round(result.agreedFee * 0.9));
    // Broadcast restricted to the two premium rider userIds.
    expect(gateway.broadcastErrand).toHaveBeenCalledWith(expect.anything(), ['r1', 'r2']);
  });

  it('external payment skips wallet credit on completion', async () => {
    const errand = { _id: 'e1', agreedFee: 1000, riderEarnings: 900, paymentMethod: 'external', riderUserId: 'r1' };
    const service = makeService({}, {}, {});
    const axios = require('axios');
    const spy = jest.spyOn(axios, 'post');
    await (service as any).creditRider(errand);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('goods pickup broadcasts to all riders (no premium filter)', async () => {
    const gateway = { broadcastErrand: jest.fn() };
    const errandModel = buildErrandModel(null);
    const service = makeService(errandModel, {}, gateway);

    await service.create('buyer1', {
      description: 'fetch documents',
      pickupLocation: KIGALI,
      dropLocation: REMOTE,
      errandType: 'goods_pickup',
    });
    // Called with a single arg (no allowed-list).
    expect(gateway.broadcastErrand).toHaveBeenCalledTimes(1);
    expect(gateway.broadcastErrand.mock.calls[0].length).toBe(1);
  });
});
