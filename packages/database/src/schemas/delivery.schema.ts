import { Schema, model } from 'mongoose';
import { DeliveryStatus } from '@rmf/shared-types';

export const deliverySchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true, unique: true },
  rider: {
    riderId: { type: Schema.Types.ObjectId, ref: 'RiderProfile', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    plateNumber: { type: String, required: true }
  },
  pickup: {
    marketId: { type: Schema.Types.ObjectId, ref: 'Market', required: true },
    stallId: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    qrScannedAt: Date,
    pickupPhotoUrl: String // Required before QR scan
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
    distanceKm: { type: Number, required: true },
    estimatedMinutes: { type: Number, required: true },
    actualMinutes: Number
  },
  tracking: [{
    lat: Number,
    lng: Number,
    recordedAt: Date
  }],
  status: { type: String, enum: Object.values(DeliveryStatus), default: DeliveryStatus.ASSIGNED },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

export const Delivery = model('Delivery', deliverySchema);
