import { Schema, model } from 'mongoose';

// IMPORTANT: This schema is strictly immutable. No updatedAt.
export const auditLogSchema = new Schema({
  service: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId, required: true },
  action: { type: String, required: true },
  performedBy: {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    role: String,
    ip: String,
    userAgent: String
  },
  changes: {
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed
  },
  metadata: Schema.Types.Mixed
}, { 
  timestamps: { createdAt: true, updatedAt: false },
  capped: { size: 1024 * 1024 * 500 } // 500MB capped collection to prevent runaway size
});

export const AuditLog = model('AuditLog', auditLogSchema);
