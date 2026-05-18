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
import { 
  Heart, 
  ShoppingCart, 
  ShieldCheck, 
  Truck, 
  Lock, 
  Store, 
  ArrowLeft, 
  Check, 
  Info, 
  Sparkles,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

type ApiError = { response?: { data?: { message?: string } } };

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

  const thumbnailsRef = React.useRef<HTMLDivElement>(null);
  
  const scrollThumbnails = (direction: 'left' | 'right') => {
    if (thumbnailsRef.current) {
      const scrollAmount = direction === 'left' ? -240 : 240;
      thumbnailsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [params.productId, fetchProduct]);

  const isWishlisted = product ? wishlist.includes(product._id) : false;

  const activeVariants = Array.isArray(product?.variants) 
    ? product.variants.filter((variant: any) => variant.isActive !== false) 
    : [];

  const selectedVariant = activeVariants[selectedVariantIndex] || null;
  const effectivePrice = (product?.price ?? 0) + (selectedVariant?.price ?? 0);
  const effectiveUnit = selectedVariant?.unit || product?.unit;
  const effectiveStockType = selectedVariant?.stockType || product?.stockType;
  const effectiveStockQuantity = selectedVariant?.stockQuantity ?? product?.stockQuantity;

  // Resolve dynamic images list: Use variant images if the selected variant has them, otherwise fallback to main product images
  const displayedImages = selectedVariant?.images?.length 
    ? selectedVariant.images 
    : (product?.images || []);

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
          imageUrl: displayedImages[0] || product.images?.[0],
          images: displayedImages,
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
      <div className="max-w-7xl mx-auto py-40 flex flex-col items-center gap-8 px-6">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-[#ffedd5]/60 rounded-full" />
          <div className="absolute inset-0 w-24 h-24 border-4 border-t-[#e05300] rounded-full animate-spin" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#414844] opacity-70">Enriching catalog information...</p>
      </div>
    </Layout>
  );

  if (!product) return (
    <Layout>
      <div className="max-w-4xl mx-auto py-40 px-6 text-center bg-white border border-[#e0e0e0] rounded-2xl shadow-xl my-20 animate-reveal">
        <p className="text-8xl mb-8">🎒</p>
        <h2 className="text-4xl font-sans tracking-tight text-[#1b1c1c] font-light">Product Unavailable</h2>
        <p className="text-sm text-[#414844] mt-4 max-w-md mx-auto leading-relaxed opacity-75">
          This product might have been moved or is currently not listed by the seller. Let's find you something similar.
        </p>
        <Link href="/markets" className="mt-10 inline-flex items-center gap-4 bg-[#1b1c1c] text-white px-10 py-5 text-xs font-black uppercase tracking-widest hover:bg-[#ff6b00] transition-all rounded-md">
          Explore Active Markets <ChevronRight size={14} />
        </Link>
      </div>
    </Layout>
  );

  const reviews = reviewsData || [];
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const isOnDemand = effectiveStockType === 'on_demand';
  const isInStock = selectedVariant ? selectedVariant.inStock !== false : product.inStock !== false;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 pb-40 pt-10 space-y-16 animate-reveal">
        
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-4 border-b border-[#e0e0e0]/60 pb-6 text-[10px] font-black uppercase tracking-[0.2em] flex-wrap text-[#414844]/60">
          <Link href="/" className="hover:text-[#ff6b00] transition-colors">Home</Link>
          <span className="text-[#e0e0e0] font-light">/</span>
          <Link href="/markets" className="hover:text-[#ff6b00] transition-colors">Markets</Link>
          <span className="text-[#e0e0e0] font-light">/</span>
          <Link href={getMarketUrl(params.slug)} className="hover:text-[#ff6b00] transition-colors capitalize text-[#1b1c1c]">
            {params.slug.replace(/-/g, ' ')}
          </Link>
          <span className="text-[#e0e0e0] font-light">/</span>
          <span className="text-[#ff6b00] tracking-normal font-bold lowercase truncate max-w-[200px]">{product.name}</span>
        </nav>

        {/* Main Product Grid */}
        <div className="grid grid-cols-1 items-start gap-16 lg:grid-cols-[1fr_480px]">
          
          {/* Left: Cinematic Image Gallery */}
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl border border-[#e0e0e0] bg-[#fcf9f8] aspect-[4/3] md:aspect-[16/10] group shadow-2xl">
              {displayedImages[activeImageIndex] ? (
                <img
                  src={displayedImages[activeImageIndex]}
                  className="w-full h-full object-cover transition-transform duration-[2500ms] group-hover:scale-105"
                  alt={product.name}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-black uppercase tracking-widest text-[#414844]/40">
                  No preview available
                </div>
              )}

              {/* Floating Aesthetic Badges */}
              <div className="absolute top-6 left-6 flex flex-col gap-3 z-10">
                {product.isMadeInRwanda && (
                  <span className="bg-[#e05300]/95 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-[0.2em] px-5 py-2.5 rounded-lg shadow-xl border border-white/10 flex items-center gap-2">
                    🇷🇼 locally crafted
                  </span>
                )}
                {product.isNegotiable && (
                  <span className="bg-[#1b1c1c]/95 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-[0.2em] px-5 py-2.5 rounded-lg shadow-xl border border-white/10 flex items-center gap-2">
                    ⚡ price negotiable
                  </span>
                )}
                {isOnDemand && (
                  <span className="bg-[#e28c41]/95 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-[0.2em] px-5 py-2.5 rounded-lg shadow-xl border border-white/10 flex items-center gap-2">
                    ⚒️ custom crafted
                  </span>
                )}
                {!isInStock && !isOnDemand && (
                  <span className="bg-red-600/90 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-[0.2em] px-5 py-2.5 rounded-lg shadow-xl border border-white/10">
                    fully sold out
                  </span>
                )}
              </div>

              {/* Left/Right Main Image Navigation Chevrons */}
              {displayedImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveImageIndex((prev) => (prev === 0 ? displayedImages.length - 1 : prev - 1))}
                    className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/80 backdrop-blur-md text-[#1b1c1c] hover:bg-white hover:text-[#ff6b00] flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-xl z-10 border border-[#e0e0e0]/40 scale-95 hover:scale-105 active:scale-95"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveImageIndex((prev) => (prev === displayedImages.length - 1 ? 0 : prev + 1))}
                    className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/80 backdrop-blur-md text-[#1b1c1c] hover:bg-white hover:text-[#ff6b00] flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-xl z-10 border border-[#e0e0e0]/40 scale-95 hover:scale-105 active:scale-95"
                    aria-label="Next image"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}

              {/* High-End Wishlist Trigger */}
              <button
                onClick={() => toggleWishlist(product._id)}
                className={`absolute top-6 right-6 w-14 h-14 rounded-full flex items-center justify-center transition-all z-10 shadow-2xl ${
                  isWishlisted 
                    ? 'bg-[#ff6b00] text-white border-none shadow-[0_0_20px_rgba(255,107,0,0.5)] scale-110' 
                    : 'bg-white/80 backdrop-blur-md text-[#414844] hover:bg-white hover:text-[#ff6b00] hover:scale-105 border border-white/40'
                }`}
              >
                <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} className="transition-transform duration-500" />
              </button>
            </div>

            {/* Thumbnail Navigation Carousel */}
            {displayedImages.length > 1 && (
              <div className="space-y-4 pt-8 mt-6 border-t border-[#e0e0e0]/40 animate-reveal">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff6b00] animate-pulse"></span>
                    <span className="text-[10px] font-black text-[#ff6b00] uppercase tracking-[0.25em]">Product Showcase</span>
                  </div>
                  <span className="text-[9px] font-black text-[#414844]/60 uppercase tracking-widest bg-[#fdfdfd] border border-[#e0e0e0]/40 px-3 py-1 rounded-full shadow-sm">
                    Image {activeImageIndex + 1} of {displayedImages.length}
                  </span>
                </div>

                <div className="relative group/thumbs pt-2 px-1">
                  {/* Left Scroll Button */}
                  <button
                    type="button"
                    onClick={() => scrollThumbnails('left')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md border border-[#e0e0e0] flex items-center justify-center shadow-lg text-[#1b1c1c] hover:text-[#ff6b00] transition-all opacity-0 group-hover/thumbs:opacity-100 hover:scale-105 active:scale-95"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* Thumbnail Scrolling Container */}
                  <div 
                    ref={thumbnailsRef}
                    className="flex items-center gap-4 overflow-x-auto pb-5 pt-2 px-1 scrollbar-none scroll-smooth snap-x"
                  >
                    {displayedImages.map((img: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImageIndex(idx)}
                        className={`flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden border-2 transition-all snap-start shadow-sm hover:shadow-md ${
                          activeImageIndex === idx 
                            ? 'border-[#ff6b00] scale-105 ring-4 ring-[#ffedd5] shadow-lg' 
                            : 'border-[#e0e0e0] hover:border-[#ff6b00]/60 bg-white hover:scale-[1.02]'
                        }`}
                      >
                        <img src={img} className="w-full h-full object-cover" alt={`Product detail photo ${idx + 1}`} />
                      </button>
                    ))}
                  </div>

                  {/* Right Scroll Button */}
                  <button
                    type="button"
                    onClick={() => scrollThumbnails('right')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md border border-[#e0e0e0] flex items-center justify-center shadow-lg text-[#1b1c1c] hover:text-[#ff6b00] transition-all opacity-0 group-hover/thumbs:opacity-100 hover:scale-105 active:scale-95"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Premium Purchase Interface (Sticky) */}
          <div className="lg:sticky lg:top-24 space-y-10 bg-white border border-[#e0e0e0] rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-[#ff6b00]"></div>
            
            <div className="space-y-4">
              {/* Category Indicator */}
              <div className="flex items-center gap-4">
                <span className="w-8 h-px bg-[#ff6b00]"></span>
                <p className="text-[10px] font-black text-[#ff6b00] uppercase tracking-[0.25em]">
                  {product.categoryLabel || product.category || 'General'}
                </p>
              </div>

              {/* Title & Brand */}
              <h1 className="text-3xl md:text-4xl font-sans tracking-tight text-[#1b1c1c] leading-tight">
                {product.name}
              </h1>

              {/* Trust Rating Row */}
              {avgRating && (
                <div className="flex items-center gap-4 bg-[#fcf9f8] border border-[#e0e0e0]/40 rounded-full w-max px-5 py-2 shadow-sm">
                  <div className="flex gap-1 text-[#ff6b00]">
                    {[1, 2, 3, 4, 5].map(s => (
                      <span key={s} className={`text-sm ${s <= Math.round(Number(avgRating)) ? 'opacity-100' : 'opacity-25'}`}>★</span>
                    ))}
                  </div>
                  <span className="text-[10px] font-black text-[#1b1c1c] uppercase tracking-widest">
                    {avgRating} <span className="text-[#414844]/50 ml-1">({reviews.length} reviews)</span>
                  </span>
                </div>
              )}
            </div>

            {/* Luxurious Price Hub */}
            <div className="bg-[#fcf9f8] border border-[#e0e0e0] p-6 rounded-2xl flex flex-col gap-2 relative">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#414844]/50">Product Price</span>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-sans font-bold tracking-tight text-[#1b1c1c]">
                  {effectivePrice?.toLocaleString()}
                </span>
                <span className="text-lg font-black text-[#ff6b00]">RWF</span>
                {effectiveUnit && (
                  <span className="text-[9px] font-black text-[#414844]/60 uppercase tracking-widest bg-white border border-[#e0e0e0] px-3 py-1 rounded-md ml-2">
                    per {effectiveUnit}
                  </span>
                )}
              </div>
              {product.priceUpdatedAt && (
                <span className="text-[8px] font-black uppercase tracking-widest text-[#414844]/40 mt-1">
                  Price updated: {new Date(product.priceUpdatedAt).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Interactive Premium Variant Selector */}
            {activeVariants.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-[#e0e0e0]/60">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-[#414844] uppercase tracking-widest">Choose Option / Variant</p>
                  <span className="text-[9px] font-black text-[#ff6b00] uppercase tracking-widest bg-[#ffedd5] px-2 py-0.5 rounded">
                    {activeVariants.length} Choices
                  </span>
                </div>
                <div className="grid gap-3">
                  {activeVariants.map((variant: any, index: number) => {
                    const hasVariantImg = variant.images && variant.images[0];
                    return (
                      <button
                        key={variant._id || variant.sku || index}
                        type="button"
                        onClick={() => {
                          setSelectedVariantIndex(index);
                          setActiveImageIndex(0); // Reset gallery view to first variant image instantly
                        }}
                        className={`rounded-2xl border p-4 text-left transition-all flex items-center gap-4 ${
                          selectedVariantIndex === index 
                            ? 'border-[#ff6b00] bg-[#ff6b00]/5 shadow-md scale-[1.01]' 
                            : 'border-[#e0e0e0] bg-white hover:border-[#ff6b00]/50 hover:bg-[#fcf9f8]/30'
                        }`}
                      >
                        {/* Variant Circular Preview Thumb */}
                        <div className="w-12 h-12 rounded-full border border-[#e0e0e0] overflow-hidden flex-shrink-0 bg-[#fcf9f8] flex items-center justify-center">
                          {hasVariantImg ? (
                            <img src={variant.images[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Sparkles size={14} className="text-[#ff6b00]" />
                          )}
                        </div>

                        {/* Title & SKU */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold text-[#1b1c1c] truncate ${selectedVariantIndex === index ? 'text-[#ff6b00]' : ''}`}>
                            {variant.title || Object.values(variant.options || {}).join(' / ') || `Option ${index + 1}`}
                          </p>
                          {variant.sku && (
                            <p className="text-[9px] font-black uppercase tracking-widest text-[#414844]/40 mt-0.5">
                              SKU: {variant.sku}
                            </p>
                          )}
                        </div>

                        {/* Custom Price override indicator */}
                        <div className="text-right">
                          <p className="text-xs font-black text-[#1b1c1c]">
                            {((product?.price ?? 0) + (variant.price ?? 0))?.toLocaleString()} RWF
                          </p>
                          {variant.price !== undefined && variant.price !== 0 && (
                            <span className="text-[8px] font-black uppercase tracking-widest text-[#ff6b00] bg-[#ffedd5] px-1 rounded block mt-0.5">
                              {variant.price > 0 ? `+${variant.price.toLocaleString()} RWF` : `${variant.price.toLocaleString()} RWF`}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dynamic Stock & Fulfillment Display */}
            <div className="flex items-center justify-between pt-4 border-t border-[#e0e0e0]/60">
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#414844]/50 block">Status</span>
                <div className={`flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest ${
                  isInStock || isOnDemand ? 'text-green-700' : 'text-red-600'
                }`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    isInStock || isOnDemand 
                      ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]' 
                      : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                  }`} />
                  {isOnDemand ? 'on demand' : isInStock ? 'in stock' : 'sold out'}
                </div>
              </div>
              <div className="text-right space-y-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#414844]/50 block">Stock Level</span>
                <p className="text-xs font-bold text-[#1b1c1c] uppercase">
                  {isOnDemand 
                    ? 'Crafted on Request' 
                    : isInStock 
                      ? `${effectiveStockQuantity || 'Multiple'} ${effectiveUnit || 'items'} available` 
                      : 'Out of stock'
                  }
                </p>
              </div>
            </div>

            {/* Custom Notes (For Made-to-Order) */}
            {isOnDemand && (
              <div className="space-y-3 pt-4 border-t border-[#e0e0e0]/60">
                <label className="text-[10px] font-black text-[#414844] uppercase tracking-widest block">
                  Customization Notes & Sizing Preferences
                </label>
                <textarea
                  className="w-full bg-[#fcf9f8] border border-[#e0e0e0] p-4 text-xs font-semibold outline-none focus:border-[#ff6b00] rounded-xl min-h-[100px] resize-y"
                  placeholder="e.g. Please craft in color Dark Suede, EU Size 43, extra wide fit..."
                  value={customization}
                  onChange={e => setCustomization(e.target.value)}
                />
              </div>
            )}

            {/* Quantity Hub */}
            {!isOnDemand && isInStock && (
              <div className="flex items-center justify-between pt-4 border-t border-[#e0e0e0]/60">
                <span className="text-[10px] font-black text-[#414844] uppercase tracking-widest">Order Quantity</span>
                <div className="flex border border-[#e0e0e0] rounded-xl overflow-hidden shadow-sm h-12 bg-white">
                  <button 
                    onClick={() => setQty(q => Math.max(1, q - 1))} 
                    className="w-12 h-full flex items-center justify-center text-lg font-medium text-[#1b1c1c] hover:bg-[#ff6b00]/5 transition-colors"
                  >
                    −
                  </button>
                  <div className="w-12 h-full flex items-center justify-center font-bold text-sm text-[#1b1c1c] border-x border-[#e0e0e0] bg-[#fcf9f8]">
                    {qty}
                  </div>
                  <button 
                    onClick={() => setQty(q => Math.min(effectiveStockQuantity || 99, q + 1))} 
                    className="w-12 h-full flex items-center justify-center text-lg font-medium text-[#1b1c1c] hover:bg-[#ff6b00]/5 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Premium CTA Panel */}
            <div className="flex flex-col gap-4 pt-6 border-t border-[#e0e0e0]/60">
              {String(product.isNegotiable) === 'true' || product.isNegotiable === true ? (
                <button
                  onClick={handleBuyNow}
                  className="flex min-h-[3.75rem] w-full items-center justify-center gap-3 rounded-xl bg-[#ff6b00] px-6 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-[#ff6b00]/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:bg-[#e05300] border-none"
                >
                  ⚡ Start Price Negotiation
                </button>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={!isInStock && !isOnDemand}
                  className="flex min-h-[3.75rem] w-full items-center justify-center gap-3 rounded-xl bg-[#ff6b00] px-6 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-[#ff6b00]/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:bg-[#e05300] disabled:opacity-40 disabled:hover:translate-y-0 disabled:shadow-none border-none"
                >
                  <ShoppingCart size={15} /> {isOnDemand ? 'Submit custom request' : 'Add Product to Cart'}
                </button>
              )}
            </div>

            {/* Trust Matrix */}
            <div className="grid grid-cols-3 gap-3 pt-6 border-t border-[#e0e0e0]/60">
              {[
                { icon: <Lock size={15} className="text-[#ff6b00]" />, label: 'secure pay' },
                { icon: <Truck size={15} className="text-[#ff6b00]" />, label: 'express rider' },
                { icon: <ShieldCheck size={15} className="text-[#ff6b00]" />, label: 'buyer warranty' },
              ].map(b => (
                <div key={b.label} className="flex flex-col items-center gap-2 p-3 bg-[#fcf9f8] border border-[#e0e0e0]/60 rounded-xl text-center">
                  {b.icon}
                  <p className="text-[8px] font-black text-[#414844]/60 uppercase tracking-widest leading-none mt-1">
                    {b.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Kigali Sanctuary Verified Seller Identity card */}
            <div className="bg-[#1b1c1c] text-white p-6 rounded-2xl flex items-center gap-4 shadow-xl border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ff6b00]"></div>
              <div className="w-12 h-12 bg-white/10 border border-white/20 rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0 text-[#ff6b00] shadow-inner">
                {product.seller?.name?.[0] || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[8px] font-black text-[#ff6b00] uppercase tracking-[0.25em] block mb-1">
                  Verified Local Partner
                </span>
                <p className="text-base font-bold tracking-tight truncate">
                  {product.seller?.name || 'Verifiable Partner'}
                </p>
                <p className="text-[9px] text-white/50 uppercase tracking-widest mt-0.5 truncate flex items-center gap-2">
                  <Store size={10} /> {params.slug.replace(/-/g, ' ')} Stall
                </p>
              </div>
              <Link 
                href={getMarketUrl(params.slug)} 
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 text-[#ff6b00] hover:bg-[#ff6b00] hover:text-white transition-all border border-white/10"
              >
                <ArrowLeft size={16} className="rotate-180" />
              </Link>
            </div>

          </div>
        </div>

        {/* Separated Product Details Section */}
        <section className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_480px] border-t border-[#e0e0e0]/60 pt-16">
          
          {/* Detailed Story & Attributes */}
          <div className="space-y-10">
            <div className="bg-white border border-[#e0e0e0] rounded-3xl p-8 md:p-10 shadow-xl relative overflow-hidden">
              <h2 className="text-2xl font-sans tracking-tight text-[#1b1c1c] pb-6 border-b border-[#e0e0e0]/60">
                Product Details
              </h2>
              
              <div className="mt-8 prose prose-neutral max-w-none">
                <p className="text-base text-[#414844] leading-relaxed font-semibold border-l-4 border-[#ff6b00] pl-6 italic">
                  {product.description || 'Verified authentic listing with full local compliance and trade approval.'}
                </p>
              </div>

              {/* Dynamic Attribute Matrix */}
              <div className="mt-12 grid gap-4 sm:grid-cols-2">
                {[
                  ['Catalog Category', product.categoryLabel || product.category || 'General'],
                  ['Delivery Unit', effectiveUnit || 'piece'],
                  ['Fulfillment Type', effectiveStockType?.replace(/_/g, ' ') || 'standard'],
                  ['Weight (kg)', product.weight ? `${product.weight} kg` : 'Not specified'],
                  ['Local Origin', product.isMadeInRwanda ? 'Made in Rwanda (Minicom Certified)' : 'Verified partner listing'],
                  ...Object.entries(selectedVariant?.attributes || product.attributes || {}).map(([key, value]: [string, any]) => [
                    key.replace(/([A-Z])/g, ' $1'), 
                    Array.isArray(value) ? value.join(', ') : String(value)
                  ]),
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[#e0e0e0] bg-[#fcf9f8]/40 p-4 hover:border-[#ff6b00]/30 transition-colors">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#414844]/55 mb-1">
                      {label}
                    </p>
                    <p className="text-sm font-sans font-bold capitalize text-[#1b1c1c]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Guidelines Sidebar (Keeping layout identical) */}
          <div className="bg-[#fcf9f8] border border-[#e0e0e0]/80 rounded-3xl p-8 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-[#1b1c1c] flex items-center gap-2">
              <Info size={14} className="text-[#ff6b00]" /> Buyer Guidelines
            </h3>
            <ul className="space-y-4 text-xs text-[#414844]/80 leading-relaxed font-semibold">
              <li className="flex gap-3">
                <Check size={14} className="text-[#ff6b00] flex-shrink-0 mt-0.5" />
                Negotiate prices safely through our secure momo escrow process.
              </li>
              <li className="flex gap-3">
                <Check size={14} className="text-[#ff6b00] flex-shrink-0 mt-0.5" />
                Products are held for collection in market hub lockups to verify item state.
              </li>
              <li className="flex gap-3">
                <Check size={14} className="text-[#ff6b00] flex-shrink-0 mt-0.5" />
                Made in Rwanda items comply with standard trade regulations and high craft standards.
              </li>
            </ul>
          </div>
        </section>

        {/* Separated Product Reviews */}
        <section className="border-t border-[#e0e0e0]/60 pt-16">
          <div className="mb-10 flex justify-between items-end flex-wrap gap-6">
            <div>
              <p className="text-[10px] font-black text-[#ff6b00] uppercase tracking-[0.25em] mb-3">
                Verified Customer Feedback
              </p>
              <h2 className="text-3xl font-sans tracking-tight text-[#1b1c1c]">
                Product Reviews
              </h2>
            </div>
            {avgRating && (
              <div className="text-right flex items-center gap-6 bg-white border border-[#e0e0e0] p-4 rounded-2xl shadow-md">
                <div>
                  <p className="text-3xl font-sans font-bold tracking-tight text-[#1b1c1c] leading-none">
                    {avgRating}
                  </p>
                  <p className="text-[8px] font-black text-[#414844]/50 uppercase tracking-widest mt-1">
                    {reviews.length} reviews
                  </p>
                </div>
                <div className="flex gap-0.5 text-[#ff6b00]">
                  {[1, 2, 3, 4, 5].map(s => (
                    <span key={s} className={`text-base ${s <= Math.round(Number(avgRating)) ? 'opacity-100' : 'opacity-25'}`}>★</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-[#e0e0e0] bg-[#fcf9f8]/40 rounded-3xl shadow-inner">
              <p className="text-6xl mb-6 opacity-60">⭐</p>
              <p className="text-sm font-semibold text-[#414844] opacity-75">
                No customer ratings submitted yet for this product.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {reviews.map((review: any) => (
                <div 
                  key={review._id} 
                  className="p-6 md:p-8 rounded-2xl border border-[#e0e0e0] bg-white hover:border-[#ff6b00]/40 transition-all space-y-6 group shadow-md"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#fcf9f8] border border-[#e0e0e0] rounded-full flex items-center justify-center font-bold text-lg group-hover:bg-[#ff6b00] group-hover:text-white group-hover:border-[#ff6b00] transition-all">
                        {review.buyerName?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-[#1b1c1c] uppercase tracking-widest">
                          {review.buyerName || 'Verified Trader'}
                        </p>
                        <p className="text-[8px] text-[#414844]/40 uppercase tracking-widest mt-1">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-0.5 bg-[#fcf9f8] px-3 py-1 rounded-full border border-[#e0e0e0] text-[#ff6b00]">
                      {[1, 2, 3, 4, 5].map(s => (
                        <span key={s} className={`text-xs ${s <= review.rating ? 'opacity-100' : 'opacity-25'}`}>★</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-[#414844] leading-relaxed font-semibold italic border-l-2 border-[#ff6b00]/30 pl-4">
                    "{review.comment || 'Satisfactory purchase.'}"
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
