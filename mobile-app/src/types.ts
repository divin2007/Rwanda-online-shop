export type Role = 'BUYER' | 'SELLER' | 'RIDER' | 'ADMIN';

export type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  count?: number;
  message?: string;
  error?: string;
};

export type User = {
  id: string;
  _id?: string;
  fullName: string;
  email: string;
  phone?: string;
  role: Role;
  avatarUrl?: string;
  // Present only when the profile has been enriched with role-specific records.
  sellerId?: string;
  riderId?: string;
};

export type Coordinates = {
  lat: number;
  lng: number;
};

export type Market = {
  _id: string;
  id?: string;
  name: string;
  slug?: string;
  code?: string;
  type?: string;
  description?: string;
  imageUrl?: string;
  location?: {
    address?: string;
    district?: string;
    sector?: string;
    coordinates?: [number, number];
  };
  operatingHours?: {
    open?: string;
    close?: string;
    daysOpen?: string[];
  };
  isActive?: boolean;
  rating?: number;
  totalSellers?: number;
};

export type SellerProfile = {
  _id: string;
  userId?: string;
  marketId?: string | Market;
  stallId?: string;
  stallName?: string;
  description?: string;
  isApproved?: boolean;
  rating?: number;
  totalSales?: number;
  totalOrders?: number;
  businessPermitUrl?: string;
  rraCertificateUrl?: string;
  idCardUrl?: string;
  stallPhotoUrl?: string;
  shopDetails?: {
    name?: string;
    slug?: string;
    code?: string;
    logoUrl?: string;
    bannerUrl?: string;
    imageUrl?: string;
    hubImageUrl?: string;
    tagline?: string;
    description?: string;
    categories?: string[];
    operatingHours?: {
      open?: string;
      close?: string;
      daysOpen?: string[];
    };
  };
};

export type CatalogAttribute = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'boolean' | string;
  required?: boolean;
  options?: string[];
  unit?: string;
};

export type CatalogCategory = {
  id: string;
  label: string;
  parentId?: string;
  productType?: string;
  aliases?: string[];
  synonyms?: string[];
  attributes?: CatalogAttribute[];
  isActive?: boolean;
};

export type ProductVariant = {
  id?: string;
  sku?: string;
  title?: string;
  options?: Record<string, string>;
  price?: number;
  unit?: string;
  stockType?: 'finite' | 'infinite' | 'on_demand';
  stockQuantity?: number;
  inStock?: boolean;
  images?: string[];
  videoUrl?: string;
  thumbnailUrl?: string;
  attributes?: Record<string, unknown>;
  isActive?: boolean;
};

export type Product = {
  _id: string;
  sellerId?: string | SellerProfile;
  marketId?: string | Market;
  name: string;
  description?: string;
  category?: string;
  categoryId?: string;
  categoryLabel?: string;
  productType?: string;
  attributes?: Record<string, unknown>;
  price: number;
  priceUpdatedAt?: string;
  unit?: string;
  stockType?: 'finite' | 'infinite' | 'on_demand';
  stockQuantity?: number;
  inStock?: boolean;
  images?: string[];
  variants?: ProductVariant[];
  isApproved?: boolean;
  isActive?: boolean;
  isMadeInRwanda?: boolean;
  isNegotiable?: boolean;
  rating?: number;
  totalOrders?: number;
  promotion?: {
    _id?: string;
    title?: string;
    discountType?: string;
    discountValue?: number;
    endsAt?: string;
  };
};

export type Promotion = {
  _id: string;
  productId?: string | Product;
  product?: Product;
  type?: 'percentage' | 'fixed_amount' | string;
  discount?: number;
  startDate?: string;
  endDate?: string;
  promotedPrice?: number;
  isActive?: boolean;
};

export type SellerVideo = {
  _id: string;
  title: string;
  caption?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  placement?: 'PRODUCT_AD' | 'SHOP_AD';
  tags?: string[];
  likeCount?: number;
  dislikeCount?: number;
  commentCount?: number;
  viewerReaction?: 'like' | 'dislike' | null;
  sellerId?: string | SellerProfile;
  marketId?: string | Market;
  productId?: string | Product;
  comments?: Array<{
    _id?: string;
    fullName?: string;
    text?: string;
    createdAt?: string;
  }>;
};

export type CartItem = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  unit?: string;
  category?: string;
  categoryId?: string;
  imageUrl?: string;
  images?: string[];
  attributes?: Record<string, unknown>;
  variantId?: string;
  variantTitle?: string;
  sellerSku?: string;
  sellerId: string;
  sellerUserId?: string;
  sellerName?: string;
  stallId?: string;
  marketId?: string;
  marketCoordinates?: Coordinates;
};

export type Order = {
  _id: string;
  orderNumber?: string;
  status?: string;
  buyer?: Record<string, any>;
  seller?: Record<string, any>;
  product?: Record<string, any>;
  products?: Record<string, any>[];
  financials?: Record<string, any>;
  payment?: Record<string, any>;
  messages?: OrderMessage[];
  notes?: string;
  statusHistory?: Record<string, any>[];
  delivery?: Record<string, any>;
  deliveryId?: string;
  createdAt?: string;
};

export type OrderMessage = {
  senderId: string;
  senderRole: 'BUYER' | 'SELLER';
  content: string;
  imageUrl?: string;
  type?: string;
  quoteAmount?: number;
  timestamp?: string;
};

export type NotificationLog = {
  _id: string;
  userId?: string;
  type?: string;
  title?: string;
  message?: string;
  body?: string;
  params?: Record<string, any>;
  isRead?: boolean;
  status?: string;
  createdAt?: string;
};

export type Wallet = {
  balance?: number;
  availableBalance?: number;
  pendingBalance?: number;
  transactions?: Record<string, any>[];
};

export type Delivery = {
  _id: string;
  orderId?: string;
  status?: string;
  riderId?: string;
  pickup?: Record<string, any>;
  dropoff?: Record<string, any>;
  currentLocation?: Coordinates;
  fee?: number;
  earnings?: number;
  createdAt?: string;
};
