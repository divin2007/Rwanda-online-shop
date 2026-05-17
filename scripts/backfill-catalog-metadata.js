const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/rmf';
const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : 5000;

const categoryRules = [
  { id: 'grocery', label: 'Fresh Produce & Groceries', productType: 'fresh_food', defaultUnit: 'kg', aliases: ['grocery', 'groceries', 'produce', 'fresh produce', 'food', 'dairy', 'spices', 'vegetables', 'fruit'] },
  { id: 'fashion', label: 'Fashion & Apparel', productType: 'apparel', defaultUnit: 'pcs', aliases: ['fashion', 'apparel', 'clothing', 'clothes', 'textiles', 'kitenge', 'fabric'] },
  { id: 'handicrafts', label: 'Handicrafts', productType: 'artisan_good', defaultUnit: 'pcs', aliases: ['handicrafts', 'crafts', 'artisan', 'art', 'basket', 'agaseke', 'imigongo'] },
  { id: 'home', label: 'Home & Interior', productType: 'home_good', defaultUnit: 'pcs', aliases: ['home', 'household', 'interior', 'decor', 'kitchen'] },
  { id: 'electronics', label: 'Electronics', productType: 'electronics', defaultUnit: 'pcs', aliases: ['electronics', 'phone', 'accessories', 'charger', 'device'] },
  { id: 'other', label: 'Other', productType: 'other', defaultUnit: 'pcs', aliases: ['other', 'general', 'misc'] },
];

function resolveCategory(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return categoryRules.find(category =>
    category.id === normalized ||
    category.productType === normalized ||
    category.aliases.some(alias => alias === normalized || normalized.includes(alias))
  ) || categoryRules[categoryRules.length - 1];
}

async function main() {
  await mongoose.connect(mongoUri);
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false, collection: 'products' }));

  const products = await Product.find({
    deletedAt: null,
    $or: [
      { categoryId: { $exists: false } },
      { categoryLabel: { $exists: false } },
      { productType: { $exists: false } },
      { priceUpdatedAt: { $exists: false } },
    ],
  }).limit(limit).lean();

  let updated = 0;
  for (const product of products) {
    const category = resolveCategory(product.categoryId || product.category);
    const update = {
      categoryId: category.id,
      categoryLabel: category.label,
      productType: category.productType,
      attributeSetVersion: product.attributeSetVersion || 1,
      unit: product.unit || category.defaultUnit,
      attributes: product.attributes || {},
      priceUpdatedAt: product.priceUpdatedAt || product.updatedAt || product.createdAt || new Date(),
    };

    console.log(`${dryRun ? '[dry-run]' : '[update]'} ${product._id} ${product.name}: ${product.category || 'unknown'} -> ${category.id}`);
    if (!dryRun) {
      await Product.updateOne(
        { _id: product._id },
        {
          $set: update,
          $push: { auditTrail: { action: 'catalog_backfilled', reason: 'taxonomy_migration_script', at: new Date() } },
        }
      );
      updated += 1;
    }
  }

  console.log(JSON.stringify({ dryRun, scanned: products.length, updated }, null, 2));
  await mongoose.disconnect();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
