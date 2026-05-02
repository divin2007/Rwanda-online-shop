import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel('Product') private productModel: Model<any>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  async create(productData: any): Promise<any> {
    if (!productData.images || !Array.isArray(productData.images) || productData.images.length === 0) {
      throw new BadRequestException('Product must have at least one image to be listed');
    }

    const newProduct = new this.productModel(productData);
    const saved = await newProduct.save();
    
    // Invalidate list cache
    await this.cacheManager.del('products:all');
    
    return saved;
  }

  async findAll(marketId?: string, sellerId?: string): Promise<any[]> {
    const cacheKey = `products:all:${marketId || 'any'}:${sellerId || 'any'}`;
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const query: any = { isActive: true, deletedAt: null };
    if (marketId) query.marketId = marketId;
    if (sellerId) query.sellerId = sellerId;
    
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
