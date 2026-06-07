import mongoose, { Schema, model } from 'mongoose';

// A seller's bid on a catering brief. Bids are visible only to the brief owner.
export const cateringBidSchema = new Schema({
  briefId: { type: Schema.Types.ObjectId, ref: 'CateringBrief', required: true },
  sellerId: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
  sellerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  proposedMenu: [{
    dayOfWeek: { type: Number },
    mealName: { type: String },
    description: { type: String },
    dietaryTags: [{ type: String }]
  }],
  pricePerMeal: { type: Number, required: true },
  totalWeeklyPrice: { type: Number },
  notes: { type: String },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  submittedAt: { type: Date, default: Date.now },
  respondedAt: { type: Date },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

cateringBidSchema.index({ briefId: 1, status: 1 });
cateringBidSchema.index({ sellerId: 1, status: 1 });

export const CateringBid = mongoose.models.CateringBid || model('CateringBid', cateringBidSchema);
