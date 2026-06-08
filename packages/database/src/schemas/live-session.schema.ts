import mongoose, { Schema, model } from 'mongoose';

// Live selling session. streamKey is a secret credential and MUST NEVER be returned
// to viewers — only to the session owner (seller). Enforce via select:false + service-level
// projection on viewer-facing endpoints.
export const liveSessionSchema = new Schema({
  sellerId: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
  sellerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  marketId: { type: Schema.Types.ObjectId, ref: 'Market', required: true },
  videoId: { type: Schema.Types.ObjectId, ref: 'SellerVideo' },
  // Secret. Never project to viewers.
  streamKey: { type: String, unique: true, sparse: true, select: false },
  playbackUrl: { type: String },
  status: { type: String, enum: ['scheduled', 'live', 'ended'], default: 'scheduled' },
  featuredProductIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  viewerCount: { type: Number, default: 0 },
  peakViewerCount: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  startedAt: { type: Date },
  endedAt: { type: Date },
  scheduledAt: { type: Date },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

liveSessionSchema.index({ sellerId: 1, status: 1 });
liveSessionSchema.index({ marketId: 1, status: 1 });
liveSessionSchema.index({ status: 1, startedAt: 1 });

export const LiveSession = mongoose.models.LiveSession || model('LiveSession', liveSessionSchema);
