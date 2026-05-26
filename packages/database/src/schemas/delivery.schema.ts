import mongoose, { Schema, model } from 'mongoose';
import { DeliveryStatus } from '@rmf/shared-types';

export const deliverySchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true, unique: true },
  orderNumber: { type: String, required: true },
  rider: {
    riderId: { type: Schema.Types.ObjectId, ref: 'RiderProfile' },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    fullName: { type: String },
    phone: { type: String },
    plateNumber: { type: String }
  },
  pickup: {
    marketId: { type: Schema.Types.ObjectId, ref: 'Market', required: true },
    stallId: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    qrScannedAt: Date,
    qrVerifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    qrPayload: String,
    pickupPhotoUrl: String, // Required before QR scan
    sellerConfirmed: { type: Boolean, default: false },
    riderConfirmed: { type: Boolean, default: false }
  },
  dropoff: {
    address: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    deliveredAt: Date
  },
  route: {
    distanceKm: { type: Number },
    estimatedMinutes: { type: Number },
    actualMinutes: Number,
    geometry: [[Number]] // Array of [lat, lng] pairs
  },
  financials: {
    deliveryFee: { type: Number, default: 500 },
    baseDeliveryFee: { type: Number, default: 500 },
    searchSurcharge: { type: Number, default: 0 },
    totalAmount: { type: Number }
  },
  dispatch: {
    strategy: { type: String, default: 'PROGRESSIVE_RADIUS' },
    initialRadiusMeters: { type: Number, default: null },
    currentRadiusMeters: { type: Number, default: null },
    nextRadiusMeters: { type: Number, default: null },
    stepMeters: { type: Number, default: null },
    maxRadiusMeters: { type: Number, default: null },
    broadcastCount: { type: Number, default: 0 },
    manualRebroadcastCount: { type: Number, default: 0 },
    notifiedRiderIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    lastBroadcastAt: Date,
    manualRebroadcastAt: Date,
    acceptedAt: Date
  },
  tracking: [{
    lat: Number,
    lng: Number,
    recordedAt: Date
  }],
  status: { type: String, enum: Object.values(DeliveryStatus), default: DeliveryStatus.ASSIGNED },
  notes: { type: String },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

export const Delivery = mongoose.models.Delivery || model('Delivery', deliverySchema);
