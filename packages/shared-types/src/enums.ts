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
  PARTIAL_REFUND = 'partial_refund',
  REDELIVER = 'redeliver',
  REJECT = 'reject'
}

// Reason a buyer raises a dispute. GENERAL is the backward-compatible default.
export enum DisputeType {
  GENERAL = 'general',
  QUALITY_MISMATCH = 'quality_mismatch',
  NOT_DELIVERED = 'not_delivered',
  WRONG_ITEM = 'wrong_item',
  OTHER = 'other'
}

// Rider subscription plan tier (premium unlocks person-pickup + priority dispatch).
export enum RiderPlan {
  STANDARD = 'standard',
  PREMIUM = 'premium'
}

// Market/seller premium sponsorship tier (drives search boost; capped + labelled per Rwanda Law n°011/2026).
export enum PremiumTier {
  NONE = 'none',
  BASIC = 'basic',
  STANDARD = 'standard',
  SPOTLIGHT = 'spotlight'
}

// Product condition grading (second-hand / refurbished marketplace transparency).
export enum ProductCondition {
  NEW = 'new',
  GRADE_A = 'grade_a',
  GRADE_B = 'grade_b',
  GRADE_C = 'grade_c',
  REFURBISHED = 'refurbished'
}
export enum StockType {
  FINITE = 'finite',
  INFINITE = 'infinite',
  ON_DEMAND = 'on_demand'
}

// ── Platform expansion enums (12-feature mission) ──────────────────

export enum SellerTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD'
}

export enum GroupBuyStatus {
  OPEN = 'open',
  LOCKED = 'locked',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed'
}

export enum LiveSessionStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  ENDED = 'ended'
}

export enum AffiliateStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  SUSPENDED = 'suspended'
}

export enum ErrandStatus {
  OPEN = 'open',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum BulkDeliveryStatus {
  SCHEDULED = 'scheduled',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum B2BBillingMethod {
  MOMO = 'MOMO',
  INVOICE = 'INVOICE'
}

export enum InvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled'
}

export enum CateringBriefStatus {
  OPEN = 'open',
  BIDDING = 'bidding',
  AWARDED = 'awarded',
  ACTIVE = 'active',
  EXPIRED = 'expired'
}

export enum ExportInquiryStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected'
}

export enum OrderSource {
  DIRECT = 'direct',
  LIVE_SESSION = 'live_session',
  GROUP_BUY = 'group_buy',
  REFERRAL = 'referral',
  B2B_RECURRING = 'b2b_recurring'
}
