'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Heart, MessageCircle, ShoppingCart } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/components/cart/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/format';
import { getProductUrl } from '@/lib/urls';
import toast from 'react-hot-toast';

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
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const { t } = useLanguage();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { user } = useAuth();
  const router = useRouter();

  const handleBuyNow = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return toast.error('Please log in to negotiate with the seller');

    const sellerProfile = typeof product.sellerId === 'object' ? product.sellerId : null;
    const sellerId = sellerProfile?._id || product.sellerId;
    const sellerUserId = sellerProfile?.userId || null;

    try {
      const subtotal = product.price;
      const deliveryFee = 1000;
      const platformCommission = Math.max(subtotal * 0.015, 100);
      const gatewayFee = Math.ceil(subtotal * 0.02);
      const totalAmount = subtotal + deliveryFee + gatewayFee;

      const payload = {
        buyer: {
          userId: user.id,
          fullName: user.fullName || 'Buyer',
          phone: user.phone || 'N/A',
        },
        seller: {
          sellerId,
          userId: sellerUserId,
          fullName: sellerProfile?.shopDetails?.name || sellerProfile?.stallName || 'Seller',
          stallId: sellerProfile?.stallId || 'N/A',
          marketId: typeof product.marketId === 'object' ? product.marketId._id : product.marketId,
        },
        products: [{
          productId: product._id,
          name: product.name,
          unitPrice: product.price,
          quantity: 1,
        }],
        financials: {
          subtotal,
          deliveryFee,
          platformCommission,
          gatewayFee,
          totalAmount,
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

  if (!product.images || product.images.length === 0) return null;

  const hasPromotion = product.promotion && product.promotion.promotedPrice > 0;
  const displayPrice = hasPromotion ? product.promotion!.promotedPrice : product.price;
  const discountLabel = hasPromotion
    ? (product.promotion!.type === 'percentage'
        ? `-${product.promotion!.discount}%`
        : `-${formatCurrency(product.promotion!.discount)}`)
    : null;
  const isNegotiable = String(product.isNegotiable) === 'true' || product.isNegotiable === true;
  const productUrl = getProductUrl(product._id, typeof product.marketId === 'object' ? product.marketId.slug : undefined);

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl cinematic-shadow">
      <div className="relative aspect-[4/3] overflow-hidden bg-background-surface">
        <Link href={productUrl} className="block h-full w-full">
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            className={`object-cover transition-transform duration-700 group-hover:scale-105 ${!product.inStock && product.stockType !== 'infinite' ? 'opacity-45 grayscale' : ''}`}
          />
        </Link>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-primary-cinematic/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary shadow-sm border border-white/20">
            <BadgeCheck size={14} className="text-accent-premium" />
            Verified
          </span>
          {hasPromotion && (
            <span className="rounded-full bg-red-600/90 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm border border-red-500/20">
              {discountLabel} off
            </span>
          )}
          {product.stockType === 'on_demand' && (
            <span className="rounded-full bg-primary/10 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary shadow-sm border border-primary/20">
              Custom order
            </span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(product._id);
          }}
          aria-label="Toggle wishlist"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur-md text-primary shadow-sm transition-all duration-300 hover:bg-primary hover:text-white border border-white/20"
        >
          <Heart size={16} fill={isInWishlist(product._id) ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="line-clamp-1 text-[11px] font-bold uppercase tracking-widest text-text-secondary">{product.category || 'Product'}</span>
          {product.isMadeInRwanda && (
            <span className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-primary">Made in Rwanda</span>
          )}
        </div>

        <h3 className="line-clamp-2 text-lg font-bold leading-snug tracking-tight text-text-primary transition-colors group-hover:text-primary">
          <Link href={productUrl}>{product.name}</Link>
        </h3>

        <div className="mt-4 grid gap-3">
          <div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xl font-black tracking-tight text-text-primary">{formatCurrency(displayPrice)}</span>
              {hasPromotion && (
                <span className="text-xs font-bold text-text-secondary line-through opacity-70">{formatCurrency(product.price)}</span>
              )}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-text-secondary">per {product.unit}</span>
          </div>
          <span className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${product.inStock ? 'bg-primary/10 text-primary font-black' : 'bg-red-50 text-red-600 border border-red-100'}`}>
            {product.inStock ? t('product_available') : (product.stockType === 'on_demand' ? t('crafted_on_commission') : t('product_out_of_stock'))}
          </span>
        </div>

        <div className="mt-auto pt-6">
          {isNegotiable ? (
            <button
              onClick={handleBuyNow}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-100/90 border border-amber-200/50 px-4 text-xs font-black uppercase tracking-widest text-amber-900 transition-colors hover:bg-accent-premium hover:text-white"
            >
              <MessageCircle size={18} />
              Negotiate price
            </button>
          ) : (
            <button
              onClick={() => addToCart(product)}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold uppercase tracking-widest text-white shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30"
            >
              <ShoppingCart size={18} />
              {product.stockType === 'on_demand' ? 'Request quote' : t('product_add_to_cart')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
