/**
 * Migration 002 — Create missing indexes
 *
 * Adds indexes that back the MTN MoMo callback lookup, settlement queries, and
 * the per-user ledger history, plus the unique constraint on ledger ids.
 * Index creation in MongoDB is idempotent: an index that already exists with the
 * same key + options is a no-op.
 *
 * NOTE: { ledgerId: 1 } is created UNIQUE. If duplicate ledgerId values already
 * exist this will fail — resolve duplicates first, then re-run.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/migrations/002-add-indexes.js
 */
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || process.env.MONGO_URL || process.env.DATABASE_URL;

async function run() {
  if (!uri) {
    console.error('MONGODB_URI is not set. Refusing to run migration without an explicit connection string.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');
  const db = mongoose.connection.db;

  // Transaction (order) collection.
  const transactions = db.collection('transactions');
  await transactions.createIndex({ 'payment.transactionRef': 1 });
  await transactions.createIndex({ 'settlement.status': 1 });
  await transactions.createIndex({ 'payment.status': 1, status: 1 });
  console.log('Transaction indexes ensured.');

  // LedgerEntry collection.
  const ledgerEntries = db.collection('ledgerentries');
  await ledgerEntries.createIndex({ userId: 1, createdAt: -1 });
  try {
    await ledgerEntries.createIndex({ ledgerId: 1 }, { unique: true });
    console.log('LedgerEntry unique ledgerId index ensured.');
  } catch (error) {
    console.error('Failed to create unique { ledgerId: 1 } index. Resolve duplicate ledgerId values, then re-run.');
    throw error;
  }
  console.log('LedgerEntry indexes ensured.');

  console.log('Migration 002 complete.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (error) => {
  console.error('Migration 002 failed:', error);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
