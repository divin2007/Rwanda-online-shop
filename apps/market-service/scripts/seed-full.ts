import mongoose from 'mongoose';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import * as bcrypt from 'bcrypt';

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
  console.log('🚀 Starting Institutional Seeding for RMF Network with Advanced Variants & Taxonomy...');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🧹 Wiping existing database completely...');
    await mongoose.connection.dropDatabase();
    console.log('✅ Database dropped successfully');

    // Declare Schemas Inline for robust, path-independent script execution
    const userSchema = new mongoose.Schema({
      fullName: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      phone: { type: String, required: true, unique: true },
      passwordHash: { type: String, required: true },
      role: { type: String, required: true, default: 'BUYER' },
      isVerified: { type: Boolean, default: true },
      isActive: { type: Boolean, default: true },
      preferences: {
        language: { type: String, default: 'en' },
        currency: { type: String, default: 'RWF' },
        discovery: {
          categoryIds: [String],
          onboardingCompleted: { type: Boolean, default: true }
        }
      }
    }, { timestamps: true });

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

    const sellerProfileSchema = new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
      marketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Market', required: true },
      stallId: { type: String, required: true, unique: true },
      stallName: { type: String, required: true },
      description: String,
      shopDetails: {
        name: String,
        slug: String,
        code: String,
        description: String,
        operatingHours: {
          open: String,
          close: String,
          daysOpen: [String]
        },
        categories: [String]
      },
      isApproved: { type: Boolean, default: true },
      rating: { type: Number, default: 4.5 },
      totalSales: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 }
    }, { timestamps: true });

    const productSchema = new mongoose.Schema({
      sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
      marketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Market', required: true },
      name: { type: String, required: true },
      description: { type: String },
      category: { type: String, required: true },
      categoryId: { type: String, required: true },
      categoryLabel: { type: String, required: true },
      productType: { type: String, required: true },
      price: { type: Number, required: true },
      unit: { type: String, required: true },
      stockType: { type: String, default: 'finite' },
      stockQuantity: { type: Number, default: 0 },
      inStock: { type: Boolean, default: true },
      images: { type: [String], required: true },
      attributes: { type: Map, of: mongoose.Schema.Types.Mixed },
      variantAxes: [{
        key: String,
        label: String,
        values: [String]
      }],
      variants: [{
        sku: String,
        title: String,
        options: { type: Map, of: String },
        price: Number,
        unit: String,
        stockType: String,
        stockQuantity: Number,
        inStock: Boolean,
        images: [String]
      }],
      isApproved: { type: Boolean, default: true },
      isActive: { type: Boolean, default: true },
      isMadeInRwanda: { type: Boolean, default: true },
      rating: { type: Number, default: 4.5 },
      totalOrders: { type: Number, default: 0 }
    }, { timestamps: true });

    const sellerVideoSchema = new mongoose.Schema({
      sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
      sellerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      marketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Market', required: true },
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      placement: { type: String, default: 'PRODUCT_AD' },
      title: { type: String, required: true },
      caption: String,
      videoUrl: { type: String, required: true },
      thumbnailUrl: String,
      durationSeconds: Number,
      tags: [String],
      isActive: { type: Boolean, default: true },
      viewCount: { type: Number, default: 0 },
      likeCount: { type: Number, default: 0 },
      dislikeCount: { type: Number, default: 0 },
      commentCount: { type: Number, default: 0 },
      comments: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userRole: String,
        fullName: String,
        text: String,
        createdAt: { type: Date, default: Date.now }
      }]
    }, { timestamps: true });

    const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
    const MarketModel = mongoose.models.Market || mongoose.model('Market', marketSchema);
    const SellerProfileModel = mongoose.models.SellerProfile || mongoose.model('SellerProfile', sellerProfileSchema);
    const ProductModel = mongoose.models.Product || mongoose.model('Product', productSchema);
    const SellerVideoModel = mongoose.models.SellerVideo || mongoose.model('SellerVideo', sellerVideoSchema);

    // Pre-hash password values
    console.log('🔑 Generating cryptographic credentials...');
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const hashedSellerPassword = await bcrypt.hash('seller123', 10);
    const hashedRiderPassword = await bcrypt.hash('rider123', 10);
    const hashedBuyerPassword = await bcrypt.hash('buyer123', 10);

    // 1. Create Core Platform Users
    console.log('👤 Seeding Administrators, Riders, and Buyers...');
    const admin = await UserModel.create({
      fullName: 'RMF System Admin',
      email: 'admin@rmf.rw',
      phone: '+250788111222',
      passwordHash: hashedAdminPassword,
      role: 'ADMIN',
      isVerified: true
    });

    const rider = await UserModel.create({
      fullName: 'Jean Bosco Rider',
      email: 'rider@rmf.rw',
      phone: '+250788333444',
      passwordHash: hashedRiderPassword,
      role: 'RIDER',
      isVerified: true
    });

    const buyer = await UserModel.create({
      fullName: 'Marie Claire Buyer',
      email: 'buyer@rmf.rw',
      phone: '+250788555666',
      passwordHash: hashedBuyerPassword,
      role: 'BUYER',
      isVerified: true
    });

    // 2. Define Markets Metadata
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

    // 3. Define Video Templates matching Products
    const videoTemplates = [
      {
        title: 'Crafting Traditional Looming & Weaving',
        caption: 'Watch how our authentic Rwandan textiles are woven by hand with natural fibers. Order our handmade Kitenge dress today! #fashion #kitenge #handcrafts #local',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-weaving-with-traditional-loom-41584-large.mp4',
        tags: ['weaving', 'loom', 'textiles', 'handcrafts'],
      },
      {
        title: 'Artisanal Clay Pottery Masterclass',
        caption: 'Handmade pottery direct from Muhanga clay artisans. Perfect traditional Agaseke baskets. #clay #artisan #handicrafts #musanze',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-hands-of-potter-shaping-clay-34586-large.mp4',
        tags: ['pottery', 'clay', 'artisan', 'handcrafts'],
      },
      {
        title: 'Premium Organic Spices & Herbs',
        caption: 'Fresh Rwandan spices ground from local agricultural hubs. Organic Musanze carrots and spices! #organic #carrots #cooking #agriculture',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-fresh-spices-in-bowls-41982-large.mp4',
        tags: ['spices', 'organic', 'cooking', 'agriculture'],
      },
      {
        title: 'Fresh Volcanic Soil Carrot Harvest',
        caption: 'Freshly harvested carrots from the highland soils of Musanze. Crisp, sweet and 100% organic. #fresh #carrots #organic #musanze',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-farmer-hands-holding-fresh-carrots-41983-large.mp4',
        tags: ['fresh', 'carrots', 'organic', 'musanze'],
      },
      {
        title: 'Custom Rwandan Fashion Boutique',
        caption: 'Preview our latest handcraft and textile garments. Visit our stall for custom tailoring. #fashion #clothes #shopping #local',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-woman-shopping-in-a-clothing-store-42410-large.mp4',
        tags: ['fashion', 'clothes', 'shopping', 'local'],
      },
      {
        title: 'Rwandan Single Origin Coffee Brewing',
        caption: 'Experience the rich aroma of single-origin coffee beans grown in the Huye Highland. #coffee #brewing #local #beverage',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-barista-pouring-milk-into-coffee-cup-43187-large.mp4',
        tags: ['coffee', 'brewing', 'local', 'beverage'],
      }
    ];

    // Seeding loop
    for (let idx = 0; idx < marketsData.length; idx++) {
      const m = marketsData[idx];
      console.log(`📡 Deploying Hub: ${m.name}`);
      
      const market = await MarketModel.create({
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
        totalSellers: 12
      });

      // Create a dedicated Seller for this Market
      const merchantEmail = `merchant.${m.code.toLowerCase()}@rmf.rw`;
      const merchantPhone = `+250788${String(idx + 10).padStart(6, '0')}`;
      
      const merchantUser = await UserModel.create({
        fullName: `${m.name.split(' ')[0]} Merchant`,
        email: merchantEmail,
        phone: merchantPhone,
        passwordHash: hashedSellerPassword,
        role: 'SELLER',
        isVerified: true
      });

      const sellerProfile = await SellerProfileModel.create({
        userId: merchantUser._id,
        marketId: market._id,
        stallId: `${m.code}-STALL-${101 + idx}`,
        stallName: `${m.name.split(' ')[0]} Elite Shop`,
        description: `Your verified institutional merchant for premium products at ${m.name}.`,
        shopDetails: {
          name: `${m.name.split(' ')[0]} Elite Shop`,
          slug: `${m.slug}-elite-shop`,
          code: `${m.code}-ELITE`,
          description: `Authorized premier vendor of high-quality goods at ${m.name}.`,
          operatingHours: {
            open: '08:00',
            close: '18:00',
            daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          },
          categories: ['Fresh Produce', 'Made in Rwanda', 'Handcrafts', 'Fashion']
        },
        isApproved: true,
        rating: 4.6 + (idx % 4) * 0.1,
        totalSales: 120 + idx * 18,
        totalOrders: 95 + idx * 12
      });

      // Products to seed specifically tailored to leaf categories, with complete variants and attributes
      const productsData = [
        {
          name: 'Premium Volcanic Soil Carrots',
          category: 'Grocery',
          categoryId: 'grocery',
          categoryLabel: 'Fresh Produce & Groceries',
          productType: 'fresh_food',
          description: 'Sweet, highly crispy carrots harvested fresh from the rich volcanic volcanic-soil highland slopes of Musanze.',
          price: 1200,
          unit: 'kg',
          images: ['https://images.unsplash.com/photo-1590865507667-3815373a3bc6?auto=format&fit=crop&w=600&q=80'],
          attributes: {
            originDistrict: 'Musanze',
            freshnessGrade: 'A',
            organic: true,
            shelfLifeDays: 14
          },
          variantAxes: [
            { key: 'packageSize', label: 'Package size', values: ['500g', '1kg', '5kg'] }
          ],
          variants: [
            { sku: `${m.code}-CARROT-500G`, title: '500g Pack', options: { packageSize: '500g' }, price: 600, unit: 'pcs', stockType: 'finite', stockQuantity: 150, inStock: true, images: ['https://images.unsplash.com/photo-1590865507667-3815373a3bc6?auto=format&fit=crop&w=600&q=80'] },
            { sku: `${m.code}-CARROT-1KG`, title: '1kg Pack', options: { packageSize: '1kg' }, price: 1200, unit: 'kg', stockType: 'finite', stockQuantity: 200, inStock: true, images: ['https://images.unsplash.com/photo-1590865507667-3815373a3bc6?auto=format&fit=crop&w=600&q=80'] },
            { sku: `${m.code}-CARROT-5KG`, title: '5kg Wholesale', options: { packageSize: '5kg' }, price: 5000, unit: 'pcs', stockType: 'finite', stockQuantity: 40, inStock: true, images: ['https://images.unsplash.com/photo-1590865507667-3815373a3bc6?auto=format&fit=crop&w=600&q=80'] }
          ]
        },
        {
          name: 'Made-in-Rwanda Kitenge Maxi Dress',
          category: 'Fashion',
          categoryId: 'fashion',
          categoryLabel: 'Fashion & Apparel',
          productType: 'apparel',
          description: 'A gorgeous, hand-tailored Kitenge maxi dress featuring traditional patterns and vibrant natural colors. Made locally in Kigali.',
          price: 18000,
          unit: 'pcs',
          images: ['https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80'],
          attributes: {
            material: 'Kitenge',
            gender: 'Women',
            fit: 'Regular',
            care: 'Hand wash cold'
          },
          variantAxes: [
            { key: 'size', label: 'Size', values: ['S', 'M', 'L'] },
            { key: 'color', label: 'Color', values: ['#ff6b00', '#0000ff'] }
          ],
          variants: [
            { sku: `${m.code}-KITENGE-S-ORANGE`, title: 'S / Orange Pattern', options: { size: 'S', color: '#ff6b00' }, price: 18000, unit: 'pcs', stockType: 'finite', stockQuantity: 12, inStock: true, images: ['https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80'] },
            { sku: `${m.code}-KITENGE-M-ORANGE`, title: 'M / Orange Pattern', options: { size: 'M', color: '#ff6b00' }, price: 18000, unit: 'pcs', stockType: 'finite', stockQuantity: 18, inStock: true, images: ['https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80'] },
            { sku: `${m.code}-KITENGE-L-BLUE`, title: 'L / Blue Pattern', options: { size: 'L', color: '#0000ff' }, price: 19500, unit: 'pcs', stockType: 'finite', stockQuantity: 10, inStock: true, images: ['https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80'] }
          ]
        },
        {
          name: 'Huye Highland Single-Origin Coffee Beans',
          category: 'Grocery',
          categoryId: 'grocery',
          categoryLabel: 'Fresh Produce & Groceries',
          productType: 'fresh_food',
          description: 'Award-winning bourbon arabica coffee beans grown on the high altitude hills of Huye District. Freshly roasted in small batches.',
          price: 6500,
          unit: 'pcs',
          images: ['https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=600&q=80'],
          attributes: {
            originDistrict: 'Huye',
            freshnessGrade: 'A',
            organic: true,
            shelfLifeDays: 180
          },
          variantAxes: [
            { key: 'packageSize', label: 'Package size', values: ['250g', '500g', '1kg'] }
          ],
          variants: [
            { sku: `${m.code}-COFFEE-250G`, title: '250g bag', options: { packageSize: '250g' }, price: 3500, unit: 'pcs', stockType: 'finite', stockQuantity: 300, inStock: true, images: ['https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=600&q=80'] },
            { sku: `${m.code}-COFFEE-500G`, title: '500g bag', options: { packageSize: '500g' }, price: 6500, unit: 'pcs', stockType: 'finite', stockQuantity: 200, inStock: true, images: ['https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=600&q=80'] },
            { sku: `${m.code}-COFFEE-1KG`, title: '1kg bag', options: { packageSize: '1kg' }, price: 12000, unit: 'pcs', stockType: 'finite', stockQuantity: 100, inStock: true, images: ['https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=600&q=80'] }
          ]
        },
        {
          name: 'Traditional Handwoven Agaseke Basket',
          category: 'Handicrafts',
          categoryId: 'handicrafts',
          categoryLabel: 'Handicrafts',
          productType: 'artisan_good',
          description: 'Genuine Rwandan peace basket handwoven by artisan cooperatives using local sisal and sweet grass. A symbol of heritage.',
          price: 12000,
          unit: 'pcs',
          images: ['https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=600&q=80'],
          attributes: {
            material: 'Sisal',
            artisanDistrict: 'Huye',
            handmade: true,
            productionDays: 5
          },
          variantAxes: [
            { key: 'size', label: 'Size', values: ['Small', 'Medium'] }
          ],
          variants: [
            { sku: `${m.code}-BASKET-SM`, title: 'Small Basket', options: { size: 'Small' }, price: 8000, unit: 'pcs', stockType: 'finite', stockQuantity: 50, inStock: true, images: ['https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=600&q=80'] },
            { sku: `${m.code}-BASKET-MD`, title: 'Medium Basket', options: { size: 'Medium' }, price: 12000, unit: 'pcs', stockType: 'finite', stockQuantity: 30, inStock: true, images: ['https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=600&q=80'] }
          ]
        }
      ];

      // Seeding products inside market and seller context
      const seededProducts = [];
      for (const p of productsData) {
        const product = await ProductModel.create({
          sellerId: sellerProfile._id,
          marketId: market._id,
          name: p.name,
          description: p.description,
          category: p.category,
          categoryId: p.categoryId,
          categoryLabel: p.categoryLabel,
          productType: p.productType,
          price: p.price,
          unit: p.unit,
          images: p.images,
          attributes: p.attributes,
          variantAxes: p.variantAxes,
          variants: p.variants,
          isApproved: true,
          isActive: true,
          isMadeInRwanda: true,
          rating: 4.5 + (idx % 5) * 0.1,
          totalOrders: 35 + (idx * 5)
        });
        seededProducts.push(product);
      }

      // Link a Seller Video for the first product seeded in each market
      const template = videoTemplates[idx % videoTemplates.length];
      const linkedProduct = seededProducts[0];
      
      await SellerVideoModel.create({
        sellerId: sellerProfile._id,
        sellerUserId: merchantUser._id,
        marketId: market._id,
        productId: linkedProduct._id,
        placement: 'PRODUCT_AD',
        title: template.title,
        caption: template.caption,
        videoUrl: template.videoUrl,
        thumbnailUrl: linkedProduct.images[0],
        durationSeconds: 15 + (idx * 2),
        tags: template.tags,
        isActive: true,
        viewCount: 280 + (idx * 40),
        likeCount: 95 + (idx * 15),
        dislikeCount: 2 + idx,
        commentCount: 4,
        comments: [
          { userId: buyer._id, userRole: 'BUYER', fullName: 'Marie Claire B.', text: 'This looks so authentic and beautiful!' },
          { userId: merchantUser._id, userRole: 'SELLER', fullName: sellerProfile.stallName, text: 'Thank you Marie Claire! We ship all across Kigali!' },
          { userId: buyer._id, userRole: 'BUYER', fullName: 'Gaspard N.', text: 'Outstanding quality, ordered the coffee and it is rich!' },
          { userId: merchantUser._id, userRole: 'SELLER', fullName: sellerProfile.stallName, text: 'Great to hear that Gaspard! Contact us for wholesale discounts.' }
        ]
      });
    }

    console.log('✅ Institutional Deployment with Variants and Category Hierarchy completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Institutional Deployment Failed:', err);
    process.exit(1);
  }
}

seed();
