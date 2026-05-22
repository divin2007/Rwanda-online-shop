'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Clock3, MapPin, PackageCheck, Search, ShieldCheck, SlidersHorizontal, Star, Store, Truck } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { ProductCard } from '@/components/ui/ProductCard';
import { SellerVideoFeed } from '@/components/ui/SellerVideoFeed';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/hooks/useSocket';
import { marketApi, productApi, reviewApi } from '@/lib/api';

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
    <section className={`animate-reveal rounded-2xl border ${isPromotion ? 'border-primary/30 bg-primary/5' : 'border-border-light bg-white'} p-6 shadow-sm md:p-8`}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">{title}</h2>
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
  const [activeTab, setActiveTab] = useState<'shop' | 'videos' | 'about' | 'reviews'>('shop');

  const { data: market, loading: marketLoading, execute: fetchMarket } = useApi(marketApi, 'get', `/markets/slug/${slug}`);
  const { data: marketReviewsData } = useApi(reviewApi, 'get', market?._id ? `/reviews/target/market/${market._id}` : '');

  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [facets, setFacets] = useState<any>(null);
  const [adVideo, setAdVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarket();
  }, [slug, fetchMarket]);

  const fetchCatalog = useCallback(async () => {
    if (!market?._id) return;
    setLoading(true);
    try {
      const [prodRes, promRes, facetRes, videoRes] = await Promise.allSettled([
        productApi.get(`/products/recommendations/for-me?marketId=${market._id}&isActive=true&isApproved=true&limit=1000`),
        productApi.get(`/products?marketId=${market._id}&isActive=true&isApproved=true&hasPromotion=true&limit=8`),
        productApi.get(`/products/catalog/facets?marketId=${market._id}&isActive=true&isApproved=true&limit=1000`),
        productApi.get(`/seller-videos?marketId=${market._id}&limit=5`),
      ]);

      const readData = (result: PromiseSettledResult<any>, fallback: any) => {
        if (result.status === 'fulfilled') return result.value.data?.data ?? fallback;
        console.warn('[MarketPage] Catalog request failed without crashing the storefront:', result.reason);
        return fallback;
      };

      setAllProducts(readData(prodRes, []));
      setPromotions(readData(promRes, []));
      setFacets(readData(facetRes, null));
      const vList = readData(videoRes, []);
      const shopAd = Array.isArray(vList) ? vList.find((v: any) => v.placement === 'SHOP_AD') || vList[0] : null;
      setAdVideo(shopAd || null);
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

  const categories = useMemo(() => {
    if (facets?.categories?.length) {
      return ['all', ...facets.categories.map((category: any) => category.id)];
    }
    const cats = new Set(allProducts.map(p => p.category).filter(Boolean));
    return ['all', ...Array.from(cats)].sort();
  }, [allProducts, facets]);

  const filteredProducts = useMemo(() => {
    return allProducts.filter(product => {
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
  }, [allProducts, selectedCategory, searchQuery, minPrice, maxPrice, attributeFilters]);

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

  const maxMarketDiscount = useMemo(() => {
    const activePromos = Array.isArray(promotions) ? promotions : [];
    if (activePromos.length === 0) return 0;
    return Math.max(...activePromos.map(p => p.discountPercentage || 0));
  }, [promotions]);

  const marketReviews = Array.isArray(marketReviewsData) ? marketReviewsData : [];
  const open = isMarketOpen(market);
  const sellers = Number(market?.totalSellers || 0);
  const productsCount = Number(market?.activeProducts || allProducts.length || 0);
  const imageUrl = market?.imageUrl || 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&q=85&w=1800';

  if (marketLoading) {
    return (
      <Layout>
        <div className="flex min-h-[28rem] flex-col items-center justify-center gap-6">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-[#ffd700] border-t-transparent" />
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#414844]">Loading market</p>
        </div>
      </Layout>
    );
  }

  if (!market) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl py-32 text-center">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#ff6b00]">Market not found</p>
          <h1 className="mt-4 text-4xl font-black text-[#1b1c1c]">This market is not available.</h1>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-10 space-y-10 pb-24">
        {/* Cover Hero Section */}
        <section className="relative h-[300px] w-full overflow-hidden rounded-xl border border-[#e2bfb0] shadow-md">
          <img src={imageUrl} className="w-full h-full object-cover" alt={market.name} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-full px-8 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex gap-4 items-center">
              <div className="w-20 h-20 bg-white p-1.5 rounded-lg border border-[#e2bfb0] shadow-lg shrink-0">
                <img alt="Market Logo" className="w-full h-full object-cover rounded" src={imageUrl} />
              </div>
              <div className="text-white">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-2xl md:text-3xl">{market.name}</h1>
                  <span className="inline-flex items-center text-blue-400">
                    <BadgeCheck size={18} className="fill-current text-blue-400" />
                  </span>
                </div>
                <p className="text-xs md:text-sm opacity-90">{market.location?.address || 'Kigali Hub • Professional Trade Zone'}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className={`text-[10px] font-bold px-3.5 py-1 rounded-full flex items-center gap-1.5 ${open ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                    {open ? 'OPEN NOW' : 'CLOSED NOW'}
                  </span>
                  <span className="bg-white text-[#1b1c1c] text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Star size={12} className="fill-amber-500 text-amber-500" />
                    {market.rating ? `${Number(market.rating).toFixed(1)} (${marketReviews.length} reviews)` : 'New Market'}
                  </span>
                </div>
              </div>
            </div>
            <div className="hidden md:flex flex-col items-end gap-1.5 text-white">
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2.5 rounded border border-white/20">
                <Clock3 size={16} className="text-primary-light animate-pulse" />
                <span className="text-xs font-semibold">Delivery: <strong className="text-accent-premium">~45 mins</strong> to Central Kigali</span>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Selection Tab-Bar */}
        <div className="flex border-b border-[#e2bfb0] pb-px overflow-x-auto gap-8 text-xs font-bold uppercase tracking-wider scrollbar-hide pt-4">
          {[
            { id: 'shop', label: 'Shop Products', count: filteredProducts.length },
            { id: 'videos', label: 'Seller Videos' },
            { id: 'about', label: 'About the Market' },
            { id: 'reviews', label: 'Reviews & Feedback', count: marketReviews.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 relative shrink-0 transition-all duration-300 ${
                activeTab === tab.id
                  ? 'text-primary font-black scale-105'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span className="flex items-center gap-2">
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-background-surface text-text-muted'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-fade-in" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Panel shop */}
        {activeTab === 'shop' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
            {/* Left sidebar filters */}
            <aside className="lg:col-span-3 space-y-6">
              <div className="bg-white border border-[#e2bfb0] p-5 rounded-lg shadow-sm">
                <h3 className="font-bold text-sm mb-4 flex items-center gap-2 uppercase tracking-wider text-text-primary">
                  <SlidersHorizontal size={16} className="text-primary" /> Filters
                </h3>
                <div className="space-y-6">
                  {/* Search input */}
                  <div>
                    <label className="text-xs font-bold text-text-muted block mb-2">Search items</label>
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                      <input
                        type="text"
                        placeholder="Search product..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="rmf-input pl-10 w-full text-xs"
                      />
                    </div>
                  </div>

                  {/* Category check selectors */}
                  <div>
                    <span className="font-mono text-xs font-bold text-primary uppercase tracking-wider block mb-3">Categories</span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => { setSelectedCategory(cat); setAttributeFilters({}); }}
                          className={`w-full text-left flex items-center justify-between rounded p-2 text-xs font-semibold transition-colors ${
                            selectedCategory === cat ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-background-surface text-text-secondary'
                          }`}
                        >
                          <span>{cat === 'all' ? 'All products' : facets?.categories?.find((category: any) => category.id === cat)?.label || cat}</span>
                          {cat === 'all' ? (
                            <span className="text-[10px] bg-background-surface px-1.5 py-0.5 rounded">{allProducts.length}</span>
                          ) : (
                            <span className="text-[10px] bg-background-surface px-1.5 py-0.5 rounded">
                              {facets?.categories?.find((category: any) => category.id === cat)?.count || 0}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price sliders or ranges */}
                  <div>
                    <span className="font-mono text-xs font-bold text-primary uppercase tracking-wider block mb-3">Price Range (RWF)</span>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" placeholder="Min" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="rmf-input w-full text-xs" />
                      <input type="number" placeholder="Max" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="rmf-input w-full text-xs" />
                    </div>
                  </div>

                  {/* Specifications facets */}
                  {activeFacetGroups.length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-border-light">
                      <span className="font-mono text-xs font-bold text-primary uppercase tracking-wider block mb-2">Specifications</span>
                      {activeFacetGroups.flatMap((group: any) => group.fields || []).slice(0, 4).map((field: any, idx: number) => (
                        <label key={`${field.key}-${idx}`} className="block">
                          <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-text-muted">{field.label}</span>
                          <select value={attributeFilters[field.key] || ''} onChange={e => updateAttributeFilter(field.key, e.target.value)} className="rmf-select w-full text-xs">
                            <option value="">Any</option>
                            {((field.values?.length ? field.values.map((item: any) => item.value) : field.options) || []).map((value: string, vi: number) => (
                              <option key={`${field.key}-${idx}-${vi}`} value={value}>{value}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Verified Trust badge */}
              <div className="bg-tertiary-container/5 border border-tertiary border-dashed p-5 rounded-lg flex items-start gap-3">
                <ShieldCheck size={20} className="text-tertiary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-tertiary font-mono uppercase">Secure Marketplace</p>
                  <p className="text-[11px] text-text-muted mt-1 leading-relaxed">All transactions inside this hub are protected by RMF escrow. Payments are held safely until handover verification.</p>
                </div>
              </div>
            </aside>

            {/* Main content shelf */}
            <div className="lg:col-span-9 space-y-8">
              {/* Seller Stories snap-rail */}
              <section className="bg-white border border-[#e2bfb0] p-6 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-text-primary">Market Stories</h3>
                  <Link href="/videos" className="text-xs font-bold text-primary hover:underline">View All</Link>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {[
                    { name: "Mama Keza", category: "Fresh Produce", img: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=250" },
                    { name: "David's Grains", category: "Arabica Supply", img: "https://images.unsplash.com/photo-1588508065123-287b28e013da?auto=format&fit=crop&q=80&w=250" },
                    { name: "Craft Collective", category: "Heritage Artisans", img: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&q=80&w=250" }
                  ].map((story, i) => (
                    <Link href="/videos" key={i} className="flex-shrink-0 w-36 h-52 relative rounded-xl overflow-hidden group cursor-pointer border border-[#e2bfb0] shadow-sm">
                      <img src={story.img} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" alt={story.name} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <p className="font-bold text-xs">{story.name}</p>
                        <p className="text-[9px] opacity-80">{story.category}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              {/* Promotions rail */}
              {selectedCategory === 'all' && !searchQuery && (
                <div className="space-y-8">
                  <ProductRail title="Promotions from this market" eyebrow="Special Deals" products={promotions} isPromotion={true} />
                  <ProductRail title="Most bought today" eyebrow="Customer Demand" products={mostBoughtProducts} />
                </div>
              )}

              {/* Product Shelf Grid */}
              <section className="bg-white border border-[#e2bfb0] p-6 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-light">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-text-primary">
                    {selectedCategory === 'all' ? 'All Products' : facets?.categories?.find((category: any) => category.id === selectedCategory)?.label || selectedCategory}
                  </h3>
                  <span className="text-xs font-bold text-text-muted">{filteredProducts.length} items</span>
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-72 animate-pulse rounded-xl border border-[#e2bfb0] bg-background-surface" />)}
                  </div>
                ) : filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProducts.map(product => (
                      <ProductCard key={product._id} product={product} isCompact={true} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#e2bfb0] bg-background-surface p-12 text-center">
                    <p className="text-xs font-bold uppercase tracking-widest text-primary">No items found</p>
                    <h3 className="mt-4 text-xl font-bold text-text-primary">Try adjusting your filters or search query.</h3>
                  </div>
                )}
              </section>

              {/* Top Rated Sellers Carousel */}
              <section className="bg-[#f5f3f3]/50 border border-[#e2bfb0] p-6 rounded-lg shadow-sm">
                <h3 className="font-bold text-sm uppercase tracking-wider text-text-primary mb-4">Top Rated Sellers</h3>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {[
                    { name: "Kigali Grains Co.", rating: "4.8", sales: "892 sales", desc: "Specialist in wholesale beans and maize.", img: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=150" },
                    { name: "Mutesi Fresh Mart", rating: "4.9", sales: "1.2k sales", desc: "Farm-to-table organic produce delivered daily.", img: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=150" },
                    { name: "Western Coffee Ex.", rating: "5.0", sales: "45 sales", desc: "Exporters of premium certified coffee beans.", img: "https://images.unsplash.com/photo-1588508065123-287b28e013da?auto=format&fit=crop&q=80&w=150" }
                  ].map((seller, idx) => (
                    <div key={idx} className="flex-shrink-0 w-60 bg-white p-5 rounded-lg border border-[#e2bfb0] flex flex-col items-center text-center shadow-sm">
                      <div className="w-16 h-16 rounded-full overflow-hidden mb-3 border-2 border-primary relative">
                        <img alt="Seller Avatar" className="w-full h-full object-cover" src={seller.img} />
                      </div>
                      <h5 className="font-bold text-xs text-text-primary">{seller.name}</h5>
                      <div className="flex items-center gap-1 my-1 text-accent-premium">
                        <Star size={10} className="fill-current" />
                        <span className="text-[10px] font-mono font-bold text-text-muted">{seller.rating} ({seller.sales})</span>
                      </div>
                      <p className="text-[11px] text-text-muted leading-relaxed mb-4 line-clamp-2">{seller.desc}</p>
                      <Link href={`/markets?search=${encodeURIComponent(seller.name)}`} className="w-full border border-primary text-primary hover:bg-primary hover:text-white py-1.5 rounded text-xs font-bold transition-colors">
                        Visit Stall
                      </Link>
                    </div>
                  ))}
                </div>
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
          <section className="animate-reveal [animation-delay:200ms] grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
            {/* Story & Background */}
            <div className="space-y-8">
              <div className="rounded-xl border border-[#e2bfb0] bg-white p-8 shadow-sm space-y-6">
                <h3 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2.5">
                  <span className="w-1.5 h-5 bg-primary rounded-full animate-pulse"></span>
                  Welcome to {market.name}
                </h3>
                <p className="text-sm md:text-base leading-relaxed text-text-secondary">
                  {market.description || 'This market is one of Rwanda\'s verified local trading hubs, connecting local merchants directly with you.'}
                </p>
                <div className="rounded-lg bg-background-surface/50 border border-[#e2bfb0]/40 p-5 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Heritage & Community Impact</p>
                  <p className="text-xs leading-relaxed text-text-muted font-normal">
                    Every purchase you make directly supports local sellers, artisan families, and agricultural cooperatives based in the {market.name} district. By shopping here, you help sustain traditional craftsmanship, organic agriculture, and local economic resilience.
                  </p>
                </div>
              </div>

              {/* Buyer Guidelines Card */}
              <div className="rounded-xl border border-[#e2bfb0] bg-white p-8 shadow-sm space-y-6">
                <h3 className="text-xl font-bold tracking-tight text-text-primary">Shopping & Delivery Guidelines</h3>
                <div className="grid gap-6 sm:grid-cols-2">
                  {[
                    { title: 'Secure MoMo Checkout', desc: 'Pay safely with MTN Mobile Money. Funds are kept secure under our buyer protection scheme until your delivery is complete.' },
                    { title: 'Price Negotiation', desc: 'Look for products with the ⚡ Negotiable badge to start a price agreement chat directly with the vendor.' },
                    { title: 'Tracked Courier Network', desc: 'Our dedicated local riders ensure fast, reliable delivery straight to your location with real-time tracking.' },
                    { title: 'Verified Quality', desc: 'Every vendor is officially registered and vetted by market administration to ensure premium quality standards.' },
                  ].map((guide, idx) => (
                    <div key={idx} className="space-y-2">
                      <p className="text-xs font-bold text-text-primary flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">{idx + 1}</span>
                        {guide.title}
                      </p>
                      <p className="text-xs leading-relaxed text-text-muted">{guide.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Logistics Info Column */}
            <div className="space-y-6">
              
              {/* Quick Facts Card */}
              <div className="rounded-xl border border-[#e2bfb0] bg-white p-6 shadow-sm space-y-6">
                <h4 className="text-xs font-bold uppercase tracking-widest text-text-primary border-b border-[#ebdcd0] pb-4">Operational Facts</h4>
                <div className="space-y-4">
                  {[
                    { label: 'Address', value: market.location?.address || 'Kigali, Rwanda' },
                    { label: 'Operating Days', value: market.operatingHours?.daysOpen?.join(', ') || 'Monday - Sunday' },
                    { label: 'Operating Hours', value: market.operatingHours?.open && market.operatingHours?.close ? `${market.operatingHours.open} - ${market.operatingHours.close}` : '6:00 AM - 6:00 PM' },
                    { label: 'Vetted Merchants', value: `${sellers} Registered Sellers` },
                    { label: 'Total Catalog', value: `${productsCount} Live Items` },
                  ].map((fact, idx) => (
                    <div key={idx} className="flex justify-between items-start gap-4 text-xs">
                      <span className="font-semibold text-text-muted">{fact.label}</span>
                      <span className="font-bold text-text-primary text-right">{fact.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Map Preview Widget */}
              <div className="rounded-xl border border-[#e2bfb0] bg-white overflow-hidden shadow-sm">
                <div className="p-6 border-b border-[#ebdcd0]">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-text-primary">District Location</h4>
                </div>
                <div className="h-48 relative bg-background-surface">
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
          <section className="animate-reveal [animation-delay:200ms] space-y-6">
            <div className="rounded-xl border border-[#e2bfb0] bg-white p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#ebdcd0]">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-text-primary">Market Reviews & Feedback</h2>
                  <p className="text-xs text-text-muted mt-1">Verified buyer reviews for orders fulfilled at {market.name}.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">4.9</p>
                    <p className="text-[9px] font-mono uppercase text-text-muted font-bold">Global Rating</p>
                  </div>
                </div>
              </div>

              {/* Stitch Review Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Review 1 */}
                <div className="bg-background-surface p-5 rounded-lg border-l-4 border-primary space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-center">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-primary border border-[#e2bfb0]">JN</div>
                      <div>
                        <p className="text-xs font-bold text-text-primary">Jean-Paul N.</p>
                        <p className="text-[10px] text-text-muted font-semibold">2 hours ago • Verified Purchase</p>
                      </div>
                    </div>
                    <div className="flex text-accent-premium gap-0.5">
                      {[1, 2, 3, 4, 5].map(star => <Star key={star} size={14} className="fill-current" />)}
                    </div>
                  </div>
                  <p className="text-xs md:text-sm leading-relaxed text-text-secondary">The Nyamirambo Hub continues to be the most reliable market for bulk grains. The RMF verification on the sellers really makes a difference in trade confidence.</p>
                </div>

                {/* Review 2 */}
                <div className="bg-background-surface p-5 rounded-lg border-l-4 border-outline space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-center">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-primary border border-[#e2bfb0]">AM</div>
                      <div>
                        <p className="text-xs font-bold text-text-primary">Alice M.</p>
                        <p className="text-[10px] text-text-muted font-semibold">Yesterday • Verified Purchase</p>
                      </div>
                    </div>
                    <div className="flex text-accent-premium gap-0.5">
                      {[1, 2, 3, 4].map(star => <Star key={star} size={14} className="fill-current" />)}
                      <Star size={14} />
                    </div>
                  </div>
                  <p className="text-xs md:text-sm leading-relaxed text-text-secondary">Great fresh produce, although parking at the physical hub was a bit tight. Using the RMF delivery service was much smoother for my second order.</p>
                </div>
              </div>

              {/* Dynamic Database Reviews */}
              {marketReviews.length > 0 && (
                <div className="space-y-4 pt-6 border-t border-border-light">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-4">All Customer Reviews</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {marketReviews.map((review: any) => (
                      <div key={review._id} className="rounded-xl border border-border-light bg-white p-5 shadow-sm space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-bold text-text-primary">{review.buyerName || 'Verified buyer'}</p>
                            <p className="text-[10px] text-text-muted font-semibold">{new Date(review.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-1 text-accent-premium">
                            <Star size={12} className="fill-current" />
                            <span className="text-xs font-mono font-bold text-text-primary">{review.rating}</span>
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed text-text-muted">{review.comment || 'Great marketplace with fast delivery.'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {isFullMap && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-[#e0e0e0] bg-white px-6 py-4 shadow-sm">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff6b00]">{market.name}</p>
              <h2 className="text-2xl font-black text-[#1b1c1c]">Delivery map</h2>
            </div>
            <button
              onClick={() => setIsFullMap(false)}
              className="rounded-md bg-[#e05300] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ff6b00]"
            >
              Close
            </button>
          </div>
          <div className="relative flex-1 bg-[#fcf9f8]">
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
