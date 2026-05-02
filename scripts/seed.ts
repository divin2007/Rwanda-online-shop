import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { 
  User, 
  Market, 
  SellerProfile, 
  Product 
} from '../packages/database/src'; // Path adjusted for execution from root

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rmf_seed';
  await mongoose.connect(uri);
  console.log('Connected to DB for seeding...');

  try {
    // 1. Create Admin User
    const adminPass = await bcrypt.hash('admin123', 10);
    const admin = await User.create({
      fullName: 'System Admin',
      email: 'admin@rmf.rw',
      phone: '+250780000000',
      passwordHash: adminPass,
      role: 'ADMIN',
      isVerified: true
    });

    // 2. Create Kimironko Market
    const kimironko = await Market.create({
      name: 'Kimironko Market',
      slug: 'kimironko',
      code: 'KIM',
      type: 'public',
      description: 'The largest public market in Kigali',
      location: {
        type: 'Point',
        coordinates: [30.1265, -1.9365],
        address: 'KG 194 St',
        city: 'Kigali'
      },
      operatingHours: { open: '06:00', close: '18:00', daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      isActive: true
    });

    // 3. Create Sample Seller
    const sellerPass = await bcrypt.hash('seller123', 10);
    const sellerUser = await User.create({
      fullName: 'Alice Umutesi',
      email: 'alice@seller.rmf.rw',
      phone: '+250780000001',
      passwordHash: sellerPass,
      role: 'SELLER',
      isVerified: true
    });

    const seller = await SellerProfile.create({
      userId: sellerUser._id,
      marketId: kimironko._id,
      stallId: 'KIM-047',
      stallName: 'Alice Fresh Produce',
      isApproved: true,
      rating: 4.8,
      totalSales: 154
    });

    // 4. Create Products
    await Product.create({
      sellerId: seller._id,
      marketId: kimironko._id,
      name: 'Fresh Tomatoes',
      category: 'Vegetables',
      price: 1200,
      unit: 'kg',
      stockQuantity: 50,
      images: ['https://example.com/tomato.jpg'],
      isApproved: true
    });

    await Product.create({
      sellerId: seller._id,
      marketId: kimironko._id,
      name: 'Irish Potatoes',
      category: 'Vegetables',
      price: 450,
      unit: 'kg',
      stockQuantity: 200,
      images: ['https://example.com/potato.jpg'],
      isApproved: true
    });

    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Seed error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
