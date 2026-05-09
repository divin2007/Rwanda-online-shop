import { Schema, model } from 'mongoose';

// Immutable Double-entry accounting ledger
export const ledgerEntrySchema = new Schema({
  ledgerId: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
  type: { type: String, enum: ['debit', 'credit'], required: true },
  account: { type: String, required: true }, // e.g. 'company_commission', 'rider_wallet', 'seller_wallet'
  amount: { type: Number, required: true },
  currency: { type: String, default: 'RWF' },
  description: { type: String, required: true },
  balanceAfter: { type: Number, required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const LedgerEntry = model('LedgerEntry', ledgerEntrySchema);
