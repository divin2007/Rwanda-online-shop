const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/market_rwanda';

async function scrubDatabase() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db();

    const UNSPLASH_PRODUCT = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600&h=400";
    const UNSPLASH_PACKAGE = "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=400&h=400";

    // 1. Scrub Products
    const products = db.collection('products');
    const productResult = await products.updateMany(
      { images: { $regex: /placehold\.co/ } },
      [
        {
          $set: {
            images: {
              $map: {
                input: "$images",
                as: "img",
                in: {
                  $cond: {
                    if: { $regexMatch: { input: "$$img", regex: /placehold\.co/ } },
                    then: UNSPLASH_PRODUCT,
                    else: "$$img"
                  }
                }
              }
            }
          }
        }
      ]
    );
    console.log(`Updated ${productResult.modifiedCount} products.`);

    // 2. Scrub Deliveries
    const deliveries = db.collection('deliveries');
    const deliveryResult = await deliveries.updateMany(
      { "pickup.photoUrl": { $regex: /placehold\.co|fakeimg\.pl/ } },
      { $set: { "pickup.photoUrl": UNSPLASH_PACKAGE } }
    );
    console.log(`Updated ${deliveryResult.modifiedCount} deliveries.`);

  } catch (err) {
    console.error('Scrubbing failed:', err);
  } finally {
    await client.close();
    process.exit(0);
  }
}

scrubDatabase();
