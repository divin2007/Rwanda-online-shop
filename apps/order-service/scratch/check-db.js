const mongoose = require('mongoose');

async function checkOrders() {
  await mongoose.connect('mongodb://localhost:27017/rwanda-market');
  const Order = mongoose.model('Transaction', new mongoose.Schema({}, { strict: false }));
  
  const count = await Order.countDocuments();
  console.log(`Total orders in DB: ${count}`);
  
  const latest = await Order.find().sort({ createdAt: -1 }).limit(1).exec();
  if (latest.length > 0) {
    console.log('Latest order sample:');
    console.log(JSON.stringify(latest[0], null, 2));
  }
  
  await mongoose.disconnect();
}

checkOrders().catch(console.error);
