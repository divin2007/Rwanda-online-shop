import mongoose, { Schema, model } from 'mongoose';
import { OrderStatus, PaymentStatus, DisputeResolution } from '@rmf/shared-types';

export const transactionSchema = new Schema({
  orderNumber: { type: String, required: true, unique: true },
  buyer: {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fullName: { type: String, required: true },
    phone: { type: String },
    nationalId: { type: String }, // For KYC Lite (high value orders)
    deliveryAddress: {
      address: { type: String },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number }
      }
    }
  },
  seller: {
    sellerId: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fullName: { type: String, required: true },
    stallId: { type: String, required: true },
    marketId: { type: Schema.Types.ObjectId, ref: 'Market', required: true }
  },
  products: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String },
    category: { type: String },
    categoryId: { type: String },
    imageUrl: { type: String },
    images: [{ type: String }],
    attributes: { type: Map, of: Schema.Types.Mixed },
    variantId: { type: String },
    variantTitle: { type: String },
    sellerSku: { type: String },
    priceSnapshotAt: { type: Date },
    weight: { type: Number },
    customization: { type: String },
    prototypeImage: { type: String }
  }],
  financials: {
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    platformCommission: { type: Number, required: true }, // floor of 100 RWF handled in logic
    gatewayFee: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    sellerPayout: { type: Number, required: true },
    riderPayout: { type: Number, required: true }
  },
  payment: {
    method: { type: String }, // MoMo, etc.
    status: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING },
    transactionRef: { type: String },
    errorMessage: { type: String },
    paidAt: { type: Date }
  },
  settlement: {
    status: { type: String, enum: ['pending', 'escrow_held', 'release_pending', 'partial', 'settled', 'refunded', 'failed'], default: 'pending' },
    sellerStatus: { type: String, enum: ['pending', 'paid', 'failed', 'skipped'], default: 'pending' },
    sellerPayoutRef: { type: String },
    sellerSettledAt: { type: Date },
    riderStatus: { type: String, enum: ['pending', 'pending_rider_assignment', 'paid', 'failed', 'skipped'], default: 'pending' },
    riderPayoutRef: { type: String },
    riderSettledAt: { type: Date },
    platformStatus: { type: String, enum: ['pending', 'paid', 'failed', 'skipped'], default: 'pending' },
    platformCommissionRef: { type: String },
    platformSettledAt: { type: Date },
    releaseAvailableAt: { type: Date },
    releaseTriggeredAt: { type: Date },
    payoutBlockedReason: { type: String },
    lastError: { type: String },
    updatedAt: { type: Date }
  },
  refund: {
    status: { type: String, enum: ['none', 'pending', 'refunded', 'failed'], default: 'none' },
    amount: { type: Number },
    transactionRef: { type: String },
    reason: { type: String },
    requestedAt: { type: Date },
    refundedAt: { type: Date },
    error: { type: String }
  },
  notes: { type: String },
  status: { type: String, enum: Object.values(OrderStatus), default: OrderStatus.PLACED },
  schedule: {
    frequency: String,
    day: String,
    nextRun: Date
  },
  deliveryId: { type: Schema.Types.ObjectId, ref: 'Delivery' },
  dispute: {
    isDisputed: { type: Boolean, default: false },
    reason: String,
    evidenceUrls: [{ type: String }],
    raisedAt: Date,
    resolvedAt: Date,
    adminNote: String,
    resolution: { type: String, enum: Object.values(DisputeResolution) }
  },
  attributes: { type: Map, of: String },
  hasBeenRated: { type: Boolean, default: false },
  messages: [{
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['BUYER', 'SELLER', 'RIDER', 'ADMIN'], required: true },
    channel: { type: String, enum: ['ORDER', 'DELIVERY', 'DISPUTE'], default: 'ORDER' },
    recipientRole: { type: String, enum: ['BUYER', 'SELLER', 'RIDER', 'ADMIN'] },
    content: { type: String, required: true },
    imageUrl: { type: String },
    type: { type: String, enum: ['TEXT', 'QUOTE', 'COUNTER_QUOTE'], default: 'TEXT' },
    quoteAmount: { type: Number },
    timestamp: { type: Date, default: Date.now }
  }],
  statusHistory: [{
    status: String,
    changedBy: Schema.Types.ObjectId,
    changedAt: Date,
    note: String
  }],
  paymentAttempts: [{
    method: String,
    transactionRef: String,
    status: String,
    attemptedAt: Date,
    failureReason: String
  }],
  security: {
    ipAddress: String,
    deviceInfo: String,
    isFlagged: { type: Boolean, default: false },
    flagReason: String,
    reviewedBy: Schema.Types.ObjectId,
    reviewedAt: Date
  },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

transactionSchema.index({ 'seller.sellerId': 1, createdAt: -1 });
transactionSchema.index({ 'seller.userId': 1, createdAt: -1 });
transactionSchema.index({ 'seller.marketId': 1, createdAt: -1 });
transactionSchema.index({ 'buyer.userId': 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ deletedAt: 1 });

export const Transaction = mongoose.models.Transaction || model('Transaction', transactionSchema);
