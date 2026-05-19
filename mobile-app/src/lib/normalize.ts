import { CartItem, Coordinates, Market, Product, ProductVariant, SellerProfile } from '../types';

export const asArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  return [];
};

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

export const imageOf = (product?: Product | null) => {
  const images = asArray<string>(product?.images);
  return images.find(Boolean);
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
  const variantImages = asArray<string>(variant?.images);
  const imageUrl = variantImages[0] || imageOf(product);
  const unitPrice = Number(product.price || 0) + Number(variant?.price || 0);
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
