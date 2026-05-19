import mongoose, { Schema, model } from 'mongoose';

export const profileChangeRequestSchema = new Schema({
  targetType: { type: String, enum: ['SELLER', 'RIDER'], required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
  requestedChanges: { type: Schema.Types.Mixed, required: true },
  reviewNotes: { type: String },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  appliedAt: { type: Date },
  auditTrail: [{
    action: { type: String, required: true },
    actorId: { type: String },
    at: { type: Date, default: Date.now },
    note: { type: String }
  }]
}, { timestamps: true });

profileChangeRequestSchema.index({ targetType: 1, targetId: 1, status: 1, createdAt: -1 });
profileChangeRequestSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const ProfileChangeRequest = mongoose.models.ProfileChangeRequest || model('ProfileChangeRequest', profileChangeRequestSchema);
