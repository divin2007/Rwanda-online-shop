import { Schema, model } from 'mongoose';

export const payoutRequestSchema = new Schema({
  userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role:         { type: String, enum: ['SELLER', 'RIDER'], required: true },
  amount:       { type: Number, required: true },          // integer RWF, no decimals
  momoNumber:   { type: String, required: true },           // destination phone for cashout
  status:       { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
  paypackRef:   { type: String, default: null },            // PayPack transaction ref on success
  failureReason:{ type: String, default: null },            // reason string on failure
  requestedAt:  { type: Date, default: () => new Date() },
  settledAt:    { type: Date, default: null },
  // Legacy fields kept for backward compat
  method:       { type: String, default: 'momo' },
  recipientPhone: { type: String },
  gatewayRef:   { type: String },
  processedAt:  { type: Date },
  deletedAt:    { type: Date, default: null },
}, { timestamps: true });

export const PayoutRequest = model('PayoutRequest', payoutRequestSchema);
