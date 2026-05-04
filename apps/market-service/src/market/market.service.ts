import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LocationService } from '@rmf/location';
import { MarketType } from '@rmf/shared-types';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class MarketService implements OnModuleInit {
  private locationService: LocationService;

  constructor(
    @InjectModel('Market') private marketModel: Model<any>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {
    this.locationService = new LocationService();
  }

  async onModuleInit() {
    // Migration: ensure all markets are active and not deleted
    try {
        const result = await this.marketModel.updateMany(
            { deletedAt: null },
            { $set: { isActive: true } }
        );
        console.log(`[Migration] Activated ${result.modifiedCount} markets`);
    } catch (e) {
        console.error('[Migration] Failed to activate markets', e);
    }
  }

  async create(marketData: any): Promise<any> {
    if (!marketData.location || !this.locationService.validateCoordinates(marketData.location.coordinates)) {
      throw new BadRequestException('Invalid coordinates provided');
    }

    if (Array.isArray(marketData.location.coordinates) && !marketData.location.type) {
      marketData.location.type = 'Point';
    }

    if (marketData.type === MarketType.INDIVIDUAL && !marketData.ownerId) {
      throw new BadRequestException('Individual markets must have an ownerId');
    }

    if (marketData.slug) {
      marketData.slug = marketData.slug.toLowerCase();
    }

    try {
      const newMarket = new this.marketModel(marketData);
      const saved = await newMarket.save();
      await this.cacheManager.del('markets:all');
      return saved;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException('Market with this slug or code already exists');
      }
      throw error;
    }
  }

  async findAll(activeOnly = true): Promise<any[]> {
    const cacheKey = `markets:all:${activeOnly}`;
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    
    if (cached) return cached;

    const query = activeOnly ? { isActive: true, deletedAt: null } : { deletedAt: null };
    const results = await this.marketModel.find(query).exec();
    
    // 30 minute TTL for markets
    await this.cacheManager.set(cacheKey, results, 1800000);
    return results;
  }

  async findById(id: string): Promise<any> {
    const cacheKey = `market:id:${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const market = await this.marketModel.findOne({ _id: id, deletedAt: null }).exec();
    if (!market) throw new NotFoundException('Market not found');
    
    await this.cacheManager.set(cacheKey, market, 1800000);
    return market;
  }

  async findBySlug(slug: string): Promise<any> {
    const cacheKey = `market:slug:${slug}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const market = await this.marketModel.findOne({ 
      slug: { $regex: new RegExp(`^${slug}$`, 'i') }, 
      deletedAt: null 
    }).exec();
    if (!market) throw new NotFoundException('Market not found');
    
    await this.cacheManager.set(cacheKey, market, 1800000);
    return market;
  }

  async update(id: string, updateData: any): Promise<any> {
    if (updateData.location && updateData.location.coordinates) {
      if (!this.locationService.validateCoordinates(updateData.location.coordinates)) {
        throw new BadRequestException('Invalid coordinates provided');
      }
    }

    if (updateData.slug) {
      updateData.slug = updateData.slug.toLowerCase();
    }

    const updatedMarket = await this.marketModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updateData },
      { new: true }
    ).exec();

    if (!updatedMarket) throw new NotFoundException('Market not found');

    await this.cacheManager.del(`market:id:${id}`);
    await this.cacheManager.del(`market:slug:${updatedMarket.slug}`);
    await this.cacheManager.del('markets:all:true');
    await this.cacheManager.del('markets:all:false');

    return updatedMarket;
  }

  async applyPenalty(id: string, penaltyType: 'warning' | 'charge' | 'suspension', reason: string): Promise<any> {
    const updates: any = {};
    if (penaltyType === 'suspension') {
      updates.isActive = false;
    }
    console.log(`Penalty applied to market ${id}: ${penaltyType} - ${reason}`);
    return this.update(id, updates);
  }

  async getAgreement(): Promise<string> {
    return `
      MARKET RWANDA SELLER AGREEMENT
      
      1. Acceptance of Terms: By registering as a seller on Market Rwanda, you agree to comply with all local laws and platform regulations.
      2. Stall Management: Sellers are responsible for maintaining accurate stock levels and pricing.
      3. Commissions: A standard commission of 2% is applied to all successful transactions.
      4. Quality Standards: All goods must meet Rwanda's national quality and hygiene standards.
      5. Delivery Participation: Sellers agree to hand over goods to authorized Market Rwanda riders within 30 minutes of order confirmation.
    `;
  }
}
