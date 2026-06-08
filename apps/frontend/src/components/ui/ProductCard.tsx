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
    category?: string;
    sellerId?: string | {
      _id?: string;
      userId?: string;
      stallId?: string;
      stallName?: string;
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
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-[#e2bfb0] bg-white transition-colors hover:border-[#ff6b00]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#efeded]">
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
          <div className="flex h-full items-center justify-center px-4 text-center font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#8e7164]">
            Image unavailable
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-sm bg-[#ff9f1c] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#221b00]">
            <BadgeCheck size={12} />
            Verified
          </span>
          {product.isMadeInRwanda && (
            <span className="rounded-sm bg-white px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#ff6b00]">
              Local
            </span>
          )}
          {hasPromotion && (
            <span className="rounded-sm bg-[#ba1a1a] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-white">
              Deal
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
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded bg-white text-[#ff6b00] transition-colors hover:bg-[#ffedd5]"
          aria-label="Toggle wishlist"
        >
          <Heart size={16} fill={isInWishlist(product._id) ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className={`flex flex-1 flex-col ${isCompact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-1 min-w-0 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#ff6b00] sm:text-[10px] sm:tracking-[0.16em]">
            {product.category || 'Product'}
          </span>
          <span className={`rmf-status-chip shrink-0 text-[8px] sm:text-[10px] ${available ? 'text-[#12805c]' : 'text-[#ba1a1a]'}`}>
            {available ? 'In stock' : 'Unavailable'}
          </span>
        </div>

        <h3 className={`${isCompact ? 'mt-2 text-base' : 'mt-3 text-lg'} line-clamp-2 font-black leading-tight text-[#1b1c1c]`}>
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs font-medium text-[#574e47]">by {sellerName}</p>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className={`${isCompact ? 'text-base' : 'text-xl'} font-black text-[#ff6b00]`}>
                {priceRangeLabel || formatCurrency(displayPrice)}
              </span>
              {hasPromotion && (
                <span className="text-xs font-bold text-[#8e7164] line-through">
                  {formatCurrency(product.price)}
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#574e47]">
              per {product.unit}
            </p>
          </div>
        </div>

        <div className="mt-auto pt-4">
          {isNegotiable ? (
            <button
              type="button"
              onClick={handleNegotiation}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-normal rounded border border-[#ff6b00] bg-white px-2 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#ff6b00] transition-colors hover:bg-[#ffedd5] sm:px-3 sm:text-[11px] sm:tracking-[0.12em]"
            >
              <MessageCircle size={15} />
              Negotiate
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCart}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-normal rounded bg-[#ff6b00] px-2 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#e05300] sm:px-3 sm:text-[11px] sm:tracking-[0.12em]"
            >
              <ShoppingCart size={15} />
              {t('product_add_to_cart') || 'Add to cart'}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
};
