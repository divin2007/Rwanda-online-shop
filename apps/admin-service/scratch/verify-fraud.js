const mongoose = require('mongoose');

async function verifyFraud() {
  await mongoose.connect('mongodb://localhost:27017/rwanda-market');
  const Order = mongoose.model('Transaction', new mongoose.Schema({}, { strict: false }));
  
  const flagged = await Order.find({ 
    'security.isFlagged': true,
    status: { $nin: ['delivered', 'cancelled', 'resolved'] }
  }).exec();
  
  console.log(`Found ${flagged.length} active fraud alerts in DB.`);
  if (flagged.length > 0) {
    console.log('Sample alert:');
    console.log(`Order: ${flagged[0].orderNumber}, Status: ${flagged[0].status}, Reason: ${flagged[0].security?.flagReason}`);
  }
  
  await mongoose.disconnect();
}

verifyFraud().catch(console.error);
