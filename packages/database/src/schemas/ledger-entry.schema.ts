import { Schema, model } from 'mongoose';

// Immutable accounting ledger. This records RMF accounting state only;
// real money movement must happen through the licensed payment provider.
export const ledgerEntrySchema = new Schema({
  ledgerId: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
  type: { type: String, enum: ['debit', 'credit'], required: true },
  account: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'RWF' },
  description: { type: String, required: true },
  balanceAfter: { type: Number, required: true },
  provider: { type: String },
  externalRef: { type: String },
  status: { type: String },
  metadata: { type: Schema.Types.Mixed }
}, { timestamps: { createdAt: true, updatedAt: false } });

ledgerEntrySchema.index({ transactionId: 1, account: 1, userId: 1 });
ledgerEntrySchema.index({ externalRef: 1 }, { sparse: true });

export const LedgerEntry = model('LedgerEntry', ledgerEntrySchema);
