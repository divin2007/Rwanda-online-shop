import { Injectable, NotFoundException, BadRequestException, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { CatalogCategory, CatalogField, catalogCategories, resolveCatalogCategory } from './catalog.definitions';

@Injectable()
export class ProductService implements OnModuleInit {
  private readonly logger = new Logger(ProductService.name);
  constructor(
    @InjectModel('Product') private productModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('Market') private marketModel: Model<any>,
    @InjectModel('Promotion') private promotionModel: Model<any>,
    @InjectModel('TaxonomyCategory') private taxonomyModel: Model<any>,
    @InjectModel('User') private userModel: Model<any>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) { }

  async findSellerProfile(sellerId: string): Promise<any | null> {
    if (!sellerId) return null;

    const lookups: any[] = [{ userId: sellerId }];
    if (Types.ObjectId.isValid(sellerId)) {
      const objectId = new Types.ObjectId(sellerId);
      lookups.unshift({ _id: objectId }, { userId: objectId });
    }

    return this.sellerModel.findOne({ $or: lookups, deletedAt: null }).exec();
  }

  private parseImageList(value: any): string[] {
    const images = String(value || '')
      .split(/[,\s;|\r\n]+/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    if (images.length === 0) {
      throw new Error('Images column is required and must include at least one product image URL');
    }

    const invalid = images.find((url: string) => !/^https?:\/\//i.test(url));
    if (invalid) {
      throw new Error(`Invalid image URL: ${invalid}`);
    }

    return images;
  }

  private cleanOptionalUrl(value: any, field: string): string | undefined {
    const url = String(value || '').trim();
    if (!url) return undefined;
    if (!/^https?:\/\//i.test(url)) {
      throw new BadRequestException(`${field} must be a public http(s) URL.`);
    }
    return url.slice(0, 600);
  }

  private parseBooleanFlag(value: any): boolean | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    return undefined;
  }

  private normalizeImportKey(value: unknown): string {
    return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
  }

  private canonicalAttributeKey(value: unknown): string {
    const rawKey = String(value || '').trim();
    const normalized = this.normalizeImportKey(rawKey);
    if (!normalized) return rawKey;

    const attributeFields = catalogCategories.flatMap(category => category.attributes);
    const match = attributeFields.find(field =>
      this.normalizeImportKey(field.key) === normalized
      || this.normalizeImportKey(field.label) === normalized
    );

    return match?.key || rawKey;
  }

  private parseAttributesFromRow(row: Record<string, any>): Record<string, any> {
    const attributes: Record<string, any> = {};
    const keys = Object.keys(row);
    const attrCol = keys.find(k => {
      const normalized = this.normalizeImportKey(k);
      return ['attributes', 'attributejson', 'attributesjson', 'specs', 'specifications'].includes(normalized);
    });

    const rawJson = attrCol ? row[attrCol] : undefined;
    if (rawJson) {
      try {
        const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
        if (parsed && typeof parsed === 'object') {
          for (const [key, value] of Object.entries(parsed)) {
            attributes[this.canonicalAttributeKey(key)] = value;
          }
        }
      } catch {
        throw new Error('Attributes must be valid JSON when provided');
      }
    }

    for (const [key, value] of Object.entries(row)) {
      const lowerKey = key.toLowerCase().trim();
      let attrKey: string | null = null;
      if (lowerKey.startsWith('attr')) {
        attrKey = key.slice(4);
      } else if (lowerKey.startsWith('attribute')) {
        attrKey = key.slice(9);
      }
      if (attrKey && value !== undefined && value !== null && value !== '') {
        attributes[this.canonicalAttributeKey(attrKey)] = value;
      }
    }

    return attributes;
  }

  private validateCategoryAttributes(category: CatalogCategory, attributes: Record<string, any>): string[] {
    const errors: string[] = [];
    for (const field of category.attributes) {
      const rawValue = attributes[field.key];
      const value = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
      if (field.required && value === '') {
        errors.push(`${field.label} (${field.key}) is required for ${category.label}`);
        continue;
      }
      if (value === '') continue;
      if (field.type === 'select' && field.options?.length) {
        const allowed = field.options.map(option => String(option).toLowerCase());
        if (!allowed.includes(value.toLowerCase())) {
          errors.push(`${field.label} must be one of: ${field.options.join(', ')}`);
        }
      }
      if (field.type === 'number') {
        const numberValue = Number(rawValue);
        if (!Number.isFinite(numberValue)) {
          errors.push(`${field.label} must be a number`);
        } else {
          if (field.min !== undefined && numberValue < field.min) errors.push(`${field.label} must be at least ${field.min}`);
          if (field.max !== undefined && numberValue > field.max) errors.push(`${field.label} must be at most ${field.max}`);
        }
      }
    }
    return errors;
  }

  private applyBulkAttributeFallbacks(category: CatalogCategory, attributes: Record<string, any>): Record<string, any> {
    if (process.env.BULK_IMPORT_ALLOW_ATTRIBUTE_FALLBACKS !== 'true') return attributes;
    for (const field of category.attributes) {
      if (!field.required) continue;
      const currentVal = attributes[field.key];
      if (currentVal !== undefined && currentVal !== null && currentVal !== '') continue;
      if (field.type === 'select' && field.options?.length) {
        attributes[field.key] = field.options.find(opt => ['other', 'mixed', 'a', 'new'].includes(opt.toLowerCase())) || field.options[0];
      } else if (field.type === 'boolean') {
        attributes[field.key] = true;
      } else if (field.type === 'number') {
        attributes[field.key] = field.min !== undefined ? field.min : 0;
      } else {
        attributes[field.key] = 'Generic';
      }
    }
    return attributes;
  }

  private async invalidateProductCaches(productId?: string) {
    try {
      if (productId) {
        await this.safeCacheDel(`product:${productId}`);
      }
      await this.safeCacheDel('products:all');
      await this.safeCacheDel('catalog:categories');
      await this.safeCacheDel('catalog:categories:all');

      if ((this.cacheManager as any).reset) {
        await (this.cacheManager as any).reset();
      } else if ((this.cacheManager as any).clear) {
        await (this.cacheManager as any).clear();
      }
    } catch (err: any) {
      console.warn(`[ProductService] Cache namespace flush skipped: ${err.message}`);
    }
  }

  private async safeCacheDel(key: string): Promise<void> {
    try {
      await Promise.race([
        this.cacheManager.del(key),
        new Promise(resolve => setTimeout(resolve, 500)),
      ]);
    } catch (error: any) {
      console.warn(`[ProductService] Cache delete skipped for ${key}: ${error?.message || error}`);
    }
  }

  private async safeCacheGet<T>(key: string): Promise<T | undefined> {
    try {
      return await Promise.race([
        this.cacheManager.get<T>(key),
        new Promise<undefined>(resolve => setTimeout(resolve, 250)),
      ]);
    } catch (error: any) {
      console.warn(`[ProductService] Cache read skipped for ${key}: ${error?.message || error}`);
      return undefined;
    }
  }

  private async safeCacheSet(key: string, value: unknown, ttl: number): Promise<void> {
    try {
      await Promise.race([
        this.cacheManager.set(key, value, ttl),
        new Promise(resolve => setTimeout(resolve, 250)),
      ]);
    } catch (error: any) {
      console.warn(`[ProductService] Cache write skipped for ${key}: ${error?.message || error}`);
    }
  }

  private normalizeCategoryId(value: unknown): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  private sanitizeCatalogField(field: any): CatalogField {
    const key = this.normalizeCategoryId(field?.key).replace(/-/g, '_');
    if (!key) throw new BadRequestException('Every taxonomy field needs a key.');
    const type = ['text', 'number', 'select', 'multi_select', 'boolean', 'date', 'color'].includes(String(field?.type))
      ? String(field.type) as CatalogField['type']
      : 'text';
    const options = Array.isArray(field?.options)
      ? field.options.map((option: any) => String(option).trim()).filter(Boolean).slice(0, 80)
      : String(field?.options || '').split(',').map(option => option.trim()).filter(Boolean).slice(0, 80);

    return {
      key,
      label: String(field?.label || key).trim().slice(0, 80),
      type,
      required: this.parseBooleanFlag(field?.required) === true,
      unit: field?.unit ? String(field.unit).trim().slice(0, 20) : undefined,
      options,
      min: field?.min === undefined || field?.min === '' ? undefined : Number(field.min),
      max: field?.max === undefined || field?.max === '' ? undefined : Number(field.max),
      searchable: this.parseBooleanFlag(field?.searchable) === true,
      filterable: this.parseBooleanFlag(field?.filterable) === true,
    };
  }

  private sanitizeCatalogCategory(input: any, existing?: any): CatalogCategory {
    const id = this.normalizeCategoryId(input.id || existing?.id || input.label);
    if (!id) throw new BadRequestException('Category ID or label is required.');
    const label = String(input.label || existing?.label || id).trim().slice(0, 120);
    const productType = this.normalizeCategoryId(input.productType || existing?.productType || id).replace(/-/g, '_');
    const aliases = Array.from(new Set([
      id,
      label.toLowerCase(),
      ...(Array.isArray(input.aliases) ? input.aliases : String(input.aliases || existing?.aliases || '').split(',')),
    ].map((alias: any) => String(alias).trim().toLowerCase()).filter(Boolean))).slice(0, 40);
    const synonyms = Array.from(new Set([
      ...(Array.isArray(input.synonyms) ? input.synonyms : String(input.synonyms || existing?.synonyms || '').split(',')),
    ].map((synonym: any) => String(synonym).trim().toLowerCase()).filter(Boolean))).slice(0, 80);

    return {
      id,
      label,
      productType,
      defaultUnit: String(input.defaultUnit || existing?.defaultUnit || 'pcs').trim().slice(0, 20),
      aliases,
      synonyms,
      searchBoost: Number(input.searchBoost || existing?.searchBoost || 1),
      variantAxes: (Array.isArray(input.variantAxes) ? input.variantAxes : existing?.variantAxes || []).map((field: any) => this.sanitizeCatalogField(field)).slice(0, 12),
      attributes: (Array.isArray(input.attributes) ? input.attributes : existing?.attributes || []).map((field: any) => this.sanitizeCatalogField(field)).slice(0, 80),
      isActive: input.isActive === undefined ? existing?.isActive !== false : this.parseBooleanFlag(input.isActive) !== false,
      version: Number(existing?.version || input.version || 1),
      parentId: input.parentId !== undefined
        ? (input.parentId ? String(input.parentId).trim().toLowerCase() : null)
        : (existing?.parentId || null),
    };
  }

  private async seedCatalogCategoriesIfNeeded(): Promise<void> {
    const activeDefaultCategoryIds = catalogCategories.map(category => this.normalizeCategoryId(category.id));
    
    // Prune bloated category audit trails once on startup to recover database speed
    try {
      const bloatedCount = await this.taxonomyModel.countDocuments({
        'auditTrail.10': { $exists: true }
      }).exec();
      if (bloatedCount > 0) {
        this.logger.log(`[TaxonomySeeder] Found ${bloatedCount} bloated category documents. Pruning audit trails...`);
        const allCategories = await this.taxonomyModel.find({ 'auditTrail.10': { $exists: true } }).exec();
        for (const cat of allCategories) {
          if (Array.isArray(cat.auditTrail) && cat.auditTrail.length > 5) {
            cat.auditTrail = cat.auditTrail.slice(-3); // Keep only the latest 3 entries
            await cat.save();
          }
        }
        this.logger.log(`[TaxonomySeeder] Bloated audit trail pruning complete.`);
      }
    } catch (pruneErr: any) {
      this.logger.warn(`[TaxonomySeeder] Failed to prune bloated category audit trails: ${pruneErr.message}`);
    }

    const existingRows = await this.taxonomyModel
      .find({ id: { $in: activeDefaultCategoryIds }, deletedAt: null })
      .select('id version')
      .lean()
      .exec();
    const existingIds = new Set(existingRows.map((row: any) => row.id));
    const operations = [];

    for (const category of catalogCategories) {
      const id = this.normalizeCategoryId(category.id);
      if (existingIds.has(id)) {
        continue; // Already seeded, bypass write completely!
      }
      const sanitized = this.sanitizeCatalogCategory(category);

      const payload = {
        ...sanitized,
        synonyms: sanitized.synonyms?.length ? sanitized.synonyms : sanitized.aliases,
        searchBoost: sanitized.searchBoost || 1,
        isActive: true,
        version: 1,
        auditTrail: [{ action: 'seeded', reason: 'default_catalog_bootstrap', at: new Date() }],
      };

      operations.push({
        updateOne: {
          filter: { id },
          update: { $set: payload },
          upsert: true,
        },
      });
    }

    if (operations.length > 0) {
      this.logger.log(`[TaxonomySeeder] Seeding ${operations.length} missing default categories...`);
      await this.taxonomyModel.bulkWrite(operations, { ordered: false });

      await this.taxonomyModel.updateMany(
        {
          deletedAt: null,
          isActive: { $ne: false },
          $or: [
            { id: /^shopify_/ },
            {
              id: { $nin: activeDefaultCategoryIds },
              auditTrail: { $elemMatch: { reason: 'default_catalog_bootstrap' } },
              createdBy: null,
            },
          ],
        },
        {
          $set: { isActive: false },
          $push: {
            auditTrail: {
              action: 'deactivated',
              reason: 'rmf_v3_catalog_replaced_shopify_taxonomy',
              at: new Date(),
            },
          },
        }
      );
    }
  }

  async getCatalogCategories(includeInactive = false): Promise<CatalogCategory[]> {

    const cacheKey = includeInactive ? 'catalog:categories:all' : 'catalog:categories';
    const cached = await this.safeCacheGet<CatalogCategory[]>(cacheKey);
    if (cached) return cached;
    await this.seedCatalogCategoriesIfNeeded();
    const rows = await this.taxonomyModel
      .find({ deletedAt: null, ...(includeInactive ? {} : { isActive: true }) })
      .lean()
      .exec();
    const orderMap = new Map(catalogCategories.map((category, index) => [category.id, index]));
    const categories = rows
      .map(row => this.sanitizeCatalogCategory(row))
      .sort((left, right) => {
        const leftOrder = orderMap.get(left.id);
        const rightOrder = orderMap.get(right.id);
        if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
        if (leftOrder !== undefined) return -1;
        if (rightOrder !== undefined) return 1;
        return left.label.localeCompare(right.label);
      });
    await this.safeCacheSet(cacheKey, categories, 6 * 60 * 60 * 1000);
    return categories;
  }

  async getDescendantLeafCategoryIds(categoryId: string): Promise<string[]> {
    const categories = await this.getCatalogCategories(false);
    const categoryMap = new Map<string, CatalogCategory>();
    const parentToChildren = new Map<string, string[]>();

    for (const cat of categories) {
      categoryMap.set(cat.id, cat);
      if (cat.parentId) {
        const children = parentToChildren.get(cat.parentId) || [];
        children.push(cat.id);
        parentToChildren.set(cat.parentId, children);
      }
    }

    const leafIds: string[] = [];
    const visited = new Set<string>();

    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      const children = parentToChildren.get(currentId) || [];
      if (children.length === 0) {
        leafIds.push(currentId);
      } else {
        for (const childId of children) {
          traverse(childId);
        }
      }
    };

    traverse(categoryId);
    return leafIds;
  }

  async buildCategoryTree(): Promise<any[]> {
    const categories = await this.getCatalogCategories(false);
    const categoryMap = new Map<string, any>();
    const roots: any[] = [];

    for (const cat of categories) {
      categoryMap.set(cat.id, {
        id: cat.id,
        label: cat.label,
        productType: cat.productType,
        parentId: cat.parentId,
        variantAxes: cat.variantAxes,
        attributes: cat.attributes,
        children: []
      });
    }

    for (const cat of categories) {
      const node = categoryMap.get(cat.id);
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        const parentNode = categoryMap.get(cat.parentId);
        parentNode.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async getCategorySchema(categoryId: string): Promise<CatalogCategory> {
    return this.resolveCatalogCategoryDynamic(categoryId);
  }

  async upsertCatalogCategory(input: any): Promise<CatalogCategory> {
    const existing = input.id ? await this.taxonomyModel.findOne({ id: this.normalizeCategoryId(input.id), deletedAt: null }).lean().exec() : null;
    const category = this.sanitizeCatalogCategory(input, existing);
    const actorId = input.updatedBy || input.createdBy || input.actorId || null;
    const updated = await this.taxonomyModel.findOneAndUpdate(
      { id: category.id },
      {
        $set: { ...category, updatedBy: actorId, deletedAt: null },
        $setOnInsert: { createdBy: actorId },
        $inc: existing ? { version: 1 } : {},
        $push: { auditTrail: { action: existing ? 'updated' : 'created', actorId, reason: 'admin_taxonomy_change', at: new Date() } },
      },
      { returnDocument: 'after', upsert: true }
    ).lean().exec();
    await this.invalidateProductCaches();
    return this.sanitizeCatalogCategory(updated);
  }

  async deleteCatalogCategory(categoryId: string, actorId?: string): Promise<CatalogCategory> {
    const id = this.normalizeCategoryId(categoryId);
    const inUse = await this.productModel.countDocuments({ categoryId: id, deletedAt: null }).exec();
    if (inUse > 0) {
      throw new BadRequestException(`Category ${id} is used by ${inUse} products. Move or migrate products before deleting it.`);
    }
    const deleted = await this.taxonomyModel.findOneAndUpdate(
      { id, deletedAt: null },
      {
        $set: { isActive: false, deletedAt: new Date(), updatedBy: actorId || null },
        $push: { auditTrail: { action: 'deleted', actorId: actorId || null, reason: 'admin_taxonomy_delete', at: new Date() } },
      },
      { returnDocument: 'after' }
    ).lean().exec();
    if (!deleted) throw new NotFoundException('Catalog category not found');
    await this.invalidateProductCaches();
    return this.sanitizeCatalogCategory(deleted);
  }

  private async resolveCatalogCategoryDynamic(value: unknown): Promise<CatalogCategory> {
    const rawValue = String(value || '').trim();
    const lookupValues = Array.from(new Set([
      rawValue,
      rawValue.includes('|') ? rawValue.split('|').pop()?.trim() : '',
      rawValue.match(/\[([A-Za-z0-9_-]+)\]\s*$/)?.[1] || '',
    ].filter(Boolean)));
    const categories = await this.getCatalogCategories();
    const match = lookupValues
      .map(candidate => {
        const normalizedId = this.normalizeCategoryId(candidate);
        const normalizedText = String(candidate).toLowerCase();
        return categories.find(category =>
          category.id === normalizedId ||
          category.productType === normalizedId ||
          category.label.toLowerCase() === normalizedText ||
          category.aliases?.some(alias => alias.toLowerCase() === normalizedText) ||
          category.synonyms?.some(synonym => synonym.toLowerCase() === normalizedText)
        );
      })
      .find(Boolean);
    return this.inheritCategoryFields(match || resolveCatalogCategory(value), categories);
  }

  private inheritCategoryFields(category: CatalogCategory, categories: CatalogCategory[]): CatalogCategory {
    let variantAxes = [...(category.variantAxes || [])];
    let attributes = [...(category.attributes || [])];
    const byId = new Map(categories.map(item => [item.id, item]));
    let parentId = category.parentId || null;

    while ((variantAxes.length === 0 || attributes.length === 0) && parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;
      if (variantAxes.length === 0 && parent.variantAxes?.length) {
        variantAxes = parent.variantAxes;
      }
      if (attributes.length === 0 && parent.attributes?.length) {
        attributes = parent.attributes;
      }
      parentId = parent.parentId || null;
    }

    return { ...category, variantAxes, attributes };
  }

  private catalogCategoryForProduct(product: any): CatalogCategory {
    const direct = catalogCategories.find(category =>
      category.id === product?.categoryId ||
      category.productType === product?.productType ||
      category.id === product?.category
    );
    return direct || resolveCatalogCategory(product?.categoryId || product?.category || product?.productType);
  }

  private legacyCategoryValues(category: CatalogCategory): string[] {
    return Array.from(new Set([
      category.id,
      category.label,
      category.productType,
      ...category.aliases,
      ...category.aliases.map(alias => alias.replace(/\b\w/g, char => char.toUpperCase())),
    ]));
  }

  private addAndFilter(filter: any, condition: any) {
    if (!filter.$and) filter.$and = [];
    filter.$and.push(condition);
  }

  private withCatalogMetadata(product: any): any {
    const category = this.catalogCategoryForProduct(product);
    return {
      ...product,
      categoryId: product.categoryId || category.id,
      categoryLabel: product.categoryLabel || category.label,
      productType: product.productType || category.productType,
      attributeSetVersion: product.attributeSetVersion || 1,
      unit: product.unit || category.defaultUnit,
      variantAxes: product.variantAxes || category.variantAxes.filter(axis => axis.options?.length).map(axis => ({
        key: axis.key,
        label: axis.label,
        values: axis.options || [],
      })),
      attributes: product.attributes || {},
      priceUpdatedAt: product.priceUpdatedAt || product.updatedAt || product.createdAt,
    };
  }

  private coerceAttributeValue(field: CatalogField, value: any): any {
    if (value === undefined || value === null || value === '') {
      if (field.required) {
        throw new BadRequestException(`${field.label} is required for this category.`);
      }
      return undefined;
    }

    if (field.type === 'boolean') {
      const parsed = this.parseBooleanFlag(value);
      if (parsed === undefined) throw new BadRequestException(`${field.label} must be yes or no.`);
      return parsed;
    }

    if (field.type === 'number') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new BadRequestException(`${field.label} must be a number.`);
      if (field.min !== undefined && parsed < field.min) throw new BadRequestException(`${field.label} must be at least ${field.min}.`);
      if (field.max !== undefined && parsed > field.max) throw new BadRequestException(`${field.label} must be at most ${field.max}.`);
      return parsed;
    }

    if (field.type === 'multi_select') {
      const values = Array.isArray(value) ? value : String(value).split(',');
      const normalized = values.map((item: any) => String(item).trim()).filter(Boolean);
      if (field.options?.length) {
        const invalid = normalized.find((item: string) => !field.options!.some(option => option.toLowerCase() === item.toLowerCase()));
        if (invalid) throw new BadRequestException(`${invalid} is not valid for ${field.label}.`);
      }
      return normalized;
    }

    const text = String(value).trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 500);
    if (field.type === 'select' && field.options?.length) {
      const match = field.options.find(option => option.toLowerCase() === text.toLowerCase());
      if (!match) throw new BadRequestException(`${text} is not valid for ${field.label}.`);
      return match;
    }
    if (field.type === 'date') {
      const date = new Date(text);
      if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field.label} must be a valid date.`);
      return date.toISOString().slice(0, 10);
    }
    return text;
  }

  private sanitizeAttributes(category: CatalogCategory, rawAttributes: any = {}, enforceRequired = true): Record<string, any> {
    const raw = rawAttributes instanceof Map ? Object.fromEntries(rawAttributes) : rawAttributes || {};
    const allowedKeys = new Set(category.attributes.map(field => field.key));
    const output: Record<string, any> = {};

    for (const field of category.attributes) {
      const fieldDef = enforceRequired ? field : { ...field, required: false };
      const value = this.coerceAttributeValue(fieldDef, raw[field.key]);
      if (value !== undefined) output[field.key] = value;
    }

    // Keep seller/admin-provided custom attributes, but bound them so this cannot become arbitrary document stuffing.
    for (const [key, value] of Object.entries(raw)) {
      if (allowedKeys.has(key)) continue;
      if (!/^[a-zA-Z][a-zA-Z0-9_]{1,40}$/.test(key)) continue;
      if (value === undefined || value === null || value === '') continue;
      output[key] = typeof value === 'object'
        ? JSON.parse(JSON.stringify(value)).toString().slice(0, 500)
        : String(value).trim().slice(0, 500);
    }

    return output;
  }

  private sanitizeVariantAxes(category: CatalogCategory, rawAxes: any[] = []): any[] {
    const axes = Array.isArray(rawAxes) && rawAxes.length > 0
      ? rawAxes
      : category.variantAxes.filter(axis => axis.options?.length).map(axis => ({ key: axis.key, label: axis.label, values: [] }));

    return axes
      .map(axis => {
        const definition = category.variantAxes.find(field => field.key === axis.key);
        if (!definition) return null;
        const rawValues = Array.isArray(axis.values) ? axis.values : String(axis.values || '').split(',');
        const values = rawValues.map((value: any) => String(value).trim()).filter(Boolean).slice(0, 30);
        return { key: definition.key, label: definition.label, values };
      })
      .filter(Boolean);
  }

  private sanitizeVariants(category: CatalogCategory, rawVariants: any[] = [], baseProduct: any): any[] {
    if (!Array.isArray(rawVariants)) return [];
    const allowedOptionKeys = new Set(category.variantAxes.map(axis => axis.key));

    return rawVariants.slice(0, 100).map((variant, index) => {
      const options = variant?.options && typeof variant.options === 'object' ? variant.options : {};
      const cleanOptions: Record<string, string> = {};
      for (const [key, value] of Object.entries(options)) {
        if (!allowedOptionKeys.has(key)) continue;
        cleanOptions[key] = String(value || '').trim().slice(0, 80);
      }

      const stockType = ['finite', 'infinite', 'on_demand'].includes(String(variant.stockType)) ? String(variant.stockType) : baseProduct.stockType;
      const stockQuantity = stockType === 'finite' ? Math.max(0, Number(variant.stockQuantity ?? baseProduct.stockQuantity ?? 0)) : 999999;
      const price = variant.price === undefined || variant.price === null || variant.price === ''
        ? undefined
        : Number(variant.price);

      if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
        throw new BadRequestException(`Variant ${index + 1} price must be a positive number.`);
      }

      const title = String(variant.title || Object.values(cleanOptions).filter(Boolean).join(' / ') || `${baseProduct.name} variant`).trim().slice(0, 160);
      return {
        sku: String(variant.sku || '').trim().slice(0, 80) || undefined,
        title,
        options: cleanOptions,
        price,
        unit: String(variant.unit || baseProduct.unit || category.defaultUnit).trim(),
        stockType,
        stockQuantity,
        inStock: variant.inStock === undefined ? stockType !== 'finite' || stockQuantity > 0 : this.parseBooleanFlag(variant.inStock) !== false,
        images: Array.isArray(variant.images) ? variant.images.filter((url: any) => /^https?:\/\//i.test(String(url))).slice(0, 6) : [],
        videoUrl: this.cleanOptionalUrl(variant.videoUrl, `Variant ${index + 1} videoUrl`),
        thumbnailUrl: this.cleanOptionalUrl(variant.thumbnailUrl, `Variant ${index + 1} thumbnailUrl`),
        attributes: this.sanitizeAttributes(category, variant.attributes || {}, false),
        isActive: variant.isActive === undefined ? true : this.parseBooleanFlag(variant.isActive) !== false,
      };
    });
  }

  private async normalizeProductData(input: any, existing?: any): Promise<any> {
    const productData = { ...input };
    const category = await this.resolveCatalogCategoryDynamic(productData.categoryId || productData.category || existing?.categoryId || existing?.category);

    // Verify that the assigned category is a leaf node (has no children)
    const allCategories = await this.getCatalogCategories(false);
    const hasChildren = allCategories.some(cat => cat.parentId === category.id);
    if (hasChildren) {
      throw new BadRequestException(
        `Cannot assign product to branch category '${category.label}'. Products must be associated with a leaf category.`
      );
    }

    const nextPrice = productData.price !== undefined ? Number(productData.price) : existing?.price;
    const previousPrice = existing?.price;

    productData.category = category.id;
    productData.categoryId = category.id;
    productData.categoryLabel = category.label;
    productData.productType = category.productType;
    productData.attributeSetVersion = 1;
    productData.unit = productData.unit || existing?.unit || category.defaultUnit;
    productData.attributes = this.sanitizeAttributes(category, productData.attributes || existing?.attributes || {});
    productData.variantAxes = this.sanitizeVariantAxes(category, productData.variantAxes || existing?.variantAxes || []);
    productData.variants = this.sanitizeVariants(category, productData.variants || existing?.variants || [], {
      ...existing,
      ...productData,
      price: nextPrice,
    });

    if (productData.price !== undefined) {
      productData.price = nextPrice;
      if (!Number.isFinite(productData.price) || productData.price < 0) {
        throw new BadRequestException('Price must be a valid positive number.');
      }
      if (previousPrice === undefined || Number(previousPrice) !== productData.price) {
        productData.priceUpdatedAt = new Date();
      }
    }

    productData.stockQuantity = Number(productData.stockQuantity ?? existing?.stockQuantity ?? 0);
    productData.stockType = ['finite', 'infinite', 'on_demand'].includes(String(productData.stockType || existing?.stockType))
      ? String(productData.stockType || existing?.stockType)
      : 'finite';
    if (productData.stockType !== 'finite') {
      productData.stockQuantity = 999999;
      productData.inStock = true;
    } else {
      productData.stockQuantity = Math.max(0, productData.stockQuantity || 0);
      productData.inStock = productData.inStock === undefined ? productData.stockQuantity > 0 : this.parseBooleanFlag(productData.inStock) !== false;
    }

    return productData;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private isMadeInRwandaSearch(search?: string): boolean {
    const normalized = String(search || '').trim().toLowerCase();
    return [
      'made in rwanda',
      'made-in-rwanda',
      'made_in_rwanda',
      'rwanda made',
      'rwandan made',
      'shop local',
      'local makers',
      'local artisans',
    ].some(token => normalized.includes(token));
  }

  private stringFromAttributes(attributes: any): string {
    const raw = attributes instanceof Map ? Object.fromEntries(attributes) : attributes || {};
    return Object.values(raw).map(value => Array.isArray(value) ? value.join(' ') : String(value || '')).join(' ');
  }

  private stringFromVariants(variants: any): string {
    if (!Array.isArray(variants)) return '';

    return variants.map((variant) => {
      const options = variant?.options instanceof Map ? Object.fromEntries(variant.options) : variant?.options || {};
      const attributes = variant?.attributes instanceof Map ? Object.fromEntries(variant.attributes) : variant?.attributes || {};
      return [
        variant?.title,
        variant?.sku,
        this.stringFromAttributes(options),
        this.stringFromAttributes(attributes),
      ].filter(Boolean).join(' ');
    }).join(' ');
  }

  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private calculateLevenshteinSimilarity(s1: string, s2: string): number {
    const longer = s1.toLowerCase();
    const shorter = s2.toLowerCase();
    if (longer.length < shorter.length) {
      return this.calculateLevenshteinSimilarity(s2, s1);
    }
    const longerLength = longer.length;
    if (longerLength === 0) {
      return 1.0;
    }

    const costs = [];
    for (let i = 0; i <= longer.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= shorter.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else {
          if (j > 0) {
            let newValue = costs[j - 1];
            if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            }
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
      }
      if (i > 0) {
        costs[shorter.length] = lastValue;
      }
    }

    return (longerLength - costs[shorter.length]) / longerLength;
  }

  private calculateHierarchyBoost(productCatId: string, targetCatId?: string, allCategories: CatalogCategory[] = []): number {
    if (!targetCatId) return 0;
    if (productCatId === targetCatId) {
      return 1000; // Perfect category matching boost
    }

    const prodCat = allCategories.find(c => c.id === productCatId);
    const targetCat = allCategories.find(c => c.id === targetCatId);
    if (!prodCat || !targetCat) return 0;

    // Sibling category boost: both categories share the same direct parent (e.g. shoes and clothes share fashion)
    if (prodCat.parentId && targetCat.parentId && prodCat.parentId === targetCat.parentId) {
      return 500;
    }

    // Direct Ancestor/Descendant boost (e.g. parent of current or vice versa)
    if (prodCat.parentId === targetCat.id || targetCat.parentId === prodCat.id) {
      return 200;
    }

    return 0;
  }

  private calculateSearchScore(
    product: any,
    search: string,
    category?: CatalogCategory,
    searchedCategory?: CatalogCategory,
    allCategories: CatalogCategory[] = [],
    userLat?: number,
    userLng?: number
  ): number {
    const term = search.trim().toLowerCase();
    
    // Keyword scoring
    let keywordScore = 0;
    if (term) {
      const haystacks = [
        { value: product.name, weight: 8 },
        { value: product.categoryLabel || product.category, weight: 5 },
        { value: product.description, weight: 3 },
        { value: this.stringFromAttributes(product.attributes), weight: 3 },
        { value: this.stringFromVariants(product.variants), weight: 5 },
        { value: product.sellerId?.stallName || product.sellerId?.shopDetails?.name, weight: 2 },
        { value: category?.aliases?.join(' '), weight: 4 },
        { value: category?.synonyms?.join(' '), weight: 4 },
      ];

      keywordScore = haystacks.reduce((score, part) => {
        const value = String(part.value || '').toLowerCase();
        if (!value) return score;
        if (value === term) return score + part.weight * 2;
        if (value.includes(term)) return score + part.weight;
        const tokens = term.split(/\s+/).filter(Boolean);
        return score + tokens.filter(token => value.includes(token)).length * (part.weight / Math.max(tokens.length, 1));
      }, Number(product.totalOrders || 0) * 0.02 + Number(product.rating || 0) * 0.8 + Number(category?.searchBoost || 1));

      // 1. Multi-Token Intersection & Typo-Tolerant Boosting
      const searchTokens = term.split(/\s+/).filter(Boolean);
      const searchableDoc = `${product.name} ${product.description || ''} ${product.categoryLabel || ''} ${this.stringFromAttributes(product.attributes)} ${this.stringFromVariants(product.variants)}`.toLowerCase();
      
      const matchedTokens = searchTokens.filter(token => searchableDoc.includes(token));
      const coverageRatio = searchTokens.length > 0 ? matchedTokens.length / searchTokens.length : 0;
      
      // Enforce premium boost for complete multi-word queries (e.g. "low J1" matching "Nike J1 low")
      if (coverageRatio === 1.0) {
        keywordScore += 400; // Major reward for complete word coverage in any order!
      } else if (coverageRatio >= 0.5) {
        keywordScore += 150; // Partial match reward
      }

      // 2. Levenshtein Typo Tolerance Fuzzy Matching
      let maxFuzzySimilarity = 0;
      const productWords = searchableDoc.split(/[\s,.\-_/]+/).filter(w => w.length > 2);
      for (const token of searchTokens) {
        if (token.length <= 2) continue;
        if (searchableDoc.includes(token)) continue; // Avoid redundant typo checking for direct matches
        for (const word of productWords) {
          const similarity = this.calculateLevenshteinSimilarity(token, word);
          if (similarity > maxFuzzySimilarity) {
            maxFuzzySimilarity = similarity;
          }
        }
      }
      
      if (maxFuzzySimilarity >= 0.75) {
        // Boost up to +150 points for very high similarity typo correction (e.g. "shos" -> "shoes")
        keywordScore += (maxFuzzySimilarity - 0.75) * 600;
      }
    } else {
      // Proximity only scoring basis
      keywordScore = Number(product.totalOrders || 0) * 0.02 + Number(product.rating || 0) * 0.8 + Number(category?.searchBoost || 1);
    }

    // 1. Category Hierarchy Tree boosting
    if (searchedCategory && product.categoryId) {
      keywordScore += this.calculateHierarchyBoost(product.categoryId, searchedCategory.id, allCategories);
    }


    // 2. Geospatial market-proximity boosting
    if (userLat !== undefined && userLng !== undefined) {
      const coords = product.marketId?.location?.coordinates;
      if (Array.isArray(coords) && coords.length === 2) {
        const marketLon = coords[0];
        const marketLat = coords[1];
        const distance = this.calculateHaversineDistance(userLat, userLng, marketLat, marketLon);
        // Inject physical distance in populated object
        product.distanceInKm = Number(distance.toFixed(2));
        // Boost closer products (maximum of +200 points for directly overlapping coords)
        keywordScore += (200 / (1 + distance));
      }
    }

    return keywordScore;
  }

  private rankProducts(
    products: any[],
    search?: string,
    searchedCategory?: CatalogCategory,
    allCategories: CatalogCategory[] = [],
    userLat?: number,
    userLng?: number
  ): any[] {
    const term = String(search || '').trim();
    if (!term && userLat === undefined && userLng === undefined) return products;
    return [...products]
      .map(product => {
        const category = this.catalogCategoryForProduct(product);
        return {
          ...product,
          searchScore: this.calculateSearchScore(
            product,
            term,
            category,
            searchedCategory,
            allCategories,
            userLat,
            userLng
          )
        };
      })
      .sort((a, b) => Number(b.searchScore || 0) - Number(a.searchScore || 0));
  }


  private scoreMap(items: any[] | undefined, keyName: 'key' | 'refId') {
    const map = new Map<string, number>();
    for (const item of Array.isArray(items) ? items : []) {
      const key = String(item?.[keyName] || '');
      if (key) map.set(key, Number(item.score || 0));
    }
    return map;
  }

  private recommendationScore(product: any, user: any): number {
    const discovery = user?.preferences?.discovery || {};
    const profile = user?.recommendationProfile || {};
    const categoryScores = this.scoreMap(profile.categoryScores, 'key');
    const marketScores = this.scoreMap(profile.marketScores, 'refId');
    const sellerScores = this.scoreMap(profile.sellerScores, 'refId');
    const productScores = this.scoreMap(profile.productScores, 'refId');
    const selectedCategories = new Set((discovery.categoryIds || []).map((item: any) => String(item)));
    const selectedMarkets = new Set((discovery.marketIds || []).map((item: any) => String(item)));
    const categoryId = String(product.categoryId || product.productType || product.category || '');
    const marketId = String(product.marketId?._id || product.marketId || '');
    const sellerId = String(product.sellerId?._id || product.sellerId || '');
    const productId = String(product._id || '');

    return (
      (selectedCategories.has(categoryId) ? 18 : 0)
      + (selectedMarkets.has(marketId) ? 12 : 0)
      + (categoryScores.get(categoryId) || 0)
      + (marketScores.get(marketId) || 0)
      + (sellerScores.get(sellerId) || 0)
      + (productScores.get(productId) || 0)
      + Number(product.totalOrders || 0) * 0.04
      + Number(product.rating || 0) * 1.5
      + (product.promotion ? 4 : 0)
      + (product.isMadeInRwanda ? 1.5 : 0)
    );
  }

  private async applyRecommendationRanking(products: any[], userId?: string) {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return products.sort((a, b) =>
        Number(b.totalOrders || 0) - Number(a.totalOrders || 0)
        || Number(b.rating || 0) - Number(a.rating || 0),
      );
    }

    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) return products;

    return products
      .map(product => ({
        ...product,
        recommendationScore: this.recommendationScore(product, user),
      }))
      .sort((a, b) =>
        Number(b.recommendationScore || 0) - Number(a.recommendationScore || 0)
        || Number(b.totalOrders || 0) - Number(a.totalOrders || 0)
        || Number(b.rating || 0) - Number(a.rating || 0),
      );
  }

  async getRecommendedProducts(userId: string | undefined, query: any = {}): Promise<any[]> {
    const limit = Math.min(Math.max(Number(query.limit || 24), 1), 200);
    const skip = Number(query.skip || 0);
    const { limit: _, skip: __, sortBy: ___, ...restQuery } = query;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return this.findAll({
        approvedOnly: true,
        isActive: true,
        ...restQuery,
        sortBy: { totalOrders: -1, rating: -1, createdAt: -1 },
        limit,
        skip,
      });
    }

    const candidateLimit = Math.min(Math.max(skip + limit, 80), 240);
    const products = await this.findAll({
      approvedOnly: true,
      isActive: true,
      ...restQuery,
      limit: candidateLimit,
    });
    const ranked = await this.applyRecommendationRanking(products, userId);
    return ranked.slice(skip, skip + limit);
  }

  async recordProductInteraction(userId: string, productId: string, action = 'product_view'): Promise<any> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(productId)) {
      throw new BadRequestException('Invalid recommendation interaction');
    }
    const product = await this.productModel.findOne({ _id: productId, deletedAt: null }).lean().exec();
    if (!product) throw new NotFoundException('Product not found');

    const weights: Record<string, number> = {
      view: 1,
      product_view: 2,
      wishlist: 6,
      like: 6,
      add_to_cart: 8,
      purchase: 12,
      dislike: -4,
    };
    const delta = weights[String(action)] ?? 1;
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');
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
          score: Math.max(-20, delta),
          lastSeenAt: new Date(),
        });
      }
      return current.filter(item => Number(item.score || 0) > -20).sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 80);
    };

    const categoryId = String(product.categoryId || product.productType || product.category || '').toLowerCase();
    const marketId = String(product.marketId || '');
    const sellerId = String(product.sellerId || '');

    const nextProfile = {
      categoryScores: upsert(profile.categoryScores || [], 'key', categoryId),
      marketScores: Types.ObjectId.isValid(marketId) ? upsert(profile.marketScores || [], 'refId', marketId) : profile.marketScores || [],
      sellerScores: Types.ObjectId.isValid(sellerId) ? upsert(profile.sellerScores || [], 'refId', sellerId) : profile.sellerScores || [],
      productScores: upsert(profile.productScores || [], 'refId', productId),
      recentProductIds: [
        new Types.ObjectId(productId),
        ...(Array.isArray(profile.recentProductIds) ? profile.recentProductIds.filter((id: any) => String(id) !== productId) : []),
      ].slice(0, 60),
      lastInteractionAt: new Date(),
    };

    await this.userModel.findByIdAndUpdate(userId, { $set: { recommendationProfile: nextProfile } }).exec();
    return { recorded: true, action, categoryId, marketId, sellerId };
  }

  async onModuleInit() {
    await this.seedCatalogCategoriesIfNeeded();

    if (process.env.SEED_PRODUCTS_ON_STARTUP !== 'true') {
      return;
    }

    console.log('🚀 FORCING Institutional Product Seeding...');
    try {
      const markets = await this.marketModel.find().exec();
      const categories = ['Produce', 'Handcrafts', 'Textiles', 'Spices', 'Dairy', 'Artisan', 'Household'];

      // Find a default seller to link products to (Products require a sellerId)
      let defaultSeller = await this.sellerModel.findOne().exec();

      for (const market of markets) {
        console.log(`📦 Seeding Products for Hub: ${market.name}`);
        for (let i = 1; i <= 5; i++) {
          const category = categories[(i + Math.floor(Math.random() * 7)) % categories.length];
          const prodName = `${market.name.split(' ')[0]} ${category} Item #${i}`;
          const catalogCategory = resolveCatalogCategory(category);

          const namePrefix = market.name.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
          const categoryPrefix = category.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
          const seededVariants = [
            {
              sku: `SKU-${namePrefix}-${categoryPrefix}-V1`,
              title: 'Standard Option',
              options: catalogCategory.id === 'grocery' ? { packageSize: '1kg' } : { color: 'Royal Blue', size: 'Medium' },
              price: 0,
              unit: i % 2 === 0 ? 'kg' : 'pcs',
              stockType: 'infinite',
              stockQuantity: 999999,
              isActive: true
            },
            {
              sku: `SKU-${namePrefix}-${categoryPrefix}-V2`,
              title: 'Premium Option',
              options: catalogCategory.id === 'grocery' ? { packageSize: '5kg' } : { color: 'Deep Crimson', size: 'Large' },
              price: 1500,
              unit: i % 2 === 0 ? 'kg' : 'pcs',
              stockType: 'infinite',
              stockQuantity: 999999,
              isActive: true
            }
          ];

          const variantAxes = catalogCategory.id === 'grocery'
            ? [{ key: 'packageSize', label: 'Package size', values: ['1kg', '5kg'] }]
            : [
                { key: 'color', label: 'Color', values: ['Royal Blue', 'Deep Crimson'] },
                { key: 'size', label: 'Size', values: ['Medium', 'Large'] }
              ];

          await this.productModel.findOneAndUpdate(
            { name: prodName, marketId: market._id },
            {
              name: prodName,
              description: `Authentic ${category} from the ${market.name}. Sustainably sourced and verified Made in Rwanda.`,
              price: (Math.floor(Math.random() * 25) + 2) * 1000,
              category: catalogCategory.id,
              categoryId: catalogCategory.id,
              categoryLabel: catalogCategory.label,
              productType: catalogCategory.productType,
              attributes: this.sanitizeAttributes(catalogCategory, {
                originDistrict: market.location?.city || 'Kigali',
                freshnessGrade: 'A',
                material: 'Mixed',
                artisanDistrict: market.location?.city || 'Kigali',
              }),
              variantAxes: variantAxes,
              variants: seededVariants,
              marketId: market._id,
              sellerId: defaultSeller?._id || new Types.ObjectId(),
              images: [market.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e'],
              stockType: 'infinite',
              stockQuantity: 999,
              unit: i % 2 === 0 ? 'kg' : 'pcs',
              isApproved: true,
              isActive: true,
              isMadeInRwanda: true
            },
            { upsert: true }
          );
        }
      }

      try {
        await this.cacheManager.del('products:all');
        if ((this.cacheManager as any).reset) {
          await (this.cacheManager as any).reset();
        }
      } catch (e) { }
      console.log('✅ Product Seeding & Cache Reset Complete.');
    } catch (err) {
      console.error('❌ Product Seeding Failed:', err.message);
    }
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
        const seller = await this.findSellerProfile(productData.sellerId);
        if (!seller) {
          throw new BadRequestException(`Seller profile not found for ID: ${productData.sellerId}. Please ensure the seller is registered.`);
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

    productData = await this.normalizeProductData(productData);

    // Sanitize numeric fields
    productData.price = Number(productData.price);
    productData.stockQuantity = Number(productData.stockQuantity || 0);
    if (productData.weight) productData.weight = Number(productData.weight);
    else delete productData.weight;
    for (const field of ['minPrice', 'maxPrice', 'minWeight', 'maxWeight']) {
      if (productData[field] !== undefined && productData[field] !== '') {
        productData[field] = Number(productData[field]);
      } else {
        delete productData[field];
      }
    }

    if (isNaN(productData.price)) throw new BadRequestException('Price must be a valid number.');
    if (productData.isNegotiable && productData.minPrice && productData.maxPrice && productData.minPrice > productData.maxPrice) {
      throw new BadRequestException('Minimum negotiable price cannot be greater than maximum price.');
    }
    if (productData.minWeight && productData.maxWeight && productData.minWeight > productData.maxWeight) {
      throw new BadRequestException('Minimum weight cannot be greater than maximum weight.');
    }

    try {
      const newProduct = new this.productModel(productData);
      const saved = await newProduct.save();

      await this.invalidateProductCaches(saved._id?.toString());

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
    const {
      marketId,
      sellerId,
      approvedOnly,
      isActive,
      limit,
      skip,
      sortBy,
      search,
      category,
      categoryId,
      productType,
      minPrice,
      maxPrice,
      hasPromotion,
      isMadeInRwanda,
      origin,
      latitude,
      longitude,
    } = query;
    // Normalize cache key: only include fields that affect the query, in sorted order
    const canonicalQuery = JSON.stringify({
      marketId,
      sellerId,
      approvedOnly,
      isActive,
      limit,
      skip,
      sortBy,
      search,
      category,
      categoryId,
      productType,
      minPrice,
      maxPrice,
      hasPromotion,
      isMadeInRwanda,
      origin,
      latitude,
      longitude,
      isApproved: query.isApproved,
    });
    const cacheKey = `products:all:${canonicalQuery}`;
    const cached = await this.safeCacheGet<any[]>(cacheKey);
    if (cached && Array.isArray(cached) && cached.every((item: any) => item !== null && item !== undefined)) {
      return cached;
    }


    const filter: any = { deletedAt: null };

    if (approvedOnly === 'true' || approvedOnly === true) {
      filter.isActive = true;
      filter.isApproved = true;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    if (query.isApproved !== undefined) {
      filter.isApproved = query.isApproved === 'true' || query.isApproved === true;
    }

    if (!sellerId && query.isApproved === undefined) {
      filter.isApproved = true;
      if (filter.isActive === undefined) {
        filter.isActive = true;
      }
    }

    if (marketId) filter.marketId = marketId;

    const madeInRwandaFlag = this.parseBooleanFlag(isMadeInRwanda);
    const originIsRwanda = ['rw', 'rwa', 'rwanda', 'made-in-rwanda', 'made_in_rwanda'].includes(String(origin || '').trim().toLowerCase());
    if (madeInRwandaFlag !== undefined) {
      filter.isMadeInRwanda = madeInRwandaFlag;
    } else if (originIsRwanda || this.isMadeInRwandaSearch(search)) {
      filter.isMadeInRwanda = true;
    }

    if (categoryId || category) {
      const resolved = await this.resolveCatalogCategoryDynamic(categoryId || category);
      const leafIds = await this.getDescendantLeafCategoryIds(resolved.id);
      this.addAndFilter(filter, {
        $or: [
          { categoryId: { $in: leafIds } },
          { productType: resolved.productType },
          { category: { $in: leafIds } },
          ...leafIds.map(leafId => {
            const leafCat = catalogCategories.find(c => c.id === leafId) || resolved;
            return { category: { $in: this.legacyCategoryValues(leafCat) } };
          })
        ],
      });
    }

    if (productType) {
      const normalizedType = String(productType).trim();
      const dynamicCategories = await this.getCatalogCategories();
      const resolved = dynamicCategories.find(item => item.productType === normalizedType) || await this.resolveCatalogCategoryDynamic(normalizedType);
      this.addAndFilter(filter, {
        $or: [
          { productType: normalizedType },
          { productType: resolved.productType },
          { categoryId: resolved.id },
          { category: { $in: this.legacyCategoryValues(resolved) } },
        ],
      });
    }

    const trimmedSearch = String(search || '').trim();
    if (trimmedSearch && !this.isMadeInRwandaSearch(trimmedSearch)) {
      const safeSearch = this.escapeRegex(trimmedSearch);
      const searchTokens = trimmedSearch.split(/\s+/).filter(Boolean);

      const dynamicCategories = await this.getCatalogCategories();
      const matchedCategories = dynamicCategories.filter(cat => {
        const check = (str: string) => str.toLowerCase().includes(trimmedSearch.toLowerCase()) || 
                      searchTokens.every(token => str.toLowerCase().includes(token.toLowerCase()));
        return (
          check(cat.label) ||
          cat.aliases?.some(a => check(a)) ||
          cat.synonyms?.some(s => check(s))
        );
      });
      const matchedCategoryIds = matchedCategories.map(cat => cat.id);

      // Build Multi-Token intersection query: enforce that every single token must match somewhere in the fields
      const tokenConditions = searchTokens.map(token => {
        const escapedToken = this.escapeRegex(token);
        return {
          $or: [
            { name: { $regex: escapedToken, $options: 'i' } },
            { description: { $regex: escapedToken, $options: 'i' } },
            { category: { $regex: escapedToken, $options: 'i' } },
            { categoryLabel: { $regex: escapedToken, $options: 'i' } },
            { productType: { $regex: escapedToken, $options: 'i' } },
            { 'attributes.brand': { $regex: escapedToken, $options: 'i' } },
            { 'attributes.model': { $regex: escapedToken, $options: 'i' } },
            { 'attributes.material': { $regex: escapedToken, $options: 'i' } },
            { 'attributes.color': { $regex: escapedToken, $options: 'i' } },
            { 'attributes.size': { $regex: escapedToken, $options: 'i' } },
            { 'attributes.shoeSize': { $regex: escapedToken, $options: 'i' } },
            { 'attributes.style': { $regex: escapedToken, $options: 'i' } },
            { 'attributes.originDistrict': { $regex: escapedToken, $options: 'i' } },
            { 'variants.title': { $regex: escapedToken, $options: 'i' } },
            { 'variants.sku': { $regex: escapedToken, $options: 'i' } },
            { 'variants.options.color': { $regex: escapedToken, $options: 'i' } },
            { 'variants.options.size': { $regex: escapedToken, $options: 'i' } },
            { 'variants.options.shoeSize': { $regex: escapedToken, $options: 'i' } },
            { 'variants.options.style': { $regex: escapedToken, $options: 'i' } },
            { 'variants.options.model': { $regex: escapedToken, $options: 'i' } },
            { 'variants.attributes.brand': { $regex: escapedToken, $options: 'i' } },
            { 'variants.attributes.model': { $regex: escapedToken, $options: 'i' } },
            { 'variants.attributes.material': { $regex: escapedToken, $options: 'i' } },
            { 'variants.attributes.color': { $regex: escapedToken, $options: 'i' } },
            { 'variants.attributes.size': { $regex: escapedToken, $options: 'i' } },
            { 'variants.attributes.shoeSize': { $regex: escapedToken, $options: 'i' } },
            { 'variants.attributes.style': { $regex: escapedToken, $options: 'i' } }
          ]
        };
      });

      this.addAndFilter(filter, {
        $or: [
          { name: { $regex: safeSearch, $options: 'i' } },
          { description: { $regex: safeSearch, $options: 'i' } },
          { 'variants.title': { $regex: safeSearch, $options: 'i' } },
          { 'variants.sku': { $regex: safeSearch, $options: 'i' } },
          // Multi-word intersection query (e.g. low AND J1 matched anywhere)
          { $and: tokenConditions },
          ...(matchedCategoryIds.length > 0 ? [{ categoryId: { $in: matchedCategoryIds } }] : []),
          ...(matchedCategoryIds.length > 0 ? [{ category: { $in: matchedCategoryIds } }] : [])
        ]
      });
    }


    if (query.minPrice || query.maxPrice) {
      filter.price = {};
      if (query.minPrice) filter.price.$gte = Number(query.minPrice);
      if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
    }

    for (const [key, value] of Object.entries(query)) {
      const attrKey = key.startsWith('attr_') ? key.slice(5) : key.startsWith('attributes.') ? key.slice(11) : null;
      if (!attrKey || value === undefined || value === '') continue;
      if (!/^[a-zA-Z][a-zA-Z0-9_]{1,40}$/.test(attrKey)) continue;
      const raw = Array.isArray(value) ? value[0] : value;
      filter[`attributes.${attrKey}`] = typeof raw === 'string' && raw.includes(',')
        ? { $in: raw.split(',').map(item => item.trim()).filter(Boolean) }
        : raw;
    }

    if (sellerId) {
      // Check if sellerId is a User ID (from frontend) and map to SellerProfile ID
      const seller = await this.sellerModel.findOne({ userId: sellerId }).exec();
      filter.sellerId = seller ? seller._id : sellerId;
    }

    const dbQuery = this.productModel
      .find(filter)
      .select('-auditTrail')
      .populate('sellerId', 'stallName shopDetails rating totalOrders userId')
      .populate('marketId', 'name slug code location imageUrl')
      .lean();

    if (sortBy) {
      dbQuery.sort(sortBy);
    } else {
      dbQuery.sort({ createdAt: -1 });
    }

    if (limit) {
      dbQuery.limit(Number(limit));
    }

    if (skip) {
      dbQuery.skip(Number(skip));
    }

    const results = await dbQuery.exec();

    // Enrich with active promotion data
    const enriched = await this.enrichWithPromotions(results.map(product => this.withCatalogMetadata(product)));
    const promotedOrAll = hasPromotion === 'true' || hasPromotion === true
      ? enriched.filter((product: any) => Boolean(product.promotion))
      : enriched;

    // Hierarchy dynamic category tree lookup based on query search string
    const dynamicCategories = await this.getCatalogCategories();
    let searchedCategory: CatalogCategory | undefined;
    if (trimmedSearch) {
      searchedCategory = dynamicCategories.find(cat =>
        cat.id === trimmedSearch.toLowerCase() ||
        cat.label.toLowerCase() === trimmedSearch.toLowerCase() ||
        cat.aliases?.some(a => a.toLowerCase() === trimmedSearch.toLowerCase()) ||
        cat.synonyms?.some(s => s.toLowerCase() === trimmedSearch.toLowerCase()) ||
        trimmedSearch.toLowerCase().includes(cat.id) ||
        cat.aliases?.some(a => trimmedSearch.toLowerCase().includes(a.toLowerCase()))
      );
    }

    const finalResults = this.rankProducts(
      promotedOrAll,
      trimmedSearch,
      searchedCategory,
      dynamicCategories,
      latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : undefined,
      longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : undefined
    );

    // Set cache with 5 minute TTL (300 seconds)
    await this.safeCacheSet(cacheKey, finalResults, 300000);

    return finalResults;

  }

  async getFacets(query: any): Promise<any> {
    const products = await this.findAll({ ...query, limit: query.limit || 1000 });
    
    // Group products by category ID and track prices in a single pass to optimize memory and CPU
    const productsByCategory = new Map<string, any[]>();
    const categories = new Map<string, { id: string; label: string; count: number; fields: any[] }>();
    const priceRange = { min: Number.POSITIVE_INFINITY, max: 0 };

    for (const product of products) {
      const category = this.catalogCategoryForProduct(product);
      
      let group = productsByCategory.get(category.id);
      if (!group) {
        group = [];
        productsByCategory.set(category.id, group);
      }
      group.push(product);

      const current = categories.get(category.id) || { id: category.id, label: category.label, count: 0, fields: [] };
      current.count += 1;
      categories.set(category.id, current);

      const price = Number(product.price || 0);
      if (price > 0) {
        priceRange.min = Math.min(priceRange.min, price);
        priceRange.max = Math.max(priceRange.max, price);
      }
    }

    const categoryList = await this.getCatalogCategories();
    // Only map categories that actually have products to prevent scanning all 150+ categories
    const attributeFacets = categoryList
      .filter(category => productsByCategory.has(category.id))
      .map(category => {
        const catProducts = productsByCategory.get(category.id) || [];
        const fields = category.attributes
          .filter(field => field.filterable)
          .map(field => {
            const counts = new Map<string, number>();
            for (const product of catProducts) {
              const raw = product.attributes?.[field.key];
              const values = Array.isArray(raw) ? raw : raw === undefined || raw === null || raw === '' ? [] : [raw];
              values.forEach(value => {
                const key = String(value);
                counts.set(key, (counts.get(key) || 0) + 1);
              });
            }
            return {
              ...field,
              values: Array.from(counts.entries())
                .map(([value, count]) => ({ value, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 40),
            };
          });
        return { id: category.id, label: category.label, fields };
      })
      .filter(category => category.fields.some(field => field.values.length > 0 || field.options?.length));

    return {
      total: products.length,
      categories: Array.from(categories.values()).sort((a, b) => b.count - a.count),
      attributes: attributeFacets,
      price: {
        min: Number.isFinite(priceRange.min) ? priceRange.min : 0,
        max: priceRange.max,
      },
    };
  }

  async getGovernanceReport(): Promise<any> {
    const products = await this.productModel.find({ deletedAt: null }).lean().exec();
    const categories = await this.getCatalogCategories(true);
    const categoryIds = new Set(categories.map(category => category.id));
    const missingRequired: any[] = [];
    const unknownAttributes: any[] = [];
    const uncategorized: any[] = [];
    const categoryCounts = new Map<string, number>();

    for (const product of products) {
      const category = this.catalogCategoryForProduct(product);
      categoryCounts.set(category.id, (categoryCounts.get(category.id) || 0) + 1);
      if (!product.categoryId || !categoryIds.has(product.categoryId)) {
        uncategorized.push({ productId: product._id, name: product.name, category: product.category, suggestedCategoryId: category.id });
      }
      const attributes = product.attributes || {};
      const allowed = new Set(category.attributes.map(field => field.key));
      for (const field of category.attributes.filter(field => field.required)) {
        if (attributes[field.key] === undefined || attributes[field.key] === null || attributes[field.key] === '') {
          missingRequired.push({ productId: product._id, name: product.name, categoryId: category.id, field: field.key, label: field.label });
        }
      }
      for (const key of Object.keys(attributes)) {
        if (!allowed.has(key)) unknownAttributes.push({ productId: product._id, name: product.name, categoryId: category.id, field: key });
      }
    }

    return {
      totals: {
        products: products.length,
        categories: categories.length,
        missingRequired: missingRequired.length,
        unknownAttributes: unknownAttributes.length,
        uncategorized: uncategorized.length,
      },
      categoryCounts: Array.from(categoryCounts.entries()).map(([categoryId, count]) => ({ categoryId, count })).sort((a, b) => b.count - a.count),
      missingRequired: missingRequired.slice(0, 250),
      unknownAttributes: unknownAttributes.slice(0, 250),
      uncategorized: uncategorized.slice(0, 250),
    };
  }

  async backfillCatalogMetadata(options: { dryRun?: boolean; limit?: number } = {}): Promise<any> {
    const query = {
      deletedAt: null,
      $or: [
        { categoryId: { $exists: false } },
        { categoryLabel: { $exists: false } },
        { productType: { $exists: false } },
        { priceUpdatedAt: { $exists: false } },
      ],
    };
    const products = await this.productModel.find(query).limit(Number(options.limit || 5000)).lean().exec();
    const changes: any[] = [];

    for (const product of products) {
      const category = await this.resolveCatalogCategoryDynamic(product.categoryId || product.category);
      const update = {
        categoryId: category.id,
        categoryLabel: category.label,
        productType: category.productType,
        attributeSetVersion: product.attributeSetVersion || 1,
        unit: product.unit || category.defaultUnit,
        attributes: product.attributes || {},
        variantAxes: product.variantAxes?.length ? product.variantAxes : this.sanitizeVariantAxes(category),
        priceUpdatedAt: product.priceUpdatedAt || product.updatedAt || product.createdAt || new Date(),
      };
      changes.push({ productId: product._id, name: product.name, from: product.category, to: update.categoryId });
      if (!options.dryRun) {
        await this.productModel.updateOne(
          { _id: product._id },
          {
            $set: update,
            $push: { auditTrail: { action: 'catalog_backfilled', reason: 'taxonomy_migration', at: new Date() } },
          }
        ).exec();
      }
    }

    if (!options.dryRun) await this.invalidateProductCaches();
    return { dryRun: Boolean(options.dryRun), scanned: products.length, updated: options.dryRun ? 0 : changes.length, changes: changes.slice(0, 100) };
  }

  async findById(id: string): Promise<any> {
    const cacheKey = `product:${id}`;
    const cached = await this.safeCacheGet(cacheKey);

    if (cached) return cached;

    const product = await this.productModel.findOne({ _id: id, deletedAt: null }).populate(['sellerId', 'marketId']).lean().exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Enrich with promotion data
    const [enriched] = await this.enrichWithPromotions([this.withCatalogMetadata(product)]);

    await this.safeCacheSet(cacheKey, enriched, 300000);
    return enriched;
  }

  async update(id: string, updateData: any): Promise<any> {
    if (updateData.images !== undefined) {
      if (!Array.isArray(updateData.images) || updateData.images.length === 0) {
        throw new BadRequestException('Product must have at least one image');
      }
    }
    const existing = await this.productModel.findOne({ _id: id, deletedAt: null }).lean().exec();
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const actorId = updateData.updatedBy || updateData.actorId || updateData.sellerId || null;
    delete updateData.updatedBy;
    delete updateData.actorId;
    delete updateData.sellerId;
    delete updateData.marketId;
    updateData = await this.normalizeProductData(updateData, existing);

    const updatedProduct = await this.productModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $set: updateData,
        $push: { auditTrail: { action: 'updated', actorId, reason: 'seller_inventory_edit', at: new Date() } }
      },
      { returnDocument: 'after' }
    ).exec();

    if (!updatedProduct) {
      throw new NotFoundException('Product not found');
    }

    try {
      await this.invalidateProductCaches(id);
    } catch (e) {
      console.error('Cache invalidation failed', e);
    }

    return updatedProduct;
  }

  async approve(id: string): Promise<any> {
    const product = await this.productModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { isApproved: true, isActive: true } },
      { returnDocument: 'after' }
    ).exec();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.cacheManager.del(`product:${id}`);
    await this.cacheManager.del('products:all');
    if ((this.cacheManager as any).reset) {
      await (this.cacheManager as any).reset();
    }

    return product;
  }

  async remove(id: string, options: { deletedBy?: string; reason?: string } = {}): Promise<any> {
    const product = await this.productModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: options.deletedBy || null,
          deletionReason: options.reason || 'seller_archived_from_inventory',
          isActive: false
        },
        $push: {
          auditTrail: {
            action: 'archived',
            actorId: options.deletedBy || null,
            reason: options.reason || 'seller_archived_from_inventory',
            at: new Date()
          }
        }
      },
      { returnDocument: 'after' }
    ).exec();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.cacheManager.del(`product:${id}`);
    await this.cacheManager.del('products:all');
    if ((this.cacheManager as any).reset) {
      await (this.cacheManager as any).reset();
    }

    return product;
  }

  async updateStock(id: string, quantityChange: number): Promise<any> {
    const product = await this.productModel.findById(id).exec();
    if (!product) throw new NotFoundException('Product not found');

    if (product.stockType === 'infinite' || product.stockType === 'on_demand') {
      if (!product.inStock) {
        return this.update(id, { inStock: true });
      }
      return product;
    }

    const filter: any = { _id: id, deletedAt: null };
    if (quantityChange < 0) {
      filter.stockQuantity = { $gte: Math.abs(quantityChange) };
    }

    const updated = await this.productModel.findOneAndUpdate(
      filter,
      { $inc: { stockQuantity: quantityChange } },
      { returnDocument: 'after' }
    ).exec();

    if (!updated) {
      throw new BadRequestException('Insufficient stock or race condition');
    }

    if (updated.stockQuantity === 0 && updated.inStock) {
      return this.update(id, { inStock: false });
    } else if (updated.stockQuantity > 0 && !updated.inStock) {
      return this.update(id, { inStock: true });
    }

    return updated;
  }

  async incrementOrders(id: string, count: number): Promise<any> {
    const safeCount = Math.min(Math.max(Math.floor(Number(count) || 1), 1), 1000);
    const product = await this.productModel.findByIdAndUpdate(
      id,
      { $inc: { totalOrders: safeCount } },
      { new: true }
    ).exec();

    if (product && product.sellerId) {
      await this.sellerModel.findByIdAndUpdate(
        product.sellerId,
        { $inc: { totalOrders: safeCount } }
      ).exec();

      if (this.cacheManager) {
        await (this.cacheManager as any).reset();
      }
    }
    return product;
  }

  private plainSpreadsheetValue(value: any): any {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value !== 'object') return value;
    if (Array.isArray(value.richText)) {
      return value.richText.map((part: any) => part?.text || '').join('');
    }
    if ('text' in value) return value.text;
    if ('hyperlink' in value && 'text' in value) return value.text;
    if ('result' in value) return value.result;
    return String(value);
  }

  private worksheetRows(worksheet: ExcelJS.Worksheet): any[][] {
    const rows: any[][] = [];
    const columnCount = Math.max(worksheet.actualColumnCount, worksheet.columnCount);
    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const values: any[] = [];
      for (let colNumber = 1; colNumber <= columnCount; colNumber++) {
        values.push(this.plainSpreadsheetValue(row.getCell(colNumber).value));
      }
      rows.push(values);
    }
    return rows;
  }

  private async readBulkUploadRows(buffer: Buffer, fileExtension = '.xlsx'): Promise<any[][]> {
    const extension = fileExtension.toLowerCase();
    const workbook = new ExcelJS.Workbook();

    if (extension === '.csv') {
      const worksheet = await workbook.csv.read(Readable.from(buffer));
      return this.worksheetRows(worksheet);
    }

    if (extension !== '.xlsx') {
      throw new BadRequestException('Unsupported spreadsheet format. Use XLSX or CSV.');
    }

    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets.find(sheet => sheet.name.toLowerCase().includes('product'))
      || workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException('The uploaded file has no readable worksheet.');
    }

    return this.worksheetRows(worksheet);
  }

  async selfHealSellerLinks(options: { dryRun?: boolean; limit?: number } = {}): Promise<any> {
    const dryRun = options.dryRun !== false;
    const limit = Math.min(Math.max(Number(options.limit || 1000), 1), 10000);
    const products = await this.productModel.find({ deletedAt: null, sellerId: { $exists: true, $ne: null } }).limit(limit).exec();
    let healed = 0;
    const samples: any[] = [];

    for (const product of products) {
      const seller = await this.sellerModel.findOne({ userId: product.sellerId }).exec();
      if (!seller) continue;

      healed++;
      if (samples.length < 20) {
        samples.push({
          productId: product._id,
          previousSellerId: product.sellerId,
          sellerProfileId: seller._id,
          marketId: seller.marketId,
        });
      }

      if (!dryRun) {
        product.sellerId = seller._id;
        product.marketId = seller.marketId;
        await product.save();
      }
    }

    if (healed > 0 && !dryRun) {
      await this.invalidateProductCaches();
    }

    return { dryRun, scanned: products.length, healed, limit, samples };
  }

  async bulkUpload(buffer: Buffer, sellerId: string, fileExtension = '.xlsx'): Promise<any> {
    console.log(`[BulkUpload] Starting for seller: ${sellerId}`);
    try {
      const rows = await this.readBulkUploadRows(buffer, fileExtension);

      // Find the header row index by scanning for rows containing Name and Price
      let headerRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (Array.isArray(row)) {
          const hasName = row.some(cell => String(cell || '').toLowerCase().trim().includes('name'));
          const hasPrice = row.some(cell => String(cell || '').toLowerCase().trim().includes('price'));
          if (hasName && hasPrice) {
            headerRowIndex = i;
            break;
          }
        }
      }

      if (headerRowIndex === -1) {
        headerRowIndex = 0; // fallback if no matching header row is found
      }

      // Normalize headers to alphanumeric-only strings (strips spaces, asterisks, parentheses, dashes)
      const headers = (rows[headerRowIndex] || []).map(cell =>
        String(cell || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '')
      );

      // Parse data rows
      const validRows: any[] = [];
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const rowData = rows[i];
        if (!Array.isArray(rowData) || rowData.length === 0) continue;

        // Skip dropdown reference or footer tables in the sheet
        const firstCellVal = String(rowData[0] || '').trim().toLowerCase();
        if (firstCellVal.includes('dropdown reference') || (firstCellVal.includes('category') && rowData[1]?.includes('|'))) {
          break; // Stop parsing as we reached the dropdown reference block
        }

        // Map row to an object using our normalized headers
        const rowObj: Record<string, any> = {};
        rowData.forEach((cell, cellIndex) => {
          const header = headers[cellIndex];
          if (header) {
            rowObj[header] = cell;
          }
        });

        // Verify if the row has a name/product name
        const rawName = String(rowObj['name'] || rowObj['product'] || rowObj['title'] || '').trim();
        if (rawName && !rawName.startsWith('#') && !rawName.startsWith('//')) {
          rowObj['_rowIndex'] = i + 1;
          validRows.push(rowObj);
        }
      }

      console.log(`[BulkUpload] Found ${validRows.length} valid product rows of ${rows.length} total rows.`);

      if (validRows.length === 0) {
        throw new BadRequestException('The uploaded file contains no valid product rows.');
      }

      // Find seller to get marketId
      console.log(`[BulkUpload] Looking up seller for user: ${sellerId}`);
      const seller = await this.findSellerProfile(sellerId);

      if (!seller) {
        console.error(`[BulkUpload] Seller profile not found for user: ${sellerId}`);
        throw new BadRequestException(`Seller profile not found for ID: ${sellerId}. Select an approved seller before uploading products.`);
      }
      console.log(`[BulkUpload] Found seller: ${seller._id} (Market: ${seller.marketId})`);

      // Group rows by case-insensitive name to handle base product + variants
      const productGroups = new Map<string, any[]>();
      for (const row of validRows) {
        const nameVal = String(row['name'] || row['product'] || row['title'] || '').trim().toLowerCase();
        let group = productGroups.get(nameVal);
        if (!group) {
          group = [];
          productGroups.set(nameVal, group);
        }
        group.push(row);
      }

      const results = {
        total: productGroups.size,
        success: 0,
        failed: 0,
        errors: [] as string[]
      };

      for (const [groupKey, groupRows] of productGroups.entries()) {
        try {
          const baseRow = groupRows[0];
          const nameVal = String(baseRow['name'] || baseRow['product'] || baseRow['title'] || '').trim();
          const descriptionVal = baseRow['description'] || baseRow['details'] || baseRow['desc'] || baseRow['about'];
          const categoryVal = baseRow['category'] || baseRow['type'] || 'General';

          // Price field mapping (normalizing Price (RWF) * to 'pricerwf')
          const priceVal = Number(baseRow['price'] || baseRow['pricerwf'] || baseRow['cost'] || baseRow['unitprice'] || baseRow['unit_price'] || baseRow['rate'] || 0);
          const unitVal = baseRow['unit'] || baseRow['pkg'] || 'pcs';

          // Stock quantity field mapping (normalizing Stock Qty * to 'stockqty')
          const stockQuantityVal = Number(baseRow['stock'] || baseRow['stockqty'] || baseRow['quantity'] || baseRow['qty'] || 0);

          const rawStockType = baseRow['stocktype'] || baseRow['inventorytype'];
          const stockTypeVal = String(rawStockType || 'finite').toLowerCase().trim();

          const madeInRwandaVal = baseRow['madeinrwanda'] || baseRow['ismadeinrwanda'];
          const isMadeInRwanda = madeInRwandaVal === 'yes' || madeInRwandaVal === 'true' || madeInRwandaVal === true || madeInRwandaVal === 1 || String(madeInRwandaVal).toLowerCase().trim() === 'yes';

          // Image URL mapping (normalizing Image URL to 'imageurl')
          const imagesVal = baseRow['imageurl'] || baseRow['images'] || baseRow['image'] || baseRow['urls'] || baseRow['img'];

          // Resolve category definition to identify required taxonomy fields
          const categoryObj = await this.resolveCatalogCategoryDynamic(categoryVal);
          const attributes = this.applyBulkAttributeFallbacks(categoryObj, this.parseAttributesFromRow(baseRow));
          const attributeErrors = this.validateCategoryAttributes(categoryObj, attributes);
          if (attributeErrors.length > 0) {
            throw new Error(`Catalog validation failed: ${attributeErrors.join('; ')}`);
          }

          // Parse variants if multiple rows are present or if a single row has variant options specified
          const allowedAxisKeys = categoryObj.variantAxes.map(axis => axis.key);
          const variants: any[] = [];
          const variantAxesMap = new Map<string, Set<string>>();
          for (const axisKey of allowedAxisKeys) {
            variantAxesMap.set(axisKey, new Set<string>());
          }

          if (allowedAxisKeys.length > 0) {
            for (const row of groupRows) {
              const options: Record<string, string> = {};
              let hasAnyOption = false;

              for (const axisKey of allowedAxisKeys) {
                const normalizedKey = axisKey.toLowerCase().replace(/[^a-z0-9]+/g, '');
                const val = row[axisKey] || row[normalizedKey] || '';
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                  const stringVal = String(val).trim();
                  options[axisKey] = stringVal;
                  variantAxesMap.get(axisKey)?.add(stringVal);
                  hasAnyOption = true;
                }
              }

              // Parse as variant if options are specified OR if there are multiple rows for this product
              if (hasAnyOption || groupRows.length > 1) {
                const variantPrice = Number(row['price'] || row['pricerwf'] || row['cost'] || row['unitprice'] || row['unit_price'] || row['rate'] || priceVal);
                const variantStock = Number(row['stock'] || row['stockqty'] || row['quantity'] || row['qty'] || stockQuantityVal);
                const variantStockType = String(row['stocktype'] || row['inventorytype'] || stockTypeVal).toLowerCase().trim();
                const variantSku = String(row['sku'] || row['variantcode'] || '').trim();
                const variantImages = this.parseImageList(row['imageurl'] || row['images'] || row['image'] || imagesVal);
                const variantVideoUrl = row['variantvideourl'] || row['videourl'] || row['video'];
                const variantThumbnailUrl = row['variantthumbnailurl'] || row['thumbnailurl'] || row['posterurl'];

                const optionLabels = Object.values(options).filter(Boolean);
                const variantTitle = optionLabels.length > 0
                  ? `${nameVal} (${optionLabels.join(' / ')})`
                  : `${nameVal} Variant`;

                variants.push({
                  sku: variantSku || undefined,
                  title: variantTitle,
                  options,
                  price: variantPrice,
                  stockType: variantStockType,
                  stockQuantity: variantStock,
                  unit: row['unit'] || baseRow['unit'] || unitVal,
                  inStock: variantStockType !== 'finite' || variantStock > 0,
                  images: variantImages,
                  videoUrl: variantVideoUrl || undefined,
                  thumbnailUrl: variantThumbnailUrl || undefined,
                  isActive: true
                });
              }
            }
          }

          // Build final variantAxes array with the unique values collected
          const variantAxes: any[] = [];
          if (allowedAxisKeys.length > 0) {
            for (const axisKey of allowedAxisKeys) {
              const uniqueVals = Array.from(variantAxesMap.get(axisKey) || []);
              if (uniqueVals.length > 0) {
                const axisDef = categoryObj.variantAxes.find(a => a.key === axisKey);
                variantAxes.push({
                  key: axisKey,
                  label: axisDef?.label || axisKey,
                  values: uniqueVals
                });
              }
            }
          }

          let productData = {
            name: nameVal,
            description: descriptionVal,
            category: categoryVal,
            price: priceVal,
            unit: unitVal,
            stockQuantity: stockQuantityVal,
            stockType: stockTypeVal,
            isMadeInRwanda: isMadeInRwanda,
            images: this.parseImageList(imagesVal),
            attributes: attributes,
            variantAxes: variantAxes,
            variants: variants,
            sellerId: seller._id,
            marketId: seller.marketId,
            isApproved: true,
            isActive: true
          };

          productData = await this.normalizeProductData(productData);

          if (!productData.name || isNaN(productData.price) || productData.price <= 0) {
            throw new Error('Missing required fields: Name and a positive Price');
          }
          if (!['finite', 'infinite', 'on_demand'].includes(productData.stockType)) {
            throw new Error('StockType must be finite, infinite, or on_demand');
          }
          if (productData.stockType === 'finite' && (isNaN(productData.stockQuantity) || productData.stockQuantity < 0)) {
            throw new Error('Finite stock products need a valid non-negative Stock value');
          }

          const newProduct = new this.productModel(productData);
          await newProduct.save();
          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`Product "${groupKey}" (Rows: ${groupRows.map(r => r._rowIndex).join(', ')}): ${err.message}`);
        }
      }

      // Invalidate caches
      await this.cacheManager.del('products:all');
      console.log(`[BulkUpload] Finished. Success: ${results.success}, Failed: ${results.failed}`);
      return results;
    } catch (err: any) {
      console.error(`[BulkUpload] CRITICAL ERROR:`, err);
      throw err;
    }
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
        const discountPercentage = promo.type === 'percentage'
          ? Number(promo.discount || 0)
          : Number(p.price || 0) > 0
            ? Math.round((Number(promo.discount || 0) / Number(p.price || 0)) * 100)
            : 0;
        p.promotion = {
          type: promo.type,
          discount: promo.discount,
          discountPercentage,
          promotedPrice: promo.promotedPrice || p.price,
          endDate: promo.endDate
        };
      }
      return p;
    });
  }

  async generateExcelTemplate(): Promise<Buffer> {
    let templateCategories = catalogCategories;
    try {
      const dynamicCategories = await this.getCatalogCategories(true);
      if (dynamicCategories.length > 0) {
        templateCategories = dynamicCategories;
      }
    } catch {
      templateCategories = catalogCategories;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Rwanda Market Facilitator';
    workbook.lastModifiedBy = 'Rwanda Market Facilitator';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.title = 'RMF bulk product import template';
    workbook.subject = 'Seller product bulk upload';
    workbook.calcProperties.fullCalcOnLoad = true;

    const darkGreen = 'FF003F2D';
    const green = 'FF0F5B43';
    const paleGreen = 'FFEAF5EF';
    const paleYellow = 'FFFFF5CC';
    const border = { style: 'thin' as const, color: { argb: 'FFD8E2DD' } };
    const headerRowNumber = 5;
    const firstDataRow = 6;
    const lastDataRow = 205;

    const products = workbook.addWorksheet('Products', {
      views: [{ state: 'frozen', ySplit: headerRowNumber }],
      properties: { defaultRowHeight: 20 },
    });

    const columnLetter = (index: number): string => {
      let dividend = index;
      let name = '';
      while (dividend > 0) {
        const modulo = (dividend - 1) % 26;
        name = String.fromCharCode(65 + modulo) + name;
        dividend = Math.floor((dividend - modulo) / 26);
      }
      return name;
    };

    const listSheet = workbook.addWorksheet('_Lists');
    listSheet.state = 'veryHidden';
    let listColumn = 1;

    const addNamedList = (name: string, values: string[]): void => {
      const safeValues = values.length ? values : [''];
      const col = listColumn++;
      safeValues.forEach((value, index) => {
        listSheet.getCell(index + 1, col).value = value;
      });
      const letter = columnLetter(col);
      workbook.definedNames.add(`_Lists!$${letter}$1:$${letter}$${safeValues.length}`, name);
    };

    const safeDefinedName = (name: string): string => {
      const cleaned = name.replace(/[^A-Za-z0-9_]/g, '_');
      return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
    };

    const uniqueFields = (fields: CatalogField[]): CatalogField[] => {
      const seen = new Set<string>();
      return fields.filter(field => {
        if (seen.has(field.key)) return false;
        seen.add(field.key);
        return true;
      });
    };

    const categoryById = new Map(templateCategories.map(category => [category.id, category]));
    const childrenByParent = new Map<string, CatalogCategory[]>();
    const roots: CatalogCategory[] = [];
    templateCategories.forEach(category => {
      const parentId = category.parentId || null;
      if (parentId && categoryById.has(parentId)) {
        const children = childrenByParent.get(parentId) || [];
        children.push(category);
        childrenByParent.set(parentId, children);
      } else {
        roots.push(category);
      }
    });

    const categoryOrder = new Map(templateCategories.map((category, index) => [category.id, index]));
    const sortCategories = (left: CatalogCategory, right: CatalogCategory) =>
      (categoryOrder.get(left.id) || 0) - (categoryOrder.get(right.id) || 0);
    roots.sort(sortCategories);
    childrenByParent.forEach(children => children.sort(sortCategories));

    const displayCategory = (category: CatalogCategory) => `${category.label} | ${category.id}`;
    const safeListName = (prefix: string, categoryId: string) => safeDefinedName(`${prefix}_${categoryId}`);
    const directChildrenOrSelf = (category: CatalogCategory) => {
      const children = childrenByParent.get(category.id) || [];
      return children.length ? children : [category];
    };
    const exactCategoriesForSub = (category: CatalogCategory) => {
      const children = childrenByParent.get(category.id) || [];
      return children.length ? children : [category];
    };

    const variantFields = uniqueFields(templateCategories.flatMap(category => category.variantAxes));
    const attributeFields = uniqueFields(templateCategories.flatMap(category => category.attributes));
    const dropdownFields = uniqueFields([...variantFields, ...attributeFields]);
    const units = Array.from(new Set([...templateCategories.map(category => category.defaultUnit), 'pcs', 'kg', 'g', 'pair', 'set', 'm', 'box', 'bag', 'liter', 'bundle']));
    const colors = ['Natural', 'Black', 'White', 'Green', 'Yellow', 'Blue', 'Red', 'Brown', 'Gold', 'Silver', 'Mixed', 'Custom'];

    addNamedList('ParentCategories', roots.map(displayCategory));
    for (const root of roots) {
      const subCategories = directChildrenOrSelf(root);
      addNamedList(safeListName('Sub', root.id), subCategories.map(displayCategory));
      for (const sub of subCategories) {
        addNamedList(safeListName('Category', sub.id), exactCategoriesForSub(sub).map(displayCategory));
      }
    }
    addNamedList('CategoryIds', templateCategories.map(displayCategory));
    addNamedList('StockTypes', ['finite', 'infinite', 'on_demand']);
    addNamedList('YesNo', ['yes', 'no']);
    addNamedList('Units', units);
    addNamedList('Colors', colors);
    addNamedList('BlankList', ['']);

    const addedDependentLists = new Set<string>();
    for (const category of templateCategories) {
      const categoryFields = uniqueFields([...category.variantAxes, ...category.attributes])
        .filter(field => field.type === 'select' || field.type === 'multi_select' || field.type === 'boolean' || field.type === 'color');

      for (const field of categoryFields) {
        const listName = safeDefinedName(`${category.id}_${field.key}`);
        if (addedDependentLists.has(listName)) continue;
        addedDependentLists.add(listName);

        let values: string[] = [''];
        if (field.type === 'boolean') {
          values = ['yes', 'no'];
        } else if (field.type === 'color') {
          values = colors;
        } else if (field.options?.length) {
          values = field.options;
        }
        addNamedList(listName, values);
      }
    }

    type TemplateColumn = {
      header: string;
      key: string;
      width: number;
      required?: boolean;
      validation?: string;
      dependentField?: CatalogField;
      note: string;
    };

    const productColumns: TemplateColumn[] = [
      { header: 'Name', key: 'name', width: 28, required: true, note: 'Required. Rows with the same Name become variants of one product.' },
      { header: 'Description', key: 'description', width: 42, required: true, note: 'What buyers should know before ordering.' },
      { header: 'Parent Category', key: 'parentCategory', width: 28, validation: '=ParentCategories', note: 'Start here, like the website category picker.' },
      { header: 'Sub Category', key: 'subCategory', width: 28, note: 'Choose after Parent Category. The dropdown changes based on the parent.' },
      { header: 'Category', key: 'category', width: 32, required: true, note: 'Choose the exact product category after Sub Category. This drives variants and attributes.' },
      { header: 'Price', key: 'price', width: 14, required: true, note: 'RWF unit price. Keep numbers only.' },
      { header: 'Unit', key: 'unit', width: 12, validation: '=Units', note: 'Pricing unit shown to buyers.' },
      { header: 'Stock', key: 'stock', width: 12, required: true, note: 'Available quantity. Use 0 for made-to-order if StockType is on_demand.' },
      { header: 'StockType', key: 'stockType', width: 15, validation: '=StockTypes', note: 'finite tracks stock, infinite stays available, on_demand is made after order.' },
      { header: 'MadeInRwanda', key: 'madeInRwanda', width: 18, validation: '=YesNo', note: 'Use yes or no.' },
      { header: 'Images', key: 'images', width: 48, required: true, note: 'Required. One or more public image URLs, separated by comma, semicolon, or new line.' },
      { header: 'SKU', key: 'sku', width: 18, note: 'Optional seller SKU. Variant rows can use different SKUs.' },
      { header: 'VariantVideoUrl', key: 'variantVideoUrl', width: 38, note: 'Optional public product/variant demo video URL. When a row becomes a variant, this video stays on that variant.' },
      { header: 'VariantThumbnailUrl', key: 'variantThumbnailUrl', width: 38, note: 'Optional public thumbnail/poster image URL for the variant video.' },
      ...variantFields.map(field => ({
        header: field.key,
        key: field.key,
        width: 16,
        dependentField: field,
        note: `${field.label}. Options change by Category when that category supports this variant.`
      })),
      ...attributeFields.map(field => ({
        header: `Attr: ${field.key}`,
        key: `attr.${field.key}`,
        width: 22,
        dependentField: field,
        note: `${field.label}${field.required ? ' (required for its category)' : ''}.`
      })),
      { header: 'Attributes JSON', key: 'attributes', width: 36, note: 'Optional advanced override, e.g. {"brand":"Acme"}. Attribute columns are easier and preferred.' },
    ];

    products.mergeCells('A1:K1');
    products.mergeCells('A2:K2');
    products.mergeCells('A3:K3');
    products.getCell('A1').value = 'RMF bulk product import';
    products.getCell('A2').value = 'Fill product rows below. Parent Category, Sub Category, and Category work like the website category picker.';
    products.getCell('A3').value = 'Keep the header row unchanged. Delete sample rows before a real upload, or replace them with your own products.';
    products.getCell('A1').font = { bold: true, size: 20, color: { argb: darkGreen } };
    products.getCell('A2').font = { size: 11, color: { argb: 'FF38564A' } };
    products.getCell('A3').font = { size: 10, color: { argb: 'FF61746B' } };

    const headerRow = products.getRow(headerRowNumber);
    headerRow.values = productColumns.map(column => column.header);
    headerRow.height = 26;
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: darkGreen } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = { top: border, bottom: border, left: border, right: border };
    });

    productColumns.forEach((column, index) => {
      const excelColumn = products.getColumn(index + 1);
      excelColumn.width = column.width;
      const headerCell = products.getCell(headerRowNumber, index + 1);
      if (column.required) {
        headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005E45' } };
      }
      headerCell.note = column.note;
    });

    products.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber, column: productColumns.length },
    };

    const samples: Record<string, string | number>[] = [
      {
        name: 'Handwoven Agaseke Basket',
        description: 'Traditional handwoven Rwandan basket with high quality sisal fibers.',
        parentCategory: 'Traditional Crafts & Fine Arts | handicrafts',
        subCategory: 'Woven Arts | handicrafts-woven',
        category: 'Traditional Agaseke Peace Baskets | handicrafts-woven-agaseke',
        price: 25000,
        unit: 'pcs',
        stock: 10,
        stockType: 'finite',
        madeInRwanda: 'yes',
        images: 'https://images.unsplash.com/photo-1607344645866-009c320b63e0',
        sku: 'AGA-S-RED',
        size: 'Small',
        color: 'Red',
        'attr.material': 'Sisal',
        'attr.artisanDistrict': 'Kigali',
        'attr.handmade': 'yes',
        'attr.productionDays': 4,
        'attr.dimensions': '25cm x 18cm',
      },
      {
        name: 'Handwoven Agaseke Basket',
        description: 'Traditional handwoven Rwandan basket with high quality sisal fibers.',
        parentCategory: 'Traditional Crafts & Fine Arts | handicrafts',
        subCategory: 'Woven Arts | handicrafts-woven',
        category: 'Traditional Agaseke Peace Baskets | handicrafts-woven-agaseke',
        price: 28000,
        unit: 'pcs',
        stock: 15,
        stockType: 'finite',
        madeInRwanda: 'yes',
        images: 'https://images.unsplash.com/photo-1607344645866-009c320b63e0',
        sku: 'AGA-M-BLU',
        size: 'Medium',
        color: 'Blue',
        'attr.material': 'Sisal',
        'attr.artisanDistrict': 'Kigali',
        'attr.handmade': 'yes',
        'attr.productionDays': 5,
        'attr.dimensions': '32cm x 21cm',
      },
      {
        name: 'Rwandan Specialty Coffee',
        description: 'High-altitude Arabica beans from Gisenyi.',
        parentCategory: 'Groceries & Fresh Produce | grocery',
        subCategory: 'Drinks & Liquid Refreshments | grocery-beverages',
        category: 'Fresh Milk, UHT Long-Life Milk, Yogurt, Cheese | grocery-beverages-dairy',
        price: 12000,
        unit: 'kg',
        stock: 100,
        stockType: 'finite',
        madeInRwanda: 'yes',
        images: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e',
        sku: 'COF-1KG',
        packageSize: '1kg',
        'attr.originDistrict': 'Rubavu',
        'attr.freshnessGrade': 'A',
        'attr.organic': 'yes',
        'attr.shelfLifeDays': 180,
      },
      {
        name: 'Kitenge Wrap Dress',
        description: 'Locally tailored cotton kitenge wrap dress.',
        parentCategory: 'Fashion & Apparel | fashion',
        subCategory: 'Fabrics & Raw Textiles | fashion-textiles',
        category: 'Premium Kitenge & Wax Fabrics | fashion-textiles-kitenge',
        price: 32000,
        unit: 'pcs',
        stock: 8,
        stockType: 'finite',
        madeInRwanda: 'yes',
        images: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f',
        sku: 'KIT-M-GRN',
        size: 'M',
        color: 'Green',
        'attr.material': 'Kitenge',
        'attr.gender': 'Women',
        'attr.fit': 'Regular',
        'attr.lengthMeters': 2,
        'attr.care': 'Cold wash, shade dry',
      },
    ];

    samples.forEach((sample, offset) => {
      const row = products.getRow(firstDataRow + offset);
      row.values = productColumns.map(column => sample[column.key] ?? '');
      row.height = 28;
    });

    for (let rowIndex = firstDataRow; rowIndex <= lastDataRow; rowIndex++) {
      const row = products.getRow(rowIndex);
      productColumns.forEach((column, index) => {
        const cell = row.getCell(index + 1);
        cell.border = { top: border, bottom: border, left: border, right: border };
        cell.alignment = { vertical: 'middle', wrapText: true };
        if (rowIndex % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBFDFC' } };
        }

        if (column.key === 'subCategory') {
          cell.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`=IFERROR(INDIRECT("Sub_"&SUBSTITUTE(TRIM(RIGHT(SUBSTITUTE($C${rowIndex},"|",REPT(" ",80)),80)),"-","_")),BlankList)`],
            showErrorMessage: true,
            errorTitle: 'Choose a sub-category',
            error: 'Choose a parent category first, then select a sub-category from the dropdown.',
          };
        } else if (column.key === 'category') {
          cell.dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: [`=IFERROR(INDIRECT("Category_"&SUBSTITUTE(TRIM(RIGHT(SUBSTITUTE($D${rowIndex},"|",REPT(" ",80)),80)),"-","_")),BlankList)`],
            showErrorMessage: true,
            errorTitle: 'Choose an exact category',
            error: 'Choose a sub-category first, then select the exact category.',
          };
        } else if ('validation' in column && column.validation) {
          cell.dataValidation = {
            type: 'list',
            allowBlank: !column.required,
            formulae: [column.validation],
            showErrorMessage: true,
            errorTitle: 'Choose a valid option',
            error: 'Please choose a value from the dropdown list.',
          };
        }

        if ('dependentField' in column && column.dependentField) {
          const field = column.dependentField;
          const shouldValidate = field.type === 'select' || field.type === 'multi_select' || field.type === 'boolean' || field.type === 'color';
          if (shouldValidate) {
            cell.dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: [`=IFERROR(INDIRECT(SUBSTITUTE(TRIM(RIGHT(SUBSTITUTE($E${rowIndex},"|",REPT(" ",80)),80)),"-","_")&"_${field.key}"),BlankList)`],
              showErrorMessage: true,
              errorTitle: 'Choose a category option',
              error: 'Choose an option supported by this row category, or leave blank if the field is not relevant.',
            };
          }
        }

        if (column.key === 'price') {
          cell.dataValidation = {
            type: 'decimal',
            operator: 'greaterThan',
            allowBlank: false,
            formulae: [0],
            showErrorMessage: true,
            errorTitle: 'Invalid price',
            error: 'Price must be a number greater than 0.',
          };
        }

        if (column.key === 'stock') {
          cell.dataValidation = {
            type: 'whole',
            operator: 'greaterThanOrEqual',
            allowBlank: false,
            formulae: [0],
            showErrorMessage: true,
            errorTitle: 'Invalid stock',
            error: 'Stock must be a whole number of 0 or more.',
          };
        }
      });
    }

    products.getColumn(6).numFmt = '#,##0';
    products.getColumn(8).numFmt = '#,##0';
    products.getRow(firstDataRow + samples.length).height = 24;

    const guide = workbook.addWorksheet('Category Guide', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    guide.columns = [
      { header: 'Category ID', key: 'id', width: 18 },
      { header: 'Category', key: 'label', width: 30 },
      { header: 'Parent', key: 'parent', width: 28 },
      { header: 'Default Unit', key: 'unit', width: 14 },
      { header: 'Variant columns', key: 'variants', width: 36 },
      { header: 'Required attributes', key: 'required', width: 45 },
      { header: 'Optional attributes', key: 'optional', width: 55 },
    ];
    templateCategories.forEach(category => {
      const parent = category.parentId ? categoryById.get(category.parentId) : undefined;
      guide.addRow({
        id: category.id,
        label: category.label,
        parent: parent ? parent.label : '',
        unit: category.defaultUnit,
        variants: category.variantAxes.map(axis => axis.key).join(', ') || 'none',
        required: category.attributes.filter(field => field.required).map(field => `Attr: ${field.key}`).join(', ') || 'none',
        optional: category.attributes.filter(field => !field.required).map(field => `Attr: ${field.key}`).join(', ') || 'none',
      });
    });
    guide.getRow(1).eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: green } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    guide.eachRow((row, rowNumber) => {
      row.eachCell(cell => {
        cell.border = { top: border, bottom: border, left: border, right: border };
        cell.alignment = { vertical: 'top', wrapText: true };
        if (rowNumber > 1 && rowNumber % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: paleGreen } };
        }
      });
    });

    const instructions = workbook.addWorksheet('Instructions');
    instructions.columns = [
      { header: 'Step', key: 'step', width: 20 },
      { header: 'What to do', key: 'detail', width: 90 },
    ];
    [
      ['1. Choose category', 'Use Parent Category, then Sub Category, then Category on each product row. Each dropdown narrows the next one, like the add-product form.'],
      ['2. Add required basics', 'Name, Category, Price, Stock, and Images are required. Images must be public http/https URLs.'],
      ['3. Use variants', 'Use the same Name on multiple rows to create variants of one product. Change size, color, packageSize, SKU, price, or stock per row.'],
      ['4. Fill attributes', 'Columns starting with Attr: are category-specific. The Category Guide sheet shows which ones are required for each category.'],
      ['5. Upload', 'Save as .xlsx and upload it from the RMF bulk operation screen. Keep the Products sheet name and header row intact.'],
    ].forEach(([step, detail]) => instructions.addRow({ step, detail }));
    instructions.getRow(1).eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: darkGreen } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });
    instructions.eachRow((row, rowNumber) => {
      row.eachCell(cell => {
        cell.border = { top: border, bottom: border, left: border, right: border };
        cell.alignment = { vertical: 'top', wrapText: true };
        if (rowNumber > 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber === 2 ? paleYellow : 'FFFFFFFF' } };
        }
      });
    });

    products.views = [{ state: 'frozen', ySplit: headerRowNumber }];
    workbook.views = [{ x: 0, y: 0, width: 16000, height: 9000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
