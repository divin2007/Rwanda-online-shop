const mongoose = require('mongoose');

async function seedSellers() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rmf-platform';
  await mongoose.connect(uri);
  
  const Seller = mongoose.model('SellerProfile', new mongoose.Schema({}, { strict: false }));
  
  await Seller.deleteMany({});
  console.log('Cleared existing sellers.');

  const sellers = [];
  for (let i = 1; i <= 125; i++) {
    sellers.push({
      userId: new mongoose.Types.ObjectId(),
      fullName: `Artisan ${i}`,
      shopName: `Shop ${i}`,
      isApproved: true,
      isActive: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  await Seller.insertMany(sellers);
  console.log(`Successfully seeded ${sellers.length} seller profiles.`);
  
  await mongoose.disconnect();
}

seedSellers().catch(console.error);
