'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Layout } from '@/components/layout/Layout';
import { MarketCard } from '@/components/ui/MarketCard';
import { ProductCard } from '@/components/ui/ProductCard';
import { useApi } from '@/hooks/useApi';
import { marketApi, productApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { MapPin, PackageCheck, Search, ShieldCheck, SlidersHorizontal, Sparkles, WifiOff } from 'lucide-react';

const RiderMap = dynamic(() => import('@/components/ui/RiderMap').then(mod => mod.RiderMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#f0eded]" />,
});

interface Market {
  _id: string;
  name: string;
  slug: string;
  type?: string;
  imageUrl?: string;
  image?: string;
  description?: string;
  rating?: number;
  productRatingSum?: number;
  totalOrders?: number;
  activeProducts?: number;
  totalSellers?: number;
  createdAt?: string;
  location?: {
    address?: string;
    coordinates?: [number, number];
  };
  operatingHours?: {
    open?: string;
    close?: string;
    daysOpen?: string[];
  };
}

interface Product {
  _id: string;
  name: string;
  price: number;
  unit: string;
  images: string[];
  inStock: boolean;
  category?: string;
  rating?: number;
  totalOrders?: number;
  stockType?: 'finite' | 'infinite' | 'on_demand';
  isMadeInRwanda?: boolean;
  isNegotiable?: boolean;
  marketId?: string | {
    _id?: string;
    slug?: string;
    name?: string;
  };
  sellerId?: string | {
    _id?: string;
    userId?: string;
    stallId?: string;
    stallName?: string;
    shopDetails?: {
      name?: string;
    };
  };
  promotion?: {
    type: 'percentage' | 'fixed_amount';
    discount: number;
    promotedPrice: number;
  };
}

const previewMarkets: Market[] = [
  {
    _id: 'preview-kimironko',
    name: 'Kimironko Market',
    description: 'Fresh produce, pantry essentials, and verified local sellers.',
    location: { address: 'Kigali' },
    image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&q=80&w=900',
    totalSellers: 45,
    activeProducts: 180,
    slug: 'kimironko-market',
  },
  {
    _id: 'preview-nyabugogo',
    name: 'Nyabugogo Market',
    description: 'Everyday household goods and delivery-ready orders.',
    location: { address: 'Kigali' },
    image: 'https://images.unsplash.com/photo-1506617564039-2f3b650b7010?auto=format&fit=crop&q=80&w=900',
    totalSellers: 32,
    activeProducts: 120,
    slug: 'nyabugogo-market',
  },
  {
    _id: 'preview-artisan',
    name: 'Local Artisan Shops',
    description: 'Made in Rwanda goods from verified local makers.',
    location: { address: 'Rwanda' },
    image: 'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&q=80&w=900',
    totalSellers: 28,
    activeProducts: 90,
    slug: 'local-artisan-shops',
  },
];

const catalogShortcuts = [
  { label: 'Made in Rwanda', value: 'Made in Rwanda' },
  { label: 'Food', value: 'Food' },
  { label: 'Crafts', value: 'Crafts' },
  { label: 'Textiles', value: 'Textiles' },
];

const isMadeInRwandaSearch = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return ['made in rwanda', 'made-in-rwanda', 'made_in_rwanda', 'rwanda made', 'rwandan made', 'shop local', 'local artisans']
    .some(token => normalized.includes(token));
};

const getProductMarketId = (product: Product) => {
  if (!product.marketId) return '';
  return typeof product.marketId === 'object' ? product.marketId._id || '' : product.marketId;
};

const getProductQueryPath = (searchQuery: string, productCategory: string, attributeFilters: Record<string, string>, priceRange: { min: string; max: string }) => {
  const params = new URLSearchParams({
    limit: '24',
    isActive: 'true',
    sortBy: '-totalOrders',
  });
  const trimmedSearch = searchQuery.trim();

  if (isMadeInRwandaSearch(trimmedSearch)) {
    params.set('isMadeInRwanda', 'true');
  } else if (trimmedSearch) {
    params.set('search', trimmedSearch);
  }
  if (productCategory !== 'all') params.set('categoryId', productCategory);
  if (priceRange.min) params.set('minPrice', priceRange.min);
  if (priceRange.max) params.set('maxPrice', priceRange.max);
  Object.entries(attributeFilters).forEach(([key, value]) => {
    if (value) params.set(`attributes.${key}`, value);
  });

  return `/products?${params.toString()}`;
};

const getFacetQueryPath = (searchQuery: string) => {
  const params = new URLSearchParams({ limit: '1000', isActive: 'true' });
  const trimmedSearch = searchQuery.trim();
  if (isMadeInRwandaSearch(trimmedSearch)) params.set('isMadeInRwanda', 'true');
  else if (trimmedSearch) params.set('search', trimmedSearch);
  return `/products/catalog/facets?${params.toString()}`;
};

const getSimilarity = (s1: string, s2: string): number => {
  const n1 = s1.toLowerCase().trim();
  const n2 = s2.toLowerCase().trim();
  if (n1 === n2) return 1;
  if (n1.includes(n2) || n2.includes(n1)) return 0.7;
  
  const getBigrams = (str: string) => {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(n1);
  const b2 = getBigrams(n2);
  if (b1.size === 0 || b2.size === 0) return 0;
  
  let intersection = 0;
  Array.from(b1).forEach(b => {
    if (b2.has(b)) intersection++;
  });
  return (2 * intersection) / (b1.size + b2.size);
};

const getDistanceKm = (fromLat: number, fromLng: number, coordinates?: [number, number]) => {
  if (!coordinates || coordinates.length < 2) return Number.POSITIVE_INFINITY;
  const [lng, lat] = coordinates;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat - fromLat);
  const dLng = toRad(lng - fromLng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(fromLat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function MarketsContent() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedProductCategory, setSelectedProductCategory] = useState('all');
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string>>({});
  
  const searchParams = useSearchParams();
  const search = searchParams.get('search');
  const requestedLocation = searchParams.get('location') || '';
  const requestedLat = Number(searchParams.get('lat'));
  const requestedLng = Number(searchParams.get('lng'));
  const hasCoordinateSearch = Number.isFinite(requestedLat) && Number.isFinite(requestedLng);
  const productQueryPath = useMemo(() => getProductQueryPath(searchQuery, selectedProductCategory, attributeFilters, priceRange), [attributeFilters, searchQuery, selectedProductCategory, priceRange]);
  const facetQueryPath = useMemo(() => getFacetQueryPath(searchQuery), [searchQuery]);
  
  const { data: marketsData, loading, error, execute: fetchMarkets } = useApi<Market[]>(marketApi, 'get', '/markets?activeOnly=true');
  const { data: productsData, loading: productsLoading, error: productsError } = useApi<Product[]>(productApi, 'get', productQueryPath);
  const { data: facetsData } = useApi<any>(productApi, 'get', facetQueryPath);

  useEffect(() => {
    fetchMarkets();
    if (search) {
      setSearchQuery(search);
    } else if (requestedLocation && requestedLocation.toLowerCase() !== 'near me') {
      setSearchQuery(requestedLocation);
    }
  }, [fetchMarkets, requestedLocation, search]);

  const allMarkets = useMemo(() => Array.isArray(marketsData) ? marketsData : [], [marketsData]);
  const matchingProducts = useMemo(
    () => (Array.isArray(productsData) ? productsData : []).filter(product => product.images?.length),
    [productsData]
  );
  const productMarketIds = useMemo(() => {
    const ids = new Set<string>();
    matchingProducts.forEach(product => {
      const marketId = getProductMarketId(product);
      if (marketId) ids.add(marketId);
    });
    return ids;
  }, [matchingProducts]);
  const hasSearch = Boolean(searchQuery.trim());
  const madeInRwandaIntent = isMadeInRwandaSearch(searchQuery);
  const facets = facetsData || { categories: [], attributes: [] };
  const activeAttributeGroups = useMemo(
    () => (facets.attributes || []).filter((group: any) => selectedProductCategory === 'all' || group.id === selectedProductCategory),
    [facets.attributes, selectedProductCategory]
  );

  const updateAttributeFilter = (key: string, value: string) => {
    setAttributeFilters(prev => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const filteredMarkets = useMemo(() => {
    let results = allMarkets;
    
    // 1. Search Query (Fuzzy)
    if (searchQuery.trim()) {
      results = results.filter((market: Market) => {
        const nameSim = getSimilarity(market.name, searchQuery);
        const descSim = market.description ? getSimilarity(market.description, searchQuery) : 0;
        const addrSim = market.location?.address ? getSimilarity(market.location.address, searchQuery) : 0;
        const productMatch = productMarketIds.has(market._id);
        return (nameSim > 0.3 || descSim > 0.3 || addrSim > 0.3 || productMatch);
      });
    }

    // 2. Filter markets by matching products in price range
    if (priceRange.min || priceRange.max) {
      results = results.filter((market: Market) => productMarketIds.has(market._id));
    }

    // 3. Market Type
    if (selectedCategory !== 'ALL') {
      const typeMap: Record<string, string> = {
        'INDIVIDUAL': 'individual',
        'PUBLIC': 'public',
      };
      const targetType = typeMap[selectedCategory];
      results = results.filter((m: Market) => m.type === targetType);
    }

    if (hasCoordinateSearch) {
      results = [...results].sort((a, b) => (
        getDistanceKm(requestedLat, requestedLng, a.location?.coordinates)
        - getDistanceKm(requestedLat, requestedLng, b.location?.coordinates)
      ));
    }

    return results;
  }, [allMarkets, hasCoordinateSearch, productMarketIds, requestedLat, requestedLng, searchQuery, selectedCategory, priceRange]);

  const liveDataUnavailable = Boolean(error);
  const productDataUnavailable = Boolean(productsError);
  const marketsToRender = liveDataUnavailable ? previewMarkets : filteredMarkets;
  const showCatalogResults = hasSearch || madeInRwandaIntent || Boolean(priceRange.min) || Boolean(priceRange.max);

  // Derived market categories for shelves from actual DB data
  const newMarkets = useMemo(() => [...marketsToRender].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 6), [marketsToRender]);
  const topSellersMarkets = useMemo(() => [...marketsToRender].sort((a, b) => (b.totalOrders || 0) - (a.totalOrders || 0)).slice(0, 6), [marketsToRender]);
  const topRatedMarkets = useMemo(() => [...marketsToRender].sort((a, b) => {
    const aScore = (a.rating || 0) + (a.productRatingSum || 0);
    const bScore = (b.rating || 0) + (b.productRatingSum || 0);
    return bScore - aScore;
  }).slice(0, 6), [marketsToRender]);
  const promotionalMarkets = useMemo(() => [...marketsToRender].sort(() => Math.random() - 0.5).slice(0, 6), [marketsToRender]);

  const MarketShelf = ({ title, description, markets }: { title: string, description: string, markets: Market[] }) => (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold tracking-tight text-text-primary">{title}</h3>
        <p className="text-sm font-medium text-text-muted mt-1">{description}</p>
      </div>
      <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x">
        {markets.map((market, idx) => (
          <div key={`${market._id}-${idx}`} className="min-w-[280px] max-w-[300px] flex-shrink-0 snap-start">
            <MarketCard market={market} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-10 pb-20">
        <section className="animate-reveal rounded-2xl border border-border-premium premium-gradient p-8 shadow-xl cinematic-shadow md:p-12 text-white">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold tracking-wide text-primary-light backdrop-blur-md border border-white/10">
                <ShieldCheck size={18} className="text-accent-premium" />
                Verified local markets
              </div>
              <h1 className="max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-6xl">
                Find a trusted market <span className="text-accent-premium">before</span> you order.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70">
                Search by market name, location, or seller type. RMF keeps seller identity and delivery readiness visible before checkout.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-6 py-5 min-w-[200px]">
              <p className="text-5xl font-bold text-accent-premium">{marketsToRender.length}</p>
              <p className="mt-1 text-sm font-medium text-white/60">Markets shown</p>
              {showCatalogResults && (
                <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-light">{matchingProducts.length} products</p>
              )}
            </div>
          </div>
        </section>

        {requestedLocation && (
          <div className="animate-reveal [animation-delay:100ms] flex items-start gap-4 rounded-xl border border-primary/20 bg-primary/5 p-5 text-primary">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
              <MapPin size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest">Location filter active</p>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-text-muted">
                Showing markets for {requestedLocation}. {hasCoordinateSearch ? 'Markets with coordinates are sorted by distance from your current map position.' : 'The directory checks market names, descriptions, and addresses for this area.'}
              </p>
            </div>
          </div>
        )}

        {liveDataUnavailable && (
          <div className="animate-reveal [animation-delay:100ms] flex items-start gap-4 rounded-xl border border-accent-premium/30 bg-accent-premium/5 p-5 text-text-primary">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-accent-premium/20 text-accent-premium">
              <WifiOff size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-accent-premium">Live markets are offline</p>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-text-muted">Preview markets are shown until the market service and database are reachable.</p>
            </div>
          </div>
        )}

        {productDataUnavailable && showCatalogResults && (
          <div className="animate-reveal [animation-delay:100ms] flex items-start gap-4 rounded-xl border border-accent-premium/30 bg-accent-premium/5 p-5 text-text-primary">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-accent-premium/20 text-accent-premium">
              <WifiOff size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-accent-premium">Catalog products are offline</p>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-text-muted">Related markets are shown, but product results need the product service and database.</p>
            </div>
          </div>
        )}

        <section className="animate-reveal [animation-delay:200ms] rounded-2xl border border-border-light bg-white p-5 shadow-sm md:p-8">
          <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-primary">
            <SlidersHorizontal size={18} className="text-primary" />
            Search and filters
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_0.62fr_0.68fr]">
            <div className="space-y-3">
              <label className="text-xs font-bold text-text-muted">Search markets and products</label>
              <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                  <input 
                    placeholder={t('home_search_placeholder') || "Search markets..."} 
                    className="rmf-input pl-11 w-full" 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {catalogShortcuts.map(shortcut => (
                  <button
                    key={shortcut.value}
                    onClick={() => setSearchQuery(shortcut.value)}
                    className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-all duration-300 ${
                      searchQuery === shortcut.value ? 'border-primary bg-primary text-white shadow-md shadow-primary/20' : 'border-border-light bg-background-surface text-text-secondary hover:border-primary hover:text-primary'
                    }`}
                  >
                    {shortcut.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => { setSelectedProductCategory('all'); setAttributeFilters({}); }}
                  className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-all duration-300 ${selectedProductCategory === 'all' ? 'border-primary bg-primary text-white shadow-md shadow-primary/20' : 'border-border-light bg-white text-text-secondary hover:border-primary hover:text-primary'}`}
                >
                  All categories
                </button>
                {(facets.categories || []).map((category: any) => (
                  <button
                    key={category.id}
                    onClick={() => { setSelectedProductCategory(category.id); setAttributeFilters({}); }}
                    className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-all duration-300 ${selectedProductCategory === category.id ? 'border-primary bg-primary text-white shadow-md shadow-primary/20' : 'border-border-light bg-white text-text-secondary hover:border-primary hover:text-primary'}`}
                  >
                    {category.label} ({category.count})
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-text-secondary">Price range (RWF)</label>
              <div className="grid grid-cols-2 gap-3">
                  <input 
                    placeholder="Min" 
                    className="rmf-input" 
                    type="number" 
                    value={priceRange.min}
                    onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                  />
                  <input 
                    placeholder="Max" 
                    className="rmf-input" 
                    type="number" 
                    value={priceRange.max}
                    onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                  />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-text-muted">Market type</label>
              <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'ALL', label: 'All' },
                    { key: 'PUBLIC', label: 'Public' },
                    { key: 'INDIVIDUAL', label: 'Shops' },
                  ].map(cat => (
                    <button 
                      key={cat.key}
                      onClick={() => setSelectedCategory(cat.key)}
                      className={`h-12 rounded-xl border text-xs font-bold transition-all duration-300 ${
                        selectedCategory === cat.key ? 'border-primary bg-primary text-white shadow-md shadow-primary/20' : 'border-border-light bg-white text-text-secondary hover:border-primary hover:text-primary'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {activeAttributeGroups.length > 0 && (
            <div className="mt-5 grid gap-4 border-t border-border-light/50 pt-5 md:grid-cols-2 xl:grid-cols-4">
              {activeAttributeGroups.flatMap((group: any) => group.fields || []).slice(0, 8).map((field: any) => (
                <label key={`${field.key}-${field.label}`} className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-text-muted">{field.label}</span>
                  {field.type === 'boolean' ? (
                    <select value={attributeFilters[field.key] || ''} onChange={e => updateAttributeFilter(field.key, e.target.value)} className="rmf-select w-full">
                      <option value="">Any</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <select value={attributeFilters[field.key] || ''} onChange={e => updateAttributeFilter(field.key, e.target.value)} className="rmf-select w-full">
                      <option value="">Any</option>
                      {((field.values?.length ? field.values.map((item: any) => item.value) : field.options) || []).map((value: string) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  )}
                </label>
              ))}
            </div>
          )}
        </section>

        {showCatalogResults && (
          <section className="animate-reveal [animation-delay:400ms] rounded-2xl border border-border-light bg-white p-6 shadow-sm md:p-8">
            <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
                  {madeInRwandaIntent ? <Sparkles size={18} /> : <PackageCheck size={18} />}
                  {madeInRwandaIntent ? 'Origin-tagged catalog' : 'Product results'}
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
                  {madeInRwandaIntent ? 'Made in Rwanda products' : `Products matching "${searchQuery.trim()}"`}
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-muted">
                  {madeInRwandaIntent
                    ? 'These products come from the product catalog using the Made in Rwanda flag, then RMF connects them back to the markets where they are sold.'
                    : 'Product search runs through the catalog and the market list is expanded with any markets selling matching products.'}
                </p>
              </div>
              <div className="rounded-xl border border-border-light bg-background-surface px-6 py-4 min-w-[160px]">
                <p className="text-4xl font-bold text-primary">{matchingProducts.length}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-text-muted">Products found</p>
              </div>
            </div>

            {productsLoading ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-[380px] animate-pulse rounded-2xl border border-border-light bg-background-surface" />
                ))}
              </div>
            ) : matchingProducts.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6">
                {matchingProducts.map(product => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border-light bg-background-surface p-12 text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">No matching products yet</p>
                <h3 className="mt-4 text-2xl font-bold text-text-primary">
                  {madeInRwandaIntent ? 'Mark products as Made in Rwanda to fill this catalog.' : 'Try a different product, category, or market search.'}
                </h3>
                <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-text-muted">
                  The catalog is connected; the product service just did not return matching active products for this query.
                </p>
              </div>
            )}
          </section>
        )}

        {!showCatalogResults && !loading && marketsToRender.length > 0 && (
          <section className="animate-reveal [animation-delay:500ms] space-y-10">
            <MarketShelf 
              title="New Markets" 
              description="Recently joined markets ready for your orders." 
              markets={newMarkets} 
            />
            <MarketShelf 
              title="Most Bought From" 
              description="High-volume markets with the most active sellers." 
              markets={topSellersMarkets} 
            />
            <MarketShelf 
              title="Most Reviewed" 
              description="Consistently highly rated markets by our community." 
              markets={topRatedMarkets} 
            />
            <MarketShelf 
              title="Active Promotions" 
              description="Markets currently offering discounts and special deals." 
              markets={promotionalMarkets} 
            />
          </section>
        )}

        <main className="animate-reveal [animation-delay:600ms] space-y-8 border-t border-border-light pt-8 mt-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Marketplace directory</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-text-primary md:text-4xl">Markets ready for browsing</h2>
            </div>
            <p className="text-sm font-bold text-text-muted">{marketsToRender.length} results</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="aspect-[4/5] bg-background-surface animate-pulse border border-border-light rounded-2xl"></div>
              ))}
            </div>
          ) : marketsToRender.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
              {marketsToRender.map((market: Market, idx: number) => (
                <MarketCard 
                  key={market._id} 
                  market={market} 
                  index={idx} 
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border-light bg-white p-12 text-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">No matching markets</p>
              <h3 className="mt-4 text-2xl font-bold text-text-primary">Try a different search or seller range.</h3>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-text-muted">
                Live market data is connected; there just are not any markets matching the current filters.
              </p>
            </div>
          )}
        </main>

        <section className="animate-reveal [animation-delay:800ms] overflow-hidden rounded-2xl border border-border-light bg-white shadow-xl cinematic-shadow">
          <div className="grid gap-0 lg:grid-cols-[0.38fr_0.62fr]">
            <div className="flex flex-col justify-between gap-8 border-b border-border-light/50 bg-background-surface p-8 lg:border-b-0 lg:border-r md:p-12">
              <div>
                <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
                  <MapPin size={24} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Market map</p>
                <h2 className="mt-4 text-3xl font-bold leading-[1.2] tracking-tight text-text-primary md:text-4xl">See every verified hub on the logistics map.</h2>
                <p className="mt-6 text-base leading-relaxed text-text-muted">
                  Market locations are loaded from the live market service. Switch map layers to inspect market coverage before choosing where to shop.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border-light bg-white p-5 shadow-sm">
                  <p className="text-3xl font-bold text-text-primary">{allMarkets.length || marketsToRender.length}</p>
                  <p className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-text-muted">Mapped hubs</p>
                </div>
                <div className="rounded-xl border border-border-light bg-white p-5 shadow-sm">
                  <p className="text-3xl font-bold text-text-primary flex items-center gap-2">Live <span className="flex h-2.5 w-2.5 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-premium opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-premium"></span></span></p>
                  <p className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-text-muted">Rider layer</p>
                </div>
              </div>
            </div>
            <div className="h-[500px] bg-background-main md:h-[600px]">
              <RiderMap marketId="all-admin" centerLat={-1.9441} centerLng={30.0619} marketName="Rwanda markets" />
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}

export default function MarketsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fdfaf7] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-[#ff6b00] border-t-transparent rounded-full"></div>
      </div>
    }>
      <MarketsContent />
    </Suspense>
  );
}
