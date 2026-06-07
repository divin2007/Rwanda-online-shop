import mongoose, { Schema, model } from 'mongoose';
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
  imageUrl: { type: String }, // Display image URL
  location: { type: LocationSubdocument, required: true },
  operatingHours: {
    open: { type: String, required: true }, // HH:mm
    close: { type: String, required: true },
    daysOpen: [{ type: String }] // ['Mon', 'Tue']
  },
  isActive: { type: Boolean, default: true },
  rating: { type: Number, default: 0 },
  totalSellers: { type: Number, default: 0 },
  // Premium sponsorship (Phase 3). Sponsored markets get a search boost but are capped
  // and labelled per Rwanda Law n°011/2026. premiumTier 'none' = organic only.
  isPremium: { type: Boolean, default: false },
  premiumTier: { type: String, enum: ['none', 'basic', 'standard', 'spotlight'], default: 'none' },
  premiumUntil: { type: Date, default: null },
  spotlightScore: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

marketSchema.index({ 'location.coordinates': '2dsphere' });
// Full-text search ranking (name weighted highest). Used by GET /markets/search.
marketSchema.index(
  { name: 'text', description: 'text' },
  { weights: { name: 10, description: 1 }, default_language: 'english', name: 'market_text_search' },
);
// Premium-tier filtering and spotlight ordering.
marketSchema.index({ premiumTier: 1, spotlightScore: -1 });

export const Market = mongoose.models.Market || model('Market', marketSchema);
