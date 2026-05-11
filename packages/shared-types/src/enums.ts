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
  AWAITING_QUOTE = 'awaiting_quote',
  QUOTE_SENT = 'quote_sent',
  PLACED = 'placed',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY_FOR_PICKUP = 'ready_for_pickup',
  CANCELLED = 'cancelled',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  AWAITING_CONFIRMATION = 'awaiting_confirmation',
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
  PENDING_HANDOVER = 'pending_handover',
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
export enum StockType {
  FINITE = 'finite',
  INFINITE = 'infinite',
  ON_DEMAND = 'on_demand'
}
