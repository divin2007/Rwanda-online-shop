const mongoose = require('mongoose');
const http = require('http');
const crypto = require('crypto');

// MongoDB URI from .env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/market_rwanda';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

function base64url(buf) {
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const part1 = base64url(Buffer.from(JSON.stringify(header)));
  const part2 = base64url(Buffer.from(JSON.stringify(payload)));
  const signature = crypto.createHmac('sha256', secret)
    .update(part1 + '.' + part2)
    .digest();
  const part3 = base64url(signature);
  return part1 + '.' + part2 + '.' + part3;
}

const request = (options, body = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data
          });
        }
      });
    });
    
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');

  // Define minimal models for looking up data
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const SellerProfile = mongoose.model('SellerProfile', new mongoose.Schema({}, { strict: false }));
  const Market = mongoose.model('Market', new mongoose.Schema({}, { strict: false }));
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));

  // Find the single seller user
  const user = await User.findOne({ role: 'SELLER' });
  if (!user) {
    console.error('❌ No user with role SELLER found!');
    await mongoose.disconnect();
    return;
  }

  const userId = user._id;
  console.log(`Found SELLER User: ${user.email} (ID: ${userId})`);

  // Grab any market
  const market = await Market.findOne();
  const marketId = market ? market._id : new mongoose.Types.ObjectId();

  // Find or create SellerProfile for this user
  let sellerProfile = await SellerProfile.findOne({ userId });
  if (!sellerProfile) {
    console.log('SellerProfile not found for user. Creating a temporary one...');
    sellerProfile = await SellerProfile.create({
      userId,
      marketId,
      stallName: 'Test Musana Stall',
      shopDetails: { name: 'Musana Shop' },
      deletedAt: null
    });
    console.log('SellerProfile created:', sellerProfile._id);
  } else {
    console.log('Using existing SellerProfile:', sellerProfile._id);
  }

  // Sign JWT token for the seller
  const payload = {
    sub: userId.toString(),
    email: user.email,
    role: 'SELLER'
  };
  const token = signJwt(payload, JWT_SECRET);
  console.log('JWT Token signed successfully!');

  // Test 1: Try creating a product under a branch category (e.g. 'cosmetics-babies' or 'cosmetics')
  console.log('\n--- Test 1: Try creating product under a BRANCH category ("cosmetics-babies") ---');
  const branchProductData = {
    name: 'Invalid Test Baby Soap',
    description: 'This should fail because cosmetics-babies is a parent/branch category.',
    price: 1500,
    category: 'cosmetics-babies',
    unit: 'pcs',
    stockType: 'finite',
    stockQuantity: 10,
    images: ['https://images.unsplash.com/photo-1542838132-92c53300491e']
  };

  const createOptions = {
    hostname: 'localhost',
    port: 3003,
    path: '/api/v1/products',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };

  let res = await request(createOptions, branchProductData);
  console.log('Status Code:', res.statusCode);
  console.log('Response:', JSON.stringify(res.body, null, 2));

  if (res.statusCode === 400 && res.body?.message?.includes('Cannot assign product to branch category')) {
    console.log('✅ Success: Properly blocked product creation under branch category with clean 400 Bad Request!');
  } else {
    console.log('❌ Failure: Branch category node creation check did not return expected validation error.');
  }

  // Test 2: Try creating a product under a leaf category (e.g. 'cosmetics-baby-skincare')
  console.log('\n--- Test 2: Try creating product under a LEAF category ("cosmetics-baby-skincare") ---');
  const leafProductData = {
    name: 'Organic Shea Baby Soap',
    description: 'Premium organic shea butter soap formulated specifically for infant skin.',
    price: 3500,
    category: 'cosmetics-baby-skincare',
    unit: 'pcs',
    stockType: 'finite',
    stockQuantity: 50,
    images: ['https://images.unsplash.com/photo-1542838132-92c53300491e'],
    attributes: {
      organic: true,
      hypoallergenic: true,
      skinType: 'Sensitive Skin'
    }
  };

  res = await request(createOptions, leafProductData);
  console.log('Status Code:', res.statusCode);
  console.log('Response:', JSON.stringify(res.body, null, 2));

  let createdProduct = null;
  if (res.statusCode === 201 && res.body?.success) {
    createdProduct = res.body.data;
    console.log('✅ Success: Properly created product under leaf category ("cosmetics-baby-skincare")!');
  } else {
    console.log('❌ Failure: Product creation under leaf category failed.');
    await mongoose.disconnect();
    return;
  }

  // Test 3: Verify recursive query filter resolves products in descendant categories
  console.log('\n--- Test 3: Search products under parent ancestor category ("cosmetics") ---');
  const searchOptions = {
    hostname: 'localhost',
    port: 3003,
    path: '/api/v1/products?categoryId=cosmetics',
    method: 'GET'
  };

  res = await request(searchOptions);
  console.log('Status Code:', res.statusCode);
  
  if (res.statusCode === 200 && res.body?.success) {
    const productsList = res.body.data;
    const found = productsList.find(p => p._id === createdProduct._id);
    if (found) {
      console.log(`✅ Success: Query by "cosmetics" recursively returned product "Organic Shea Baby Soap" (ID: ${createdProduct._id})!`);
    } else {
      console.log('❌ Failure: Created product was not resolved under root category search.');
    }
  } else {
    console.log('❌ Failure: Product list query returned error status:', res.statusCode);
  }

  // Cleanup: Delete the test product
  if (createdProduct) {
    console.log('\nCleaning up test product...');
    await Product.deleteOne({ _id: createdProduct._id });
    console.log('Cleanup complete!');
  }

  await mongoose.disconnect();
}

main().catch(console.error);
