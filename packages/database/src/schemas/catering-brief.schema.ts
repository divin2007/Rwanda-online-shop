import mongoose, { Schema, model } from 'mongoose';

// An institution's catering request that sellers bid on. NOTE: this is the catering brief,
// distinct from contract.schema.ts (the seller Terms-of-Service contract — do not touch that).
export const cateringBriefSchema = new Schema({
  institutionId: { type: Schema.Types.ObjectId, ref: 'B2BAccount', required: true },
  buyerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  mealsPerWeek: { type: Number, required: true },
  dietaryRequirements: [{ type: String }],
  budgetPerMeal: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  deliveryAddress: {
    address: { type: String },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number }
    }
  },
  status: { type: String, enum: ['open', 'bidding', 'awarded', 'active', 'expired'], default: 'open' },
  awardedSellerId: { type: Schema.Types.ObjectId, ref: 'SellerProfile' },
  awardedBidId: { type: Schema.Types.ObjectId, ref: 'CateringBid' },
  awardedAt: { type: Date },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

cateringBriefSchema.index({ institutionId: 1, status: 1 });
cateringBriefSchema.index({ status: 1, createdAt: -1 });

export const CateringBrief = mongoose.models.CateringBrief || model('CateringBrief', cateringBriefSchema);
