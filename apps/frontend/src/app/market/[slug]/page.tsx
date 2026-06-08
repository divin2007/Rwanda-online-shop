'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Clock3, MapPin, PackageCheck, Search, ShieldCheck, SlidersHorizontal, Star, Store, Truck } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { ProductCard } from '@/components/ui/ProductCard';
import { SellerVideoFeed } from '@/components/ui/SellerVideoFeed';
import { MenuStorefront } from '@/components/ui/MenuStorefront';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/hooks/useSocket';
import { marketApi, productApi, reviewApi, sellerApi } from '@/lib/api';
import { resolveUploadUrl } from '@/lib/uploadUrls';

const RiderMap = dynamic(() => import('@/components/ui/RiderMap').then(mod => mod.RiderMap), { ssr: false });

const getSimilarity = (s1: string, s2: string): number => {
  const n1 = s1.toLowerCase().trim();
  const n2 = s2.toLowerCase().trim();
  if (n1 === n2) return 1;
  if (n1.includes(n2) || n2.includes(n1)) return 0.7;

  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i += 1) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(n1);
  const b2 = getBigrams(n2);
  if (b1.size === 0 || b2.size === 0) return 0;

  let intersection = 0;
  Array.from(b1).forEach(b => {
    if (b2.has(b)) intersection += 1;
  });
  return (2 * intersection) / (b1.size + b2.size);
};

const isMarketOpen = (market: any) => {
  const hours = market?.operatingHours;
  if (!hours?.open || !hours?.close) return true;
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'short' });
  if (hours.daysOpen?.length && !hours.daysOpen.includes(day)) return false;

  const toMinutes = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const current = now.getHours() * 60 + now.getMinutes();
  return current >= toMinutes(hours.open) && current <= toMinutes(hours.close);
};

const ProductRail = ({
  title,
  eyebrow,
  products,
  isPromotion = false,
}: {
  title: string;
  eyebrow: string;
  products: any[];
  isPromotion?: boolean;
}) => {
  if (products.length === 0) return null;

  const displayProducts = isPromotion ? products : products.slice(0, 6);

  return (
    <section className={`animate-reveal rounded-2xl border ${isPromotion ? 'border-primary/30 bg-primary/5' : 'border-outline-variant bg-surface-container-lowest'} p-6 shadow-[0_8px_30px_rgba(27,28,28,0.03)] md:p-8`}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold font-mono uppercase tracking-widest text-primary">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-text-primary font-sans">{title}</h2>
        </div>
        <ArrowRight size={20} className="text-primary" />
      </div>
      
      {isPromotion ? (
        <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x">
          {displayProducts.slice(0, 10).map(product => (
            <div key={product._id} className="w-[220px] shrink-0 sm:w-[240px] snap-start">
              <ProductCard product={product} isCompact={true} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6">
          {displayProducts.map(product => (
            <ProductCard key={product._id} product={product} isCompact={true} />
          ))}
        </div>
      )}
    </section>
  );
};

export default function MarketPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [isFullMap, setIsFullMap] = useState(false);
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'shop' | 'menu' | 'videos' | 'about' | 'reviews'>('shop');
  const [selectedSellerId, setSelectedSellerId] = useState<string>('all');
  const [madeInRwandaOnly, setMadeInRwandaOnly] = useState(false);
  const [bulkWholesaleOnly, setBulkWholesaleOnly] = useState(false);

  const { data: market, loading: marketLoading, execute: fetchMarket } = useApi(marketApi, 'get', `/markets/slug/${slug}`);
  const { data: marketReviewsData } = useApi(reviewApi, 'get', market?._id ? `/reviews/target/market/${market._id}` : '');

  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [facets, setFacets] = useState<any>(null);
  const [adVideo, setAdVideo] = useState<any>(null);
  const [marketStories, setMarketStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Food/dining sellers in this market and their public menus.
  const [menuSellers, setMenuSellers] = useState<Array<{ seller: any; menu: any }>>([]);

  useEffect(() => {
    fetchMarket();
  }, [slug, fetchMarket]);

  // Load food-business sellers in this market and their active public menus.
  useEffect(() => {
    if (!market?._id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await sellerApi.get('/sellers/discover?businessType=RESTAURANT,HOTEL,CAFE,BAKERY,CATERING,JUICE_BAR,FOOD_KIOSK');
        const sellers = (res.data?.data || []).filter((s: any) => {
          const sMarketId = typeof s.marketId === 'object' ? s.marketId?._id : s.marketId;
          return String(sMarketId) === String(market._id) && s.isApproved;
        });
        const withMenus = await Promise.all(
          sellers.map(async (seller: any) => {
            try {
              const menuRes = await sellerApi.get(`/sellers/menu/public/${seller._id}`);
              const menu = menuRes.data?.data;
              if (menu && (menu.sections || []).length > 0) return { seller, menu };
            } catch { /* no menu */ }
            return null;
          })
        );
        if (!cancelled) setMenuSellers(withMenus.filter(Boolean) as Array<{ seller: any; menu: any }>);
      } catch {
        if (!cancelled) setMenuSellers([]);
      }
    })();
    return () => { cancelled = true; };
  }, [market?._id]);

  const fetchCatalog = useCallback(async () => {
    if (!market?._id) return;
    setLoading(true);
    try {
      const [prodRes, promRes, facetRes, videoRes] = await Promise.allSettled([
        productApi.get(`/products/recommendations/for-me?marketId=${market._id}&isActive=true&isApproved=true&limit=100`),
        productApi.get(`/products?marketId=${market._id}&isActive=true&isApproved=true&hasPromotion=true&limit=8`),
        productApi.get(`/products/catalog/facets?marketId=${market._id}&isActive=true&isApproved=true&limit=200`),
        productApi.get(`/seller-videos?marketId=${market._id}&limit=5`),
      ]);

      const readData = (result: PromiseSettledResult<any>, fallback: any) => {
        if (result.status === 'fulfilled') return result.value.data?.data ?? fallback;
        console.warn('[MarketPage] Catalog request failed without crashing the storefront:', result.reason);
        return fallback;
      };

      setAllProducts(readData(prodRes, []));
      setPromotions([...readData(promRes, [])].sort((a: any, b: any) => Number(b.promotion?.discountPercentage || b.promotion?.discount || 0) - Number(a.promotion?.discountPercentage || a.promotion?.discount || 0)));
      setFacets(readData(facetRes, null));
      const vList = readData(videoRes, []);
      const videos = Array.isArray(vList) ? vList : [];
      const shopAd = videos.find((v: any) => v.placement === 'SHOP_AD') || videos.find((v: any) => v.placement === 'PRODUCT_AD') || null;
      setAdVideo(shopAd || null);
      setMarketStories(videos.filter((v: any) => v.placement === 'STORY' && v.isArchived !== true).slice(0, 8));
    } finally {
      setLoading(false);
    }
  }, [market?._id]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Real-time WebSocket synchronization for order status completions
  const orderSocketUrl = process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006';
  const { data: socketMessage } = useSocket(orderSocketUrl, 'order:seller:updates');

  useEffect(() => {
    if (socketMessage) {
      console.log('[WebSocket] Order update received on Market Details Page:', socketMessage);
      if (socketMessage.type === 'STATUS_UPDATE' && (socketMessage.status === 'delivered' || socketMessage.status === 'confirmed')) {
        fetchMarket();
        fetchCatalog();
      }
    }
  }, [socketMessage, fetchMarket, fetchCatalog]);

  // If this is a food/dining market/store with menus but no standard catalog products,
  // default the active tab to 'menu' so the user is immediately shown food items.
  useEffect(() => {
    if (!loading && menuSellers.length > 0 && allProducts.length === 0 && activeTab === 'shop') {
      setActiveTab('menu');
    }
  }, [menuSellers, allProducts, loading, activeTab]);

  const categories = useMemo(() => {
    if (facets?.categories?.length) {
      return ['all', ...facets.categories.map((category: any) => category.id)];
    }
    const cats = new Set(allProducts.map(p => p.category).filter(Boolean));
    return ['all', ...Array.from(cats)].sort();
  }, [allProducts, facets]);

  const filteredProducts = useMemo(() => {
    return allProducts.filter(product => {
      const sellerProfile = typeof product.sellerId === 'object' ? product.sellerId : null;
      const sellerId = sellerProfile?._id || product.sellerId;
      if (selectedSellerId !== 'all' && String(sellerId) !== selectedSellerId) return false;

      if (madeInRwandaOnly && !product.isMadeInRwanda) return false;
      if (bulkWholesaleOnly && product.stockType !== 'wholesale' && !product.name.toLowerCase().includes('wholesale')) return false;

      if (selectedCategory !== 'all' && product.categoryId !== selectedCategory && product.category !== selectedCategory) return false;
      const price = product.price;
      if (minPrice && price < Number(minPrice)) return false;
      if (maxPrice && price > Number(maxPrice)) return false;
      for (const [key, value] of Object.entries(attributeFilters)) {
        if (!value) continue;
        if (String(product.attributes?.[key] ?? '') !== String(value)) return false;
      }
      if (searchQuery.trim()) {
        const nameSimilarity = getSimilarity(product.name || '', searchQuery);
        const categorySimilarity = product.category ? getSimilarity(product.category, searchQuery) : 0;
        const descriptionSimilarity = product.description ? getSimilarity(product.description, searchQuery) : 0;
        return nameSimilarity > 0.35 || categorySimilarity > 0.35 || descriptionSimilarity > 0.5;
      }
      return true;
    });
  }, [allProducts, selectedCategory, searchQuery, minPrice, maxPrice, attributeFilters, selectedSellerId, madeInRwandaOnly, bulkWholesaleOnly]);

  const activeFacetGroups = useMemo(
    () => (facets?.attributes || []).filter((group: any) => selectedCategory === 'all' || group.id === selectedCategory),
    [facets, selectedCategory]
  );

  const updateAttributeFilter = (key: string, value: string) => {
    setAttributeFilters(prev => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const mostBoughtProducts = useMemo(
    () => [...allProducts].sort((a, b) => Number(b.totalOrders || b.orders || 0) - Number(a.totalOrders || a.orders || 0)).slice(0, 6),
    [allProducts]
  );
  const highlyReviewedProducts = useMemo(
    () => [...allProducts].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0)).slice(0, 6),
    [allProducts]
  );
  const topSellers = useMemo(() => {
    const sellerMap = new Map<string, any>();
    allProducts.forEach(product => {
      const seller = product.sellerId && typeof product.sellerId === 'object' ? product.sellerId : null;
      const sellerId = String(seller?._id || seller?.userId || product.sellerId || '');
      if (!sellerId) return;
      const sellerImage = seller?.shopDetails?.logoUrl || seller?.shopDetails?.imageUrl;
      const current = sellerMap.get(sellerId) || {
        id: sellerId,
        name: seller?.stallName || seller?.shopDetails?.name || product.seller?.name || 'Verified seller',
        description: seller?.shopDetails?.description || product.description || 'Verified seller in this market.',
        rating: Number(seller?.rating || product.rating || 0),
        sales: Number(seller?.totalOrders || product.totalOrders || product.orders || 0),
        image: sellerImage || product.images?.[0],
        imageService: sellerImage ? 'seller' : 'product',
        products: 0,
      };
      current.products += 1;
      current.sales += Number(product.totalOrders || product.orders || 0);
      current.rating = Math.max(Number(current.rating || 0), Number(seller?.rating || product.rating || 0));
      sellerMap.set(sellerId, current);
    });
    return Array.from(sellerMap.values())
      .sort((a, b) => (Number(b.rating || 0) + Number(b.sales || 0) * 0.01) - (Number(a.rating || 0) + Number(a.sales || 0) * 0.01))
      .slice(0, 6);
  }, [allProducts]);

  const maxMarketDiscount = useMemo(() => {
    const activePromos = Array.isArray(promotions) ? promotions : [];
    if (activePromos.length === 0) return 0;
    return Math.max(...activePromos.map(p => p.discountPercentage || 0));
  }, [promotions]);

  const marketReviews = Array.isArray(marketReviewsData) ? marketReviewsData : [];
  const avgMarketRating = marketReviews.length
    ? (marketReviews.reduce((sum: number, review: any) => sum + Number(review.rating || 0), 0) / marketReviews.length).toFixed(1)
    : (market?.rating ? Number(market.rating).toFixed(1) : '0.0');
  const open = isMarketOpen(market);
  const sellers = Number(market?.totalSellers || 0);
  const productsCount = Number(market?.activeProducts || allProducts.length || 0);
  const fallbackMarketImage = 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&q=85&w=1800';
  const imageUrl = market?.bannerUrl
    ? resolveUploadUrl(market.bannerUrl, 'seller')
    : market?.imageUrl
      ? resolveUploadUrl(market.imageUrl, 'market')
      : fallbackMarketImage;
  const logoUrl = market?.logoUrl ? resolveUploadUrl(market.logoUrl, 'seller') : imageUrl;

  if (marketLoading) {
    return (
      <Layout>
        <div className="flex min-h-[28rem] flex-col items-center justify-center gap-6">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-on-surface-variant">Loading market</p>
        </div>
      </Layout>
    );
  }

  if (!market) {
    return (
      <Layout>
        <div className="w-full py-32 text-center">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Market not found</p>
          <h1 className="mt-4 text-4xl font-black text-on-surface">This market is not available.</h1>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full p-8 md:p-12 space-y-16 pb-32">
        {/* Cover Hero Section */}
        <section className="relative h-[360px] w-full overflow-hidden rounded-2xl border border-outline-variant shadow-[0_12px_40px_rgba(27,28,28,0.04)]">
          <img src={imageUrl} className="w-full h-full object-cover filter brightness-[0.70] contrast-[1.05]" alt={market.name} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent"></div>
          
          <div className="absolute bottom-0 left-0 w-full px-10 pb-10 flex flex-col justify-end h-full z-20">
            <div className="space-y-4 text-on-surface">
              {/* Simplified white badges at the bottom left */}
              <div className="flex flex-wrap gap-3">
                <span className="bg-white border border-[#ebdcd0] text-[#ff6b00] text-[10px] font-black font-mono tracking-widest px-3 py-1.5 rounded flex items-center gap-1.5 shadow-sm">
                  <span className="material-symbols-outlined inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#ff6b00]/10 text-[#ff6b00] border border-[#ff6b00] text-[9px] font-black">check</span>
                  Verified Market
                </span>
                <span className="bg-white border border-[#ebdcd0] text-[#ff6b00] text-[10px] font-black font-mono tracking-widest px-3 py-1.5 rounded flex items-center gap-1.5 shadow-sm">
                  <span className="material-symbols-outlined text-[12px] font-black" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
                  Open: 06:00 - 20:00
                </span>
              </div>

              {/* Market title */}
              <div className="flex items-center gap-2.5">
                <h1 className="font-sans font-extrabold text-3xl md:text-5xl tracking-tight text-white">{market.name}</h1>
              </div>

              {/* Stars rating and Kigali Rwanda */}
              <div className="flex items-center gap-2 text-white/95 text-xs font-semibold drop-shadow-sm">
                <div className="flex gap-0.5 text-[#ff6b00]">
                  <Star size={14} className="fill-[#ff6b00] text-[#ff6b00]" />
                  <Star size={14} className="fill-[#ff6b00] text-[#ff6b00]" />
                  <Star size={14} className="fill-[#ff6b00] text-[#ff6b00]" />
                  <Star size={14} className="fill-[#ff6b00] text-[#ff6b00]" />
                  <Star size={14} className="fill-[#ff6b00] text-[#ff6b00]" />
                </div>
                <span className="ml-1 text-white/90">
                  {market.rating ? `${Number(market.rating).toFixed(1)} (${marketReviews.length} Reviews)` : '4.8 (1,204 Reviews)'}
                </span>
                <span className="text-white/60">•</span>
                <span className="flex items-center gap-1">
                  {market.location?.address || 'Kigali, Rwanda'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Standalone wide MTN MoMo Protected Settlement Card */}
        <section className="bg-white border border-[#ebdcd0] rounded-xl p-6 flex items-start gap-4 shadow-sm w-full">
          <div className="w-10 h-10 rounded bg-[#ff6b00]/10 flex items-center justify-center shrink-0 border border-[#ff6b00]/20">
            <span className="material-symbols-outlined text-[#ff6b00] text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>shield</span>
          </div>
          <div>
            <h4 className="text-sm font-black text-[#ff6b00] uppercase tracking-wider font-mono">MTN MoMo Protected Settlement</h4>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed font-semibold">
              All transactions within this market are secured in escrow until dispatch is confirmed.
            </p>
          </div>
        </section>

        {adVideo && (
          <section className="grid gap-8 rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 shadow-[0_8px_30px_rgba(27,28,28,0.03)] md:grid-cols-[0.85fr_1.15fr]">
            <div className="overflow-hidden rounded-xl bg-black border border-outline-variant shadow-inner">
              <video
                src={resolveUploadUrl(adVideo.videoUrl, 'product', '/seller-videos/upload')}
                poster={adVideo.thumbnailUrl || adVideo.productId?.images?.[0] ? resolveUploadUrl(adVideo.thumbnailUrl || adVideo.productId?.images?.[0], 'product') : imageUrl}
                controls
                playsInline
                preload="metadata"
                className="aspect-video h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col justify-center gap-4">
              <p className="text-[10px] font-bold font-mono uppercase tracking-[0.18em] text-primary">Market spotlight</p>
              <h2 className="text-2xl font-extrabold tracking-tight text-on-surface font-sans">{adVideo.title || `What's new at ${market.name}`}</h2>
              <p className="line-clamp-3 text-sm font-semibold leading-relaxed text-on-surface-variant font-sans">
                {adVideo.caption || 'Watch the latest seller update from this market.'}
              </p>
              <Link href={`/videos?marketId=${market._id}`} className="mt-2 inline-flex w-max items-center gap-2 rounded-full border border-primary px-6 py-3 text-[10px] font-black uppercase tracking-widest text-primary transition-all hover:bg-primary hover:text-white font-mono">
                View more videos <ArrowRight size={13} />
              </Link>
            </div>
          </section>
        )}

        {/* Tab Selection Tab-Bar */}
        <div className="flex border-b border-outline-variant overflow-x-auto gap-8 text-xs font-bold uppercase tracking-wider scrollbar-hide pt-4">
          {[
            { id: 'shop', label: 'Shop Products', count: filteredProducts.length },
            ...(menuSellers.length > 0 ? [{ id: 'menu', label: 'Menu', count: menuSellers.length }] : []),
            { id: 'videos', label: 'Seller Videos' },
            { id: 'about', label: 'About the Market' },
            { id: 'reviews', label: 'Reviews & Feedback', count: marketReviews.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 relative shrink-0 transition-all duration-300 ${
                activeTab === tab.id
                  ? 'text-[#ff6b00] font-black scale-105'
                  : 'text-on-surface-variant hover:text-[#ff6b00]'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                {tab.label}
              </span>
              {activeTab === tab.id && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-1 bg-[#ff6b00]" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Panel menu */}
        {activeTab === 'menu' && (
          <div className="flex flex-col gap-8 pt-6">
            {menuSellers.map(({ seller, menu }) => (
              <div key={seller._id} className="flex flex-col gap-3">
                <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
                  {seller.shopDetails?.name || seller.stallName || 'Kitchen'}
                </h3>
                <MenuStorefront seller={seller} menu={menu} />
              </div>
            ))}
          </div>
        )}

        {/* Tab Panel shop */}
        {activeTab === 'shop' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6">
            {/* Left sidebar filters */}
            <aside className="lg:col-span-3 space-y-8">
              <div className="bg-white border border-[#ebdcd0] p-6 rounded-xl shadow-sm space-y-6">
                <h3 className="font-bold text-sm mb-4 flex items-center gap-2 uppercase tracking-wider text-on-surface">
                  <SlidersHorizontal size={16} className="text-[#ff6b00]" /> Filters
                </h3>
                <div className="space-y-6">
                  {/* Search input */}
                  <div>
                    <label className="text-xs font-bold text-on-surface-variant block mb-2">Search items</label>
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                      <input
                        type="text"
                        placeholder="Search product..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline-variant text-on-surface rounded-lg text-xs outline-none focus:border-primary transition-colors font-semibold"
                      />
                    </div>
                  </div>

                  {/* Category check selectors formatted as checkboxes */}
                  <div className="space-y-4">
                    <span className="font-mono text-[10px] font-black text-on-surface-variant uppercase tracking-widest block mb-3">Taxonomy / Categories</span>
                    <div className="space-y-2.5">
                      {/* Checkbox item for all */}
                      <button
                        onClick={() => { setSelectedCategory('all'); setAttributeFilters({}); }}
                        className="flex items-center gap-3 w-full text-left group"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          selectedCategory === 'all'
                            ? 'bg-[#ff6b00] border-[#ff6b00] text-white shadow-sm'
                            : 'border-outline group-hover:border-[#ff6b00] bg-white'
                        }`}>
                          {selectedCategory === 'all' && <span className="text-[10px] font-black">✓</span>}
                        </div>
                        <span className={`text-xs font-semibold ${selectedCategory === 'all' ? 'text-on-surface font-bold' : 'text-on-surface-variant'}`}>
                          All Products
                        </span>
                      </button>

                      {categories.filter(cat => cat !== 'all').map(cat => {
                        const isSelected = selectedCategory === cat;
                        const label = facets?.categories?.find((category: any) => category.id === cat)?.label || cat;
                        return (
                          <button
                            key={cat}
                            onClick={() => { setSelectedCategory(cat); setAttributeFilters({}); }}
                            className="flex items-center gap-3 w-full text-left group"
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-[#ff6b00] border-[#ff6b00] text-white shadow-sm'
                                : 'border-outline group-hover:border-[#ff6b00] bg-white'
                            }`}>
                              {isSelected && <span className="text-[10px] font-black">✓</span>}
                            </div>
                            <span className={`text-xs font-semibold ${isSelected ? 'text-on-surface font-bold' : 'text-on-surface-variant'}`}>
                              {label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Attributes checkbox selectors */}
                  <div className="pt-4 border-t border-outline-variant/60">
                    <span className="font-mono text-[10px] font-black text-on-surface-variant uppercase tracking-widest block mb-3">Attributes</span>
                    <div className="space-y-2.5">
                      <button
                        onClick={() => setMadeInRwandaOnly(!madeInRwandaOnly)}
                        className="flex items-center gap-3 w-full text-left group"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          madeInRwandaOnly
                            ? 'bg-[#ff6b00] border-[#ff6b00] text-white shadow-sm'
                            : 'border-outline group-hover:border-[#ff6b00] bg-white'
                        }`}>
                          {madeInRwandaOnly && <span className="text-[10px] font-black">✓</span>}
                        </div>
                        <span className={`text-xs font-semibold ${madeInRwandaOnly ? 'text-on-surface font-bold' : 'text-on-surface-variant'}`}>
                          Made in Rwanda
                        </span>
                      </button>

                      <button
                        onClick={() => setBulkWholesaleOnly(!bulkWholesaleOnly)}
                        className="flex items-center gap-3 w-full text-left group"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          bulkWholesaleOnly
                            ? 'bg-[#ff6b00] border-[#ff6b00] text-white shadow-sm'
                            : 'border-outline group-hover:border-[#ff6b00] bg-white'
                        }`}>
                          {bulkWholesaleOnly && <span className="text-[10px] font-black">✓</span>}
                        </div>
                        <span className={`text-xs font-semibold ${bulkWholesaleOnly ? 'text-on-surface font-bold' : 'text-on-surface-variant'}`}>
                          Bulk Wholesale
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Price range inputs */}
                  <div className="pt-4 border-t border-outline-variant/60">
                    <span className="font-mono text-[10px] font-black text-on-surface-variant uppercase tracking-widest block mb-3">Price Range (RWF)</span>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" placeholder="Min" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="w-full p-3 bg-surface-container-low border border-outline-variant text-on-surface rounded-lg text-xs outline-none focus:border-primary transition-colors font-semibold" />
                      <input type="number" placeholder="Max" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="w-full p-3 bg-surface-container-low border border-outline-variant text-on-surface rounded-lg text-xs outline-none focus:border-primary transition-colors font-semibold" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Verified Trust badge */}
              <div className="bg-[#ff6b00]/5 border border-[#ff6b00] border-dashed p-5 rounded-xl flex items-start gap-3">
                <ShieldCheck size={20} className="text-[#ff6b00] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-[#ff6b00] font-mono uppercase">Secure Marketplace</p>
                  <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed font-semibold">All transactions inside this hub are protected by RMF escrow. Payments are held safely until handover verification.</p>
                </div>
              </div>
            </aside>

            {/* Main content shelf */}
            <div className="lg:col-span-9 space-y-12">
              {/* Merchant circular quick selector row */}
              <div className="bg-white border border-[#ebdcd0] p-6 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-3">
                  <Store size={16} className="text-[#ff6b00]" />
                  <span className="font-mono text-[10px] font-black text-on-surface uppercase tracking-widest">Select Merchant Vendor</span>
                </div>
                <div className="flex flex-wrap gap-6 items-start">
                  <button
                    onClick={() => setSelectedSellerId('all')}
                    className={`flex flex-col items-center gap-1.5 transition-all ${
                      selectedSellerId === 'all' ? 'opacity-100 scale-105' : 'opacity-65 hover:opacity-100'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center bg-[#ff6b00]/5 text-[#ff6b00] font-bold text-xs shadow-sm ${
                      selectedSellerId === 'all' ? 'border-[#ff6b00]' : 'border-outline-variant'
                    }`}>
                      ALL
                    </div>
                    <span className="text-[10px] font-bold text-on-surface-variant tracking-tight text-center w-16 truncate mt-1">All Products</span>
                  </button>
                  {topSellers.map((seller) => (
                    <button
                      key={seller.id}
                      onClick={() => setSelectedSellerId(selectedSellerId === seller.id ? 'all' : seller.id)}
                      className={`flex flex-col items-center gap-1.5 transition-all ${
                        selectedSellerId === seller.id ? 'opacity-100 scale-105 font-bold' : 'opacity-65 hover:opacity-100'
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-full overflow-hidden border-2 relative shadow-sm ${
                        selectedSellerId === seller.id ? 'border-[#ff6b00]' : 'border-outline-variant'
                      }`}>
                        {seller.image ? (
                          <img
                            alt={seller.name}
                            className="w-full h-full object-cover"
                            src={resolveUploadUrl(seller.image, seller.imageService === 'seller' ? 'seller' : 'product')}
                            onError={(event) => {
                              event.currentTarget.src = imageUrl;
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[#ff6b00]/10 text-xs font-black text-[#ff6b00]">
                            {seller.name?.[0] || 'S'}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-on-surface-variant tracking-tight text-center w-16 truncate mt-1">{seller.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Seller Stories snap-rail */}
              <section className="bg-white border border-[#ebdcd0] p-8 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-6 pb-2 border-b border-outline-variant/30">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-on-surface font-sans">Market Stories</h3>
                  <Link href={`/videos?marketId=${market._id}`} className="text-xs font-bold text-primary hover:underline font-sans">View All</Link>
                </div>
                {marketStories.length > 0 ? (
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x">
                    {marketStories.map((story) => (
                      <Link href={`/videos?story=${story._id}`} key={story._id} className="flex-shrink-0 w-36 h-52 relative rounded-xl overflow-hidden group cursor-pointer border border-outline-variant shadow-sm bg-black snap-start">
                        <video
                          src={resolveUploadUrl(story.videoUrl, 'product', '/seller-videos/upload')}
                          poster={story.thumbnailUrl ? resolveUploadUrl(story.thumbnailUrl, 'product') : imageUrl}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500 rounded"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"></div>
                        <div className="absolute bottom-3 left-3 right-3 text-white">
                          <p className="font-bold text-xs line-clamp-2">{story.title || story.sellerId?.stallName || market.name}</p>
                          <p className="text-[9px] opacity-80 line-clamp-1 font-mono">{story.caption || 'Story expires after 24 hours'}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low/30 p-8 text-center">
                    <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-on-surface-variant">No live stories yet</p>
                  </div>
                )}
              </section>

              {/* Promotions rail */}
              {selectedCategory === 'all' && !searchQuery && selectedSellerId === 'all' && (
                <div className="space-y-16">
                  <ProductRail title="Promotions from this market" eyebrow="Special Deals" products={promotions} isPromotion={true} />
                  <ProductRail title="Most bought today" eyebrow="Customer Demand" products={mostBoughtProducts} />
                </div>
              )}

              {/* Product Shelf Grid */}
              <section className="bg-white border border-[#ebdcd0] p-8 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-outline-variant/40">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-on-surface font-sans">
                    {selectedCategory === 'all' ? 'All Products' : facets?.categories?.find((category: any) => category.id === selectedCategory)?.label || selectedCategory}
                  </h3>
                  <span className="text-xs font-bold text-on-surface-variant font-mono">{filteredProducts.length} items</span>
                </div>

                {loading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-72 animate-pulse rounded-2xl border border-outline-variant bg-surface-container-low" />)}
                  </div>
                ) : filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                    {filteredProducts.map(product => (
                      <ProductCard key={product._id} product={product} isCompact={true} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low/30 p-12 text-center">
                    <p className="text-xs font-bold uppercase tracking-widest text-primary font-mono">No items found</p>
                    <h3 className="mt-4 text-xl font-bold text-on-surface font-sans">Try adjusting your filters or search query.</h3>
                  </div>
                )}
              </section>

              {/* Top Rated Sellers Carousel */}
              <section className="bg-surface-container-low border border-outline-variant p-8 rounded-2xl shadow-[0_8px_30px_rgba(27,28,28,0.03)]">
                <h3 className="font-bold text-sm uppercase tracking-wider text-on-surface mb-6 font-sans">Top Rated Sellers</h3>
                {topSellers.length > 0 ? (
                  <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x">
                  {topSellers.map((seller) => (
                    <div key={seller.id} className="flex-shrink-0 w-60 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant flex flex-col items-center text-center shadow-[0_8px_30px_rgba(27,28,28,0.02)] snap-start">
                      <div className="w-18 h-18 rounded-full overflow-hidden mb-4 border-2 border-primary relative shadow-md">
                        {seller.image ? (
                          <img
                            alt="Seller Avatar"
                            className="w-full h-full object-cover"
                            src={resolveUploadUrl(seller.image, seller.imageService === 'seller' ? 'seller' : 'product')}
                            onError={(event) => {
                              event.currentTarget.src = imageUrl;
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-primary/10 text-xl font-black text-primary">
                            {seller.name?.[0] || 'S'}
                          </div>
                        )}
                      </div>
                      <h5 className="font-bold text-xs text-on-surface font-sans">{seller.name}</h5>
                      <div className="flex items-center gap-1 my-1 text-primary">
                        <Star size={10} className="fill-current animate-pulse" />
                        <span className="text-[10px] font-mono font-bold text-on-surface-variant">{Number(seller.rating || 0).toFixed(1)} ({seller.sales} sales)</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed mb-4 line-clamp-2 font-sans h-8">{seller.description}</p>
                      <Link href={`/markets?search=${encodeURIComponent(seller.name)}`} className="w-full border border-primary text-primary hover:bg-primary hover:text-white py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all text-center font-mono">
                        Visit Stall
                      </Link>
                    </div>
                  ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center">
                    <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-on-surface-variant">Seller activity will appear as products are listed.</p>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* Tab Panel videos */}
        {activeTab === 'videos' && (
          <section className="animate-reveal [animation-delay:200ms]">
            <SellerVideoFeed
              marketId={market._id}
              title={`${market.name} Seller Videos`}
              description="Watch product demos and shop adverts from sellers inside this market."
            />
          </section>
        )}

        {/* Tab Panel about */}
        {activeTab === 'about' && (
          <section className="animate-reveal [animation-delay:200ms] grid gap-10 lg:grid-cols-[1.4fr_0.6fr]">
            {/* Story & Background */}
            <div className="space-y-16">
              <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-10 shadow-[0_8px_30px_rgba(27,28,28,0.03)] space-y-6">
                <h3 className="text-2xl font-extrabold tracking-tight text-on-surface flex items-center gap-2.5 font-sans">
                  <span className="w-1.5 h-6 bg-primary rounded-full animate-pulse"></span>
                  Welcome to {market.name}
                </h3>
                <p className="text-sm md:text-base leading-relaxed text-on-surface-variant font-medium font-sans">
                  {market.description || 'This market is one of Rwanda\'s verified local trading hubs, connecting local merchants directly with you.'}
                </p>
                <div className="rounded-2xl bg-surface-container-low border border-outline-variant p-6 space-y-3 shadow-sm">
                  <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-primary">Heritage & Community Impact</p>
                  <p className="text-xs leading-relaxed text-on-surface-variant font-medium font-sans">
                    Every purchase you make directly supports local sellers, artisan families, and agricultural cooperatives based in the {market.name} district. By shopping here, you help sustain traditional craftsmanship, organic agriculture, and local economic resilience.
                  </p>
                </div>
              </div>

              {/* Buyer Guidelines Card */}
              <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-10 shadow-[0_8px_30px_rgba(27,28,28,0.03)] space-y-6">
                <h3 className="text-2xl font-extrabold tracking-tight text-on-surface font-sans">Shopping & Delivery Guidelines</h3>
                <div className="grid gap-6 sm:grid-cols-2">
                  {[
                    { title: 'Secure MoMo Checkout', desc: 'Pay safely with MTN Mobile Money. Funds are kept secure under our buyer protection scheme until your delivery is complete.' },
                    { title: 'Price Negotiation', desc: 'Look for products with the Negotiable badge to start a price agreement chat directly with the vendor.' },
                    { title: 'Tracked Courier Network', desc: 'Our dedicated local riders ensure fast, reliable delivery straight to your location with real-time tracking.' },
                    { title: 'Verified Quality', desc: 'Every vendor is officially registered and vetted by market administration to ensure premium quality standards.' },
                  ].map((guide, idx) => (
                    <div key={idx} className="space-y-2">
                      <p className="text-xs font-bold text-on-surface flex items-center gap-2 font-sans">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary font-mono">{idx + 1}</span>
                        {guide.title}
                      </p>
                      <p className="text-xs leading-relaxed text-on-surface-variant font-medium font-sans">{guide.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Logistics Info Column */}
            <div className="space-y-10">
              
              {/* Quick Facts Card */}
              <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 shadow-[0_8px_30px_rgba(27,28,28,0.03)] space-y-6">
                <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface border-b border-outline-variant/60 pb-4 font-sans">Operational Facts</h4>
                <div className="space-y-4">
                  {[
                    { label: 'Address', value: market.location?.address || 'Kigali, Rwanda' },
                    { label: 'Operating Days', value: market.operatingHours?.daysOpen?.join(', ') || 'Monday - Sunday' },
                    { label: 'Operating Hours', value: market.operatingHours?.open && market.operatingHours?.close ? `${market.operatingHours.open} - ${market.operatingHours.close}` : '6:00 AM - 6:00 PM' },
                    { label: 'Vetted Merchants', value: `${sellers} Registered Sellers` },
                    { label: 'Total Catalog', value: `${productsCount} Live Items` },
                  ].map((fact, idx) => (
                    <div key={idx} className="flex justify-between items-start gap-4 text-xs font-semibold font-sans">
                      <span className="text-on-surface-variant font-medium">{fact.label}</span>
                      <span className="text-on-surface text-right font-mono font-bold">{fact.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Map Preview Widget */}
              <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest overflow-hidden shadow-[0_8px_30px_rgba(27,28,28,0.03)]">
                <div className="p-6 border-b border-outline-variant/65">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface font-sans">District Location</h4>
                </div>
                <div className="h-56 relative bg-surface-container-low">
                  <RiderMap
                    marketId={market._id}
                    centerLat={market.location?.coordinates?.[1]}
                    centerLng={market.location?.coordinates?.[0]}
                    marketName={market.name}
                  />
                </div>
              </div>

            </div>
          </section>
        )}

        {/* Tab Panel reviews */}
        {activeTab === 'reviews' && (
          <section className="animate-reveal [animation-delay:200ms] space-y-10">
            <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-10 shadow-[0_8px_30px_rgba(27,28,28,0.03)] space-y-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-outline-variant/60">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-on-surface font-sans">Market Reviews & Feedback</h2>
                  <p className="text-xs text-on-surface-variant mt-1 font-sans font-medium">Verified buyer reviews for orders fulfilled at {market.name}.</p>
                </div>
                <div className="flex items-center gap-4 bg-surface-container-low px-4 py-2.5 rounded-xl border border-outline-variant">
                  <div className="text-right">
                    <p className="text-3xl font-black text-primary font-mono">{avgMarketRating}</p>
                    <p className="text-[9px] font-bold uppercase text-on-surface-variant font-mono">Global Rating</p>
                  </div>
                </div>
              </div>

              {/* Dynamic Database Reviews */}
              {marketReviews.length > 0 ? (
                <div className="space-y-6">
                  <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-on-surface-variant">Customer Reviews</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {marketReviews.map((review: any) => (
                      <div key={review._id} className="rounded-2xl border border-outline-variant bg-surface-container-low/40 p-6 shadow-sm space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-bold text-on-surface font-sans">{review.buyerName || 'Verified buyer'}</p>
                            <p className="text-[10px] text-on-surface-variant font-mono font-semibold">{new Date(review.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-1 text-primary">
                            <Star size={12} className="fill-current animate-pulse" />
                            <span className="text-xs font-mono font-bold text-on-surface">{review.rating}</span>
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed text-on-surface-variant font-medium font-sans">{review.comment || 'Great marketplace with fast delivery.'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low/30 p-12 text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary font-mono">No reviews yet</p>
                  <h3 className="mt-4 text-xl font-bold text-on-surface font-sans">Reviews will appear here after completed orders.</h3>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {isFullMap && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-surface-container-lowest">
          <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-8 py-6 shadow-md">
            <div>
              <p className="text-xs font-bold font-mono uppercase tracking-[0.18em] text-primary">{market.name}</p>
              <h2 className="text-2xl font-extrabold text-on-surface font-sans">Interactive Courier Route</h2>
            </div>
            <button
              onClick={() => setIsFullMap(false)}
              className="rounded-full bg-primary px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-on-primary transition hover:bg-primary-container font-mono"
            >
              Close Map
            </button>
          </div>
          <div className="relative flex-1 bg-background">
            <RiderMap
              marketId={market._id}
              centerLat={market.location?.coordinates?.[1]}
              centerLng={market.location?.coordinates?.[0]}
              marketName={market.name}
            />
          </div>
        </div>
      )}
    </Layout>
  );
}
