import { Injectable, NotFoundException, BadRequestException, Inject, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class ProductService implements OnModuleInit {
  constructor(
    @InjectModel('Product') private productModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('Market') private marketModel: Model<any>,
    @InjectModel('Promotion') private promotionModel: Model<any>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  async onModuleInit() {
    // Removed auto-approve migration — it overrode admin decisions on every restart.
    // Products default to isApproved: false via the schema and must be approved by an admin.
  }

  async create(productData: any): Promise<any> {
    if (!productData.images || !Array.isArray(productData.images) || productData.images.length === 0) {
      throw new BadRequestException('At least one product image is required.');
    }

    const { name, price, category, unit } = productData;
    if (!name || price === undefined || price === null || !category || !unit) {
      throw new BadRequestException('Product Name, Price, Category, and Unit are required.');
    }

    // Map authenticated User ID to SellerProfile ID and Market ID
    if (productData.sellerId) {
      try {
        const userId = productData.sellerId;
        // Strategy 1: Find by ObjectId
        let seller = await this.sellerModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
        
        // Strategy 2: Find by String (fallback for some DB drivers/configs)
        if (!seller) {
          seller = await this.sellerModel.findOne({ userId: userId }).exec();
        }

        if (!seller) {
          throw new BadRequestException(`Seller profile not found for User ID: ${userId}. Please ensure you are logged in as a registered seller.`);
        }
        
        productData.sellerId = seller._id; 
        productData.marketId = seller.marketId;
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException('Invalid Seller ID format or profile lookup failed.');
      }
    }

    if (!productData.marketId) {
      throw new BadRequestException('Your shop is not correctly linked to a market. Please contact support.');
    }

    // Sanitize numeric fields
    productData.price = Number(productData.price);
    productData.stockQuantity = Number(productData.stockQuantity || 0);
    if (productData.weight) productData.weight = Number(productData.weight);
    else delete productData.weight;

    if (isNaN(productData.price)) throw new BadRequestException('Price must be a valid number.');

    try {
      const newProduct = new this.productModel(productData);
      const saved = await newProduct.save();
      
      // Invalidate list cache
      await this.cacheManager.del('products:all');
      
      return saved;
    } catch (err: any) {
      console.error('Product creation failed:', err);
      // Catch Mongoose validation errors and return a clean message
      if (err.name === 'ValidationError') {
        const firstError = Object.values(err.errors)[0] as any;
        throw new BadRequestException(`Validation Failed: ${firstError.message}`);
      }
      throw err;
    }
  }

  async findAll(query: any): Promise<any[]> {
    const { marketId, sellerId, approvedOnly, isActive, limit, sortBy } = query;
    // Normalize cache key: only include fields that affect the query, in sorted order
    const canonicalQuery = JSON.stringify({ marketId, sellerId, approvedOnly, isActive, limit, sortBy });
    const cacheKey = `products:all:${canonicalQuery}`;
    const cached = await this.cacheManager.get<any[]>(cacheKey);

    if (cached) return cached;

    const filter: any = { deletedAt: null };
    
    if (approvedOnly === 'true' || approvedOnly === true || query.isApproved === 'true' || query.isApproved === true) {
      filter.isActive = true;
      filter.isApproved = true;
    } else if (isActive !== undefined) {
      filter.isActive = isActive === 'true' || isActive === true;
      if (query.isApproved !== undefined) {
        filter.isApproved = query.isApproved === 'true' || query.isApproved === true;
      }
    } else if (!sellerId) {
      // Default for public views
      filter.isActive = true;
      filter.isApproved = true; // Public views should always be approved products
    }
    
    if (marketId) filter.marketId = marketId;
    
    if (sellerId) {
      // Check if sellerId is a User ID (from frontend) and map to SellerProfile ID
      const seller = await this.sellerModel.findOne({ userId: sellerId }).exec();
      filter.sellerId = seller ? seller._id : sellerId;
    }
    
    const dbQuery = this.productModel.find(filter).populate(['sellerId', 'marketId']).lean();

    if (sortBy) {
        dbQuery.sort(sortBy);
    } else {
        dbQuery.sort({ createdAt: -1 });
    }

    if (limit) {
        dbQuery.limit(Number(limit));
    }
    
    const results = await dbQuery.exec();
    
    // Enrich with active promotion data
    const enriched = await this.enrichWithPromotions(results);
    
    // Set cache with 5 minute TTL (300 seconds)
    await this.cacheManager.set(cacheKey, enriched, 300000);
    
    return enriched;
  }

  async findById(id: string): Promise<any> {
    const cacheKey = `product:${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    
    if (cached) return cached;

    const product = await this.productModel.findOne({ _id: id, deletedAt: null }).populate(['sellerId', 'marketId']).lean().exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    
    // Enrich with promotion data
    const [enriched] = await this.enrichWithPromotions([product]);
    
    await this.cacheManager.set(cacheKey, enriched, 300000);
    return enriched;
  }

  async update(id: string, updateData: any): Promise<any> {
    if (updateData.images !== undefined) {
      if (!Array.isArray(updateData.images) || updateData.images.length === 0) {
        throw new BadRequestException('Product must have at least one image');
      }
    }

    const updatedProduct = await this.productModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updateData },
      { new: true }
    ).exec();

    if (!updatedProduct) {
      throw new NotFoundException('Product not found');
    }
    
    // Invalidate Cache
    await this.cacheManager.del(`product:${id}`);
    
    // We need to invalidate list caches. Since they are parameter-dependent,
    // and cache-manager doesn't easily support wildcard deletion, 
    // we should at least clear the common ones or use a more robust strategy.
    // For now, let's clear the primary products:all which is a common prefix.
    try {
      // If using redis, we could use keys and del. 
      // In memory, we can try to clear or just wait.
      // A better way is to use a cache versioning system or clear the whole store if needed.
      // But for this project, let's just ensure we clear the most likely ones.
      await this.cacheManager.del('products:all'); 
      // Some cache managers allow resetting the whole store
      if ((this.cacheManager as any).reset) {
        await (this.cacheManager as any).reset();
      }
    } catch (e) {
      console.error('Cache invalidation failed', e);
    }

    return updatedProduct;
  }

  async updateStock(id: string, quantityChange: number): Promise<any> {
    const product = await this.findById(id);
    const newStock = product.stockQuantity + quantityChange;
    
    if (newStock < 0) {
      throw new BadRequestException('Insufficient stock');
    }
    
    return this.update(id, { 
      stockQuantity: newStock,
      inStock: newStock > 0 
    });
  }

  /**
   * Enrich a list of products with their active promotion data.
   * Attaches a `promotion` field to each product if an active promo exists.
   */
  private async enrichWithPromotions(products: any[]): Promise<any[]> {
    if (products.length === 0) return products;

    const now = new Date();
    const productIds = products.map(p => p._id?.toString() || p.id);
    
    const activePromos = await this.promotionModel.find({
      productId: { $in: productIds },
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gt: now },
      deletedAt: null
    }).lean().exec();

    // Build a map of productId -> promotion
    const promoMap = new Map<string, any>();
    for (const promo of activePromos) {
      promoMap.set(promo.productId.toString(), promo);
    }

    return products.map(product => {
      const p = typeof product.toObject === 'function' ? product.toObject() : { ...product };
      const promo = promoMap.get(p._id?.toString());
      if (promo) {
        p.promotion = {
          type: promo.type,
          discount: promo.discount,
          promotedPrice: promo.promotedPrice || p.price,
          endDate: promo.endDate
        };
      }
      return p;
    });
  }
}
