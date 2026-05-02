import { Schema, model } from 'mongoose';
import { OrderStatus, PaymentStatus, DisputeResolution } from '@rmf/shared-types';

export const transactionSchema = new Schema({
  orderNumber: { type: String, required: true, unique: true },
  buyer: {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    deliveryAddress: {
      address: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
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
  product: {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true },
    weight: { type: Number }
  },
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
    method: { type: String, required: true }, // MoMo, etc.
    status: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING },
    transactionRef: { type: String },
    paidAt: { type: Date }
  },
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
    raisedAt: Date,
    resolvedAt: Date,
    resolution: { type: String, enum: Object.values(DisputeResolution) }
  },
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

export const Transaction = model('Transaction', transactionSchema);
