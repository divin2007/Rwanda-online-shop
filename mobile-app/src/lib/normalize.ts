import { CartItem, Coordinates, Market, Product, ProductVariant, SellerProfile } from '../types';

export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  return [];
}

export const sellerProfileOf = (product: Product): SellerProfile | null => {
  return typeof product.sellerId === 'object' && product.sellerId ? product.sellerId as SellerProfile : null;
};

export const marketOf = (value?: string | Market): Market | null => {
  return typeof value === 'object' && value ? value as Market : null;
};

export const idOf = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const anyValue = value as { _id?: string; id?: string };
    return anyValue._id || anyValue.id;
  }
  return undefined;
};

import { host } from './api';

const serviceBase = (port: number) => {
  const cleanHost = host.replace(/\/$/, '').replace(/:\d+$/, '');
  return `${cleanHost}:${port}`;
};

export const normalizeMediaUrl = (url?: string | null, port = 3003): string | undefined => {
  const value = String(url || '').trim();
  if (!value) return undefined;
  if (/^(data|blob):/i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;

  if (value.startsWith('/')) {
    return `${serviceBase(port)}${value}`;
  }

  if (/^https?:\/\//i.test(value)) {
    return value.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, serviceBase(port));
  }

  return `${serviceBase(port)}/${value.replace(/^\/+/, '')}`;
};

const optimizeUnsplashUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (url.includes('unsplash.com')) {
    if (!url.includes('w=')) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}w=600&auto=format&fit=crop&q=80`;
    }
  }
  return url;
};

export const normalizeImageUrl = (url?: string | null): string | undefined => {
  const value = String(url || '').trim();
  if (!value) return undefined;
  const firstUrl = value.split(',')[0].trim();
  const normalized = normalizeMediaUrl(firstUrl, 3003);
  return normalized ? optimizeUnsplashUrl(normalized) : undefined;
};

export const imagesOfVariant = (variant?: ProductVariant | null): string[] => {
  if (!variant) return [];
  const rawImages = variant.images || (variant as any).imageUrl || (variant as any).image;
  let list: string[] = [];
  if (typeof rawImages === 'string') {
    list = rawImages.split(',');
  } else if (Array.isArray(rawImages)) {
    list = rawImages.flatMap((item: any) =>
      typeof item === 'string' ? item.split(',') : String(item || '')
    );
  }
  return list
    .map((url: string) => url.trim())
    .filter(Boolean)
    .map(normalizeImageUrl)
    .filter(Boolean) as string[];
};

export const imageOf = (product?: Product | null) => {
  const images = asArray<string>(product?.images);
  const rawImage = images.find(Boolean);
  return normalizeImageUrl(rawImage);
};

export const normalizeMarketImageUrl = (url?: string): string | undefined => {
  const normalized = normalizeMediaUrl(url, 3002);
  return normalized ? optimizeUnsplashUrl(normalized) : undefined;
};

export const coordinatesOfMarket = (market?: Market | null): Coordinates | undefined => {
  const coords = market?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return undefined;
  return { lng: Number(coords[0]), lat: Number(coords[1]) };
};

export const productToCartItem = (
  product: Product,
  quantity: number,
  variantIndex = -1,
): CartItem => {
  const seller = sellerProfileOf(product);
  const market = marketOf(product.marketId);
  const variant = variantIndex >= 0 ? asArray<ProductVariant>(product.variants)[variantIndex] : undefined;
  const variantImages = imagesOfVariant(variant);
  const imageUrl = variantImages[0] || imageOf(product);
  const basePrice = Number(product.price || 0);
  const addPrice = variant?.price !== undefined && variant?.price !== null
    ? Number(variant.price)
    : 0;
  const unitPrice = basePrice + addPrice;
  const sellerId = idOf(product.sellerId);

  if (!product._id || !sellerId) {
    throw new Error('This product is missing seller information and cannot be ordered yet.');
  }

  return {
    productId: product._id,
    name: product.name,
    unitPrice,
    quantity,
    unit: variant?.unit || product.unit,
    category: product.categoryLabel || product.category,
    categoryId: product.categoryId,
    imageUrl,
    images: imageUrl ? [imageUrl] : undefined,
    attributes: { ...(product.attributes || {}), ...(variant?.attributes || {}) },
    variantId: variant?.id || variant?.sku,
    variantTitle: variant?.title,
    sellerSku: variant?.sku,
    sellerId,
    sellerUserId: typeof seller?.userId === 'string' ? seller.userId : idOf(seller?.userId),
    sellerName: seller?.shopDetails?.name || seller?.stallName,
    stallId: seller?.stallId,
    marketId: idOf(product.marketId) || idOf(seller?.marketId),
    marketCoordinates: coordinatesOfMarket(marketOf(product.marketId)),
  };
};
