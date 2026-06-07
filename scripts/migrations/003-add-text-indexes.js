/**
 * Migration 003 — Create $text + Phase 3 search/filter indexes
 *
 * Backs the dedicated GET /markets/search and GET /products/search endpoints, plus
 * the product condition filter and the market premium-tier ordering.
 *
 * In dev, autoIndex:true in connectDatabase() creates these on startup. In production
 * autoIndex should be off, so this script must be run manually before/after deploy.
 *
 * Index creation in MongoDB is idempotent for identical key+options. NOTE: a collection
 * may only have ONE $text index. If a different text index already exists, drop it first
 * (this script attempts to detect and skip a conflicting text index rather than fail hard).
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/migrations/003-add-text-indexes.js
 */
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || process.env.MONGO_URL || process.env.DATABASE_URL;

async function ensureTextIndex(collection, key, options) {
  try {
    await collection.createIndex(key, options);
    console.log(`  ${collection.collectionName}: text index "${options.name}" ensured.`);
  } catch (error) {
    // 85 = IndexOptionsConflict, 86 = IndexKeySpecsConflict. A pre-existing text index with
    // a different spec must be dropped manually — surface it but do not abort the whole run.
    if (error.code === 85 || error.code === 86) {
      console.warn(`  ${collection.collectionName}: a conflicting text index already exists. ` +
        `Drop it manually and re-run if you need the Phase 3 weighting. (${error.codeName})`);
    } else {
      throw error;
    }
  }
}

async function run() {
  if (!uri) {
    console.error('MONGODB_URI is not set. Refusing to run migration without an explicit connection string.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');
  const db = mongoose.connection.db;

  // Markets — full-text search + premium ordering.
  const markets = db.collection('markets');
  await ensureTextIndex(
    markets,
    { name: 'text', description: 'text' },
    { weights: { name: 10, description: 1 }, default_language: 'english', name: 'market_text_search' },
  );
  await markets.createIndex({ premiumTier: 1, spotlightScore: -1 });
  console.log('Market indexes ensured.');

  // Products — full-text search + condition filter.
  const products = db.collection('products');
  await ensureTextIndex(
    products,
    { name: 'text', description: 'text', category: 'text' },
    { weights: { name: 10, category: 5, description: 1 }, default_language: 'english', name: 'product_text_search' },
  );
  await products.createIndex({ condition: 1 });
  console.log('Product indexes ensured.');

  console.log('Migration 003 complete.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (error) => {
  console.error('Migration 003 failed:', error);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
