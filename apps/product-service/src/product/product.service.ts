import { Injectable, NotFoundException, BadRequestException, Inject, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as XLSX from 'xlsx';
import { CatalogCategory, CatalogField, catalogCategories, resolveCatalogCategory } from './catalog.definitions';

@Injectable()
export class ProductService implements OnModuleInit {
  constructor(
    @InjectModel('Product') private productModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('Market') private marketModel: Model<any>,
    @InjectModel('Promotion') private promotionModel: Model<any>,
    @InjectModel('TaxonomyCategory') private taxonomyModel: Model<any>,
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

  private parseBooleanFlag(value: any): boolean | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    return undefined;
  }

  private parseAttributesFromRow(row: Record<string, any>): Record<string, any> {
    const attributes: Record<string, any> = {};
    const keys = Object.keys(row);
    const attrCol = keys.find(k => {
      const normalized = k.toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
      return ['attributes', 'attributejson', 'specs', 'specifications'].includes(normalized);
    });

    const rawJson = attrCol ? row[attrCol] : undefined;
    if (rawJson) {
      try {
        const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
        if (parsed && typeof parsed === 'object') Object.assign(attributes, parsed);
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
        attributes[attrKey.trim()] = value;
      }
    }

    return attributes;
  }

  private async invalidateProductCaches(productId?: string) {
    if (productId) {
      await this.cacheManager.del(`product:${productId}`);
    }
    await this.cacheManager.del('products:all');
    await this.cacheManager.del('catalog:categories');
    await this.cacheManager.del('catalog:categories:all');
    // N7 fix: do NOT call cacheManager.reset() here — it wipes the entire Redis namespace
    // (including session data and other services if sharing Redis). Use targeted key deletion.
    // For a full product cache flush, the keys follow the pattern `products:all:*`—
    // handled by the canonical query key in findAll().
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
    };
  }

  private async seedCatalogCategoriesIfNeeded(): Promise<void> {
    for (const category of catalogCategories) {
      const id = this.normalizeCategoryId(category.id);
      const existing = await this.taxonomyModel.findOne({ id, deletedAt: null }).lean().exec();
      const sanitized = this.sanitizeCatalogCategory(category, existing);

      const payload = {
        ...sanitized,
        synonyms: sanitized.synonyms?.length ? sanitized.synonyms : sanitized.aliases,
        searchBoost: sanitized.searchBoost || 1,
        isActive: true,
        version: existing ? Number(existing.version || 1) + 1 : 1,
        auditTrail: existing
          ? (Array.isArray(existing.auditTrail) ? existing.auditTrail : []).concat({ action: 'synchronized', reason: 'default_catalog_bootstrap', at: new Date() })
          : [{ action: 'seeded', reason: 'default_catalog_bootstrap', at: new Date() }],
      };

      await this.taxonomyModel.findOneAndUpdate(
        { id },
        { $set: payload },
        { upsert: true, returnDocument: 'after' }
      ).exec();
    }
    await this.cacheManager.del('catalog:categories');
    await this.cacheManager.del('catalog:categories:all');
  }


  async getCatalogCategories(includeInactive = false): Promise<CatalogCategory[]> {
    const cacheKey = includeInactive ? 'catalog:categories:all' : 'catalog:categories';
    const cached = await this.cacheManager.get<CatalogCategory[]>(cacheKey);
    if (cached) return cached;
    await this.seedCatalogCategoriesIfNeeded();
    const rows = await this.taxonomyModel
      .find({ deletedAt: null, ...(includeInactive ? {} : { isActive: true }) })
      .sort({ label: 1 })
      .lean()
      .exec();
    const categories = rows.map(row => this.sanitizeCatalogCategory(row));
    await this.cacheManager.set(cacheKey, categories, 6 * 60 * 60 * 1000);
    return categories;
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
    const normalized = String(value || '').trim().toLowerCase();
    const categories = await this.getCatalogCategories();
    const match = categories.find(category =>
      category.id === normalized ||
      category.productType === normalized ||
      category.label.toLowerCase() === normalized ||
      category.aliases?.some(alias => alias.toLowerCase() === normalized) ||
      category.synonyms?.some(synonym => synonym.toLowerCase() === normalized)
    );
    return match || resolveCatalogCategory(value);
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
        attributes: this.sanitizeAttributes(category, variant.attributes || {}, false),
        isActive: variant.isActive === undefined ? true : this.parseBooleanFlag(variant.isActive) !== false,
      };
    });
  }

  private async normalizeProductData(input: any, existing?: any): Promise<any> {
    const productData = { ...input };
    const category = await this.resolveCatalogCategoryDynamic(productData.categoryId || productData.category || existing?.categoryId || existing?.category);
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

  private calculateSearchScore(product: any, search: string, category?: CatalogCategory): number {
    const term = search.trim().toLowerCase();
    if (!term) return 0;
    const haystacks = [
      { value: product.name, weight: 8 },
      { value: product.categoryLabel || product.category, weight: 5 },
      { value: product.description, weight: 3 },
      { value: this.stringFromAttributes(product.attributes), weight: 3 },
      { value: product.sellerId?.stallName || product.sellerId?.shopDetails?.name, weight: 2 },
      { value: category?.aliases?.join(' '), weight: 4 },
      { value: category?.synonyms?.join(' '), weight: 4 },
    ];

    return haystacks.reduce((score, part) => {
      const value = String(part.value || '').toLowerCase();
      if (!value) return score;
      if (value === term) return score + part.weight * 2;
      if (value.includes(term)) return score + part.weight;
      const tokens = term.split(/\s+/).filter(Boolean);
      return score + tokens.filter(token => value.includes(token)).length * (part.weight / Math.max(tokens.length, 1));
    }, Number(product.totalOrders || 0) * 0.02 + Number(product.rating || 0) * 0.8 + Number(category?.searchBoost || 1));
  }

  private rankProducts(products: any[], search?: string): any[] {
    const term = String(search || '').trim();
    if (!term) return products;
    return [...products]
      .map(product => {
        const category = this.catalogCategoryForProduct(product);
        return { ...product, searchScore: this.calculateSearchScore(product, term, category) };
      })
      .sort((a, b) => Number(b.searchScore || 0) - Number(a.searchScore || 0));
  }

  async onModuleInit() {
    try {
      const XLSX = require('xlsx');
      const fs = require('fs');
      const filePath = 'c:/Users/mahor/.gemini/antigravity/scratch/Rwanda-online-shop/rmf_bulk_product_template.xlsx';
      if (fs.existsSync(filePath)) {
        const wb = XLSX.readFile(filePath);
        const res: Record<string, any> = {};
        wb.SheetNames.forEach((name: string) => {
          const ws = wb.Sheets[name];
          res[name] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        });
        fs.writeFileSync('c:/Users/mahor/.gemini/antigravity/scratch/Rwanda-online-shop/xlsx-output.txt', JSON.stringify(res, null, 2));
        console.log('✅ SUCCESSFULLY DUMPED XLSX TEMPLATE TO xlsx-output.txt');
      } else {
        console.log('❌ TEMPLATE FILE NOT FOUND AT:', filePath);
      }
    } catch (e: any) {
      console.error('❌ FAILED TO DUMP XLSX TEMPLATE:', e.message);
    }

    await this.seedCatalogCategoriesIfNeeded();

    // Self-healing migration for products that got corrupted with User ID instead of SellerProfile ID
    try {
      console.log('🔄 Running product database self-healing migration...');
      const allProducts = await this.productModel.find({ deletedAt: null }).exec();
      let healCount = 0;
      for (const prod of allProducts) {
        if (prod.sellerId) {
          const seller = await this.sellerModel.findOne({ userId: prod.sellerId }).exec();
          if (seller) {
            prod.sellerId = seller._id;
            prod.marketId = seller.marketId;
            await prod.save();
            healCount++;
          }
        }
      }
      if (healCount > 0) {
        console.log(`✅ Successfully self-healed ${healCount} products!`);
        await this.invalidateProductCaches();
      }
    } catch (e: any) {
      console.error('❌ Product self-healing migration failed:', e.message);
    }

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
              variantAxes: this.sanitizeVariantAxes(catalogCategory),
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

    if (isNaN(productData.price)) throw new BadRequestException('Price must be a valid number.');

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
    } = query;
    // Normalize cache key: only include fields that affect the query, in sorted order
    const canonicalQuery = JSON.stringify({
      marketId,
      sellerId,
      approvedOnly,
      isActive,
      limit,
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
      isApproved: query.isApproved,
    });
    const cacheKey = `products:all:${canonicalQuery}`;
    const cached = await this.cacheManager.get<any[]>(cacheKey);
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
      this.addAndFilter(filter, {
        $or: [
          { categoryId: resolved.id },
          { productType: resolved.productType },
          { category: { $in: this.legacyCategoryValues(resolved) } },
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

      const dynamicCategories = await this.getCatalogCategories();
      const matchedCategories = dynamicCategories.filter(cat =>
        cat.label.toLowerCase().includes(trimmedSearch.toLowerCase()) ||
        cat.aliases?.some((a: string) => a.toLowerCase().includes(trimmedSearch.toLowerCase())) ||
        cat.synonyms?.some((s: string) => s.toLowerCase().includes(trimmedSearch.toLowerCase()))
      );
      const matchedCategoryIds = matchedCategories.map(cat => cat.id);

      this.addAndFilter(filter, {
        $or: [
          { name: { $regex: safeSearch, $options: 'i' } },
          { description: { $regex: safeSearch, $options: 'i' } },
          { category: { $regex: safeSearch, $options: 'i' } },
          { categoryLabel: { $regex: safeSearch, $options: 'i' } },
          { productType: { $regex: safeSearch, $options: 'i' } },
          { 'attributes.brand': { $regex: safeSearch, $options: 'i' } },
          { 'attributes.model': { $regex: safeSearch, $options: 'i' } },
          { 'attributes.material': { $regex: safeSearch, $options: 'i' } },
          { 'attributes.originDistrict': { $regex: safeSearch, $options: 'i' } },
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

    const dbQuery = this.productModel.find(filter).populate(['sellerId', 'marketId']).lean();

    if (sortBy) {
      dbQuery.sort(sortBy);
    } else {
      dbQuery.sort({ createdAt: -1 });
    }

    if (limit) {
      dbQuery.limit(Number(limit));
    }

    const results = await dbQuery.exec();

    // Enrich with active promotion data
    const enriched = await this.enrichWithPromotions(results.map(product => this.withCatalogMetadata(product)));
    const promotedOrAll = hasPromotion === 'true' || hasPromotion === true
      ? enriched.filter((product: any) => Boolean(product.promotion))
      : enriched;
    const finalResults = this.rankProducts(promotedOrAll, trimmedSearch);

    // Set cache with 5 minute TTL (300 seconds)
    await this.cacheManager.set(cacheKey, finalResults, 300000);

    return finalResults;
  }

  async getFacets(query: any): Promise<any> {
    const products = await this.findAll({ ...query, limit: query.limit || 1000 });
    const categories = new Map<string, { id: string; label: string; count: number; fields: any[] }>();
    const priceRange = { min: Number.POSITIVE_INFINITY, max: 0 };

    for (const product of products) {
      const category = this.catalogCategoryForProduct(product);
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
    const attributeFacets = categoryList.map(category => {
      const fields = category.attributes.filter(field => field.filterable).map(field => {
        const counts = new Map<string, number>();
        for (const product of products) {
          const productCategory = this.catalogCategoryForProduct(product);
          if (productCategory.id !== category.id) continue;
          const raw = product.attributes?.[field.key];
          const values = Array.isArray(raw) ? raw : raw === undefined || raw === null || raw === '' ? [] : [raw];
          values.forEach(value => {
            const key = String(value);
            counts.set(key, (counts.get(key) || 0) + 1);
          });
        }
        return {
          ...field,
          values: Array.from(counts.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count).slice(0, 40),
        };
      });
      return { id: category.id, label: category.label, fields };
    }).filter(category => category.fields.some(field => field.values.length > 0 || field.options?.length));

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
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) return cached;

    const product = await this.productModel.findOne({ _id: id, deletedAt: null }).populate(['sellerId', 'marketId']).lean().exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Enrich with promotion data
    const [enriched] = await this.enrichWithPromotions([this.withCatalogMetadata(product)]);

    await this.cacheManager.set(cacheKey, enriched, 300000);
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

  async bulkUpload(buffer: Buffer, sellerId: string): Promise<any> {
    console.log(`[BulkUpload] Starting for seller: ${sellerId}`);
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let sheetName = workbook.SheetNames.find(name => {
        const lower = name.toLowerCase().trim();
        return lower.includes('product');
      });
      if (!sheetName) {
        sheetName = workbook.SheetNames[0];
      }
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

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
          const attributes = this.parseAttributesFromRow(baseRow);

          // Supply safe fallbacks for missing mandatory category fields
          for (const field of categoryObj.attributes) {
            if (field.required) {
              const currentVal = attributes[field.key];
              if (currentVal === undefined || currentVal === null || currentVal === '') {
                if (field.type === 'select' && field.options?.length) {
                  const fallbackOption = field.options.find(opt => ['other', 'mixed', 'a', 'new'].includes(opt.toLowerCase())) || field.options[0];
                  attributes[field.key] = fallbackOption;
                } else if (field.type === 'boolean') {
                  attributes[field.key] = true;
                } else if (field.type === 'number') {
                  attributes[field.key] = field.min !== undefined ? field.min : 0;
                } else {
                  attributes[field.key] = 'Generic';
                }
              }
            }
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
        p.promotion = {
          type: promo.type,
          discount: promo.discount,
          promotedPrice: promo.promotedPrice || p.price,
          endDate: promo.endDate
        };
      }
      return p;
    });
  }

  generateExcelTemplate(): Buffer {
    const wb = XLSX.utils.book_new();

    const productHeaders = [
      'Name',
      'Description',
      'Category',
      'Price',
      'Unit',
      'Stock',
      'StockType',
      'MadeInRwanda',
      'Images',
      'Size',
      'Color',
      'Flavor',
      'PackageSize',
      'Capacity',
      'SKU'
    ];

    const sampleRows = [
      {
        Name: 'Handwoven Agaseke Basket',
        Description: 'Traditional handwoven Rwandan basket with high quality sisal fibers.',
        Category: 'handicrafts',
        Price: 25000,
        Unit: 'pcs',
        Stock: 10,
        StockType: 'finite',
        MadeInRwanda: 'yes',
        Images: 'https://images.unsplash.com/photo-1607344645866-009c320b63e0',
        Size: 'Small',
        Color: 'Red',
        Flavor: '',
        PackageSize: '',
        Capacity: '',
        SKU: 'AGA-S-RED'
      },
      {
        Name: 'Handwoven Agaseke Basket',
        Description: 'Traditional handwoven Rwandan basket with high quality sisal fibers.',
        Category: 'handicrafts',
        Price: 28000,
        Unit: 'pcs',
        Stock: 15,
        StockType: 'finite',
        MadeInRwanda: 'yes',
        Images: 'https://images.unsplash.com/photo-1607344645866-009c320b63e0',
        Size: 'Medium',
        Color: 'Blue',
        Flavor: '',
        PackageSize: '',
        Capacity: '',
        SKU: 'AGA-M-BLU'
      },
      {
        Name: 'Rwandan Specialty Coffee',
        Description: 'High-altitude Arabica beans from Gisenyi.',
        Category: 'grocery',
        Price: 12000,
        Unit: 'kg',
        Stock: 100,
        StockType: 'infinite',
        MadeInRwanda: 'yes',
        Images: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e',
        Size: '',
        Color: '',
        Flavor: '',
        PackageSize: '1kg',
        Capacity: '',
        SKU: 'COF-1KG'
      },
      {
        Name: 'Rwandan Specialty Coffee',
        Description: 'High-altitude Arabica beans from Gisenyi.',
        Category: 'grocery',
        Price: 6500,
        Unit: 'kg',
        Stock: 200,
        StockType: 'infinite',
        MadeInRwanda: 'yes',
        Images: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e',
        Size: '',
        Color: '',
        Flavor: '',
        PackageSize: '500g',
        Capacity: '',
        SKU: 'COF-500G'
      },
      {
        Name: 'Comfortable Kitenge Cushion',
        Description: 'Soft cotton cushion for home interior.',
        Category: 'home',
        Price: 15000,
        Unit: 'pcs',
        Stock: 5,
        StockType: 'on_demand',
        MadeInRwanda: 'yes',
        Images: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e6',
        Size: 'Medium',
        Color: 'Yellow',
        Flavor: '',
        PackageSize: '',
        Capacity: '',
        SKU: 'CUSH-KIT-YLW'
      }
    ];

    const wsProducts = XLSX.utils.json_to_sheet(sampleRows, { header: productHeaders });
    XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

    const referenceData = [
      { Parameter: 'Category', 'Allowed Values': 'grocery, fashion, handicrafts, home, electronics, other', Description: 'The category matching your product. Custom entries resolve to "other" schema.' },
      { Parameter: 'StockType', 'Allowed Values': 'finite, infinite, on_demand', Description: 'How stock availability is managed.' },
      { Parameter: 'MadeInRwanda', 'Allowed Values': 'yes, no', Description: 'Is this product made or produced in Rwanda?' },
      { Parameter: 'Unit', 'Allowed Values': 'pcs, kg, pair, set', Description: 'The pricing unit for the inventory listing.' },
      { Parameter: 'Variants (Size, Color, Flavor, PackageSize, Capacity, SKU)', 'Allowed Values': 'Text / standard codes', Description: 'Group rows with the SAME "Name" to declare variants (e.g. red/blue or small/medium/large).' }
    ];

    const wsRef = XLSX.utils.json_to_sheet(referenceData);
    XLSX.utils.book_append_sheet(wb, wsRef, 'Validation Reference');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  async debugInspect(): Promise<any> {
    const sellers = await this.sellerModel.find().lean().exec();
    const products = await this.productModel.find().populate(['sellerId', 'marketId']).lean().exec();
    return { sellers, products };
  }
}
