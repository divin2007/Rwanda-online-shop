export enum UserRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  RIDER = 'RIDER',
  ADMIN = 'ADMIN'
}

export enum MarketType {
  PUBLIC = 'public',
  INDIVIDUAL = 'individual'
}

export enum PromotionType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount'
}

export enum OrderStatus {
  SCHEDULED = 'scheduled',
  PLACED = 'placed',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  DISPUTED = 'disputed',
  RESOLVED = 'resolved'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export enum DeliveryStatus {
  ASSIGNED = 'assigned',
  EN_ROUTE_TO_PICKUP = 'en_route_to_pickup',
  PICKED_UP = 'picked_up',
  EN_ROUTE_TO_DROPOFF = 'en_route_to_dropoff',
  DELIVERED = 'delivered',
  FAILED = 'failed'
}

export enum DisputeResolution {
  REFUND = 'refund',
  REDELIVER = 'redeliver',
  REJECT = 'reject'
}
