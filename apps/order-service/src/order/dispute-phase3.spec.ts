jest.mock('@rmf/shared-utils', () => ({
  StateConflictError: class StateConflictError extends Error {},
}));
jest.mock('./payment.service', () => ({
  PaymentService: class PaymentService {},
}));

import { OrderService } from './order.service';
import { DisputeResolution, DisputeType, OrderStatus } from '@rmf/shared-types';

function buildOrderModel(order: any) {
  const updates: any[] = [];
  const model: any = {
    _updates: updates,
    findById: jest.fn().mockResolvedValue(order),
    findByIdAndUpdate: jest.fn((id: string, update: any) => {
      updates.push(update);
      return { exec: jest.fn().mockResolvedValue({ ...order, ...update.$set }) };
    }),
  };
  return model;
}

function makeService(orderModel: any, buyerProtection: any) {
  return new OrderService(
    orderModel as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    buyerProtection as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

describe('Phase 3 dispute window (7 days)', () => {
  const baseOrder = (deliveredAgoHours: number) => ({
    _id: '507f1f77bcf86cd799439011',
    status: OrderStatus.DELIVERED,
    financials: { totalAmount: 10000 },
    statusHistory: [
      { status: OrderStatus.DELIVERED, changedAt: new Date(Date.now() - deliveredAgoHours * 3600 * 1000) },
    ],
    dispute: {},
    settlement: {},
  });

  it('accepts a dispute raised 5 days after delivery', async () => {
    const order = baseOrder(5 * 24);
    const model = buildOrderModel(order);
    const service = makeService(model, {});
    (service as any).clearEscrowReleaseTimer = jest.fn();
    (service as any).validateTransition = jest.fn();

    const result = await service.raiseDispute(order._id, 'item damaged', [], DisputeType.QUALITY_MISMATCH);
    expect(result).toBeTruthy();
    const setOp = model._updates[0].$set;
    expect(setOp['dispute.type']).toBe(DisputeType.QUALITY_MISMATCH);
    expect(setOp['dispute.isDisputed']).toBe(true);
  });

  it('rejects a dispute raised 8 days after delivery', async () => {
    const order = baseOrder(8 * 24);
    const model = buildOrderModel(order);
    const service = makeService(model, {});
    (service as any).clearEscrowReleaseTimer = jest.fn();
    (service as any).validateTransition = jest.fn();

    await expect(
      service.raiseDispute(order._id, 'too late', [], DisputeType.GENERAL),
    ).rejects.toThrow(/7 days/);
  });

  it('defaults an unknown dispute type to GENERAL', async () => {
    const order = baseOrder(1);
    const model = buildOrderModel(order);
    const service = makeService(model, {});
    (service as any).clearEscrowReleaseTimer = jest.fn();
    (service as any).validateTransition = jest.fn();

    await service.raiseDispute(order._id, 'reason', [], 'bogus' as any);
    expect(model._updates[0].$set['dispute.type']).toBe(DisputeType.GENERAL);
  });
});

describe('Phase 3 partial refund math', () => {
  const baseOrder = () => ({
    _id: '507f1f77bcf86cd799439011',
    orderNumber: 'RMF-1',
    status: OrderStatus.DISPUTED,
    financials: { totalAmount: 10000 },
    buyer: { userId: '507f1f77bcf86cd799439012', phone: '250788000000' },
    dispute: { isDisputed: true },
    settlement: {},
  });

  it('refunds the server-computed percentage of the DB total', async () => {
    const order = baseOrder();
    const model = buildOrderModel(order);
    const refund = { executeInstantRefund: jest.fn().mockResolvedValue({ transactionRef: 'ref-1' }) };
    const service = makeService(model, refund);
    (service as any).validateTransition = jest.fn();
    (service as any).prepareEscrowRelease = jest.fn();

    await service.resolveDispute(order._id, DisputeResolution.PARTIAL_REFUND, 40);
    // 40% of 10000 = 4000, computed server-side.
    expect(refund.executeInstantRefund).toHaveBeenCalledWith(order, 4000, expect.any(String));
  });

  it('rejects an out-of-range partial refund percentage', async () => {
    const order = baseOrder();
    const model = buildOrderModel(order);
    const refund = { executeInstantRefund: jest.fn() };
    const service = makeService(model, refund);
    (service as any).validateTransition = jest.fn();

    await expect(
      service.resolveDispute(order._id, DisputeResolution.PARTIAL_REFUND, 0),
    ).rejects.toThrow(/between 1 and 100/);
    await expect(
      service.resolveDispute(order._id, DisputeResolution.PARTIAL_REFUND, 101),
    ).rejects.toThrow(/between 1 and 100/);
    expect(refund.executeInstantRefund).not.toHaveBeenCalled();
  });

  it('full refund returns the entire total', async () => {
    const order = baseOrder();
    const model = buildOrderModel(order);
    const refund = { executeInstantRefund: jest.fn().mockResolvedValue({ transactionRef: 'ref-2' }) };
    const service = makeService(model, refund);
    (service as any).validateTransition = jest.fn();
    (service as any).prepareEscrowRelease = jest.fn();

    await service.resolveDispute(order._id, DisputeResolution.REFUND);
    expect(refund.executeInstantRefund).toHaveBeenCalledWith(order, 10000, expect.any(String));
  });
});
