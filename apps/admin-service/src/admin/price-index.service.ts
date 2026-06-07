import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus } from '@rmf/shared-types';

/**
 * Market Price Index (Feature 10). Weekly aggregation of delivered-order line item
 * prices per (market, category). Computed by cron then published manually before
 * becoming public.
 */
@Injectable()
export class PriceIndexService {
  private readonly logger = new Logger(PriceIndexService.name);

  constructor(
    @InjectModel('Transaction') private orderModel: Model<any>,
    @InjectModel('PriceIndex') private priceIndexModel: Model<any>,
  ) {}

  @Cron('0 23 * * 0') // Every Sunday 23:00
  async scheduledComputation(): Promise<void> {
    if (process.env.PRICE_INDEX_COMPUTE_ENABLED === 'false') {
      this.logger.log('Price index computation disabled via PRICE_INDEX_COMPUTE_ENABLED=false');
      return;
    }
    const week = this.isoWeek(new Date());
    await this.computeForWeek(week);
  }

  /** ISO-8601 week string, e.g. "2026-W23". */
  isoWeek(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  /** Resolve the [start, end] date range for an ISO week string. */
  weekRange(week: string): { start: Date; end: Date } {
    const match = /^(\d{4})-W(\d{2})$/.exec(week);
    if (!match) throw new Error(`Invalid ISO week: ${week}`);
    const year = Number(match[1]);
    const weekNo = Number(match[2]);
    // Monday of ISO week 1.
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
    const start = new Date(week1Monday);
    start.setUTCDate(week1Monday.getUTCDate() + (weekNo - 1) * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);
    end.setUTCMilliseconds(-1);
    return { start, end };
  }

  async computeForWeek(week: string): Promise<{ week: string; records: number }> {
    this.logger.log(`Computing market price index for ${week}...`);
    const { start, end } = this.weekRange(week);

    const results = await this.orderModel.aggregate([
      { $match: { status: OrderStatus.DELIVERED, deletedAt: null, createdAt: { $gte: start, $lte: end } } },
      { $unwind: '$products' },
      {
        $group: {
          _id: { marketId: '$seller.marketId', categoryId: '$products.categoryId' },
          categoryLabel: { $first: '$products.category' },
          avgPrice: { $avg: '$products.unitPrice' },
          minPrice: { $min: '$products.unitPrice' },
          maxPrice: { $max: '$products.unitPrice' },
          sampleSize: { $sum: 1 },
        },
      },
    ]);

    // Previous week (for trend comparison).
    const prevWeek = this.shiftWeek(week, -1);

    let recordCount = 0;
    for (const r of results) {
      const marketId = r._id?.marketId;
      const categoryId = r._id?.categoryId || 'other';
      if (!marketId) continue;

      const prev = await this.priceIndexModel
        .findOne({ week: prevWeek, marketId, categoryId })
        .select('avgPrice')
        .lean()
        .exec();

      let trend: 'RISING' | 'FALLING' | 'STABLE' = 'STABLE';
      if (prev?.avgPrice && prev.avgPrice > 0) {
        const change = (r.avgPrice - prev.avgPrice) / prev.avgPrice;
        if (change > 0.05) trend = 'RISING';
        else if (change < -0.05) trend = 'FALLING';
      }

      await this.priceIndexModel.findOneAndUpdate(
        { week, marketId, categoryId },
        {
          $set: {
            categoryLabel: r.categoryLabel || categoryId,
            avgPrice: Math.round(r.avgPrice),
            minPrice: Math.round(r.minPrice),
            maxPrice: Math.round(r.maxPrice),
            sampleSize: r.sampleSize,
            trend,
          },
        },
        { upsert: true, new: true },
      );
      recordCount++;
    }

    this.logger.log(`Price index for ${week} computed: ${recordCount} records.`);
    return { week, records: recordCount };
  }

  async publishWeek(week: string): Promise<{ week: string; published: number }> {
    const res = await this.priceIndexModel.updateMany(
      { week },
      { $set: { isPublished: true, publishedAt: new Date() } },
    );
    return { week, published: (res as any).modifiedCount ?? 0 };
  }

  async query(filter: { week?: string; marketId?: string; categoryId?: string }): Promise<any[]> {
    const q: any = { deletedAt: null };
    if (filter.week) q.week = filter.week;
    if (filter.marketId) q.marketId = filter.marketId;
    if (filter.categoryId) q.categoryId = filter.categoryId;
    return this.priceIndexModel.find(q).sort({ categoryLabel: 1 }).lean().exec();
  }

  async latest(marketId?: string): Promise<{ week: string | null; records: any[] }> {
    const latestDoc = await this.priceIndexModel
      .findOne({ isPublished: true, deletedAt: null })
      .sort({ week: -1, publishedAt: -1 })
      .select('week')
      .lean()
      .exec();
    if (!latestDoc) return { week: null, records: [] };
    const q: any = { week: latestDoc.week, isPublished: true, deletedAt: null };
    if (marketId) q.marketId = marketId;
    const records = await this.priceIndexModel.find(q).sort({ categoryLabel: 1 }).lean().exec();
    return { week: latestDoc.week, records };
  }

  private shiftWeek(week: string, delta: number): string {
    const { start } = this.weekRange(week);
    const shifted = new Date(start);
    shifted.setUTCDate(start.getUTCDate() + delta * 7);
    return this.isoWeek(shifted);
  }
}
