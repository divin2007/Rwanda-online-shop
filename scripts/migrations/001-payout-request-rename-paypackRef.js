/**
 * Migration 001 — Rename payoutrequests.paypackRef -> gatewayRef
 *
 * Part of the PayPack -> MTN MoMo migration. Copies any existing paypackRef value
 * into gatewayRef (without clobbering an already-populated gatewayRef) and removes
 * the legacy paypackRef field. Idempotent: re-running is a no-op once migrated.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/migrations/001-payout-request-rename-paypackRef.js
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

  const collection = mongoose.connection.db.collection('payoutrequests');

  // Step 1: copy paypackRef into gatewayRef where gatewayRef is missing/empty.
  const copyResult = await collection.updateMany(
    { paypackRef: { $exists: true, $ne: null }, $or: [{ gatewayRef: { $exists: false } }, { gatewayRef: null }] },
    [{ $set: { gatewayRef: '$paypackRef' } }],
  );
  console.log(`Copied paypackRef -> gatewayRef on ${copyResult.modifiedCount} document(s).`);

  // Step 2: drop the legacy field from every document that still has it.
  const unsetResult = await collection.updateMany(
    { paypackRef: { $exists: true } },
    { $unset: { paypackRef: '' } },
  );
  console.log(`Removed paypackRef from ${unsetResult.modifiedCount} document(s).`);

  console.log('Migration 001 complete.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (error) => {
  console.error('Migration 001 failed:', error);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
