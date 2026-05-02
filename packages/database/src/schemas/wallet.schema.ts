import { Schema, model } from 'mongoose';

export const walletSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balance: { type: Number, required: true, default: 0 },
  totalEarnings: { type: Number, required: true, default: 0 },
  totalWithdrawn: { type: Number, required: true, default: 0 }
}, { timestamps: true });

export const Wallet = model('Wallet', walletSchema);
