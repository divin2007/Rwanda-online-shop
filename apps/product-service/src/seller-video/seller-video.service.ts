import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '@rmf/shared-types';

type AuthUser = {
  userId: string;
  email?: string;
  role: UserRole | string;
};

type VideoQuery = {
  marketId?: string;
  sellerId?: string;
  productId?: string;
  placement?: string;
  search?: string;
  tag?: string;
  limit?: string | number;
  cursor?: string;
};

@Injectable()
export class SellerVideoService {
  constructor(
    @InjectModel('SellerVideo') private sellerVideoModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('Product') private productModel: Model<any>,
    @InjectModel('Market') private marketModel: Model<any>,
    @InjectModel('User') private userModel: Model<any>,
  ) {}

  async onModuleInit() {
    return;
  }

  private async autoSeed() {
    try {
      // 1. Ensure markets exist
      const marketCount = await this.marketModel.countDocuments().exec();
      if (marketCount === 0) {
        console.log('No markets found. Seeding default markets first...');
        const marketsData = [
          { name: 'Kimironko Elite Hub', code: 'KIM', slug: 'kimironko-elite', type: 'public', description: 'The premier artisanal hub of Kigali, specializing in textiles and fresh produce.', imageUrl: 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e', lat: -1.935, lng: 30.125 },
          { name: 'Nyabugogo Logistics Terminal', code: 'NYA', slug: 'nyabugogo-terminal', type: 'public', description: 'Central logistics node for regional trade and bulk commodities.', imageUrl: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9', lat: -1.942, lng: 30.051 },
          { name: 'Nyamirambo Cultural Market', code: 'NYM', slug: 'nyamirambo-cultural', type: 'public', description: 'Rich heritage artifacts and traditional Rwandan handcrafts.', imageUrl: 'https://images.unsplash.com/photo-1605371924599-2d0365da1ae0', lat: -1.965, lng: 30.055 },
          { name: 'Kigali Heights Artisanal', code: 'KGH', slug: 'kigali-heights', type: 'public', description: 'Upscale facilitator hub for premium Made in Rwanda goods.', imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8', lat: -1.951, lng: 30.091 },
          { name: 'Musanze Regional Hub', code: 'MUS', slug: 'musanze-hub', type: 'public', description: 'Primary gateway for volcanic-soil produce and highland artifacts.', imageUrl: 'https://images.unsplash.com/photo-1506484334402-40f2fc958f6d', lat: -1.507, lng: 29.633 },
          { name: 'Rubavu Border Trade Center', code: 'RUB', slug: 'rubavu-border', type: 'public', description: 'International facilitator terminal for cross-border commerce.', imageUrl: 'https://images.unsplash.com/photo-1531058240690-006c446962d8', lat: -1.696, lng: 29.261 },
          { name: 'Huye Knowledge Market', code: 'HUY', slug: 'huye-market', type: 'public', description: 'Academic and artisanal intersection specializing in traditional weaving.', imageUrl: 'https://images.unsplash.com/photo-1516594708146-07c5171b9c8a', lat: -2.597, lng: 29.740 },
          { name: 'Rwamagana Agri Terminal', code: 'RWA', slug: 'rwamagana-agri', type: 'public', description: 'Strategic agricultural hub for Eastern Province distribution.', imageUrl: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399', lat: -1.949, lng: 30.435 },
          { name: 'Gicumbi Highland Hub', code: 'GIC', slug: 'gicumbi-highland', type: 'public', description: 'Specialized node for high-altitude dairy and organic spices.', imageUrl: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854', lat: -1.594, lng: 30.061 },
          { name: 'Muhanga Central Facilitation', code: 'MUH', slug: 'muhanga-central', type: 'public', description: 'Geographic center node for inter-provincial trade logistics.', imageUrl: 'https://images.unsplash.com/photo-1495570689269-d883b1224443', lat: -2.077, lng: 29.756 }
        ];
        for (const m of marketsData) {
          await this.marketModel.create({
            name: m.name,
            code: m.code,
            slug: m.slug,
            type: m.type,
            description: m.description,
            imageUrl: m.imageUrl,
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
          });
        }
      }

      const markets = await this.marketModel.find().exec();
      
      // 2. Ensure seller users and profiles exist for each market
      for (let i = 0; i < markets.length; i++) {
        const market = markets[i];
        const email = `merchant.${market.code.toLowerCase()}@rmf.rw`;
        const phone = `+250788${String(i).padStart(6, '0')}`;
        
        let user = await this.userModel.findOne({ email }).exec();
        if (!user) {
          user = await this.userModel.create({
            fullName: `Merchant ${market.name.split(' ')[0]}`,
            email,
            phone,
            passwordHash: '$2b$10$Z3mO9p53C9eG4z67f/9vKeH4.YjTkyUo0WqB.oV3vP.R98yX4Fp/S',
            role: 'SELLER',
            isActive: true,
            isVerified: true,
          });
        }
        
        let sellerProfile = await this.sellerModel.findOne({ userId: user._id }).exec();
        if (!sellerProfile) {
          sellerProfile = await this.sellerModel.create({
            userId: user._id,
            marketId: market._id,
            stallId: `${market.code}-${100 + i}`,
            stallName: `${market.name.split(' ')[0]} Verified Merchant`,
            description: `Authorized seller at ${market.name}. Sells quality products.`,
            shopDetails: {
              name: `${market.name.split(' ')[0]} Elite Shop`,
              slug: `${market.slug}-elite-shop`,
              code: `${market.code}-ELITE`,
              description: `Quality goods sourced from ${market.name}.`,
              operatingHours: { open: '08:00', close: '18:00', daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
              categories: ['Produce', 'Textiles', 'Handcrafts', 'Spices']
            },
            isApproved: true,
            rating: 4.5 + (i % 5) * 0.1,
            totalSales: 120 + i * 15,
            totalOrders: 90 + i * 12,
          });
        }
        
        // Ensure products exist and point to this seller!
        const prodCount = await this.productModel.countDocuments({ marketId: market._id }).exec();
        if (prodCount === 0) {
          console.log(`Seeding default products for ${market.name}...`);
          const categories = ['Produce', 'Handcrafts', 'Textiles', 'Spices', 'Dairy', 'Artisan', 'Household'];
          for (let p = 1; p <= 5; p++) {
            const cat = categories[(p + i) % categories.length];
            const prodName = `${market.name.split(' ')[0]} ${cat} Item #${p}`;
            await this.productModel.create({
              name: prodName,
              slug: `${market.slug}-item-${p}`,
              description: `Premium ${cat} sourced from the ${market.name}. Verified Made in Rwanda.`,
              price: (Math.floor(Math.random() * 20) + 1) * 1000,
              category: cat,
              categoryLabel: cat,
              categoryId: cat.toLowerCase(),
              marketId: market._id,
              sellerId: sellerProfile._id,
              images: [market.imageUrl || 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e'],
              stockType: 'infinite',
              stockQuantity: 999,
              unit: p % 2 === 0 ? 'kg' : 'pcs',
              isApproved: true,
              isActive: true,
              isMadeInRwanda: true
            });
          }
        } else {
          // If products exist but don't have sellerId, update them
          const products = await this.productModel.find({ marketId: market._id }).exec();
          for (const prod of products) {
            if (!prod.sellerId) {
              prod.sellerId = sellerProfile._id;
              await prod.save();
            }
          }
        }
      }

      // 3. Seed Seller Videos
      console.log('Seeding seller videos with high-speed CDN MP4s...');
      const allSellers = await this.sellerModel.find().exec();
      const videoTemplates = [
        {
          title: 'Crafting Traditional Looming & Weaving',
          caption: 'Watch how our authentic Rwandan textiles are woven by hand with natural fibers. Order today!',
          videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-weaving-with-traditional-loom-41584-large.mp4',
          tags: ['weaving', 'loom', 'textiles', 'handcrafts'],
        },
        {
          title: 'Artisanal Clay Pottery Masterclass',
          caption: 'Handmade pottery direct from Muhanga clay artisans. Perfectly shaped and dried.',
          videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-hands-of-potter-shaping-clay-34586-large.mp4',
          tags: ['pottery', 'clay', 'artisan', 'handcrafts'],
        },
        {
          title: 'Premium Organic Spices & Herbs',
          caption: 'Fresh Rwandan spices ground from local agricultural hubs. Adds incredible flavor to your dishes.',
          videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-fresh-spices-in-bowls-41982-large.mp4',
          tags: ['spices', 'organic', 'cooking', 'agriculture'],
        },
        {
          title: 'Fresh Volcanic Soil Carrot Harvest',
          caption: 'Freshly harvested carrots from the highland soils of Musanze. Crisp, sweet and 100% organic.',
          videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-farmer-hands-holding-fresh-carrots-41983-large.mp4',
          tags: ['fresh', 'carrots', 'organic', 'musanze'],
        },
        {
          title: 'Custom Rwandan Fashion Boutique',
          caption: 'Preview our latest handcraft and textile garments. Visit our stall for custom tailoring.',
          videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-woman-shopping-in-a-clothing-store-42410-large.mp4',
          tags: ['fashion', 'clothes', 'shopping', 'local'],
        },
        {
          title: 'Rwandan Single Origin Coffee Brewing',
          caption: 'Experience the rich aroma of single-origin coffee beans grown in the Western Province.',
          videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-barista-pouring-milk-into-coffee-cup-43187-large.mp4',
          tags: ['coffee', 'brewing', 'local', 'beverage'],
        }
      ];

      for (let j = 0; j < videoTemplates.length; j++) {
        const template = videoTemplates[j];
        const seller = allSellers[j % allSellers.length];
        if (!seller) continue;
        
        const product = await this.productModel.findOne({ sellerId: seller._id }).exec();
        const placement = j % 2 === 1 ? 'STORY' : 'PRODUCT_AD';
        const categoryId = j === 1 ? 'handicrafts' : j === 3 ? 'grocery' : j === 5 ? 'grocery' : 'other';
        
        const videoPayload = {
          sellerId: seller._id,
          sellerUserId: seller.userId,
          marketId: seller.marketId,
          productId: product ? product._id : undefined,
          placement,
          categoryId,
          title: template.title,
          caption: template.caption,
          videoUrl: template.videoUrl,
          thumbnailUrl: product && product.images && product.images[0] ? product.images[0] : 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e',
          durationSeconds: 15 + j * 5,
          tags: template.tags,
          isActive: true,
          isArchived: false,
          viewCount: 150 + j * 42,
          likeCount: 45 + j * 12,
          dislikeCount: 2 + j,
          commentCount: 4,
          comments: [
            { userId: seller.userId, userRole: 'BUYER', fullName: 'Gaspard N.', text: 'Outstanding quality, highly recommended!' },
            { userId: seller.userId, userRole: 'BUYER', fullName: 'Liliane U.', text: 'Is this available in custom sizes?' },
            { userId: seller.userId, userRole: 'SELLER', fullName: seller.stallName, text: 'Yes Liliane! We do custom sizes if you contact us.' },
            { userId: seller.userId, userRole: 'BUYER', fullName: 'Christian R.', text: 'Fast shipping to Kigali heights!' }
          ]
        };

        await this.sellerVideoModel.create(videoPayload);
      }
      console.log('✅ Auto-seeding completed successfully.');
    } catch (e) {
      console.error('❌ Auto-seeding error:', e);
    }
  }

  private toObjectId(value: string, field: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return new Types.ObjectId(value);
  }

  private cleanText(value: unknown, maxLength: number) {
    return String(value || '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  private cleanTags(value: unknown): string[] {
    const raw = Array.isArray(value) ? value : String(value || '').split(',');
    return Array.from(new Set(raw
      .map(item => this.cleanText(item, 40).toLowerCase().replace(/^#/, ''))
      .filter(Boolean)
      .filter(item => /^[a-z0-9_-]{2,40}$/.test(item))
    )).slice(0, 12);
  }

  private validateUrl(value: unknown, field: string) {
    const url = this.cleanText(value, 600);
    if (!/^https?:\/\//i.test(url)) {
      throw new BadRequestException(`${field} must be a public http(s) URL`);
    }
    return url;
  }

  private async findSellerForUser(user: AuthUser, requestedSellerId?: string) {
    if (!user?.userId) throw new ForbiddenException('Authentication is required');

    const lookups: any[] = [{ userId: user.userId }];
    if (Types.ObjectId.isValid(user.userId)) {
      const objectId = new Types.ObjectId(user.userId);
      lookups.unshift({ _id: objectId }, { userId: objectId });
    }

    if (user.role === UserRole.ADMIN && requestedSellerId) {
      const sellerObjectId = this.toObjectId(requestedSellerId, 'sellerId');
      const seller = await this.sellerModel.findOne({ _id: sellerObjectId, deletedAt: null }).exec();
      if (!seller) throw new BadRequestException('Seller profile not found');
      return seller;
    }

    const seller = await this.sellerModel.findOne({ $or: lookups, deletedAt: null }).exec();
    if (!seller) throw new BadRequestException('Complete seller onboarding before publishing videos');
    if (user.role !== UserRole.ADMIN && seller.isApproved !== true) {
      throw new ForbiddenException('Only approved sellers can publish shop videos');
    }
    return seller;
  }

  private async resolveLinkedProduct(productId: string | undefined, seller: any, user: AuthUser) {
    if (!productId) return null;
    const productObjectId = this.toObjectId(productId, 'productId');
    const product = await this.productModel.findOne({ _id: productObjectId, deletedAt: null }).lean().exec();
    if (!product) throw new BadRequestException('Linked product not found');
    if (user.role !== UserRole.ADMIN && String(product.sellerId) !== String(seller._id)) {
      throw new ForbiddenException('You can only advertise your own products');
    }
    return product;
  }

  private async resolveMarketId(inputMarketId: string | undefined, seller: any, product: any) {
    const marketId = inputMarketId || product?.marketId || seller.marketId;
    if (!marketId) throw new BadRequestException('A market is required for seller videos');
    const marketObjectId = this.toObjectId(String(marketId), 'marketId');
    const market = await this.marketModel.findOne({ _id: marketObjectId, deletedAt: null }).lean().exec();
    if (!market) throw new BadRequestException('Market not found for seller video');
    return marketObjectId;
  }

  private presentation(video: any, viewerId?: string) {
    const likeUserIds = (video.likeUserIds || []).map((id: any) => String(id));
    const dislikeUserIds = (video.dislikeUserIds || []).map((id: any) => String(id));
    return {
      ...video,
      likeCount: Number(video.likeCount ?? likeUserIds.length ?? 0),
      dislikeCount: Number(video.dislikeCount ?? dislikeUserIds.length ?? 0),
      commentCount: Number(video.commentCount ?? (video.comments || []).filter((comment: any) => !comment.deletedAt).length ?? 0),
      viewerReaction: viewerId
        ? likeUserIds.includes(viewerId)
          ? 'like'
          : dislikeUserIds.includes(viewerId)
            ? 'dislike'
            : null
        : null,
      comments: (video.comments || []).filter((comment: any) => !comment.deletedAt).slice(-12),
    };
  }

  private async recordViewerSignal(userId: string | undefined, video: any, action: 'video_view' | 'video_like' | 'video_comment') {
    if (!userId || !Types.ObjectId.isValid(userId)) return;
    const weights = { video_view: 1.25, video_like: 4, video_comment: 5 };
    const delta = weights[action];
    const user = await this.userModel.findById(userId).exec();
    if (!user) return;
    const profile = user.recommendationProfile || {};
    const upsert = (items: any[], keyName: 'key' | 'refId', key: string) => {
      if (!key) return items || [];
      const current = Array.isArray(items) ? [...items] : [];
      const found = current.find(item => String(item?.[keyName]) === key);
      if (found) {
        found.score = Math.max(-20, Math.min(1000, Number(found.score || 0) + delta));
        found.lastSeenAt = new Date();
      } else {
        current.push({
          [keyName]: keyName === 'refId' ? new Types.ObjectId(key) : key,
          score: delta,
          lastSeenAt: new Date(),
        });
      }
      return current.filter(item => Number(item.score || 0) > -20).sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 80);
    };

    const product = video.productId && typeof video.productId === 'object' ? video.productId : null;
    const categoryId = String(product?.categoryId || product?.category || '').toLowerCase();
    const marketId = String(video.marketId?._id || video.marketId || '');
    const sellerId = String(video.sellerId?._id || video.sellerId || '');
    const productId = product?._id ? String(product._id) : String(video.productId || '');

    await this.userModel.findByIdAndUpdate(userId, {
      $set: {
        recommendationProfile: {
          categoryScores: categoryId ? upsert(profile.categoryScores || [], 'key', categoryId) : profile.categoryScores || [],
          marketScores: Types.ObjectId.isValid(marketId) ? upsert(profile.marketScores || [], 'refId', marketId) : profile.marketScores || [],
          sellerScores: Types.ObjectId.isValid(sellerId) ? upsert(profile.sellerScores || [], 'refId', sellerId) : profile.sellerScores || [],
          productScores: Types.ObjectId.isValid(productId) ? upsert(profile.productScores || [], 'refId', productId) : profile.productScores || [],
          recentProductIds: Types.ObjectId.isValid(productId)
            ? [new Types.ObjectId(productId), ...(Array.isArray(profile.recentProductIds) ? profile.recentProductIds.filter((id: any) => String(id) !== productId) : [])].slice(0, 60)
            : profile.recentProductIds || [],
          lastInteractionAt: new Date(),
        },
      },
    }).exec();
  }

  async archiveExpiredStories(): Promise<void> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.sellerVideoModel.updateMany(
      {
        placement: 'STORY',
        isArchived: false,
        createdAt: { $lt: twentyFourHoursAgo },
      },
      {
        $set: { isArchived: true }
      }
    ).exec();
  }

  async getPersonalizedStories(user?: AuthUser, query: any = {}) {
    await this.archiveExpiredStories().catch(err => console.error('Archive expired stories failed:', err));

    const filter: any = {
      placement: 'STORY',
      isActive: true,
      isArchived: false,
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      deletedAt: null,
    };

    if (query.marketId) {
      filter.marketId = this.toObjectId(String(query.marketId), 'marketId');
    }

    const stories = await this.sellerVideoModel
      .find(filter)
      .populate('sellerId', 'stallName shopDetails rating totalOrders')
      .populate('marketId', 'name slug code location imageUrl')
      .populate('productId', 'name price unit images category categoryLabel categoryId')
      .lean()
      .exec();

    const viewerId = user?.userId;
    const presentedStories = stories.map(story => this.presentation(story, viewerId));

    if (!viewerId) {
      return presentedStories.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const dbUser = await this.userModel.findById(viewerId).lean().exec();
    if (!dbUser) {
      return presentedStories.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const favoriteCategories = new Set<string>();
    if (dbUser.preferences?.discovery?.categoryIds?.length) {
      dbUser.preferences.discovery.categoryIds.forEach((catId: string) => {
        if (catId) favoriteCategories.add(catId.trim().toLowerCase());
      });
    }

    const categoryScores = new Map<string, number>();
    if (dbUser.recommendationProfile?.categoryScores?.length) {
      dbUser.recommendationProfile.categoryScores.forEach((scoreObj: any) => {
        if (scoreObj?.key) {
          categoryScores.set(scoreObj.key.trim().toLowerCase(), Number(scoreObj.score || 0));
        }
      });
    }

    const scoredStories = presentedStories.map((story: any) => {
      let score = 0;
      const catId = String(story.categoryId || '').trim().toLowerCase();

      if (catId && favoriteCategories.has(catId)) {
        score += 500;
      }

      if (catId && categoryScores.has(catId)) {
        score += categoryScores.get(catId)! * 2;
      }

      const sellerRating = Number(story.sellerId?.rating || 0);
      if (sellerRating > 4.0) {
        score += (sellerRating - 4.0) * 50;
      }

      const hoursSinceCreation = (Date.now() - new Date(story.createdAt).getTime()) / (1000 * 60 * 60);
      score += Math.max(0, 24 - hoursSinceCreation) * 10;

      return { story, score };
    });

    scoredStories.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.01) {
        return b.score - a.score;
      }
      return new Date(b.story.createdAt).getTime() - new Date(a.story.createdAt).getTime();
    });

    return scoredStories.map(item => item.story);
  }

  async create(user: AuthUser, data: any) {
    const seller = await this.findSellerForUser(user, data?.sellerId);
    const product = await this.resolveLinkedProduct(data?.productId, seller, user);
    const marketId = await this.resolveMarketId(data?.marketId, seller, product);
    const title = this.cleanText(data?.title, 100);
    const caption = this.cleanText(data?.caption, 800);
    
    let placement = 'PRODUCT_AD';
    if (data?.placement === 'STORY' || data?.isStory === true) {
      placement = 'STORY';
    } else if (data?.placement === 'SHOP_AD' || data?.isShopAd === true) {
      placement = 'SHOP_AD';
    }

    if (!title) throw new BadRequestException('Video title is required');
    if (placement === 'SHOP_AD') {
      const existing = await this.sellerVideoModel.findOne({
        sellerId: seller._id,
        placement: 'SHOP_AD',
        isActive: true,
        deletedAt: null,
      }).lean().exec();
      if (existing) {
        throw new BadRequestException('This shop already has an active shop advertisement video. Edit or remove it before publishing another one.');
      }
    }

    let categoryId = data?.categoryId ? String(data.categoryId).trim().toLowerCase() : null;
    if (!categoryId && product) {
      categoryId = String(product.categoryId || product.category || '').toLowerCase();
    }
    if (!categoryId && seller?.shopDetails?.categories?.length) {
      categoryId = String(seller.shopDetails.categories[0]).trim().toLowerCase();
    }
    if (!categoryId) {
      categoryId = 'other';
    }

    const payload = {
      sellerId: seller._id,
      sellerUserId: seller.userId,
      marketId,
      productId: placement === 'SHOP_AD' ? undefined : product?._id,
      variantSku: placement === 'SHOP_AD' ? undefined : data?.variantSku || undefined,
      placement,
      categoryId,
      title,
      caption,
      videoUrl: this.validateUrl(data?.videoUrl, 'videoUrl'),
      thumbnailUrl: data?.thumbnailUrl ? this.validateUrl(data.thumbnailUrl, 'thumbnailUrl') : undefined,
      durationSeconds: data?.durationSeconds ? Math.min(Number(data.durationSeconds), 600) : undefined,
      tags: this.cleanTags(data?.tags),
      processingStatus: 'READY',
      moderationStatus: process.env.VIDEO_REQUIRE_MODERATION === 'true' && user.role !== UserRole.ADMIN ? 'PENDING' : 'APPROVED',
      isActive: data?.isActive === undefined ? true : data.isActive !== false,
      isArchived: false,
      auditTrail: [{ action: 'created', actorId: user.userId, reason: 'seller_video_created', at: new Date() }],
    };

    const saved = await this.sellerVideoModel.create(payload);
    return this.findById(String(saved._id), false, user.userId, true);
  }

  async findAll(query: any = {}, viewerId?: string) {
    await this.archiveExpiredStories().catch(err => console.error('Archive expired stories failed:', err));

    const isAdminView = query.adminTrusted === true;
    const filter: any = { deletedAt: null, isActive: true };
    if (!isAdminView) {
      filter.processingStatus = 'READY';
      filter.moderationStatus = 'APPROVED';
    } else if (query.moderationStatus) {
      filter.moderationStatus = String(query.moderationStatus).toUpperCase();
    }
    if (query.marketId) filter.marketId = this.toObjectId(String(query.marketId), 'marketId');
    if (query.sellerId) filter.sellerId = this.toObjectId(String(query.sellerId), 'sellerId');
    if (query.productId) filter.productId = this.toObjectId(String(query.productId), 'productId');
    
    if (query.placement) {
      filter.placement = query.placement;
    }
    if (query.isStory === true || query.isStory === 'true' || filter.placement === 'STORY') {
      filter.placement = 'STORY';
      if (query.includeArchived !== 'true' && query.includeArchived !== true) {
        filter.isArchived = false;
      }
    }
    if (query.categoryId) {
      filter.categoryId = String(query.categoryId).trim().toLowerCase();
    }

    if (query.tag) filter.tags = this.cleanText(query.tag, 40).toLowerCase().replace(/^#/, '');
    if (query.cursor) filter.createdAt = { $lt: new Date(String(query.cursor)) };

    const search = this.cleanText(query.search, 80);
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const [matchingProducts, matchingMarkets, matchingSellers] = await Promise.all([
        this.productModel.find({
          deletedAt: null,
          $or: [
            { name: { $regex: safeSearch, $options: 'i' } },
            { category: { $regex: safeSearch, $options: 'i' } },
            { categoryLabel: { $regex: safeSearch, $options: 'i' } },
            { productType: { $regex: safeSearch, $options: 'i' } },
          ],
        }).select('_id').limit(80).lean().exec(),
        this.marketModel.find({
          deletedAt: null,
          $or: [
            { name: { $regex: safeSearch, $options: 'i' } },
            { slug: { $regex: safeSearch, $options: 'i' } },
            { code: { $regex: safeSearch, $options: 'i' } },
          ],
        }).select('_id').limit(40).lean().exec(),
        this.sellerModel.find({
          deletedAt: null,
          $or: [
            { stallName: { $regex: safeSearch, $options: 'i' } },
            { 'shopDetails.name': { $regex: safeSearch, $options: 'i' } },
            { 'shopDetails.slug': { $regex: safeSearch, $options: 'i' } },
          ],
        }).select('_id').limit(40).lean().exec(),
      ]);
      filter.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { caption: { $regex: safeSearch, $options: 'i' } },
        { tags: { $regex: safeSearch, $options: 'i' } },
        ...(matchingProducts.length ? [{ productId: { $in: matchingProducts.map((item: any) => item._id) } }] : []),
        ...(matchingMarkets.length ? [{ marketId: { $in: matchingMarkets.map((item: any) => item._id) } }] : []),
        ...(matchingSellers.length ? [{ sellerId: { $in: matchingSellers.map((item: any) => item._id) } }] : []),
      ];
    }

    const limit = Math.min(Math.max(Number(query.limit || 20), 1), 50);
    const videos = await this.sellerVideoModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sellerId', 'stallName shopDetails rating totalOrders')
      .populate('marketId', 'name slug code location imageUrl')
      .populate('productId', 'name price unit images category categoryLabel categoryId')
      .lean()
      .exec();

    return videos.map(video => this.presentation(video, viewerId));
  }

  async findById(id: string, incrementView = true, viewerId?: string, includeUnmoderated = false) {
    const objectId = this.toObjectId(id, 'videoId');
    const filter: any = { _id: objectId, deletedAt: null, isActive: true };
    if (!includeUnmoderated) {
      filter.processingStatus = 'READY';
      filter.moderationStatus = 'APPROVED';
    }
    const operation = incrementView
      ? this.sellerVideoModel.findOneAndUpdate(filter, { $inc: { viewCount: 1 } }, { new: true })
      : this.sellerVideoModel.findOne(filter);
    const video = await operation
      .populate('sellerId', 'stallName shopDetails rating totalOrders')
      .populate('marketId', 'name slug code location imageUrl')
      .populate('productId', 'name price unit images category categoryLabel')
      .lean()
      .exec();
    if (!video) throw new NotFoundException('Seller video not found');
    if (incrementView) this.recordViewerSignal(viewerId, video, 'video_view').catch(() => {});
    return this.presentation(video, viewerId);
  }

  async update(user: AuthUser, id: string, data: any) {
    const video = await this.sellerVideoModel.findOne({ _id: this.toObjectId(id, 'videoId'), deletedAt: null }).exec();
    if (!video) throw new NotFoundException('Seller video not found');
    if (user.role !== UserRole.ADMIN && String(video.sellerUserId) !== String(user.userId)) {
      throw new ForbiddenException('You can only update your own videos');
    }

    const updates: any = {};
    if (data.title !== undefined) updates.title = this.cleanText(data.title, 100);
    if (data.caption !== undefined) updates.caption = this.cleanText(data.caption, 800);
    if (data.thumbnailUrl !== undefined) updates.thumbnailUrl = data.thumbnailUrl ? this.validateUrl(data.thumbnailUrl, 'thumbnailUrl') : undefined;
    if (data.tags !== undefined) updates.tags = this.cleanTags(data.tags);
    if (data.isActive !== undefined) updates.isActive = data.isActive === true;
    if (data.variantSku !== undefined) updates.variantSku = data.variantSku || undefined;
    if (data.placement !== undefined || data.isShopAd !== undefined) {
      const nextPlacement = data.placement === 'SHOP_AD' || data.isShopAd === true ? 'SHOP_AD' : 'PRODUCT_AD';
      if (nextPlacement === 'SHOP_AD' && video.placement !== 'SHOP_AD') {
        const existing = await this.sellerVideoModel.findOne({
          _id: { $ne: video._id },
          sellerId: video.sellerId,
          placement: 'SHOP_AD',
          isActive: true,
          deletedAt: null,
        }).lean().exec();
        if (existing) throw new BadRequestException('This shop already has an active shop advertisement video.');
      }
      updates.placement = nextPlacement;
      if (nextPlacement === 'SHOP_AD') updates.productId = undefined;
    }
    if (updates.title === '') throw new BadRequestException('Video title cannot be empty');
    await video.updateOne({
      $set: updates,
      $push: { auditTrail: { action: 'updated', actorId: user.userId, reason: 'seller_video_updated', at: new Date() } },
    });
    return this.findById(id, false, user.userId, true);
  }

  async remove(user: AuthUser, id: string) {
    const video = await this.sellerVideoModel.findOne({ _id: this.toObjectId(id, 'videoId'), deletedAt: null }).exec();
    if (!video) throw new NotFoundException('Seller video not found');
    if (user.role !== UserRole.ADMIN && String(video.sellerUserId) !== String(user.userId)) {
      throw new ForbiddenException('You can only remove your own videos');
    }
    await video.updateOne({
      $set: { isActive: false, deletedAt: new Date() },
      $push: { auditTrail: { action: 'deleted', actorId: user.userId, reason: 'seller_video_deleted', at: new Date() } },
    });
    return { removed: true };
  }

  async react(user: AuthUser, id: string, reaction: 'like' | 'dislike' | 'none') {
    if (!['like', 'dislike', 'none'].includes(reaction)) {
      throw new BadRequestException('Reaction must be like, dislike, or none');
    }
    const userObjectId = this.toObjectId(user.userId, 'userId');
    const videoObjectId = this.toObjectId(id, 'videoId');
    const pullBoth = { likeUserIds: userObjectId, dislikeUserIds: userObjectId };
    const publicFilter = { _id: videoObjectId, deletedAt: null, isActive: true, processingStatus: 'READY', moderationStatus: 'APPROVED' };
    await this.sellerVideoModel.updateOne(publicFilter, { $pull: pullBoth }).exec();
    if (reaction !== 'none') {
      await this.sellerVideoModel.updateOne(
        publicFilter,
        { $addToSet: reaction === 'like' ? { likeUserIds: userObjectId } : { dislikeUserIds: userObjectId } },
      ).exec();
    }
    const updated = await this.sellerVideoModel.findOne(publicFilter).exec();
    if (!updated) throw new NotFoundException('Seller video not found');
    updated.likeCount = updated.likeUserIds.length;
    updated.dislikeCount = updated.dislikeUserIds.length;
    await updated.save();
    if (reaction === 'like') this.recordViewerSignal(user.userId, updated, 'video_like').catch(() => {});
    return this.findById(id, false, user.userId, true);
  }

  async comment(user: AuthUser, id: string, data: any) {
    const text = this.cleanText(data?.text, 700);
    if (!text) throw new BadRequestException('Comment text is required');
    const userObjectId = this.toObjectId(user.userId, 'userId');
    const videoObjectId = this.toObjectId(id, 'videoId');
    const fullName = this.cleanText(data?.fullName || user.email || 'RMF user', 80);
    const updated = await this.sellerVideoModel.findOneAndUpdate(
      { _id: videoObjectId, deletedAt: null, isActive: true, processingStatus: 'READY', moderationStatus: 'APPROVED' },
      {
        $push: {
          comments: {
            userId: userObjectId,
            userRole: user.role,
            fullName,
            text,
          },
        },
        $inc: { commentCount: 1 },
      },
      { new: true },
    ).lean().exec();
    if (!updated) throw new NotFoundException('Seller video not found');
    this.recordViewerSignal(user.userId, updated, 'video_comment').catch(() => {});
    return this.presentation(updated, user.userId);
  }

  async moderate(user: AuthUser, id: string, data: any) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can moderate seller videos');
    }
    const status = String(data?.moderationStatus || data?.status || '').toUpperCase();
    if (!['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED'].includes(status)) {
      throw new BadRequestException('moderationStatus must be PENDING, APPROVED, REJECTED, or FLAGGED');
    }
    const videoObjectId = this.toObjectId(id, 'videoId');
    const updated = await this.sellerVideoModel.findOneAndUpdate(
      { _id: videoObjectId, deletedAt: null },
      {
        $set: {
          moderationStatus: status,
          moderationReason: this.cleanText(data?.reason, 500),
          moderatedBy: user.userId,
          moderatedAt: new Date(),
          ...(status === 'APPROVED' ? { processingStatus: 'READY', isActive: true } : {}),
          ...(status === 'REJECTED' ? { isActive: false } : {}),
        },
        $push: { auditTrail: { action: 'moderated', actorId: user.userId, reason: status, at: new Date() } },
      },
      { new: true },
    )
      .populate('sellerId', 'stallName shopDetails rating totalOrders')
      .populate('marketId', 'name slug code location imageUrl')
      .populate('productId', 'name price unit images category categoryLabel categoryId')
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Seller video not found');
    return this.presentation(updated, user.userId);
  }
}
