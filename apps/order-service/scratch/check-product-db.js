const mongoose = require('mongoose');

async function checkProduct() {
  await mongoose.connect('mongodb://localhost:27017/rwanda-market');
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
  
  const product = await Product.findOne({ name: /Nike J1 low/i }).lean().exec();
  console.log('Product Details:');
  console.log(JSON.stringify(product, null, 2));
  
  await mongoose.disconnect();
}

checkProduct().catch(console.error);
