import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from workspace root
function loadEnvFile(filePath: string) {
  if (existsSync(filePath)) {
    const content = readFileSync(filePath, 'utf-8');
    content.split(/\r?\n/).forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) return;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    });
  }
}

// Find workspace root and load environments
const searchDir = process.cwd();
loadEnvFile(join(searchDir, '.env'));
loadEnvFile(join(searchDir, '.env.local'));

import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { 
  User, 
  Market, 
  SellerProfile, 
  Product 
} from '../packages/database/src'; // Path adjusted for execution from root

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/market_rwanda';
  console.log(`[SEED] Connecting to database: ${uri}`);
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
