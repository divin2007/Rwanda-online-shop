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
}: {
  title: string;
  eyebrow: string;
  products: any[];
}) => {
  if (products.length === 0) return null;

  return (
    <section className="animate-reveal rounded-2xl border border-border-light bg-white p-6 shadow-sm md:p-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">{title}</h2>
        </div>
        <ArrowRight size={20} className="text-primary" />
      </div>
      <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x">
        {products.slice(0, 8).map(product => (
          <div key={product._id} className="w-[240px] shrink-0 sm:w-[260px] snap-start">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
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
    () => [...allProducts].sort((a, b) => Number(b.totalOrders || b.orders || 0) - Number(a.totalOrders || a.orders || 0)).slice(0, 8),
    [allProducts]
  );
  const highlyReviewedProducts = useMemo(
    () => [...allProducts].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0)).slice(0, 8),
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
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#1b4332]">Market not found</p>
          <h1 className="mt-4 text-4xl font-black text-[#1b1c1c]">This market is not available.</h1>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 pb-24">
        <section className="animate-reveal overflow-hidden rounded-2xl border border-border-light bg-white shadow-xl cinematic-shadow">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
            <div className="relative min-h-[28rem] bg-background-main">
              <img src={imageUrl} className="absolute inset-0 h-full w-full object-cover" alt={market.name} />
              <div className="absolute inset-0 bg-gradient-to-r from-primary-cinematic/95 via-primary-cinematic/70 to-transparent" />
              <div className="relative flex h-full min-h-[28rem] flex-col justify-end p-8 text-white md:p-12">
                <div className="mb-6 flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-widest backdrop-blur-md border border-white/20 text-white shadow-sm">
                    <BadgeCheck size={16} className="text-accent-premium" />
                    Verified market
                  </span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest backdrop-blur-md border border-white/20 shadow-sm ${open ? 'bg-white/95 text-primary' : 'bg-red-600/90 text-white border-red-500/20'}`}>
                    <Clock3 size={16} />
                    {open ? 'Open now' : 'Closed now'}
                  </span>
                </div>
                <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">{market.name}</h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/80">
                  {market.description || 'Shop fresh produce, everyday essentials, and local goods from verified sellers.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col justify-between p-8 md:p-10 bg-background-surface border-l border-border-light/50">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Store, label: 'Verified sellers', value: sellers },
                  { icon: PackageCheck, label: 'Live products', value: productsCount },
                  { icon: Star, label: 'Rating', value: market.rating ? Number(market.rating).toFixed(1) : 'New' },
                  { icon: Truck, label: 'Delivery', value: 'Available' },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="rounded-xl border border-border-light bg-white p-5 shadow-sm">
                      <Icon size={20} className="text-primary" />
                      <p className="mt-4 text-3xl font-bold tracking-tight text-text-primary">{stat.value}</p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-text-muted">{stat.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 rounded-xl border border-border-light bg-white p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-primary">{market.location?.address || 'Rwanda'}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-text-muted">Choose products below and checkout with tracked local delivery.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsFullMap(true)}
                className="mt-6 inline-flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold uppercase tracking-widest text-white shadow-md shadow-primary/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/30"
              >
                View delivery map
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>

        <section className="animate-reveal [animation-delay:200ms] grid gap-8 lg:grid-cols-[18rem_1fr]">
          <aside className="space-y-6 sticky top-24">
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
                <ProductRail title="Promotions from this market" eyebrow="Deals" products={promotions} />
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
                <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="h-[380px] animate-pulse rounded-2xl border border-border-light bg-background-surface" />)}
                </div>
              ) : filteredProducts.length > 0 ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6">
                  {filteredProducts.map(product => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border-light bg-white p-12 text-center shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">No items found</p>
                  <h3 className="mt-4 text-2xl font-bold text-text-primary">Try adjusting your search or filters.</h3>
                </div>
              )}
            </section>

            <section className="animate-reveal [animation-delay:800ms] border-t border-border-light pt-10">
              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Community voice</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-text-primary">Market reviews</h2>
              </div>

              {marketReviews.length === 0 ? (
                <div className="rounded-2xl border border-border-light bg-background-surface p-10 text-center">
                  <p className="text-sm font-medium text-text-muted">No reviews yet. Reviews will appear after completed orders.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
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
            </section>
          </main>
        </section>
      </div>

      {isFullMap && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-[#e0e0e0] bg-white px-6 py-4 shadow-sm">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1b4332]">{market.name}</p>
              <h2 className="text-2xl font-black text-[#1b1c1c]">Delivery map</h2>
            </div>
            <button
              onClick={() => setIsFullMap(false)}
              className="rounded-md bg-[#012d1d] px-5 py-3 text-sm font-black text-white transition hover:bg-[#012d1d]"
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
