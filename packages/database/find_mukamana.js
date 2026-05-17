const mongoose = require('mongoose');

async function main() {
  const uri = 'mongodb://127.0.0.1:27017/market_rwanda';
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const sellerId = '6a0975b0b72f7285694fd4fd';
    
    const profile = await db.collection('sellerprofiles').findOne({ _id: new mongoose.Types.ObjectId(sellerId) });
    console.log('\n--- Target Seller Profile ---');
    console.log(JSON.stringify(profile, null, 2));

    const profileByUserId = await db.collection('sellerprofiles').findOne({ userId: '6a097280f9afc0d3c0ffee65' });
    console.log('\n--- Seller Profile By User ID ---');
    console.log(JSON.stringify(profileByUserId, null, 2));
    
    const txs = await db.collection('transactions').find({
      $or: [
        { sellerId: sellerId },
        { sellerId: '6a097280f9afc0d3c0ffee65' },
        { 'seller._id': sellerId },
        { 'seller.userId': '6a097280f9afc0d3c0ffee65' },
        { 'buyer.userId': '6a097280f9afc0d3c0ffee65' }
      ]
    }).toArray();
    console.log('\n--- Matching Transactions ---');
    console.log(JSON.stringify(txs, null, 2));
    
  } catch (err) {
    console.error('Error querying MongoDB:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

main();
