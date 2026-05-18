'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight, BadgeCheck, Clock3, MapPin, PackageCheck, Search, ShieldCheck, SlidersHorizontal, Star, Store, Truck } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { ProductCard } from '@/components/ui/ProductCard';
import { useApi } from '@/hooks/useApi';
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

export default function MarketPage({ params }: { params: { slug: string } }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [isFullMap, setIsFullMap] = useState(false);
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'shop' | 'about' | 'reviews'>('shop');

  const { data: market, loading: marketLoading, execute: fetchMarket } = useApi(marketApi, 'get', `/markets/slug/${params.slug}`);
  const { data: marketReviewsData } = useApi(reviewApi, 'get', market?._id ? `/reviews/target/market/${market._id}` : '');

  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [facets, setFacets] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarket();
  }, [params.slug, fetchMarket]);

  useEffect(() => {
    if (!market?._id) return;
    setLoading(true);
    Promise.all([
      productApi.get(`/products?marketId=${market._id}&isActive=true&isApproved=true&limit=1000`),
      productApi.get(`/products?marketId=${market._id}&isActive=true&isApproved=true&hasPromotion=true&limit=8`),
      productApi.get(`/products/catalog/facets?marketId=${market._id}&isActive=true&isApproved=true&limit=1000`),
    ])
      .then(([prodRes, promRes, facetRes]) => {
        setAllProducts(prodRes.data?.data || []);
        setPromotions(promRes.data?.data || []);
        setFacets(facetRes.data?.data || null);
      })
      .finally(() => setLoading(false));
  }, [market?._id]);

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
      <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-10 space-y-12 pb-24">
        <section className="animate-reveal relative overflow-hidden rounded-3xl border border-border-premium bg-slate-950 shadow-2xl cinematic-shadow min-h-[440px] flex flex-col justify-end">
          {/* Cover image */}
          <img src={imageUrl} className="absolute inset-0 h-full w-full object-cover opacity-60" alt={market.name} />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/20 md:bg-gradient-to-r md:from-slate-950 md:via-slate-950/80 md:to-transparent" />
          
          {/* Inner Grid for content */}
          <div className="relative z-10 grid gap-8 p-8 md:p-12 lg:grid-cols-[1.3fr_0.7fr] items-end h-full flex-grow">
            
            {/* Left Column: Market Info */}
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border border-white/10 text-white shadow-md">
                  <BadgeCheck size={14} className="text-accent-premium" />
                  Verified Market
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border border-white/10 shadow-md ${open ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : 'bg-red-500/20 text-red-400 border-red-500/20'}`}>
                  <Clock3 size={14} />
                  {open ? 'Open now' : 'Closed now'}
                </span>
                {market.location?.address && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border border-white/10 text-white shadow-md">
                    <MapPin size={14} className="text-primary-light" />
                    {market.location.address}
                  </span>
                )}
              </div>
              
              <div className="space-y-4">
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white leading-none">
                  {market.name}
                </h1>
                <p className="max-w-2xl text-base md:text-lg leading-relaxed text-white/70 font-medium line-clamp-2 md:line-clamp-3">
                  {market.description || 'Shop fresh produce, everyday essentials, and local goods from verified sellers.'}
                </p>
              </div>
            </div>

            {/* Right Column: Glassmorphic Stats Tray */}
            <div className="w-full rounded-2xl border border-white/10 bg-white/[0.07] backdrop-blur-xl p-6 shadow-2xl space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Store, label: 'Sellers', value: sellers },
                  { icon: PackageCheck, label: 'Products', value: productsCount },
                  { icon: Star, label: 'Rating', value: market.rating ? Number(market.rating).toFixed(1) : 'New', isGold: true },
                  { icon: Truck, label: 'Delivery', value: 'Live' },
                ].map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <div key={idx} className="bg-white/[0.04] border border-white/5 rounded-xl p-4 transition-all duration-300 hover:bg-white/[0.08] hover:border-white/10">
                      <Icon size={16} className={stat.isGold ? 'text-accent-premium' : 'text-primary-light'} />
                      <p className="mt-2 text-2xl font-extrabold tracking-tight text-white">{stat.value}</p>
                      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-white/50">{stat.label}</p>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setIsFullMap(true)}
                className="w-full flex min-h-[3rem] items-center justify-center gap-2 rounded-xl bg-primary px-6 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30"
              >
                View Delivery Network Map →
              </button>
            </div>
            
          </div>
        </section>

        {/* Immersive Storefront Navigation Tabs */}
        <div className="flex border-b border-border-light pb-px overflow-x-auto gap-8 text-sm font-bold uppercase tracking-wider scrollbar-hide pt-4">
          {[
            { id: 'shop', label: 'Shop Products', count: filteredProducts.length },
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

        {activeTab === 'shop' && (
          <section className="animate-reveal [animation-delay:200ms] grid gap-8 lg:grid-cols-[18rem_1fr]">
            <aside className="space-y-6 sticky top-24 lg:ml-6 xl:ml-8">
              <div className="rounded-2xl border border-border-light bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-primary">
                  <SlidersHorizontal size={18} className="text-primary" />
                  Filters
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-text-muted">Search products</label>
                    <div className="relative mt-2">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                      <input
                        type="text"
                        placeholder="Find an item..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="rmf-input pl-11 w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-text-muted">Price range</label>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <input type="number" placeholder="Min" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="rmf-input w-full" />
                      <input type="number" placeholder="Max" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="rmf-input w-full" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border-light bg-white p-6 shadow-sm">
                <p className="mb-5 text-xs font-bold uppercase tracking-widest text-text-primary">Categories</p>
                <nav className="flex flex-col gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setSelectedCategory(cat); setAttributeFilters({}); }}
                      className={`rounded-xl border px-4 py-3 text-left text-xs font-bold uppercase tracking-widest transition-all duration-300 ${selectedCategory === cat
                          ? 'border-primary bg-primary text-white shadow-md shadow-primary/20'
                          : 'border-border-light bg-background-surface text-text-secondary hover:border-primary hover:text-primary'
                        }`}
                    >
                      {cat === 'all' ? 'All products' : facets?.categories?.find((category: any) => category.id === cat)?.label || cat}
                    </button>
                  ))}
                </nav>
              </div>

              {activeFacetGroups.length > 0 && (
                <div className="rounded-2xl border border-border-light bg-white p-6 shadow-sm">
                  <p className="mb-5 text-xs font-bold uppercase tracking-widest text-text-primary">Product details</p>
                  <div className="space-y-4">
                    {activeFacetGroups.flatMap((group: any) => group.fields || []).slice(0, 8).map((field: any) => (
                      <label key={field.key} className="block">
                        <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-text-muted">{field.label}</span>
                        <select value={attributeFilters[field.key] || ''} onChange={e => updateAttributeFilter(field.key, e.target.value)} className="rmf-select w-full">
                          <option value="">Any</option>
                          {((field.values?.length ? field.values.map((item: any) => item.value) : field.options) || []).map((value: string) => (
                            <option key={value} value={value}>{value}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-primary">
                <ShieldCheck size={28} className="text-accent-premium mb-3" />
                <p className="text-sm font-bold tracking-tight">Buyer protection</p>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">Payments stay traceable, and support can review delivery or quality issues.</p>
              </div>
            </aside>

            <main className="space-y-10">
              {selectedCategory === 'all' && !searchQuery && (
                <div className="animate-reveal [animation-delay:400ms] space-y-10 mb-10">
                  <ProductRail title="Promotions from this market" eyebrow="Deals" products={promotions} isPromotion={true} />
                  <ProductRail title="Most bought today" eyebrow="Customer demand" products={mostBoughtProducts} />
                  <ProductRail title="Highly reviewed picks" eyebrow="Buyer rated" products={highlyReviewedProducts} />
                </div>
              )}

              <section className="animate-reveal [animation-delay:600ms]">
                <div className="mb-6 flex flex-col justify-between gap-4 border-b border-border-light pb-6 md:flex-row md:items-end">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-primary">Market shelf</p>
                    <h2 className="mt-2 text-3xl font-bold tracking-tight text-text-primary">
                      {selectedCategory === 'all' ? 'All products' : facets?.categories?.find((category: any) => category.id === selectedCategory)?.label || selectedCategory}
                    </h2>
                  </div>
                  <p className="text-sm font-bold text-text-muted">{filteredProducts.length} items</p>
                </div>

                {loading ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => <div key={i} className="h-[320px] animate-pulse rounded-xl border border-border-light bg-background-surface" />)}
                  </div>
                ) : filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6">
                    {filteredProducts.map(product => (
                      <ProductCard key={product._id} product={product} isCompact={true} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border-light bg-white p-12 text-center shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-widest text-primary">No items found</p>
                    <h3 className="mt-4 text-2xl font-bold text-text-primary">Try adjusting your search or filters.</h3>
                  </div>
                )}
              </section>
            </main>
          </section>
        )}

        {activeTab === 'about' && (
          <section className="animate-reveal [animation-delay:200ms] grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
            {/* Story & Background */}
            <div className="space-y-8">
              <div className="rounded-3xl border border-border-light bg-white p-8 md:p-10 shadow-sm space-y-6">
                <h3 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-3">
                  <span className="w-1.5 h-6 bg-primary rounded-full animate-pulse"></span>
                  Welcome to {market.name}
                </h3>
                <p className="text-base md:text-lg leading-relaxed text-text-secondary font-medium">
                  {market.description || 'This market is one of Rwanda\'s verified local trading hubs, connecting local merchants directly with you.'}
                </p>
                <div className="rounded-2xl bg-background-surface/50 border border-border-light/40 p-6 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">Heritage & Community Impact</p>
                  <p className="text-sm leading-relaxed text-text-muted font-normal">
                    Every purchase you make directly supports local sellers, artisan families, and agricultural cooperatives based in the {market.name} district. By shopping here, you help sustain traditional craftsmanship, organic agriculture, and local economic resilience.
                  </p>
                </div>
              </div>

              {/* Buyer Guidelines Card */}
              <div className="rounded-3xl border border-border-light bg-white p-8 md:p-10 shadow-sm space-y-6">
                <h3 className="text-2xl font-bold tracking-tight text-text-primary">Shopping & Delivery Guidelines</h3>
                <div className="grid gap-6 sm:grid-cols-2">
                  {[
                    { title: 'Secure MoMo Checkout', desc: 'Pay safely with MTN Mobile Money. Funds are kept secure under our buyer protection scheme until your delivery is complete.' },
                    { title: 'Price Negotiation', desc: 'Look for products with the ⚡ Negotiable badge to start a price agreement chat directly with the vendor.' },
                    { title: 'Tracked Courier Network', desc: 'Our dedicated local riders ensure fast, reliable delivery straight to your location with real-time tracking.' },
                    { title: 'Verified Quality', desc: 'Every vendor is officially registered and vetted by market administration to ensure premium quality standards.' },
                  ].map((guide, idx) => (
                    <div key={idx} className="space-y-2">
                      <p className="text-sm font-bold text-text-primary flex items-center gap-2">
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
              <div className="rounded-3xl border border-border-light bg-white p-6 shadow-sm space-y-6">
                <h4 className="text-sm font-bold uppercase tracking-widest text-text-primary border-b border-border-light pb-4">Operational Facts</h4>
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
              <div className="rounded-3xl border border-border-light bg-white overflow-hidden shadow-sm">
                <div className="p-6 border-b border-border-light">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-text-primary">District Location</h4>
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

        {activeTab === 'reviews' && (
          <section className="animate-reveal [animation-delay:200ms] space-y-6">
            <div className="rounded-3xl border border-border-light bg-white p-8 md:p-10 shadow-sm space-y-6">
              <div className="mb-8 border-b border-border-light pb-6">
                <h2 className="text-2xl font-bold tracking-tight text-text-primary">Market Reviews & Feedback</h2>
                <p className="text-sm text-text-muted mt-2">Verified buyer reviews for orders fulfilled at {market.name}.</p>
              </div>

              {marketReviews.length === 0 ? (
                <div className="rounded-2xl border border-border-light bg-background-surface p-12 text-center">
                  <p className="text-sm font-medium text-text-muted">No reviews yet. Reviews will appear after completed orders.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {marketReviews.map((review: any) => (
                    <div key={review._id} className="rounded-2xl border border-border-light bg-white p-6 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-text-primary">{review.buyerName || 'Verified buyer'}</p>
                          <p className="mt-1.5 text-xs font-bold uppercase tracking-widest text-text-muted">{new Date(review.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-accent-premium">
                          <Star size={16} className="fill-current" />
                          <span className="text-sm font-bold text-text-primary">{review.rating}</span>
                        </div>
                      </div>
                      <p className="mt-5 text-sm leading-relaxed text-text-muted">{review.comment || 'Great marketplace with fast delivery.'}</p>
                    </div>
                  ))}
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
