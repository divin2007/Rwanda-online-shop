'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities */
import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import { useApi } from '@/hooks/useApi';
import { productApi, reviewApi } from '@/lib/api';
import { useCart } from '@/components/cart/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getMarketUrl } from '@/lib/urls';
import toast from 'react-hot-toast';

export default function ProductDetailPage({ params }: { params: { slug: string, productId: string } }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const { addToCart } = useCart();
  const { wishlist, toggleWishlist } = useWishlist();

  const { data: product, loading, execute: fetchProduct } = useApi(productApi, 'get', `/products/${params.productId}`);
  const { data: reviewsData } = useApi(reviewApi, 'get', `/reviews/target/product/${params.productId}`);
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const [customization, setCustomization] = React.useState('');
  const [qty, setQty] = React.useState(1);
  const [selectedVariantIndex, setSelectedVariantIndex] = React.useState(0);

  useEffect(() => {
    fetchProduct();
  }, [params.productId, fetchProduct]);

  const isWishlisted = product ? wishlist.includes(product._id) : false;

  const selectedVariant = product?.variants?.filter((variant: any) => variant.isActive !== false)?.[selectedVariantIndex] || null;
  const effectivePrice = selectedVariant?.price ?? product?.price ?? 0;
  const effectiveUnit = selectedVariant?.unit || product?.unit;
  const effectiveStockType = selectedVariant?.stockType || product?.stockType;
  const effectiveStockQuantity = selectedVariant?.stockQuantity ?? product?.stockQuantity;

  const handleAddToCart = () => {
    const cartProduct = selectedVariant ? {
      ...product,
      price: effectivePrice,
      unit: effectiveUnit,
      variantId: selectedVariant._id || selectedVariant.sku,
      variantTitle: selectedVariant.title,
      sellerSku: selectedVariant.sku,
      attributes: selectedVariant.attributes || product.attributes,
      images: selectedVariant.images?.length ? selectedVariant.images : product.images,
    } : product;
    for (let i = 0; i < qty; i++) addToCart(cartProduct, customization);
    toast.success(`${product.name} added to cart!`);
  };

  const handleBuyNow = async () => {
    if (!user) return toast.error('Please login to negotiate with the seller');

    try {
      const { orderApi } = await import('@/lib/api');
      const subtotal = effectivePrice * qty;
      const deliveryFee = 1000;
      const platformCommission = Math.max(subtotal * 0.015, 100);
      const gatewayFee = Math.ceil(subtotal * 0.02);
      const totalAmount = subtotal + deliveryFee + gatewayFee;
      const sellerProfile = typeof product.sellerId === 'object' ? product.sellerId : null;

      const payload = {
        buyer: {
          userId: user.id,
          fullName: user.fullName || 'Buyer',
          phone: user.phone || 'N/A',
        },
        seller: {
          sellerId: sellerProfile?._id || product.sellerId,
          userId: sellerProfile?.userId || null,
          fullName: sellerProfile?.shopDetails?.name || sellerProfile?.stallName || product.seller?.name || 'Seller',
          stallId: sellerProfile?.stallId || 'N/A',
          marketId: product.marketId?._id || product.marketId,
        },
        products: [{
          productId: product._id,
          name: product.name,
          unitPrice: effectivePrice,
          quantity: qty,
          unit: effectiveUnit,
          category: product.category,
          categoryId: product.categoryId,
          imageUrl: selectedVariant?.images?.[0] || product.images?.[0],
          images: selectedVariant?.images?.length ? selectedVariant.images : product.images,
          attributes: selectedVariant?.attributes || product.attributes,
          variantId: selectedVariant?._id || selectedVariant?.sku,
          variantTitle: selectedVariant?.title,
          sellerSku: selectedVariant?.sku,
          priceSnapshotAt: product.priceUpdatedAt,
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
        attributes: { 
          isQuoteRequest: 'true',
          isCustomizable: customization ? 'true' : 'false'
        },
        notes: customization || `Negotiation started for ${product.name}`,
      };

      const response = await orderApi.post('/orders', payload);
      const order = response.data?.data || response.data;
      toast.success('Negotiation initiated! Redirecting to your dashboard...');
      router.push(`/orders?open=${order._id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to start negotiation');
    }
  };

  if (loading) return (
    <Layout>
      <div className="rmf-container py-40 flex flex-col items-center gap-8">
        <div className="w-16 h-16 border-4 border-accent-premium border-t-transparent rounded-full animate-spin shadow-sm" />
        <p className="text-sm font-bold text-text-muted uppercase tracking-widest">Loading product...</p>
      </div>
    </Layout>
  );

  if (!product) return (
    <Layout>
      <div className="rmf-container py-40 text-center bg-background-surface rounded-2xl border border-dashed border-border-light my-10 shadow-sm">
        <p className="text-6xl mb-6 opacity-50 drop-shadow-sm">🛒</p>
        <h2 className="text-3xl font-bold text-text-primary tracking-tight mb-4">Product not found</h2>
        <Link href="/markets" className="inline-flex min-h-[3rem] items-center justify-center rounded-xl bg-primary/5 px-8 text-xs font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-all mt-4">Browse Markets →</Link>
      </div>
    </Layout>
  );

  const reviews = reviewsData || [];
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const activeVariants = Array.isArray(product.variants) ? product.variants.filter((variant: any) => variant.isActive !== false) : [];
  const isOnDemand = effectiveStockType === 'on_demand';
  const isInStock = selectedVariant ? selectedVariant.inStock !== false : product.inStock !== false;

  return (
    <Layout>
      <div className="rmf-container space-y-16 pb-40 pt-10 animate-reveal">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-3 border-b border-border-light pb-6 text-[10px] font-bold uppercase tracking-widest flex-wrap">
          <Link href="/" className="text-text-muted hover:text-primary transition-colors">Home</Link>
          <span className="text-border-light">/</span>
          <Link href="/markets" className="text-text-muted hover:text-primary transition-colors">Markets</Link>
          <span className="text-border-light">/</span>
          <Link href={getMarketUrl(params.slug)} className="text-text-muted hover:text-primary transition-colors capitalize">{params.slug.replace(/-/g, ' ')}</Link>
          <span className="text-border-light">/</span>
          <span className="text-text-primary opacity-60 truncate max-w-[200px]">{product.name}</span>
        </nav>

        {/* ── Main Product Grid ── */}
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,1fr)_450px]">

          {/* ── Left: Image Gallery ── */}
          <div className="space-y-6">
            {/* Main Image */}
            <div className="relative overflow-hidden rounded-3xl border border-border-light bg-background-surface cinematic-shadow aspect-[4/3] md:aspect-[16/10] group">
              {product.images?.[activeImageIndex] ? (
                <img
                  src={product.images[activeImageIndex]}
                  className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-105"
                  alt={product.name}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-bold uppercase tracking-widest text-text-muted">
                  Product image unavailable
                </div>
              )}
              {/* Badges */}
              <div className="absolute top-6 left-6 flex flex-col gap-2.5 z-10">
                {product.isNegotiable && (
                  <span className="bg-primary/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl shadow-md border border-white/20">⚡ Negotiable Price</span>
                )}
                {product.isMadeInRwanda && (
                  <span className="bg-primary/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl shadow-md border border-white/20">🇷🇼 Made in Rwanda</span>
                )}
                {isOnDemand && (
                  <span className="bg-accent-premium/90 backdrop-blur-md text-primary text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl shadow-md border border-primary/10">Made to Order</span>
                )}
                {!isInStock && !isOnDemand && (
                  <span className="bg-red-600/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl shadow-md border border-white/20">Out of Stock</span>
                )}
              </div>
              {/* Wishlist */}
              <button
                onClick={() => toggleWishlist(product._id)}
                className={`absolute top-6 right-6 w-12 h-12 rounded-full flex items-center justify-center transition-all z-10 shadow-md ${isWishlisted ? 'bg-accent-premium text-primary border-none shadow-[0_0_15px_rgba(255,215,0,0.4)]' : 'bg-white/80 backdrop-blur-md text-text-muted hover:bg-white hover:text-primary hover:shadow-lg border border-white/40'}`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={isWishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
            </div>

            {/* Thumbnails */}
            {product.images?.length > 1 && (
              <div className="grid grid-cols-5 gap-4">
                {product.images.map((img: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`aspect-square overflow-hidden rounded-xl border-2 transition-all ${activeImageIndex === idx ? 'border-primary shadow-md scale-[1.02]' : 'border-border-light hover:border-primary/50'}`}
                  >
                    <img src={img} className="w-full h-full object-cover" alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Info + Actions (Sticky) ── */}
          <div className="lg:sticky lg:top-32 space-y-8">

            {/* Category */}
            <p className="text-[10px] font-bold text-accent-premium uppercase tracking-widest flex items-center gap-3">
               <span className="w-6 h-px bg-accent-premium"></span>
               {product.category || 'General'}
            </p>

            {/* Product Name */}
            <h1 className="text-3xl md:text-5xl font-bold text-text-primary leading-[1.1] tracking-tight">{product.name}</h1>

            {/* Rating Row */}
            {avgRating && (
              <div className="flex items-center gap-3 bg-background-surface border border-border-light rounded-full w-max px-4 py-1.5 shadow-sm">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <span key={s} className={`text-sm ${s <= Math.round(Number(avgRating)) ? 'text-accent-premium drop-shadow-sm' : 'text-border-light'}`}>★</span>
                  ))}
                </div>
                <span className="text-[10px] font-bold text-text-primary uppercase tracking-widest">{avgRating} <span className="opacity-50">({reviews.length} reviews)</span></span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-4 border-y border-border-light py-6 flex-wrap">
              <span className="text-4xl md:text-5xl font-bold tracking-tight text-text-primary">{effectivePrice?.toLocaleString()}</span>
              <span className="text-lg font-bold text-primary uppercase tracking-widest">RWF</span>
              {effectiveUnit && <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1 bg-background-surface px-2 py-1 rounded-md">/ {effectiveUnit}</span>}
              {product.priceUpdatedAt && <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted ml-auto w-full mt-2 block">Updated {new Date(product.priceUpdatedAt).toLocaleDateString()}</span>}
            </div>

            {activeVariants.length > 0 && (
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Choose option</p>
                <div className="grid gap-3">
                  {activeVariants.map((variant: any, index: number) => (
                    <button
                      key={variant._id || variant.sku || index}
                      type="button"
                      onClick={() => setSelectedVariantIndex(index)}
                      className={`rounded-xl border p-4 text-left transition-all flex flex-col gap-1 ${selectedVariantIndex === index ? 'border-primary bg-primary/5 shadow-sm' : 'border-border-light bg-white hover:border-primary/30'}`}
                    >
                      <div className="flex items-center justify-between gap-3 w-full">
                        <span className="text-sm font-bold text-text-primary">{variant.title || Object.values(variant.options || {}).join(' / ') || 'Option'}</span>
                        <span className="text-xs font-bold text-primary">{(variant.price ?? product.price)?.toLocaleString()} RWF</span>
                      </div>
                      {variant.sku && <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">SKU {variant.sku}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock / Availability */}
            <div className={`flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-widest bg-background-surface w-max px-4 py-2 rounded-xl border border-border-light ${isInStock || isOnDemand ? 'text-green-700' : 'text-red-600'}`}>
              <div className={`w-2 h-2 rounded-full ${isInStock || isOnDemand ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
              {isOnDemand ? 'Made to Order — Contact seller' : isInStock ? `In Stock${effectiveStockQuantity ? ` (${effectiveStockQuantity})` : ''}` : 'Out of Stock'}
            </div>

            {/* Custom Note */}
            {isOnDemand && (
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block">Custom Request / Notes <span className="opacity-50">(optional)</span></label>
                <textarea
                  className="rmf-input w-full min-h-[100px] resize-y"
                  placeholder="Describe your size, colour preference, or special instructions..."
                  value={customization}
                  onChange={e => setCustomization(e.target.value)}
                />
              </div>
            )}

            {/* Quantity */}
            {!isOnDemand && isInStock && (
              <div className="flex items-center gap-6">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Quantity</span>
                <div className="flex border border-border-light rounded-xl overflow-hidden shadow-sm h-12 bg-white">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-12 h-full flex items-center justify-center text-lg font-medium text-text-primary hover:bg-primary/5 transition-colors">−</button>
                  <div className="w-12 h-full flex items-center justify-center font-bold text-text-primary border-x border-border-light bg-background-surface/50">{qty}</div>
                  <button onClick={() => setQty(q => Math.min(effectiveStockQuantity || 99, q + 1))} className="w-12 h-full flex items-center justify-center text-lg font-medium text-text-primary hover:bg-primary/5 transition-colors">+</button>
                </div>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-col gap-4 pt-4 border-t border-border-light">
              {String(product.isNegotiable) === 'true' || product.isNegotiable === true ? (
                <button
                  onClick={handleBuyNow}
                  className="flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-xl bg-accent-premium px-6 text-xs font-bold uppercase tracking-widest text-primary shadow-md shadow-accent-premium/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-accent-premium/30"
                >
                  ⚡ {t('buy_now') || 'Buy Now'} & Negotiate Price
                </button>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={!isInStock && !isOnDemand}
                  className="flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-xs font-bold uppercase tracking-widest text-white shadow-md shadow-primary/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/30 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none"
                >
                  {isOnDemand ? '💬 Request This Item' : '🛒 Add to Cart'}
                </button>
              )}
              <button
                onClick={() => toggleWishlist(product._id)}
                className={`flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-xl border border-border-light px-6 text-xs font-bold uppercase tracking-widest transition-all duration-300 ${isWishlisted ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-text-primary hover:-translate-y-1 hover:border-primary/30 hover:shadow-md'}`}
              >
                {isWishlisted ? '♥ Saved to Wishlist' : '♡ Save to Wishlist'}
              </button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3 pt-6 border-t border-border-light">
              {[
                { icon: '🔒', label: 'Secure Payment' },
                { icon: '🛵', label: 'Fast Delivery' },
                { icon: '🛡️', label: 'Buyer Protected' },
              ].map(b => (
                <div key={b.label} className="flex flex-col items-center gap-2.5 p-4 bg-background-surface border border-border-light rounded-xl text-center shadow-sm">
                  <span className="text-2xl drop-shadow-sm">{b.icon}</span>
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest leading-tight">{b.label}</p>
                </div>
              ))}
            </div>

            {/* Seller Card */}
            <div className="bg-primary-cinematic text-white p-6 rounded-2xl flex items-center gap-5 group cinematic-shadow border border-white/5 shadow-xl mt-4">
              <div className="w-14 h-14 bg-white/10 border border-white/20 rounded-full flex items-center justify-center font-bold text-2xl flex-shrink-0 text-accent-premium shadow-inner">
                {product.seller?.name?.[0] || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold text-accent-premium uppercase tracking-widest mb-1.5">Sold by</p>
                <p className="text-lg font-bold tracking-tight truncate">{product.seller?.name || 'Verified Seller'}</p>
                <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1 truncate">{params.slug.replace(/-/g, ' ')} Market</p>
              </div>
              <Link href={getMarketUrl(params.slug)} className="flex items-center justify-center w-10 h-10 rounded-full bg-accent-premium/10 text-accent-premium hover:bg-accent-premium hover:text-primary transition-all border border-accent-premium/20">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Description ── */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_450px]">
          <div className="rounded-2xl border border-border-light bg-white p-8 md:p-10 shadow-sm">
            <h2 className="border-b border-border-light pb-5 text-2xl font-bold tracking-tight text-text-primary">Seller Product Details</h2>
            <p className="mt-6 border-l-4 border-primary pl-6 text-base font-medium leading-relaxed text-text-muted">
              {product.description || 'A quality product from one of our verified local market sellers. Contact the seller for more details.'}
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                ['Category', product.categoryLabel || product.category || 'General'],
                ['Unit', effectiveUnit || 'item'],
                ['Stock type', effectiveStockType?.replace(/_/g, ' ') || 'standard'],
                ['Available stock', effectiveStockQuantity ? `${effectiveStockQuantity}` : isOnDemand ? 'Made to order' : isInStock ? 'Available' : 'Out of stock'],
                ['Weight', product.weight ? `${product.weight} kg` : 'Not specified'],
                ['Origin tag', product.isMadeInRwanda ? 'Made in Rwanda' : 'Verified seller'],
                ...Object.entries(product.attributes || {}).map(([key, value]: [string, any]) => [key.replace(/([A-Z])/g, ' $1'), Array.isArray(value) ? value.join(', ') : String(value)]),
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border-light bg-background-surface p-4 shadow-sm">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-1.5">{label}</p>
                  <p className="text-sm font-bold capitalize text-text-primary">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Reviews ── */}
        <section className="border-t border-border-light pt-12">
          <div className="mb-10 flex justify-between items-end">
            <div>
              <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-3">Customer Feedback</p>
              <h2 className="text-3xl font-bold text-text-primary tracking-tight leading-none">Reviews</h2>
            </div>
            {avgRating && (
              <div className="text-right">
                <p className="text-5xl font-bold text-text-primary tracking-tight">{avgRating}</p>
                <div className="flex gap-1 justify-end mt-2">
                  {[1,2,3,4,5].map(s => (
                    <span key={s} className={`text-base ${s <= Math.round(Number(avgRating)) ? 'text-accent-premium drop-shadow-sm' : 'text-border-light'}`}>★</span>
                  ))}
                </div>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-2">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
              </div>
            )}
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border-light bg-white rounded-2xl shadow-sm">
              <p className="text-5xl mb-4 opacity-50 drop-shadow-sm">⭐</p>
              <p className="text-lg text-text-muted font-medium">No reviews yet — be the first to review this product!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {reviews.map((review: any) => (
                <div key={review._id} className="p-6 md:p-8 rounded-2xl border border-border-light bg-white hover:border-primary/30 hover:shadow-md transition-all space-y-6 group shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-background-surface border border-border-light rounded-full flex items-center justify-center font-bold text-xl group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                        {review.buyerName?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-text-primary uppercase tracking-widest">{review.buyerName || 'Verified Buyer'}</p>
                        <p className="text-[9px] text-text-muted uppercase tracking-widest mt-1.5">{new Date(review.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-0.5 bg-background-surface px-3 py-1 rounded-full border border-border-light">
                      {[1,2,3,4,5].map(s => (
                        <span key={s} className={`text-xs ${s <= review.rating ? 'text-accent-premium' : 'text-border-light'}`}>★</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-base text-text-muted leading-relaxed font-medium italic">
                    "{review.comment || 'Great product!'}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </Layout>
  );
}
