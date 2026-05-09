const { MongoClient, ObjectId } = require('mongodb');

async function inspect() {
  const client = new MongoClient('mongodb://localhost:27017/market_rwanda');
  try {
    await client.connect();
    const db = client.db('market_rwanda');
    const order = await db.collection('transactions').findOne({ _id: new ObjectId('69ff8612b02d3989f215cd7c') });
    console.log('--- ORDER DATA ---');
    console.log(JSON.stringify(order, null, 2));
  } finally {
    await client.close();
  }
}

inspect();
