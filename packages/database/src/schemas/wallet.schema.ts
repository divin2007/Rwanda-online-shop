import { Schema, model } from 'mongoose';

export const walletSchema = new Schema({
  userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  role:             { type: String, enum: ['SELLER', 'RIDER'], required: true },
  currency:         { type: String, default: 'RWF' },
  // availableBalance: funds credited after delivery, ready for withdrawal
  availableBalance: { type: Number, required: true, default: 0 },
  // pendingBalance: funds locked in an in-flight withdrawal request
  pendingBalance:   { type: Number, required: true, default: 0 },
  totalEarned:      { type: Number, required: true, default: 0 },
  totalWithdrawn:   { type: Number, required: true, default: 0 },
  // Legacy field kept for migration compatibility
  balance:          { type: Number, default: 0 },
}, { timestamps: true });

export const Wallet = model('Wallet', walletSchema);
