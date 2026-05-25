jest.mock('@rmf/shared-utils', () => ({
  StateConflictError: class StateConflictError extends Error {},
}));
jest.mock('./payment.service', () => ({
  PaymentService: class PaymentService {},
}));

import { OrderService } from './order.service';

describe('OrderService catalog snapshots', () => {
  it('freezes product and variant details on order lines', async () => {
    const productId = '507f1f77bcf86cd799439011';
    const product = {
      _id: productId,
      name: 'Kitenge Wrap',
      price: 12000,
      unit: 'pcs',
      category: 'fashion',
      categoryId: 'fashion',
      images: ['base.jpg'],
      attributes: { material: 'Kitenge' },
      priceUpdatedAt: new Date('2026-05-01T08:00:00Z'),
      variants: [{
        _id: 'variant-1',
        sku: 'KIT-M-RED',
        title: 'Medium / Red',
        price: 15000,
        unit: 'pcs',
        images: ['variant.jpg'],
        attributes: { size: 'M', color: 'red' },
      }],
    };
    const productModel = {
      find: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([product]),
      })),
    };
    const service = new OrderService(
      {} as any,
      {} as any,
      {} as any,
      productModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    const [line] = await (service as any).snapshotOrderProducts([{ productId, quantity: 2, variantId: 'variant-1' }]);

    expect(line.name).toBe('Kitenge Wrap');
    expect(line.unitPrice).toBe(27000);
    expect(line.imageUrl).toBe('variant.jpg');
    expect(line.variantTitle).toBe('Medium / Red');
    expect(line.sellerSku).toBe('KIT-M-RED');
    expect(line.attributes).toEqual({ size: 'M', color: 'red' });
    expect(line.priceSnapshotAt).toEqual(product.priceUpdatedAt);
  });
});
