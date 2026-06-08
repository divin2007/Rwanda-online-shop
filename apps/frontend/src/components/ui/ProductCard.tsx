'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Heart, MessageCircle, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/components/cart/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { useWishlist } from '@/context/WishlistContext';
import { formatCurrency } from '@/lib/format';
import { trackProductSignal } from '@/lib/recommendations';
import { getProductUrl } from '@/lib/urls';
import { resolveUploadUrl } from '@/lib/uploadUrls';
import { PerishableBadge } from '@/components/ui/PerishableBadge';
import { SellerTierBadge } from '@/components/ui/SellerTierBadge';
import { ConditionBadge } from '@/components/ui/ConditionBadge';

interface ProductCardProps {
  product: {
    _id: string;
    name: string;
    price: number;
    unit: string;
    images: string[];
    inStock: boolean;
    marketId?: string | {
      _id?: string;
      slug?: string;
    };
    promotion?: {
      type: 'percentage' | 'fixed_amount';
      discount: number;
      promotedPrice: number;
    };
    stockType?: 'finite' | 'infinite' | 'on_demand';
    isMadeInRwanda?: boolean;
    isNegotiable?: boolean;
    perishable?: boolean;
    maxDeliveryMinutes?: number;
    condition?: 'new' | 'grade_a' | 'grade_b' | 'grade_c' | 'refurbished' | null;
    category?: string;
    sellerId?: string | {
      _id?: string;
      userId?: string;
      stallId?: string;
      stallName?: string;
      certificationTier?: 'BRONZE' | 'SILVER' | 'GOLD';
      exportReady?: boolean;
      shopDetails?: {
        name?: string;
      };
    };
  };
  isCompact?: boolean;
}

const normalizeImages = (rawImages: unknown) => {
  const list = typeof rawImages === 'string'
    ? rawImages.split(',')
    : Array.isArray(rawImages)
      ? rawImages.flatMap(item => (typeof item === 'string' ? item.split(',') : item))
      : [];

  return list
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .map(url => resolveUploadUrl(url, 'product'));
};

export const ProductCard = ({ product, isCompact = false }: ProductCardProps) => {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const images = React.useMemo(() => normalizeImages(product.images), [product.images]);

  const sellerProfile = typeof product.sellerId === 'object' ? product.sellerId : null;
  const sellerId = sellerProfile?._id || product.sellerId;
  const sellerUserId = sellerProfile?.userId || null;
  const sellerName = sellerProfile?.shopDetails?.name || sellerProfile?.stallName || 'Verified seller';
  const productUrl = getProductUrl(product._id);
  const hasPromotion = product.promotion && product.promotion.promotedPrice > 0;
  const displayPrice = hasPromotion ? product.promotion!.promotedPrice : product.price;
  const isNegotiable = String(product.isNegotiable) === 'true' || product.isNegotiable === true || product.stockType === 'on_demand';
  const priceRangeLabel = (product as any).minPrice && (product as any).maxPrice
    ? `${Number((product as any).minPrice).toLocaleString()} - ${Number((product as any).maxPrice).toLocaleString()} RWF`
    : null;
  const available = Boolean(product.inStock || product.stockType === 'infinite' || product.stockType === 'on_demand');

  const handleNegotiation = async (event: React.MouseEvent) => {
    event.preventDefault();
    if (!user) return toast.error('Please log in to negotiate with the seller');
    if (user.role !== 'BUYER') {
      return toast.error('Negotiations must be started from a buyer account.');
    }
    trackProductSignal(product, 'add_to_cart');

    try {
      const subtotal = product.price;
      const deliveryFee = 1000;
      const platformCommission = Math.max(subtotal * 0.015, 100);
      const gatewayFee = Math.ceil(subtotal * 0.02);

      const payload = {
        buyer: {
          userId: user.id,
          fullName: user.fullName || 'Buyer',
          phone: user.phone || 'N/A',
        },
        seller: {
          sellerId,
          userId: sellerUserId,
          fullName: sellerName,
          stallId: sellerProfile?.stallId || 'N/A',
          marketId: typeof product.marketId === 'object' ? product.marketId._id : product.marketId,
        },
        products: [{
          productId: product._id,
          name: product.name,
          unitPrice: product.price,
          quantity: 1,
          customization: priceRangeLabel ? `Buyer opened negotiation in listed price range: ${priceRangeLabel}` : undefined,
        }],
        financials: {
          subtotal,
          deliveryFee,
          platformCommission,
          gatewayFee,
          totalAmount: subtotal + deliveryFee + gatewayFee,
          sellerPayout: subtotal - platformCommission,
          riderPayout: 900,
        },
        payment: { method: 'MTN_MOMO' },
        attributes: { isQuoteRequest: 'true' },
        notes: `Negotiation started for ${product.name}`,
      };

      const { orderApi } = await import('@/lib/api');
      const response = await orderApi.post('/orders', payload);
      const order = response.data?.data || response.data;
      toast.success('Negotiation started. Redirecting...');
      router.push(`/orders?open=${order._id}`);
    } catch (err: unknown) {
      const message = typeof err === 'object' && err !== null && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast.error(message || 'Failed to start negotiation');
    }
  };

  const handleCart = (event: React.MouseEvent) => {
    event.preventDefault();
    trackProductSignal(product, 'add_to_cart');
    addToCart(product);
  };

  return (
    <Link
      href={productUrl}
      onClick={() => trackProductSignal(product, 'product_view')}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest custom-shadow hover:border-primary transition-all duration-300"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-container-low">
        {images[0] ? (
          <Image
            src={images[0]}
            alt={product.name}
            fill
            unoptimized
            sizes="(min-width: 1024px) 280px, 45vw"
            className={`object-cover transition-transform duration-500 group-hover:scale-[1.03] ${available ? '' : 'opacity-50 grayscale'}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-md text-center font-data-mono text-data-mono-sm text-outline">
            Image unavailable
          </div>
        )}

        <div className="absolute left-2 top-2 flex flex-wrap gap-xs">
          <span className="inline-flex items-center gap-xs rounded-sm bg-surface-container-lowest px-2 py-0.5 border border-outline font-label-caps text-[9px] text-primary shadow-sm">
            <BadgeCheck size={10} className="text-primary-container" />
            Verified
          </span>
          {product.isMadeInRwanda && (
            <div className="bg-surface-container-lowest border border-outline rounded-full px-2 py-0.5 flex items-center gap-xs shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
              <span className="font-label-caps text-label-caps text-[9px] text-on-surface">Made in Rwanda</span>
            </div>
          )}
          {hasPromotion && (
            <span className="rounded-sm bg-error text-on-error font-label-caps text-[9px] px-2 py-0.5 shadow-sm">
              Deal
            </span>
          )}
          {product.perishable && (
            <PerishableBadge maxDeliveryMinutes={product.maxDeliveryMinutes} />
          )}
          {product.condition && product.condition !== 'new' && (
            <ConditionBadge condition={product.condition} size="xs" />
          )}
          {product.isMadeInRwanda && sellerProfile?.exportReady && (
            <span className="rounded-sm bg-surface-container-lowest border border-outline font-label-caps text-[9px] px-2 py-0.5 text-primary shadow-sm">
              Export Ready
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            if (!isInWishlist(product._id)) trackProductSignal(product, 'wishlist');
            toggleWishlist(product._id);
          }}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-lowest text-primary-container transition-colors border border-outline-variant hover:bg-surface-container-low"
          aria-label="Toggle wishlist"
        >
          <Heart size={14} fill={isInWishlist(product._id) ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-md space-y-xs">
        <div className="flex items-center justify-between gap-sm">
          <span className="font-label-caps text-[9px] text-on-surface-variant uppercase tracking-wider">
            {product.category || 'Product'}
          </span>
          <span className={`font-label-caps text-[9px] px-2 py-0.5 rounded-full ${available ? 'bg-primary/10 text-primary-container' : 'bg-error-container text-error'}`}>
            {available ? 'In stock' : 'Unavailable'}
          </span>
        </div>

        <h3 className="text-body-md font-bold text-on-surface group-hover:text-primary transition-colors leading-tight font-sans line-clamp-2">
          {product.name}
        </h3>
        <p className="font-label-caps text-[10px] text-on-surface-variant flex items-center gap-xs">
          by {sellerName}
          {sellerProfile?.certificationTier && (
            <SellerTierBadge tier={sellerProfile.certificationTier} size="xs" />
          )}
        </p>

        <div className="pt-sm border-t border-outline-variant flex items-center justify-between mt-sm">
          <div>
            <div className="flex flex-wrap items-baseline gap-xs">
              <span className="font-data-mono text-data-mono text-primary-container text-base font-bold">
                {priceRangeLabel || formatCurrency(displayPrice)}
              </span>
              {hasPromotion && (
                <span className="font-data-mono text-data-mono-sm text-on-surface-variant line-through">
                  {formatCurrency(product.price)}
                </span>
              )}
            </div>
            <p className="font-data-mono-sm text-[10px] text-on-surface-variant">
              per {product.unit}
            </p>
          </div>
        </div>

        <div className="pt-sm mt-auto">
          {isNegotiable ? (
            <button
              type="button"
              onClick={handleNegotiation}
              className="inline-flex h-9 w-full items-center justify-center gap-xs rounded border border-outline bg-surface-container-lowest px-3 py-2 font-label-caps text-label-caps text-primary hover:bg-surface-container-low transition-all"
            >
              <MessageCircle size={14} className="text-primary-container" />
              Negotiate
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCart}
              className="inline-flex h-9 w-full items-center justify-center gap-xs rounded bg-primary-container text-on-primary px-3 py-2 font-label-caps text-label-caps hover:bg-primary transition-colors"
            >
              <ShoppingCart size={14} />
              {t('product_add_to_cart') || 'Add to cart'}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
};
