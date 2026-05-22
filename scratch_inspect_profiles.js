const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/rmf-platform';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');
  
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const SellerProfile = mongoose.model('SellerProfile', new mongoose.Schema({}, { strict: false }));
  
  const totalUsers = await User.countDocuments();
  const totalSellers = await SellerProfile.countDocuments();
  console.log(`Total Users: ${totalUsers}`);
  console.log(`Total Sellers: ${totalSellers}`);
  
  const sellers = await SellerProfile.find().limit(5);
  for (const s of sellers) {
    console.log('Seller:', s._id, 'stallName:', s.stallName, 'userId:', s.userId);
    const u = await User.findById(s.userId);
    console.log('  Associated User found?', u ? 'YES' : 'NO');
    if (u) {
      console.log('    User Role:', u.role, 'email:', u.email);
    } else {
      // Let's try searching user by string or object ID if it's stored differently
      const allUsers = await User.find().limit(5);
      console.log('    Sample Users in DB:');
      for (const usr of allUsers) {
        console.log('      User:', usr._id, 'role:', usr.role, 'email:', usr.email);
      }
    }
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
