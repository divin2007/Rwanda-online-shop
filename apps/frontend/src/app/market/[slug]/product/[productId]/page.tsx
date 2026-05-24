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
import { resolveUploadUrl } from '@/lib/uploadUrls';
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
  ChevronLeft,
  Maximize2,
  X,
  PlayCircle,
  Award,
  BadgePercent,
  Compass,
  Star,
  ShoppingBag
} from 'lucide-react';

type ApiError = { response?: { data?: { message?: string } } };

export default function ProductDetailPage({ params }: { params: Promise<{ slug?: string, productId: string }> }) {
  const { slug, productId } = React.use(params);
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const { addToCart } = useCart();
  const { wishlist, toggleWishlist } = useWishlist();

  const { data: product, loading, execute: fetchProduct } = useApi(productApi, 'get', `/products/${productId}`);
  const { data: reviewsData } = useApi(reviewApi, 'get', `/reviews/target/product/${productId}`);
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = React.useState(false);
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

  const isWishlisted = product ? wishlist.includes(product._id) : false;

  const activeVariants = Array.isArray(product?.variants)
    ? product.variants.filter((variant: any) => variant.isActive !== false)
    : [];

  const selectedVariant = activeVariants[selectedVariantIndex] || null;
  const effectivePrice = Number(product?.price ?? 0) + (selectedVariant?.price !== undefined && selectedVariant?.price !== null ? Number(selectedVariant.price) : 0);
  const effectiveUnit = selectedVariant?.unit || product?.unit;
  const effectiveStockType = selectedVariant?.stockType || product?.stockType;
  const effectiveStockQuantity = selectedVariant?.stockQuantity ?? product?.stockQuantity;
  const selectedVariantText = `${selectedVariant?.title || ''} ${Object.values(selectedVariant?.options || {}).join(' ')}`.toLowerCase();
  const isCustomShoeSize = Boolean(
    selectedVariantText.includes('custom') &&
    String(product?.categoryId || product?.category || product?.productType || '').toLowerCase().includes('shoe')
  );

  // Resolve dynamic images list
  const rawDisplayedImages = selectedVariant?.images?.length
    ? selectedVariant.images
    : (product?.images || []);

  const displayedImages: string[] = React.useMemo(() => {
    let list: any[] = [];
    if (typeof rawDisplayedImages === 'string') {
      list = (rawDisplayedImages as string).split(',');
    } else if (Array.isArray(rawDisplayedImages)) {
      list = rawDisplayedImages.flatMap((item: any) =>
        typeof item === 'string' ? item.split(',') : item
      );
    }
    return list
      .map((url: any) => typeof url === 'string' ? url.trim() : '')
      .filter(Boolean)
      .map((url: string) => resolveUploadUrl(url, 'product'));
  }, [rawDisplayedImages]);

  useEffect(() => {
    fetchProduct();
  }, [productId, fetchProduct]);

  // Premium auto-slideshow
  useEffect(() => {
    if (displayedImages.length <= 1) return;
    const interval = setTimeout(() => {
      setActiveImageIndex((prev) => (prev + 1) % displayedImages.length);
    }, 5500);
    return () => clearTimeout(interval);
  }, [activeImageIndex, displayedImages.length]);

  // Safety gallery sync
  useEffect(() => {
    if (activeImageIndex >= displayedImages.length) {
      setActiveImageIndex(0);
    }
  }, [displayedImages.length, activeImageIndex]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (isLightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isLightboxOpen]);

  const handleAddToCart = () => {
    const cartProduct = selectedVariant ? {
      ...product,
      price: effectivePrice,
      unit: effectiveUnit,
      variantId: selectedVariant._id || selectedVariant.sku,
      variantTitle: selectedVariant.title,
      sellerSku: selectedVariant.sku,
      attributes: selectedVariant.attributes || product.attributes,
      images: displayedImages,
    } : {
      ...product,
      images: displayedImages,
    };
    for (let i = 0; i < qty; i++) addToCart(cartProduct, customization);
    toast.success(`${product.name} added to cart!`);
  };

  const handleBuyNow = async () => {
    if (!user) return toast.error('Please login to negotiate with the seller');
    if (user.role !== 'BUYER') {
      return toast.error('Negotiations must be started from a buyer account. Please switch accounts before requesting a quote.');
    }

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
          customization: customization || (isCustomShoeSize ? 'Custom shoe size availability check requested' : undefined),
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
          isCustomizable: customization || isCustomShoeSize ? 'true' : 'false',
          isCustomShoeSize: isCustomShoeSize ? 'true' : 'false'
        },
        notes: customization || (isCustomShoeSize ? `Custom shoe size availability check for ${product.name}` : `Negotiation started for ${product.name}`),
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
      <div className="max-w-7xl mx-auto py-48 flex flex-col items-center justify-center gap-8 px-6 bg-[#fdfaf7] min-h-[80vh]">
        <div className="relative flex items-center justify-center">
          <div className="w-20 h-20 border-4 border-primary/20 rounded-full" />
          <div className="absolute w-20 h-20 border-4 border-t-primary rounded-full animate-spin" />
          <ShoppingBag className="absolute text-primary w-6 h-6 animate-pulse" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#80756c]">Enriching product details...</p>
      </div>
    </Layout>
  );

  if (!product) return (
    <Layout>
      <div className="max-w-4xl mx-auto py-40 px-6 text-center bg-white border border-[#ebdcd0] rounded-3xl shadow-xl my-20 animate-reveal flex flex-col items-center">
        <Compass size={96} className="text-primary mb-8 animate-pulse" />
        <h2 className="text-4xl font-black text-[#17201a] tracking-tight">Product Unavailable</h2>
        <p className="text-sm text-[#80756c] mt-4 max-w-md mx-auto leading-relaxed">
          This product might have been moved, sold, or is currently unlisted by the merchant stall. Let's find you something fresh.
        </p>
        <Link href="/markets" className="mt-10 inline-flex items-center gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary-hover hover:to-secondary-hover text-white px-10 py-5 text-xs font-black uppercase tracking-widest transition-all rounded-2xl shadow-md shadow-primary/20">
          Explore Active Stalls <ChevronRight size={14} />
        </Link>
      </div>
    </Layout>
  );

  const productMarket = typeof product.marketId === 'object' ? product.marketId : null;
  const displayMarketSlug = slug || productMarket?.slug || '';
  const displayMarketName = productMarket?.name || (displayMarketSlug ? displayMarketSlug.replace(/-/g, ' ') : 'Market');
  const displayMarketHref = displayMarketSlug ? getMarketUrl(displayMarketSlug) : '/markets';
  const reviews = reviewsData || [];
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const isOnDemand = effectiveStockType === 'on_demand';
  const isInStock = selectedVariant ? selectedVariant.inStock !== false : product.inStock !== false;
  const requiresNegotiation = Boolean(product.isNegotiable) || isOnDemand || isCustomShoeSize;
  const priceRangeLabel = product.minPrice && product.maxPrice
    ? `${Number(product.minPrice).toLocaleString()} - ${Number(product.maxPrice).toLocaleString()} RWF`
    : null;
  const weightRangeLabel = product.minWeight && product.maxWeight
    ? `${Number(product.minWeight).toLocaleString()} - ${Number(product.maxWeight).toLocaleString()} kg`
    : null;

  return (
    <Layout>
      <div className="bg-[#fdfaf7] min-h-screen">
        <div className="max-w-7xl mx-auto px-4 md:px-8 pb-40 pt-8 space-y-12 animate-reveal">

          {/* ── Breadcrumbs & Navigation Back Bar ── */}
          <div className="bg-white/60 backdrop-blur-sm border border-[#ebdcd0]/40 rounded-2xl px-6 py-4 flex items-center justify-between shadow-sm">
            <nav className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[#80756c]/80 flex-wrap">
              <Link href="/" className="hover:text-primary transition-colors">Home</Link>
              <ChevronRight size={10} className="text-[#ebdcd0]" />
              <Link href="/markets" className="hover:text-primary transition-colors">Markets</Link>
              <ChevronRight size={10} className="text-[#ebdcd0]" />
              <Link href={displayMarketHref} className="hover:text-primary transition-colors capitalize text-[#17201a]">
                {displayMarketName}
              </Link>
              <ChevronRight size={10} className="text-[#ebdcd0]" />
              <span className="text-primary truncate max-w-[150px] font-black">{product.name}</span>
            </nav>
            <button onClick={() => router.back()} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#17201a] hover:text-primary transition-colors">
              <ArrowLeft size={12} className="stroke-[2.5]" /> Back
            </button>
          </div>

          {/* ── Main Product Presentation Area ── */}
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_450px]">

            {/* ── LEFT HALF: Gallery & Specifics Description ── */}
            <div className="space-y-8">
              
              {/* Premium Interactive Showcase Panel */}
              <div className="relative overflow-hidden rounded-3xl border border-[#ebdcd0] bg-[#fcfcfc] aspect-[4/3] md:aspect-[16/10] group shadow-lg">
                {displayedImages[activeImageIndex] ? (
                  <img
                    key={activeImageIndex}
                    src={displayedImages[activeImageIndex]}
                    className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-103 animate-fade-in"
                    alt={product.name}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] font-black uppercase tracking-widest text-[#80756c]">
                    No preview available
                  </div>
                )}

                {/* Floating Aesthetic Badges (Gradients & Premium Badging) */}
                <div className="absolute top-5 left-5 flex flex-col gap-2 z-10 select-none">
                  {product.isMadeInRwanda && (
                    <span className="bg-gradient-to-r from-emerald-600/95 to-teal-700/95 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5">
                      <Award size={10} /> locally crafted
                    </span>
                  )}
                  {product.isNegotiable && (
                    <span className="bg-gradient-to-r from-primary/95 to-[#ea580c]/95 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5">
                      <BadgePercent size={11} /> price negotiable
                    </span>
                  )}
                  {isOnDemand && (
                    <span className="bg-gradient-to-r from-amber-500/95 to-[#d97706]/95 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5">
                      <Compass size={11} /> made-to-order
                    </span>
                  )}
                  {!isInStock && !isOnDemand && (
                    <span className="bg-red-600/95 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-md">
                      sold out
                    </span>
                  )}
                </div>

                {/* Left/Right Main Image Navigation buttons */}
                {displayedImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveImageIndex((prev) => (prev === 0 ? displayedImages.length - 1 : prev - 1))}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white/90 backdrop-blur-sm text-[#17201a] hover:bg-white hover:text-primary flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-md border border-[#ebdcd0]/40 scale-95 hover:scale-105 active:scale-95"
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={16} className="stroke-[3]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveImageIndex((prev) => (prev === displayedImages.length - 1 ? 0 : prev + 1))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white/90 backdrop-blur-sm text-[#17201a] hover:bg-white hover:text-primary flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-md border border-[#ebdcd0]/40 scale-95 hover:scale-105 active:scale-95"
                      aria-label="Next image"
                    >
                      <ChevronRight size={16} className="stroke-[3]" />
                    </button>
                  </>
                )}

                {/* Dynamic Wishlist Toggle */}
                <button
                  onClick={() => toggleWishlist(product._id)}
                  className={`absolute top-5 right-5 w-12 h-12 rounded-xl flex items-center justify-center transition-all z-10 shadow-md ${isWishlisted
                      ? 'bg-primary text-white border-none shadow-primary/20 scale-105'
                      : 'bg-white/80 backdrop-blur-sm text-[#574e47] hover:bg-white hover:text-primary hover:scale-105 border border-white/40'
                    }`}
                >
                  <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} className="transition-transform duration-500" />
                </button>

                {/* Contained Lightbox Modal Trigger */}
                {displayedImages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsLightboxOpen(true)}
                    className="absolute bottom-5 right-5 z-10 bg-[#17201a]/85 hover:bg-primary backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition-all duration-300 scale-95 hover:scale-100 active:scale-95"
                  >
                    <Maximize2 size={11} className="stroke-[2.5]" />
                    view gallery
                  </button>
                )}
              </div>

              {/* Horizontal Thumbnail Rail */}
              {displayedImages.length > 1 && (
                <div className="space-y-3 pt-4 border-t border-[#ebdcd0]/40">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">Image Showcase</span>
                    </div>
                    <span className="text-[9px] font-black text-[#80756c] bg-white border border-[#ebdcd0] px-3 py-1 rounded-lg shadow-sm">
                      {activeImageIndex + 1} / {displayedImages.length}
                    </span>
                  </div>

                  <div className="relative group/thumbs pt-1">
                    <button
                      type="button"
                      onClick={() => scrollThumbnails('left')}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-xl bg-white/95 border border-[#ebdcd0] flex items-center justify-center shadow-md text-[#17201a] hover:text-primary transition-all opacity-0 group-hover/thumbs:opacity-100"
                    >
                      <ChevronLeft size={14} className="stroke-[2.5]" />
                    </button>

                    <div
                      ref={thumbnailsRef}
                      className="flex items-center gap-3 overflow-x-auto pb-4 pt-1 px-1 scrollbar-none scroll-smooth snap-x"
                    >
                      {displayedImages.map((img: string, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => setActiveImageIndex(idx)}
                          className={`flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all snap-start shadow-sm ${activeImageIndex === idx
                              ? 'border-primary ring-4 ring-[#ffedd5] shadow-md scale-98'
                              : 'border-[#ebdcd0] hover:border-primary/50 bg-white hover:scale-[1.01]'
                            }`}
                        >
                          <img src={img} className="w-full h-full object-cover" alt="" />
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => scrollThumbnails('right')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-xl bg-white/95 border border-[#ebdcd0] flex items-center justify-center shadow-md text-[#17201a] hover:text-primary transition-all opacity-0 group-hover/thumbs:opacity-100"
                    >
                      <ChevronRight size={14} className="stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              )}

              {/* Video Player Section */}
              {selectedVariant?.videoUrl && (
                <div className="overflow-hidden rounded-3xl border border-[#ebdcd0] bg-white shadow-md">
                  <div className="flex items-center justify-between border-b border-[#f2e8e0] px-6 py-4 bg-gradient-to-r from-white to-[#fdfaf7]">
                    <div className="flex items-center gap-2">
                      <PlayCircle size={16} className="text-primary" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">Variant Showcase Video</p>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#80756c] bg-white border border-[#ebdcd0] px-2 py-0.5 rounded">
                      Live Preview
                    </span>
                  </div>
                  <video
                    src={selectedVariant.videoUrl}
                    poster={selectedVariant.thumbnailUrl || displayedImages[0]}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full bg-[#17201a] object-cover"
                  />
                </div>
              )}

              {/* Detailed Description & Spec Matrix */}
              <div className="bg-white border border-[#ebdcd0] rounded-3xl p-8 md:p-10 shadow-md relative overflow-hidden">
                <div className="flex items-center gap-2 mb-6 border-b border-[#f2e8e0] pb-6">
                   <div className="w-8 h-1 bg-primary rounded-full" />
                   <h3 className="text-xl font-black text-[#17201a] tracking-tight">Merchant Story & Details</h3>
                </div>

                <div className="prose prose-neutral max-w-none">
                  <p className="text-sm text-[#574e47] leading-relaxed font-medium border-l-3 border-primary/30 pl-4 italic bg-[#fdfaf7] py-3 rounded-r-xl">
                    {product.description || 'Verified authentic listing with full local compliance and trade approval.'}
                  </p>
                </div>

                {/* Attribute Matrix Grid */}
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {[
                    ['Category label', product.categoryLabel || product.category || 'General'],
                    ['Unit weight', weightRangeLabel || (product.weight ? `${product.weight} kg` : 'N/A')],
                    ['Base unit standard', effectiveUnit || 'unit'],
                    ['Fulfillment format', effectiveStockType?.replace(/_/g, ' ') || 'standard'],
                    ['Product origin', product.isMadeInRwanda ? 'MINICOM Made in Rwanda Certified' : 'Verified Merchant Supply'],
                    ...Object.entries(selectedVariant?.attributes || product.attributes || {}).map(([key, value]: [string, any]) => [
                      key.replace(/([A-Z])/g, ' $1'),
                      Array.isArray(value) ? value.join(', ') : String(value)
                    ]),
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-[#ebdcd0]/75 bg-[#fdfaf7]/30 p-4 hover:border-primary/20 transition-all shadow-sm">
                      <p className="text-[8px] font-black uppercase tracking-widest text-[#80756c] mb-1">
                        {label}
                      </p>
                      <p className="text-xs font-black capitalize text-[#17201a]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT HALF: Dynamic Pricing & Customizer (Sticky Sidebar) ── */}
            <div className="lg:sticky lg:top-28 space-y-8">
              <div className="bg-white border border-[#ebdcd0] rounded-3xl p-8 md:p-10 shadow-xl relative overflow-hidden flex flex-col gap-6">
                <div className="absolute top-0 left-0 w-full h-[5px] bg-gradient-to-r from-primary via-accent to-secondary" />

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-[2px] bg-primary"></span>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                      {product.categoryLabel || product.category || 'General'}
                    </p>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-black text-[#17201a] tracking-tight leading-tight">
                    {product.name}
                  </h1>

                  {/* Dynamic Rating */}
                  {avgRating && (
                    <div className="flex items-center gap-3 bg-[#fdfaf7] border border-[#ebdcd0]/40 rounded-xl w-max px-3.5 py-1.5 shadow-inner">
                      <div className="flex text-primary">
                        <Star size={12} className="fill-primary text-primary" />
                      </div>
                      <span className="text-[10px] font-black text-[#17201a] uppercase tracking-widest">
                        {avgRating} <span className="text-[#80756c]/70 ml-1">({reviews.length} feedback)</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Cinematic Price Segment */}
                <div className="bg-[#fdfaf7] border border-[#ebdcd0] p-5 rounded-2xl flex flex-col gap-1 shadow-inner relative">
                  <span className="text-[8px] font-black uppercase tracking-widest text-[#80756c]">Unit Selling Price</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black tracking-tight text-[#17201a]">
                      {priceRangeLabel || effectivePrice?.toLocaleString()}
                    </span>
                    {!priceRangeLabel && <span className="text-sm font-black text-primary uppercase tracking-widest">
                      RWF
                    </span>}
                    {effectiveUnit && (
                      <span className="text-[8px] font-black text-[#80756c] uppercase tracking-widest bg-white border border-[#ebdcd0] px-2.5 py-0.5 rounded-lg ml-2 shadow-sm">
                        per {effectiveUnit}
                      </span>
                    )}
                  </div>
                </div>

                {/* Elegant Custom Variant Options Selector */}
                {activeVariants.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-[#17201a] uppercase tracking-widest">Select Variant Options</p>
                      <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-[#ffedd5] px-2 py-0.5 rounded border border-primary/10">
                        {activeVariants.length} Choices
                      </span>
                    </div>
                    <div className="grid gap-2.5">
                      {activeVariants.map((variant: any, index: number) => {
                        const variantImagesList: string[] = (() => {
                          const rawImages = variant.images;
                          let list: any[] = [];
                          if (typeof rawImages === 'string') {
                            list = (rawImages as string).split(',');
                          } else if (Array.isArray(rawImages)) {
                            list = rawImages.flatMap((item: any) =>
                              typeof item === 'string' ? item.split(',') : item
                            );
                          }
                          return list
                            .map((url: any) => typeof url === 'string' ? url.trim() : '')
                            .filter(Boolean)
                            .map((url: string) => resolveUploadUrl(url, 'product'));
                        })();
                        const hasVariantImg = variantImagesList.length > 0;
                        return (
                          <button
                            key={variant._id || variant.sku || index}
                            type="button"
                            onClick={() => {
                              setSelectedVariantIndex(index);
                              setActiveImageIndex(0);
                            }}
                            className={`rounded-2xl border p-3.5 text-left transition-all flex items-center gap-3 ${selectedVariantIndex === index
                                ? 'border-primary bg-primary/5 shadow-sm scale-[1.01]'
                                : 'border-[#ebdcd0] bg-white hover:border-primary/50'
                              }`}
                          >
                            {/* Variant Preview Image */}
                            <div className="w-10 h-10 rounded-xl border border-[#ebdcd0] overflow-hidden flex-shrink-0 bg-[#fdfaf7] flex items-center justify-center shadow-inner">
                              {hasVariantImg ? (
                                <img src={variantImagesList[0]} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Sparkles size={12} className="text-primary" />
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-black text-[#17201a] truncate ${selectedVariantIndex === index ? 'text-primary' : ''}`}>
                                {variant.title || Object.values(variant.options || {}).join(' / ') || `Option ${index + 1}`}
                              </p>
                              {variant.sku && (
                                <p className="text-[8px] font-black uppercase tracking-widest text-[#80756c]/50 mt-0.5">
                                  SKU: {variant.sku}
                                </p>
                              )}
                            </div>

                            {/* Surcharges Indicator */}
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs font-black text-[#17201a]">
                                {(Number(product?.price ?? 0) + (variant.price !== undefined && variant.price !== null ? Number(variant.price) : 0)).toLocaleString()}
                              </p>
                              {variant.price !== undefined && variant.price !== 0 && (
                                <span className="text-[8px] font-black uppercase tracking-widest text-primary bg-[#ffedd5] px-1 rounded block mt-0.5">
                                  +{Number(variant.price).toLocaleString()} RWF
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Stock Status Area */}
                <div className="flex items-center justify-between pt-4 border-t border-[#f2e8e0]">
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-black uppercase tracking-widest text-[#80756c] block">Availability</span>
                    <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${isInStock || isOnDemand ? 'text-emerald-700' : 'text-red-600'}`}>
                      <div className={`w-2 h-2 rounded-full ${isInStock || isOnDemand ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50' : 'bg-red-500'}`} />
                      {isOnDemand ? 'made on demand' : isInStock ? 'in stock' : 'sold out'}
                    </div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className="text-[8px] font-black uppercase tracking-widest text-[#80756c] block">Stock Level</span>
                    <p className="text-xs font-black text-[#17201a] uppercase">
                      {isOnDemand ? 'Tailored to Fit' : isInStock ? `${effectiveStockQuantity || 'Multiple'} units` : 'Zero stock'}
                    </p>
                  </div>
                </div>

                {/* Custom Sizing Notes */}
                {(isOnDemand || isCustomShoeSize) && (
                  <div className="space-y-2 pt-4 border-t border-[#f2e8e0]">
                    <label className="text-[9px] font-black text-[#17201a] uppercase tracking-widest block">
                      {isCustomShoeSize ? 'Custom Shoe Size Request' : 'Customization Notes & Sizing Preferences'}
                    </label>
                    <textarea
                      className="w-full bg-[#fdfaf7] border border-[#ebdcd0] p-4 text-xs font-semibold outline-none focus:border-primary rounded-2xl min-h-[100px] resize-y shadow-inner"
                      placeholder={isCustomShoeSize ? 'Tell the seller the exact shoe size you need and any fit notes.' : 'e.g. Craft in EU Size 43, extra wide fit, utilizing Premium Tan Leather accents...'}
                      value={customization}
                      onChange={e => setCustomization(e.target.value)}
                    />
                  </div>
                )}

                {/* Quantity adjuster */}
                {!isOnDemand && isInStock && (
                  <div className="flex items-center justify-between pt-4 border-t border-[#f2e8e0]">
                    <span className="text-[9px] font-black text-[#17201a] uppercase tracking-widest">Order Quantity</span>
                    <div className="flex border border-[#ebdcd0] rounded-2xl overflow-hidden shadow-sm h-10 bg-white">
                      <button
                        onClick={() => setQty(q => Math.max(1, q - 1))}
                        className="w-10 h-full flex items-center justify-center text-sm font-bold text-[#17201a] hover:bg-primary/10 transition-colors"
                      >
                        −
                      </button>
                      <div className="w-10 h-full flex items-center justify-center font-black text-xs text-[#17201a] bg-[#fdfaf7]">
                        {qty}
                      </div>
                      <button
                        onClick={() => setQty(q => Math.min(effectiveStockQuantity || 99, q + 1))}
                        className="w-10 h-full flex items-center justify-center text-sm font-bold text-[#17201a] hover:bg-primary/10 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* Magnificent Purchase CTA Call-to-action button */}
                <div className="flex flex-col gap-3 pt-4 border-t border-[#f2e8e0]">
                  {requiresNegotiation ? (
                    <button
                      onClick={handleBuyNow}
                      className="flex min-h-[3.75rem] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-secondary hover:from-primary-hover hover:to-secondary-hover px-6 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      {isCustomShoeSize ? 'Check Custom Size Availability' : 'Start Escrow Negotiation'}
                    </button>
                  ) : (
                    <button
                      onClick={handleAddToCart}
                      disabled={!isInStock && !isOnDemand}
                      className="flex min-h-[3.75rem] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-secondary hover:from-primary-hover hover:to-secondary-hover px-6 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 disabled:shadow-none"
                    >
                      <ShoppingCart size={14} className="stroke-[2.5]" /> 
                      {isOnDemand ? 'Submit custom request' : 'Add Product to Cart'}
                    </button>
                  )}
                </div>

                {/* Secure payments indicator */}
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-[#f2e8e0]">
                  {[
                    { icon: <Lock size={13} className="text-primary" />, label: 'secure momo' },
                    { icon: <Truck size={13} className="text-primary" />, label: 'hub lockup' },
                    { icon: <ShieldCheck size={13} className="text-primary" />, label: 'rmf escrow' },
                  ].map(b => (
                    <div key={b.label} className="flex flex-col items-center gap-1 p-2 bg-[#fdfaf7] border border-[#ebdcd0]/60 rounded-xl text-center shadow-inner">
                      {b.icon}
                      <p className="text-[7.5px] font-black text-[#80756c] uppercase tracking-widest leading-none mt-1">
                        {b.label}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Verified Merchant Profile details card */}
                <div className="bg-[#17201a] text-white p-5 rounded-2xl flex items-center gap-4 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                  <div className="w-11 h-11 bg-white/10 border border-white/20 rounded-full flex items-center justify-center font-bold text-lg text-primary shadow-inner">
                    {product.seller?.name?.[0] || 'S'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[7.5px] font-black text-primary uppercase tracking-widest block mb-0.5">
                      Verified Merchant Partner
                    </span>
                    <p className="text-sm font-black tracking-tight truncate leading-none">
                      {product.seller?.name || 'Verified Partner'}
                    </p>
                    <p className="text-[8.5px] text-white/50 uppercase tracking-widest mt-1 truncate flex items-center gap-1.5 font-bold">
                      <Store size={10} /> {displayMarketName} Stall
                    </p>
                  </div>
                  <Link
                    href={displayMarketHref}
                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/10 text-primary hover:bg-primary hover:text-white transition-all border border-white/5"
                  >
                    <ArrowLeft size={14} className="rotate-180 stroke-[2.5]" />
                  </Link>
                </div>
              </div>

              {/* Guidelines Segment */}
              <div className="bg-[#fdfaf7] border border-[#ebdcd0] rounded-3xl p-8 space-y-4 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#17201a] flex items-center gap-2">
                  <Info size={14} className="text-primary" /> Trading Guidelines
                </h3>
                <ul className="space-y-3 text-[11px] text-[#574e47] leading-relaxed font-semibold">
                  <li className="flex gap-2">
                    <Check size={12} className="text-primary flex-shrink-0 mt-0.5" />
                    Negotiate secure escrow payouts with verified stalls using MoMo.
                  </li>
                  <li className="flex gap-2">
                    <Check size={12} className="text-primary flex-shrink-0 mt-0.5" />
                    Riders inspect and safely store products at hub lockups before transport.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* ── Customer Reviews section ── */}
          <section className="border-t border-[#ebdcd0] pt-16">
            <div className="mb-10 flex justify-between items-end flex-wrap gap-6">
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">
                  Verified Customer Feedback
                </p>
                <h2 className="text-3xl font-black text-[#17201a] tracking-tight">
                  Stall Reviews
                </h2>
              </div>
              {avgRating && (
                <div className="text-right flex items-center gap-5 bg-white border border-[#ebdcd0] p-4 rounded-2xl shadow-sm">
                  <div>
                    <p className="text-2xl font-black tracking-tight text-[#17201a] leading-none">
                      {avgRating}
                    </p>
                    <p className="text-[8px] font-black text-[#80756c]/70 uppercase tracking-widest mt-1.5">
                      {reviews.length} feedback
                    </p>
                  </div>
                  <div className="flex gap-0.5 text-primary">
                    <Star size={14} className="fill-primary text-primary" />
                  </div>
                </div>
              )}
            </div>

            {reviews.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-[#ebdcd0] bg-[#fdfaf7]/40 rounded-3xl shadow-inner flex flex-col items-center justify-center">
                <Star size={48} className="text-primary mb-4 fill-primary animate-pulse" />
                <p className="text-xs font-black text-[#80756c] tracking-widest uppercase">
                  No feedback reviews posted yet for this product.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reviews.map((review: any) => (
                  <div
                    key={review._id}
                    className="p-6 md:p-8 rounded-2xl border border-[#ebdcd0] bg-white hover:border-primary/30 transition-all space-y-5 group shadow-sm hover:shadow-md"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#fdfaf7] border border-[#ebdcd0] rounded-full flex items-center justify-center font-black text-sm group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                          {review.buyerName?.[0] || 'U'}
                        </div>
                        <div>
                          <p className="text-xs font-black text-[#17201a] uppercase tracking-widest">
                            {review.buyerName || 'Verified Buyer'}
                          </p>
                          <p className="text-[8px] text-[#80756c]/50 uppercase tracking-widest mt-0.5">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-0.5 bg-[#fdfaf7] px-2.5 py-1 rounded-full border border-[#ebdcd0] text-primary">
                        <Star size={10} className="fill-primary text-primary" />
                      </div>
                    </div>
                    <p className="text-xs text-[#574e47] leading-relaxed font-semibold italic border-l-2 border-primary/20 pl-3">
                      "{review.comment || 'Satisfactory purchase.'}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>

      {/* Lightbox / Carousel Overlay Modal */}
      {isLightboxOpen && displayedImages.length > 0 && (() => {
        const safeImageSrc = displayedImages[activeImageIndex] || displayedImages[0] || '';
        return (
          <div className="fixed top-0 left-0 w-screen h-screen z-[99999] bg-[#000000] bg-opacity-95 backdrop-blur-xl flex flex-col justify-between p-6 select-none">
            {/* Header */}
            <div className="flex items-center justify-between w-full max-w-7xl mx-auto py-2">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white text-opacity-50">
                Image {Math.min(activeImageIndex + 1, displayedImages.length)} of {displayedImages.length}
              </div>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="w-10 h-10 rounded-full bg-white/5 text-white hover:bg-primary hover:text-white flex items-center justify-center transition-all duration-300 border border-white/10 hover:border-transparent scale-90 hover:scale-105 active:scale-95 cursor-pointer"
                aria-label="Close image viewer"
              >
                <X size={18} className="text-white" />
              </button>
            </div>

            {/* Main Body */}
            <div className="relative flex-1 flex items-center justify-center w-full max-w-7xl mx-auto my-4 group/lightbox">
              {/* Left Chevron */}
              {displayedImages.length > 1 && (
                <button
                  type="button"
                  onClick={() => setActiveImageIndex((prev) => (prev === 0 ? displayedImages.length - 1 : prev - 1))}
                  className="absolute left-4 z-20 w-14 h-14 rounded-full bg-white/5 hover:bg-primary text-white hover:text-white flex items-center justify-center transition-all duration-300 border border-white/10 hover:border-transparent opacity-60 hover:opacity-100 scale-90 hover:scale-105 active:scale-95 cursor-pointer"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={24} className="text-white" />
                </button>
              )}

              {/* Image */}
              {safeImageSrc && (
                <img
                  key={activeImageIndex}
                  src={safeImageSrc}
                  className="max-w-full max-h-[75vh] object-contain rounded-xl select-none animate-fade-in drop-shadow-[0_24px_50px_rgba(255,255,255,0.05)]"
                  alt={product.name}
                />
              )}

              {/* Right Chevron */}
              {displayedImages.length > 1 && (
                <button
                  type="button"
                  onClick={() => setActiveImageIndex((prev) => (prev === displayedImages.length - 1 ? 0 : prev + 1))}
                  className="absolute right-4 z-20 w-14 h-14 rounded-full bg-white/5 hover:bg-primary text-white hover:text-white flex items-center justify-center transition-all duration-300 border border-white/10 hover:border-transparent opacity-60 hover:opacity-100 scale-90 hover:scale-105 active:scale-95 cursor-pointer"
                  aria-label="Next image"
                >
                  <ChevronRight size={24} className="text-white" />
                </button>
              )}
            </div>

            {/* Footer Carousel Thumbnails */}
            <div className="w-full max-w-4xl mx-auto pb-4">
              <div className="flex items-center justify-center gap-3 overflow-x-auto py-2 px-4 scrollbar-none">
                {displayedImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-300 flex-shrink-0 ${idx === activeImageIndex
                        ? 'border-primary scale-105 shadow-lg'
                        : 'border-white/10 hover:border-white/30 scale-95'
                      }`}
                  >
                    <img
                      src={img}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </Layout>
  );
}
