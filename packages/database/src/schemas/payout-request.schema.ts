import { Schema, model } from 'mongoose';

export const payoutRequestSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  method: { type: String, required: true }, // MoMo, Bank
  recipientPhone: { type: String, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  gatewayRef: String,
  processedAt: Date,
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

export const PayoutRequest = model('PayoutRequest', payoutRequestSchema);
