import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { LiveGateway } from './live.gateway';

/**
 * Live Selling (Feature 2) — PLACEHOLDER infrastructure.
 *
 * LIVE_STREAM_PROVIDER defaults to 'none': streamKey = crypto.randomUUID(), playbackUrl stays null,
 * no external (Cloudflare/Mux) API calls.
 *
 * SECURITY: streamKey is a secret. It is select:false on the schema and is ONLY ever returned to
 * the session owner (the seller who started it). Viewer-facing responses never include it.
 */
@Injectable()
export class LiveSessionService {
  private readonly logger = new Logger(LiveSessionService.name);

  constructor(
    @InjectModel('LiveSession') private liveModel: Model<any>,
    @InjectModel('SellerVideo') private videoModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    private gateway: LiveGateway,
  ) {}

  private async getSeller(userId: string): Promise<any> {
    const seller = await this.sellerModel.findOne({ userId, deletedAt: null }).select('_id marketId').lean().exec();
    if (!seller) throw new NotFoundException('Seller profile not found');
    return seller;
  }

  async start(userId: string): Promise<any> {
    const seller = await this.getSeller(userId);
    const streamKey = randomUUID();

    let playbackUrl: string | null = null;
    const provider = process.env.LIVE_STREAM_PROVIDER || 'none';
    if (provider === 'cloudflare' && process.env.CLOUDFLARE_STREAM_TOKEN) {
      // Real provider integration intentionally omitted for the placeholder.
      this.logger.warn('LIVE_STREAM_PROVIDER=cloudflare set but provider integration is a placeholder; playbackUrl stays null.');
    }

    const session = await this.liveModel.create({
      sellerId: seller._id,
      sellerUserId: userId,
      marketId: seller.marketId,
      streamKey,
      playbackUrl,
      status: 'live',
      startedAt: new Date(),
      featuredProductIds: [],
    });

    const video = await this.videoModel.create({
      sellerId: seller._id,
      userId,
      placement: 'LIVE',
      isLive: true,
      liveSessionId: session._id,
      videoUrl: playbackUrl || undefined,
    }).catch((e: any) => {
      this.logger.warn(`SellerVideo create failed for live session: ${e?.message}`);
      return null;
    });

    if (video) await this.liveModel.findByIdAndUpdate(session._id, { $set: { videoId: video._id } });

    this.gateway.emitToMarket(String(seller.marketId), 'live:started', { sessionId: String(session._id), sellerId: String(seller._id) });

    // streamKey is ONLY returned here, to the owner.
    return { sessionId: String(session._id), streamKey, playbackUrl };
  }

  async end(userId: string, sessionId: string): Promise<any> {
    const session = await this.liveModel.findById(sessionId);
    if (!session) throw new NotFoundException('Live session not found');
    if (String(session.sellerUserId) !== String(userId)) {
      throw new ForbiddenException('Only the session owner can end this session');
    }
    session.status = 'ended';
    session.endedAt = new Date();
    await session.save();

    await this.videoModel.updateMany(
      { liveSessionId: session._id },
      { $set: { isLive: false, liveEndedAt: new Date() } },
    );

    this.gateway.emitToRoom(String(session._id), 'live:ended', { sessionId: String(session._id) });
    return { ended: true };
  }

  /** Public active sessions — NEVER include streamKey (select:false already excludes it). */
  async listActive(marketId?: string): Promise<any[]> {
    const q: any = { status: 'live', deletedAt: null };
    if (marketId) q.marketId = marketId;
    const sessions = await this.liveModel.find(q).sort({ startedAt: -1 }).lean().exec();
    return sessions.map((s: any) => {
      // Defence in depth: strip streamKey even if a future query selects it.
      const { streamKey, ...safe } = s;
      return safe;
    });
  }

  async featureProduct(userId: string, sessionId: string, productId: string): Promise<any> {
    const session = await this.liveModel.findById(sessionId).select('sellerUserId featuredProductIds').exec();
    if (!session) throw new NotFoundException('Live session not found');
    if (String(session.sellerUserId) !== String(userId)) {
      throw new ForbiddenException('Only the session owner can feature products');
    }
    await this.liveModel.findByIdAndUpdate(sessionId, { $addToSet: { featuredProductIds: productId } });
    this.gateway.emitToRoom(sessionId, 'live:product_featured', { productId });
    return { success: true };
  }

  async getOrders(userId: string, sessionId: string): Promise<any[]> {
    const session = await this.liveModel.findById(sessionId).select('sellerUserId').lean().exec();
    if (!session) throw new NotFoundException('Live session not found');
    if (String(session.sellerUserId) !== String(userId)) {
      throw new ForbiddenException('Only the session owner can view session orders');
    }
    // Transaction lookups by liveSessionId are served by order-service; the studio reads
    // them over the real-time socket (live:new_order). Returns empty here by design.
    return [];
  }
}
