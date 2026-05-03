import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel('Product') private productModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

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

  async findAll(marketId?: string, sellerId?: string): Promise<any[]> {
    const cacheKey = `products:all:${marketId || 'any'}:${sellerId || 'any'}`;
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const query: any = { isActive: true, deletedAt: null };
    if (marketId) query.marketId = marketId;
    
    if (sellerId) {
      // Check if sellerId is a User ID (from frontend) and map to SellerProfile ID
      const seller = await this.sellerModel.findOne({ userId: sellerId }).exec();
      query.sellerId = seller ? seller._id : sellerId;
    }
    
    const results = await this.productModel.find(query).exec();
    
    // Set cache with 5 minute TTL (300 seconds)
    await this.cacheManager.set(cacheKey, results, 300000);
    
    return results;
  }

  async findById(id: string): Promise<any> {
    const cacheKey = `product:${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    
    if (cached) return cached;

    const product = await this.productModel.findOne({ _id: id, deletedAt: null }).exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    
    await this.cacheManager.set(cacheKey, product, 300000);
    return product;
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
    await this.cacheManager.del('products:all');

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
}
