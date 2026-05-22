"use strict";
const mongoose = require('mongoose');
const { existsSync, readFileSync } = require('fs');
const { resolve } = require('path');

// Load env from root
const envPath = resolve(__dirname, '../../../.env');
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8');
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

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/market_rwanda';

async function seed() {
  console.log('🚀 Starting Institutional Seeding for RMF Network...');
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to Deployment Database');

    console.log('🧹 Wiping existing database first...');
    await mongoose.connection.dropDatabase();
    console.log('✅ Database cleared completely');

    const marketSchema = new mongoose.Schema({
      name: String,
      slug: String,
      code: String,
      type: String,
      description: String,
      imageUrl: String,
      location: {
        type: { type: String, default: 'Point' },
        coordinates: [Number],
        address: String
      },
      operatingHours: {
        open: String,
        close: String,
        daysOpen: [String]
      },
      isActive: { type: Boolean, default: true },
      totalSellers: Number
    }, { timestamps: true });

    const productSchema = new mongoose.Schema({
      name: String,
      slug: String,
      description: String,
      price: Number,
      category: String,
      marketId: mongoose.Schema.Types.ObjectId,
      sellerId: mongoose.Schema.Types.ObjectId,
      images: [String],
      stockType: String,
      stockQuantity: Number,
      unit: String,
      isApproved: { type: Boolean, default: true },
      isActive: { type: Boolean, default: true },
      isMadeInRwanda: { type: Boolean, default: true }
    }, { timestamps: true });

    const Market = mongoose.models.Market || mongoose.model('Market', marketSchema);
    const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

    const marketsData = [
      { name: 'Kimironko Elite Hub', code: 'KIM', slug: 'kimironko-elite', type: 'public', description: 'The premier artisanal hub of Kigali, specializing in textiles and fresh produce.', image: 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e', lat: -1.935, lng: 30.125 },
      { name: 'Nyabugogo Logistics Terminal', code: 'NYA', slug: 'nyabugogo-terminal', type: 'public', description: 'Central logistics node for regional trade and bulk commodities.', image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9', lat: -1.942, lng: 30.051 },
      { name: 'Nyamirambo Cultural Market', code: 'NYM', slug: 'nyamirambo-cultural', type: 'public', description: 'Rich heritage artifacts and traditional Rwandan handcrafts.', image: 'https://images.unsplash.com/photo-1605371924599-2d0365da1ae0', lat: -1.965, lng: 30.055 },
      { name: 'Kigali Heights Artisanal', code: 'KGH', slug: 'kigali-heights', type: 'public', description: 'Upscale facilitator hub for premium Made in Rwanda goods.', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8', lat: -1.951, lng: 30.091 },
      { name: 'Musanze Regional Hub', code: 'MUS', slug: 'musanze-hub', type: 'public', description: 'Primary gateway for volcanic-soil produce and highland artifacts.', image: 'https://images.unsplash.com/photo-1506484334402-40f2fc958f6d', lat: -1.507, lng: 29.633 },
      { name: 'Rubavu Border Trade Center', code: 'RUB', slug: 'rubavu-border', type: 'public', description: 'International facilitator terminal for cross-border commerce.', image: 'https://images.unsplash.com/photo-1531058240690-006c446962d8', lat: -1.696, lng: 29.261 },
      { name: 'Huye Knowledge Market', code: 'HUY', slug: 'huye-market', type: 'public', description: 'Academic and artisanal intersection specializing in traditional weaving.', image: 'https://images.unsplash.com/photo-1516594708146-07c5171b9c8a', lat: -2.597, lng: 29.740 },
      { name: 'Rwamagana Agri Terminal', code: 'RWA', slug: 'rwamagana-agri', type: 'public', description: 'Strategic agricultural hub for Eastern Province distribution.', image: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399', lat: -1.949, lng: 30.435 },
      { name: 'Gicumbi Highland Hub', code: 'GIC', slug: 'gicumbi-highland', type: 'public', description: 'Specialized node for high-altitude dairy and organic spices.', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854', lat: -1.594, lng: 30.061 },
      { name: 'Muhanga Central Facilitation', code: 'MUH', slug: 'muhanga-central', type: 'public', description: 'Geographic center node for inter-provincial trade logistics.', image: 'https://images.unsplash.com/photo-1495570689269-d883b1224443', lat: -2.077, lng: 29.756 }
    ];

    const categories = ['Produce', 'Handcrafts', 'Textiles', 'Spices', 'Dairy', 'Artisan', 'Household'];

    function idx() { return Math.floor(Math.random() * 100); }

    for (const m of marketsData) {
      console.log(`📡 Deploying Hub: ${m.name}`);
      
      const market = await Market.findOneAndUpdate(
        { code: m.code },
        {
          name: m.name,
          slug: m.slug,
          code: m.code,
          type: m.type,
          description: m.description,
          imageUrl: m.image,
          location: {
            type: 'Point',
            coordinates: [m.lng, m.lat],
            address: `${m.name}, Rwanda`
          },
          operatingHours: {
            open: '07:00',
            close: '19:00',
            daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          },
          totalSellers: Math.floor(Math.random() * 100) + 50
        },
        { upsert: true, new: true }
      );

      for (let i = 1; i <= 5; i++) {
        const cat = categories[(idx() + i) % categories.length];
        const prodName = `${m.name.split(' ')[0]} ${cat} Item #${i}`;
        await Product.findOneAndUpdate(
          { slug: `${market.slug}-item-${i}` },
          {
            name: prodName,
            slug: `${market.slug}-item-${i}`,
            description: `Premium ${cat} sourced from the ${market.name}. Verified Made in Rwanda.`,
            price: (Math.floor(Math.random() * 20) + 1) * 1000,
            category: cat,
            marketId: market._id,
            images: [m.image],
            stockType: 'infinite',
            stockQuantity: 999,
            unit: i % 2 === 0 ? 'kg' : 'pcs',
            isApproved: true,
            isActive: true,
            isMadeInRwanda: true
          },
          { upsert: true }
        );
      }
    }

    console.log('✅ Institutional Deployment Complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Deployment Failed:', err);
    process.exit(1);
  }
}

seed();