import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

@Injectable()
export class MenuService {
  constructor(
    @InjectModel('Menu') private menuModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
  ) {}

  /**
   * Resolve the seller profile that belongs to the authenticated user.
   * Every write path goes through this so a user can only ever touch their own menu.
   */
  private async getOwnerProfile(userId: string): Promise<any> {
    if (!userId) throw new BadRequestException('Authentication required');
    const profile = await this.sellerModel.findOne({ userId }).lean().exec();
    if (!profile) {
      throw new NotFoundException('Seller profile not found. Complete seller onboarding first.');
    }
    return profile;
  }

  /** Find (or create an empty) menu owned by this user. */
  private async getOrCreateMenuForUser(userId: string): Promise<any> {
    const profile = await this.getOwnerProfile(userId);
    let menu = await this.menuModel.findOne({ userId, deletedAt: null }).exec();
    if (!menu) {
      menu = await this.menuModel.create({
        sellerId: profile._id,
        userId,
        sections: [],
        availabilityHours: [],
      });
    }
    return menu;
  }

  async getMyMenu(userId: string): Promise<any> {
    if (!userId) throw new BadRequestException('Authentication required');
    return this.menuModel.findOne({ userId, deletedAt: null }).lean().exec();
  }

  /**
   * Public buyer-facing menu. Only active menus, only visible sections,
   * only available items are returned. sellerId is the SellerProfile _id.
   */
  async getPublicMenu(sellerId: string): Promise<any> {
    if (!sellerId || !Types.ObjectId.isValid(sellerId)) {
      throw new BadRequestException('Invalid seller id');
    }
    const menu = await this.menuModel
      .findOne({ sellerId, isActive: true, deletedAt: null })
      .lean()
      .exec();
    if (!menu) return null;

    const sections = (menu.sections || [])
      .filter((section: any) => section.isVisible !== false)
      .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((section: any) => ({
        ...section,
        items: (section.items || [])
          .filter((item: any) => item.isAvailable !== false)
          .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)),
      }));

    // Public projection: never leak the owner's userId or internal bookkeeping fields.
    return {
      _id: menu._id,
      sellerId: menu.sellerId,
      currency: menu.currency,
      isActive: menu.isActive,
      availabilityHours: menu.availabilityHours,
      sections,
    };
  }

  /** Create or replace the full menu (sections + metadata) for this user. */
  async upsertMenu(userId: string, data: any): Promise<any> {
    const profile = await this.getOwnerProfile(userId);
    const update: any = {
      sellerId: profile._id,
      userId,
      deletedAt: null,
    };
    if (Array.isArray(data?.sections)) update.sections = data.sections;
    if (Array.isArray(data?.availabilityHours)) update.availabilityHours = data.availabilityHours;
    if (typeof data?.isActive === 'boolean') update.isActive = data.isActive;
    if (typeof data?.currency === 'string') update.currency = data.currency;

    return this.menuModel
      .findOneAndUpdate({ userId }, { $set: update }, { new: true, upsert: true })
      .exec();
  }

  /** Update menu-level metadata only (availabilityHours, isActive, currency). */
  async updateMenuMeta(userId: string, data: any): Promise<any> {
    await this.getOrCreateMenuForUser(userId);
    const update: any = {};
    if (Array.isArray(data?.availabilityHours)) update.availabilityHours = data.availabilityHours;
    if (typeof data?.isActive === 'boolean') update.isActive = data.isActive;
    if (typeof data?.currency === 'string') update.currency = data.currency;
    if (Object.keys(update).length === 0) {
      throw new BadRequestException('No valid menu metadata fields provided');
    }
    return this.menuModel
      .findOneAndUpdate({ userId, deletedAt: null }, { $set: update }, { new: true })
      .exec();
  }

  async addSection(userId: string, sectionData: any): Promise<any> {
    if (!sectionData?.name) throw new BadRequestException('Section name is required');
    const menu = await this.getOrCreateMenuForUser(userId);
    menu.sections.push({
      name: sectionData.name,
      description: sectionData.description,
      items: [],
      sortOrder: sectionData.sortOrder ?? menu.sections.length,
      isVisible: sectionData.isVisible ?? true,
    });
    await menu.save();
    return menu;
  }

  private findSection(menu: any, sectionId: string): any {
    const section = menu.sections.id(sectionId);
    if (!section) throw new NotFoundException('Menu section not found');
    return section;
  }

  async updateSection(userId: string, sectionId: string, data: any): Promise<any> {
    const menu = await this.getOrCreateMenuForUser(userId);
    const section = this.findSection(menu, sectionId);
    if (data?.name !== undefined) section.name = data.name;
    if (data?.description !== undefined) section.description = data.description;
    if (data?.sortOrder !== undefined) section.sortOrder = data.sortOrder;
    if (data?.isVisible !== undefined) section.isVisible = data.isVisible;
    await menu.save();
    return menu;
  }

  async deleteSection(userId: string, sectionId: string): Promise<any> {
    const menu = await this.getOrCreateMenuForUser(userId);
    const section = this.findSection(menu, sectionId);
    section.deleteOne();
    await menu.save();
    return menu;
  }

  async addItem(userId: string, sectionId: string, itemData: any): Promise<any> {
    if (!itemData?.name) throw new BadRequestException('Item name is required');
    if (itemData?.price === undefined || itemData?.price === null || Number(itemData.price) < 0) {
      throw new BadRequestException('Item price must be a non-negative number');
    }
    const menu = await this.getOrCreateMenuForUser(userId);
    const section = this.findSection(menu, sectionId);
    section.items.push({
      name: itemData.name,
      description: itemData.description,
      price: Number(itemData.price),
      images: Array.isArray(itemData.images) ? itemData.images : [],
      dietaryTags: Array.isArray(itemData.dietaryTags) ? itemData.dietaryTags : [],
      preparationMinutes: itemData.preparationMinutes ?? 15,
      isAvailable: itemData.isAvailable ?? true,
      modifiers: Array.isArray(itemData.modifiers) ? itemData.modifiers : [],
      sortOrder: itemData.sortOrder ?? section.items.length,
      perishable: itemData.perishable === true,
      maxDeliveryMinutes: itemData.perishable === true
        ? (Number(itemData.maxDeliveryMinutes) > 0 ? Math.round(Number(itemData.maxDeliveryMinutes)) : 60)
        : undefined,
    });
    await menu.save();
    return menu;
  }

  private findItem(section: any, itemId: string): any {
    const item = section.items.id(itemId);
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  async updateItem(userId: string, sectionId: string, itemId: string, data: any): Promise<any> {
    const menu = await this.getOrCreateMenuForUser(userId);
    const section = this.findSection(menu, sectionId);
    const item = this.findItem(section, itemId);

    if (data?.name !== undefined) item.name = data.name;
    if (data?.description !== undefined) item.description = data.description;
    if (data?.price !== undefined) {
      if (Number(data.price) < 0) throw new BadRequestException('Item price must be non-negative');
      item.price = Number(data.price);
    }
    if (data?.images !== undefined) item.images = Array.isArray(data.images) ? data.images : item.images;
    if (data?.dietaryTags !== undefined) item.dietaryTags = Array.isArray(data.dietaryTags) ? data.dietaryTags : item.dietaryTags;
    if (data?.preparationMinutes !== undefined) item.preparationMinutes = data.preparationMinutes;
    if (data?.isAvailable !== undefined) item.isAvailable = data.isAvailable;
    if (data?.modifiers !== undefined) item.modifiers = Array.isArray(data.modifiers) ? data.modifiers : item.modifiers;
    if (data?.sortOrder !== undefined) item.sortOrder = data.sortOrder;
    if (data?.perishable !== undefined) {
      item.perishable = data.perishable === true;
      if (item.perishable) {
        item.maxDeliveryMinutes = Number(data.maxDeliveryMinutes ?? item.maxDeliveryMinutes) > 0
          ? Math.round(Number(data.maxDeliveryMinutes ?? item.maxDeliveryMinutes))
          : 60;
      } else {
        item.maxDeliveryMinutes = undefined;
      }
    }

    await menu.save();
    return menu;
  }

  async deleteItem(userId: string, sectionId: string, itemId: string): Promise<any> {
    const menu = await this.getOrCreateMenuForUser(userId);
    const section = this.findSection(menu, sectionId);
    const item = this.findItem(section, itemId);
    item.deleteOne();
    await menu.save();
    return menu;
  }

  async toggleItemAvailability(userId: string, sectionId: string, itemId: string): Promise<any> {
    const menu = await this.getOrCreateMenuForUser(userId);
    const section = this.findSection(menu, sectionId);
    const item = this.findItem(section, itemId);
    item.isAvailable = !item.isAvailable;
    await menu.save();
    return menu;
  }
}
