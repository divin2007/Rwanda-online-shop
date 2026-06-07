import { RiderService } from './rider.service';

function makeService(riderModel: any) {
  const service = new RiderService(riderModel as any, {} as any, {} as any, {} as any);
  // Silence outbound notifications.
  (service as any).triggerNotification = jest.fn();
  return service;
}

describe('RiderService premium plan', () => {
  it('rejects upgrade for an unapproved rider', async () => {
    const rider = { userId: 'u1', isApproved: false, plan: 'standard' };
    const riderModel = {
      findOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(rider) })),
    };
    const service = makeService(riderModel);
    await expect(service.upgradeMyPlan('u1')).rejects.toThrow(/approved/);
  });

  it('sets premium for 30 days from now on first upgrade', async () => {
    const rider = { userId: 'u1', isApproved: true, plan: 'standard', premiumUntil: null };
    let captured: any;
    const riderModel = {
      findOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(rider) })),
      findOneAndUpdate: jest.fn((_q: any, update: any) => {
        captured = update.$set;
        return { exec: jest.fn().mockResolvedValue({ ...rider, ...update.$set }) };
      }),
    };
    const service = makeService(riderModel);
    await service.upgradeMyPlan('u1');
    expect(captured.plan).toBe('premium');
    const days = (new Date(captured.premiumUntil).getTime() - Date.now()) / (24 * 3600 * 1000);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it('extends from current expiry (does not stack a fresh 30 days onto now) when already premium', async () => {
    const futureExpiry = new Date(Date.now() + 10 * 24 * 3600 * 1000); // 10 days left
    const rider = { userId: 'u1', isApproved: true, plan: 'premium', premiumUntil: futureExpiry };
    let captured: any;
    const riderModel = {
      findOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(rider) })),
      findOneAndUpdate: jest.fn((_q: any, update: any) => {
        captured = update.$set;
        return { exec: jest.fn().mockResolvedValue({ ...rider, ...update.$set }) };
      }),
    };
    const service = makeService(riderModel);
    await service.upgradeMyPlan('u1');
    // 10 days remaining + 30 new = ~40 days from now.
    const days = (new Date(captured.premiumUntil).getTime() - Date.now()) / (24 * 3600 * 1000);
    expect(days).toBeGreaterThan(39.9);
    expect(days).toBeLessThan(40.1);
  });

  it('admin can revoke to standard and clears premiumUntil', async () => {
    let captured: any;
    const riderModel = {
      findOneAndUpdate: jest.fn((_q: any, update: any) => {
        captured = update.$set;
        return { exec: jest.fn().mockResolvedValue({ userId: 'u1', ...update.$set }) };
      }),
    };
    const service = makeService(riderModel);
    await service.adminSetPlan('rid1', 'standard');
    expect(captured.plan).toBe('standard');
    expect(captured.premiumUntil).toBeNull();
  });
});
