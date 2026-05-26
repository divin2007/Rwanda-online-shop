import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LocationService } from '@rmf/location';
import { MarketType } from '@rmf/shared-types';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class MarketService implements OnModuleInit {
  private readonly logger = new Logger(MarketService.name);
  private locationService: LocationService;

  constructor(
    @InjectModel('Market') private marketModel: Model<any>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {
    this.locationService = new LocationService();
  }

  async onModuleInit() {
    this.logger.log('Market Service initialized.');
    await this.clearMarketListCache().catch(err => {
      this.logger.warn(`Failed to clear cache on init: ${err.message}`);
    });
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private buildMarketStatsPipeline(match: any): any[] {
    return [
      { $match: match },
      { $addFields: { _idString: { $toString: '$_id' } } },
      {
        $lookup: {
          from: 'sellerprofiles',
          let: { marketId: '$_id', marketIdString: '$_idString' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$deletedAt', null] },
                    { $eq: ['$isApproved', true] },
                    { $ne: ['$isOnVacation', true] },
                    {
                      $or: [
                        { $eq: ['$marketId', '$$marketId'] },
                        { $eq: ['$marketId', '$$marketIdString'] },
                      ],
                    },
                  ],
                },
              },
            },
            { $project: { shopDetails: 1, stallPhotoUrl: 1 } },
          ],
          as: 'activeSellers',
        },
      },
      {
        $lookup: {
          from: 'products',
          let: { marketId: '$_id', marketIdString: '$_idString' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$deletedAt', null] },
                    { $eq: ['$isActive', true] },
                    { $eq: ['$isApproved', true] },
                    {
                      $or: [
                        { $eq: ['$marketId', '$$marketId'] },
                        { $eq: ['$marketId', '$$marketIdString'] },
                      ],
                    },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                activeProducts: { $sum: 1 },
                sellerIds: { $addToSet: '$sellerId' },
                totalOrders: { $sum: '$totalOrders' },
                productRatingSum: { $sum: '$rating' },
              },
            },
          ],
          as: 'productStats',
        },
      },
      {
        $addFields: {
          activeSellerCount: { $size: '$activeSellers' },
          productStatsDoc: {
            $ifNull: [
              { $arrayElemAt: ['$productStats', 0] },
              { activeProducts: 0, sellerIds: [], totalOrders: 0, productRatingSum: 0 },
            ],
          },
        },
      },
      {
        $addFields: {
          activeProducts: { $ifNull: ['$productStatsDoc.activeProducts', 0] },
          totalOrders: { $ifNull: ['$productStatsDoc.totalOrders', 0] },
          productRatingSum: { $ifNull: ['$productStatsDoc.productRatingSum', 0] },
          imageUrl: {
            $ifNull: [
              '$imageUrl',
              {
                $ifNull: [
                  { $arrayElemAt: ['$activeSellers.shopDetails.bannerUrl', 0] },
                  {
                    $ifNull: [
                      { $arrayElemAt: ['$activeSellers.shopDetails.imageUrl', 0] },
                      { $arrayElemAt: ['$activeSellers.stallPhotoUrl', 0] },
                    ],
                  },
                ],
              },
            ],
          },
          logoUrl: {
            $ifNull: [
              { $arrayElemAt: ['$activeSellers.shopDetails.logoUrl', 0] },
              { $arrayElemAt: ['$activeSellers.stallPhotoUrl', 0] },
            ],
          },
          bannerUrl: {
            $ifNull: [
              { $arrayElemAt: ['$activeSellers.shopDetails.bannerUrl', 0] },
              {
                $ifNull: [
                  '$imageUrl',
                  { $arrayElemAt: ['$activeSellers.shopDetails.hubImageUrl', 0] },
                ],
              },
            ],
          },
          totalSellers: '$activeSellerCount',
        },
      },
      {
        $project: {
          activeSellers: 0,
          productStats: 0,
          productStatsDoc: 0,
          activeSellerCount: 0,
          _idString: 0,
        },
      },
      { $sort: { isActive: -1, totalSellers: -1, activeProducts: -1, name: 1 } },
    ];
  }

  private async clearMarketListCache(): Promise<void> {
    await this.cacheManager.del('markets:all:true:any');
    await this.cacheManager.del('markets:all:false:any');
    for (const type of Object.values(MarketType)) {
      await this.cacheManager.del(`markets:all:true:${type}`);
      await this.cacheManager.del(`markets:all:false:${type}`);
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
      await this.clearMarketListCache();
      return saved;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException('Market with this slug or code already exists');
      }
      throw error;
    }
  }

  async findAll(options: boolean | { activeOnly?: boolean; type?: string } = true): Promise<any[]> {
    const activeOnly = typeof options === 'boolean' ? options : options.activeOnly !== false;
    const type = typeof options === 'boolean' ? undefined : options.type;
    const cacheKey = `markets:all:${activeOnly}:${type || 'any'}`;

    // N4 fix: cache market list results (5 min TTL) — was never actually caching despite having cacheManager
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    if (cached) return cached;

    const match: any = { deletedAt: null };
    if (activeOnly) match.isActive = true;
    if (type && Object.values(MarketType).includes(type as MarketType)) {
      match.type = type;
    }

    const results = await this.marketModel.aggregate(this.buildMarketStatsPipeline(match)).exec();
    await this.cacheManager.set(cacheKey, results, 5 * 60 * 1000);
    return results;
  }

  async findById(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      try {
        return await this.findBySlug(id);
      } catch {
        throw new BadRequestException('Invalid market ID');
      }
    }

    const [market] = await this.marketModel.aggregate(this.buildMarketStatsPipeline({
      _id: new Types.ObjectId(id),
      deletedAt: null,
    })).exec();
    if (!market) throw new NotFoundException('Market not found');
    return market;
  }

  async findBySlug(slug: string): Promise<any> {
    const [market] = await this.marketModel.aggregate(this.buildMarketStatsPipeline({
      slug: { $regex: new RegExp(`^${this.escapeRegex(slug)}$`, 'i') },
      deletedAt: null,
    })).exec();
    if (!market) throw new NotFoundException('Market not found');
    return market;
  }

  async geocode(query: string): Promise<any> {
    const trimmedQuery = query?.trim();
    if (!trimmedQuery || trimmedQuery.length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters');
    }

    return this.locationService.geocode(trimmedQuery);
  }

  async reverseGeocode(lat: number, lng: number): Promise<any> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('Latitude and longitude are required');
    }

    const coordinates = { lat, lng };
    if (!this.locationService.validateCoordinates(coordinates)) {
      throw new BadRequestException('Invalid coordinates provided');
    }

    return this.locationService.reverseGeocode(coordinates);
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
    await this.clearMarketListCache();

    return updatedMarket;
  }

  async applyPenalty(id: string, penaltyType: 'warning' | 'charge' | 'suspension', reason: string): Promise<any> {
    const updates: any = {};
    if (penaltyType === 'suspension') {
      updates.isActive = false;
    }
    // MD7 fix: use structured NestJS logger instead of console.log
    this.logger.warn(`Penalty applied to market ${id}: ${penaltyType} - ${reason}`);
    return this.update(id, updates);
  }

  async getAgreement(): Promise<string> {
    return `
      MARKET RWANDA SELLER AGREEMENT
      
      1. Acceptance of Terms: By registering as a seller on Market Rwanda, you agree to comply with all local laws and platform regulations.
      2. Stall Management: Sellers are responsible for maintaining accurate stock levels and pricing.
      3. Commissions: A standard commission of 1.5% (minimum 100 RWF) is applied to all successful transactions.
      4. Quality Standards: All goods must meet Rwanda's national quality and hygiene standards.
      5. Delivery Participation: Sellers agree to hand over goods to authorized Market Rwanda riders within 30 minutes of order confirmation.
    `;
  }

  async syncInstitutionalImagery(): Promise<void> {
    const marketsToFix = await this.marketModel.aggregate([
      { $match: { $or: [{ imageUrl: null }, { imageUrl: '' }], deletedAt: null } },
      {
        $lookup: {
          from: 'sellerprofiles',
          localField: '_id',
          foreignField: 'marketId',
          as: 'sellers'
        }
      },
      { $match: { 'sellers.0': { $exists: true } } }
    ]).exec();

    for (const m of marketsToFix) {
      const firstSeller = m.sellers[0];
      const newImageUrl = firstSeller.shopDetails?.imageUrl || firstSeller.stallPhotoUrl;
      if (newImageUrl) {
        await this.marketModel.findByIdAndUpdate(m._id, { $set: { imageUrl: newImageUrl } });
      }
    }

    await this.clearMarketListCache();
  }
}
