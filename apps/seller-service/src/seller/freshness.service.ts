import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

/**
 * Verified Freshness (Feature 12). Food/produce sellers check in each day so buyers
 * know the stall is open and stock is fresh. A rider can additionally confirm the
 * stall is open during a delivery, which strengthens the freshness signal.
 */
@Injectable()
export class FreshnessService {
  constructor(@InjectModel('SellerProfile') private sellerModel: Model<any>) {}

  /** Authenticated seller checks in for today (expires at end of local day). */
  async checkIn(userId: string): Promise<any> {
    if (!userId) throw new BadRequestException('Authentication required');
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const seller = await this.sellerModel.findOneAndUpdate(
      { userId, deletedAt: null },
      {
        $set: {
          'freshnessCheckin.checkedInAt': now,
          'freshnessCheckin.expiresAt': endOfDay,
          // A new daily check-in clears any prior rider confirmation.
          'freshnessCheckin.confirmedByRiderId': null,
        },
      },
      { new: true },
    );
    if (!seller) throw new NotFoundException('Seller profile not found');

    return {
      isCheckedIn: true,
      checkedInAt: seller.freshnessCheckin?.checkedInAt,
      expiresAt: seller.freshnessCheckin?.expiresAt,
    };
  }

  /** Public freshness status for a seller profile id. */
  async getStatus(sellerId: string): Promise<any> {
    if (!sellerId || !Types.ObjectId.isValid(sellerId)) {
      throw new BadRequestException('Invalid seller id');
    }
    const seller = await this.sellerModel
      .findOne({ _id: sellerId, deletedAt: null })
      .select('freshnessCheckin')
      .lean()
      .exec();
    if (!seller) throw new NotFoundException('Seller profile not found');

    const checkin = seller.freshnessCheckin || {};
    const expiresAt = checkin.expiresAt ? new Date(checkin.expiresAt) : null;
    const isCheckedIn = Boolean(expiresAt && expiresAt.getTime() > Date.now());
    return {
      isCheckedIn,
      checkedInAt: checkin.checkedInAt || null,
      expiresAt: checkin.expiresAt || null,
      confirmedByRider: Boolean(checkin.confirmedByRiderId),
    };
  }
}
