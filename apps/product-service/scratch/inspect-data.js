const { MongoClient, ObjectId } = require('mongodb');

async function inspect() {
  const client = new MongoClient('mongodb://localhost:27017/market_rwanda');
  try {
    await client.connect();
    const db = client.db('market_rwanda');
    const product = await db.collection('products').findOne({ category: 'bakery' });
    console.log('--- PRODUCT DATA ---');
    console.log(JSON.stringify(product, null, 2));
    
    if (product && product.sellerId) {
      const seller = await db.collection('sellerprofiles').findOne({ _id: product.sellerId });
      console.log('--- SELLER DATA ---');
      console.log(JSON.stringify(seller, null, 2));
    }
  } finally {
    await client.close();
  }
}

inspect();
