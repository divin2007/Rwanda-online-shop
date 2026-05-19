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

  async create(user: AuthUser, data: any) {
    const seller = await this.findSellerForUser(user, data?.sellerId);
    const product = await this.resolveLinkedProduct(data?.productId, seller, user);
    const marketId = await this.resolveMarketId(data?.marketId, seller, product);
    const title = this.cleanText(data?.title, 100);
    const caption = this.cleanText(data?.caption, 800);
    const placement = data?.placement === 'SHOP_AD' || data?.isShopAd === true ? 'SHOP_AD' : 'PRODUCT_AD';

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

    const payload = {
      sellerId: seller._id,
      sellerUserId: seller.userId,
      marketId,
      productId: placement === 'SHOP_AD' ? undefined : product?._id,
      placement,
      title,
      caption,
      videoUrl: this.validateUrl(data?.videoUrl, 'videoUrl'),
      thumbnailUrl: data?.thumbnailUrl ? this.validateUrl(data.thumbnailUrl, 'thumbnailUrl') : undefined,
      durationSeconds: data?.durationSeconds ? Math.min(Number(data.durationSeconds), 600) : undefined,
      tags: this.cleanTags(data?.tags),
      isActive: data?.isActive === undefined ? true : data.isActive !== false,
      auditTrail: [{ action: 'created', actorId: user.userId, reason: 'seller_video_created', at: new Date() }],
    };

    const saved = await this.sellerVideoModel.create(payload);
    return this.findById(String(saved._id), false, user.userId);
  }

  async findAll(query: VideoQuery = {}, viewerId?: string) {
    const filter: any = { deletedAt: null, isActive: true };
    if (query.marketId) filter.marketId = this.toObjectId(String(query.marketId), 'marketId');
    if (query.sellerId) filter.sellerId = this.toObjectId(String(query.sellerId), 'sellerId');
    if (query.productId) filter.productId = this.toObjectId(String(query.productId), 'productId');
    if (query.placement === 'SHOP_AD' || query.placement === 'PRODUCT_AD') filter.placement = query.placement;
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
      .populate('productId', 'name price unit images category categoryLabel')
      .lean()
      .exec();

    return videos.map(video => this.presentation(video, viewerId));
  }

  async findById(id: string, incrementView = true, viewerId?: string) {
    const objectId = this.toObjectId(id, 'videoId');
    const operation = incrementView
      ? this.sellerVideoModel.findOneAndUpdate({ _id: objectId, deletedAt: null, isActive: true }, { $inc: { viewCount: 1 } }, { new: true })
      : this.sellerVideoModel.findOne({ _id: objectId, deletedAt: null, isActive: true });
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
    return this.findById(id, false, user.userId);
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
    await this.sellerVideoModel.updateOne({ _id: videoObjectId, deletedAt: null }, { $pull: pullBoth }).exec();
    if (reaction !== 'none') {
      await this.sellerVideoModel.updateOne(
        { _id: videoObjectId, deletedAt: null },
        { $addToSet: reaction === 'like' ? { likeUserIds: userObjectId } : { dislikeUserIds: userObjectId } },
      ).exec();
    }
    const updated = await this.sellerVideoModel.findOne({ _id: videoObjectId, deletedAt: null }).exec();
    if (!updated) throw new NotFoundException('Seller video not found');
    updated.likeCount = updated.likeUserIds.length;
    updated.dislikeCount = updated.dislikeUserIds.length;
    await updated.save();
    if (reaction === 'like') this.recordViewerSignal(user.userId, updated, 'video_like').catch(() => {});
    return this.findById(id, false, user.userId);
  }

  async comment(user: AuthUser, id: string, data: any) {
    const text = this.cleanText(data?.text, 700);
    if (!text) throw new BadRequestException('Comment text is required');
    const userObjectId = this.toObjectId(user.userId, 'userId');
    const videoObjectId = this.toObjectId(id, 'videoId');
    const fullName = this.cleanText(data?.fullName || user.email || 'RMF user', 80);
    const updated = await this.sellerVideoModel.findOneAndUpdate(
      { _id: videoObjectId, deletedAt: null },
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
}
