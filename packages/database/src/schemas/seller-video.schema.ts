import mongoose, { Schema, model } from 'mongoose';

const sellerVideoCommentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userRole: { type: String, enum: ['BUYER', 'SELLER', 'RIDER', 'ADMIN'], required: true },
  fullName: { type: String, trim: true },
  text: { type: String, required: true, trim: true, maxlength: 700 },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

export const sellerVideoSchema = new Schema({
  sellerId: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true, index: true },
  sellerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  marketId: { type: Schema.Types.ObjectId, ref: 'Market', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', index: true },
  variantSku: { type: String, default: null },
  placement: { type: String, enum: ['PRODUCT_AD', 'SHOP_AD', 'STORY'], default: 'PRODUCT_AD', index: true },
  categoryId: { type: String, default: null, index: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  caption: { type: String, trim: true, maxlength: 800 },
  videoUrl: { type: String, required: true, trim: true },
  thumbnailUrl: { type: String, trim: true },
  durationSeconds: { type: Number, min: 0, max: 600 },
  tags: [{ type: String, trim: true, lowercase: true, maxlength: 40 }],
  processingStatus: { type: String, enum: ['PENDING', 'READY', 'FAILED'], default: 'READY', index: true },
  moderationStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED'], default: 'APPROVED', index: true },
  moderationReason: { type: String, trim: true, maxlength: 500 },
  moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  moderatedAt: { type: Date },
  isActive: { type: Boolean, default: true, index: true },
  isArchived: { type: Boolean, default: false, index: true },
  viewCount: { type: Number, default: 0, min: 0 },
  likeUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  dislikeUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  likeCount: { type: Number, default: 0, min: 0 },
  dislikeCount: { type: Number, default: 0, min: 0 },
  commentCount: { type: Number, default: 0, min: 0 },
  comments: [sellerVideoCommentSchema],
  auditTrail: [{
    action: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    at: { type: Date, default: Date.now },
  }],
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });

sellerVideoSchema.index({ marketId: 1, isActive: 1, createdAt: -1 });
sellerVideoSchema.index({ sellerId: 1, isActive: 1, createdAt: -1 });
sellerVideoSchema.index({ productId: 1, isActive: 1, createdAt: -1 });
sellerVideoSchema.index(
  { sellerId: 1, placement: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { placement: 'SHOP_AD', isActive: true, deletedAt: null } }
);

export const SellerVideo = mongoose.models.SellerVideo || model('SellerVideo', sellerVideoSchema);
