import { Schema, model } from 'mongoose';
import { MarketType } from '@rmf/shared-types';
import { LocationSubdocument } from './location.schema';

export const marketSchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true }, // e.g. KIM
  type: { type: String, enum: Object.values(MarketType), required: true },
  ownerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: function(this: any) {
      return this.type === MarketType.INDIVIDUAL;
    }
  },
  description: { type: String },
  location: { type: LocationSubdocument, required: true },
  operatingHours: {
    open: { type: String, required: true }, // HH:mm
    close: { type: String, required: true },
    daysOpen: [{ type: String }] // ['Mon', 'Tue']
  },
  isActive: { type: Boolean, default: false },
  totalSellers: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

marketSchema.index({ 'location.coordinates': '2dsphere' });

export const Market = model('Market', marketSchema);
