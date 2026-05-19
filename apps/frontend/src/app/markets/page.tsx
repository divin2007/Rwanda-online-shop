'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Layout } from '@/components/layout/Layout';
import { MarketCard } from '@/components/ui/MarketCard';
import { ProductCard } from '@/components/ui/ProductCard';
import { useApi } from '@/hooks/useApi';
import { marketApi, productApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { MapPin, PackageCheck, Search, ShieldCheck, SlidersHorizontal, Sparkles, WifiOff, Clock, TrendingUp, Star, BadgePercent } from 'lucide-react';

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
  const hasProductFiltersActive = hasSearch || madeInRwandaIntent || selectedProductCategory !== 'all' || Object.keys(attributeFilters).length > 0 || Boolean(priceRange.min) || Boolean(priceRange.max);
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
    
    // 1. Search Query & Product Filters (Fuzzy + Exact match check)
    if (hasProductFiltersActive) {
      results = results.filter((market: Market) => {
        if (searchQuery.trim()) {
          const nameSim = getSimilarity(market.name, searchQuery);
          const descSim = market.description ? getSimilarity(market.description, searchQuery) : 0;
          const addrSim = market.location?.address ? getSimilarity(market.location.address, searchQuery) : 0;
          const productMatch = productMarketIds.has(market._id);
          return (nameSim > 0.3 || descSim > 0.3 || addrSim > 0.3 || productMatch);
        }
        return productMarketIds.has(market._id);
      });
    }

    // 2. Market Type
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
  }, [allMarkets, hasCoordinateSearch, productMarketIds, requestedLat, requestedLng, searchQuery, selectedCategory, hasProductFiltersActive]);

  const liveDataUnavailable = Boolean(error);
  const productDataUnavailable = Boolean(productsError);
  const marketsToRender = filteredMarkets;
  const showCatalogResults = hasProductFiltersActive;

  const promotionalMarketIds = useMemo(() => {
    const ids = new Set<string>();
    (Array.isArray(productsData) ? productsData : []).forEach(product => {
      if (product.promotion && (product.promotion.discount > 0 || product.promotion.promotedPrice > 0)) {
        const marketId = getProductMarketId(product);
        if (marketId) ids.add(marketId);
      }
    });
    return ids;
  }, [productsData]);

  // Derived market categories for shelves from actual DB data
  const newMarkets = useMemo(
    () => [...marketsToRender]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 6),
    [marketsToRender]
  );
  const topSellersMarkets = useMemo(
    () => [...marketsToRender]
      .filter(m => (m.totalOrders || 0) > 0)
      .sort((a, b) => (b.totalOrders || 0) - (a.totalOrders || 0))
      .slice(0, 6),
    [marketsToRender]
  );
  const topRatedMarkets = useMemo(
    () => [...marketsToRender]
      .filter(m => (m.rating || 0) > 0 || (m.productRatingSum || 0) > 0)
      .sort((a, b) => {
        const aScore = (a.rating || 0) + (a.productRatingSum || 0);
        const bScore = (b.rating || 0) + (b.productRatingSum || 0);
        return bScore - aScore;
      })
      .slice(0, 6),
    [marketsToRender]
  );
  const promotionalMarkets = useMemo(
    () => [...marketsToRender]
      .filter(m => promotionalMarketIds.has(m._id))
      .slice(0, 6),
    [marketsToRender, promotionalMarketIds]
  );

  // Helper to translate shortcut labels dynamically
  const getShortcutLabel = (value: string) => {
    switch (value) {
      case 'Made in Rwanda': return t('made_in_rwanda');
      case 'Food': return t('category_food');
      case 'Crafts': return t('category_crafts');
      case 'Textiles': return t('category_textiles');
      default: return value;
    }
  };

  const MarketShelf = ({ title, description, markets, isFullWidth = false }: { title: string, description: string, markets: Market[], isFullWidth?: boolean }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const theme = useMemo(() => {
      if (isFullWidth) {
        return {
          icon: <BadgePercent className="text-white shrink-0 animate-bounce" size={26} />,
          bg: 'bg-primary text-white relative overflow-hidden',
          border: 'border-2 border-primary shadow-xl shadow-primary/10',
          badge: 'bg-white/20 text-white border border-white/30 backdrop-blur-md font-black',
          glow: 'hover:scale-[1.01] hover:shadow-primary/20',
          textTitle: 'text-white',
          textDesc: 'text-white/90 leading-relaxed text-sm font-semibold max-w-xl'
        };
      }
      switch (title) {
        case 'New Markets':
        case 'Masoko Mashya':
        case 'Nouveaux Marchés':
          return {
            icon: <Clock className="text-orange-500 animate-pulse shrink-0" size={22} />,
            bg: 'bg-white',
            border: 'border-2 border-orange-300 shadow-md shadow-orange-500/5',
            badge: 'bg-orange-100 text-orange-800 border border-orange-200',
            glow: 'hover:border-orange-400 hover:shadow-orange-500/10',
            textTitle: 'text-text-primary',
            textDesc: 'text-sm font-semibold text-text-muted leading-relaxed max-w-sm'
          };
        case 'Most Bought From':
        case 'Ahabitswe cyane':
        case 'Les Plus Achetés':
          return {
            icon: <TrendingUp className="text-red-500 shrink-0" size={22} />,
            bg: 'bg-white',
            border: 'border-2 border-red-300 shadow-md shadow-red-500/5',
            badge: 'bg-red-100 text-red-800 border border-red-200',
            glow: 'hover:border-red-400 hover:shadow-red-500/10',
            textTitle: 'text-text-primary',
            textDesc: 'text-sm font-semibold text-text-muted leading-relaxed max-w-sm'
          };
        case 'Most Reviewed':
        case 'Ayashimagijwe cyane':
        case 'Les Plus Évalués':
          return {
            icon: <Star className="text-amber-500 fill-amber-500 shrink-0 animate-bounce" size={22} />,
            bg: 'bg-white',
            border: 'border-2 border-amber-300 shadow-md shadow-amber-500/5',
            badge: 'bg-amber-100 text-amber-800 border border-amber-200',
            glow: 'hover:border-amber-400 hover:shadow-amber-500/10',
            textTitle: 'text-text-primary',
            textDesc: 'text-sm font-semibold text-text-muted leading-relaxed max-w-sm'
          };
        default:
          return {
            icon: <Sparkles className="text-primary shrink-0" size={22} />,
            bg: 'bg-white',
            border: 'border-2 border-border-light shadow-sm',
            badge: 'bg-primary-light text-primary-dark border border-primary/20',
            glow: 'hover:border-primary hover:shadow-primary/10',
            textTitle: 'text-text-primary',
            textDesc: 'text-sm font-semibold text-text-muted leading-relaxed max-w-sm'
          };
      }
    }, [title, isFullWidth]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container || markets.length <= 1) return;

      let animationFrameId: number;
      let scrollSpeed = 0.4;
      let direction = 1;

      const animate = () => {
        if (!container) return;
        container.scrollLeft += scrollSpeed * direction;

        const maxScroll = container.scrollWidth - container.clientWidth;
        if (container.scrollLeft >= maxScroll - 1) {
          direction = -1;
        } else if (container.scrollLeft <= 1) {
          direction = 1;
        }
        animationFrameId = requestAnimationFrame(animate);
      };

      let isPaused = false;
      const handleMouseEnter = () => {
        isPaused = true;
        cancelAnimationFrame(animationFrameId);
      };
      const handleMouseLeave = () => {
        isPaused = false;
        animationFrameId = requestAnimationFrame(animate);
      };

      container.addEventListener('mouseenter', handleMouseEnter);
      container.addEventListener('mouseleave', handleMouseLeave);

      animationFrameId = requestAnimationFrame(animate);

      return () => {
        cancelAnimationFrame(animationFrameId);
        container.removeEventListener('mouseenter', handleMouseEnter);
        container.removeEventListener('mouseleave', handleMouseLeave);
      };
    }, [markets]);

    return (
      <div className={`space-y-5 rounded-3xl p-8 transition-all duration-500 ${theme.bg} ${theme.border} ${theme.glow}`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              {theme.icon}
              <h3 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${theme.textTitle} flex items-center gap-2`}>
                {title}
                {isFullWidth && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-white border border-white/20 backdrop-blur-sm animate-pulse">
                    🔥 {t('special_deals')}
                  </span>
                )}
              </h3>
            </div>
            <p className={theme.textDesc}>{description}</p>
          </div>
          <span className={`self-start rounded-full px-3.5 py-1 text-xs font-black uppercase tracking-wider ${theme.badge}`}>
            {markets.length} {markets.length === 1 ? t('market') : t('markets_plural')}
          </span>
        </div>
        <div 
          ref={containerRef}
          className={`flex gap-6 overflow-x-auto pb-4 snap-x scroll-smooth cursor-grab active:cursor-grabbing border-t pt-5 ${
            isFullWidth ? 'border-white/20 white-scrollbar' : 'scrollbar-hide border-border-light/40'
          }`}
        >
          {markets.map((market, idx) => (
            <div key={`${market._id}-${idx}`} className="min-w-[240px] max-w-[255px] flex-shrink-0 snap-start transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1">
              <MarketCard market={market} isCompact={true} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-10 pb-20">
        <section className="animate-reveal rounded-2xl border border-border-premium premium-gradient p-8 shadow-xl cinematic-shadow md:p-12 text-white">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold tracking-wide text-primary-light backdrop-blur-md border border-white/10">
                <ShieldCheck size={18} className="text-accent-premium" />
                {t('verified_local_markets')}
              </div>
              <h1 className="max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-6xl">
                {t('find_trusted_market_before')}
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70">
                {t('markets_page_hero_description')}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-6 py-5 min-w-[200px]">
              <p className="text-5xl font-bold text-accent-premium">{marketsToRender.length}</p>
              <p className="mt-1 text-sm font-medium text-white/60">{t('markets_shown')}</p>
              {showCatalogResults && (
                <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-light">{matchingProducts.length} {t('products_plural')}</p>
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
              <p className="text-xs font-bold uppercase tracking-widest">{t('location_filter_active')}</p>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-text-muted">
                {t('showing_markets_for', { location: requestedLocation })} {hasCoordinateSearch ? t('markets_sorted_by_distance') : t('markets_sorted_by_fuzzy')}
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
              <p className="text-xs font-bold uppercase tracking-widest text-accent-premium">{t('live_markets_offline')}</p>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-text-muted">{t('preview_markets_shown_fallback')}</p>
            </div>
          </div>
        )}

        {productDataUnavailable && showCatalogResults && (
          <div className="animate-reveal [animation-delay:100ms] flex items-start gap-4 rounded-xl border border-accent-premium/30 bg-accent-premium/5 p-5 text-text-primary">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-accent-premium/20 text-accent-premium">
              <WifiOff size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-accent-premium">{t('catalog_products_offline')}</p>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-text-muted">{t('related_markets_shown_fallback')}</p>
            </div>
          </div>
        )}

        <section className="animate-reveal [animation-delay:200ms] rounded-2xl border border-border-light bg-white p-5 shadow-sm md:p-8">
          <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-primary">
            <SlidersHorizontal size={18} className="text-primary" />
            {t('search_and_filters')}
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_0.62fr_0.68fr]">
            <div className="space-y-3">
              <label className="text-xs font-bold text-text-muted">{t('search_markets_and_products')}</label>
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
                    {getShortcutLabel(shortcut.label)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => { setSelectedProductCategory('all'); setAttributeFilters({}); }}
                  className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-all duration-300 ${selectedProductCategory === 'all' ? 'border-primary bg-primary text-white shadow-md shadow-primary/20' : 'border-border-light bg-white text-text-secondary hover:border-primary hover:text-primary'}`}
                >
                  {t('all_categories')}
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
              <label className="text-xs font-bold text-text-secondary">{t('price_range_rwf')}</label>
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
              <label className="text-xs font-bold text-text-muted">{t('market_type')}</label>
              <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'ALL', label: t('all') },
                    { key: 'PUBLIC', label: t('market_type_public') },
                    { key: 'INDIVIDUAL', label: t('market_type_shops') },
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
                      <option value="">{t('any')}</option>
                      <option value="true">{t('yes')}</option>
                      <option value="false">{t('no')}</option>
                    </select>
                  ) : (
                    <select value={attributeFilters[field.key] || ''} onChange={e => updateAttributeFilter(field.key, e.target.value)} className="rmf-select w-full">
                      <option value="">{t('any')}</option>
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
                  {madeInRwandaIntent ? t('origin_tagged_catalog') : t('product_results')}
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
                  {madeInRwandaIntent ? t('made_in_rwanda_products') : t('products_matching_query', { query: searchQuery.trim() })}
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-muted">
                  {madeInRwandaIntent
                    ? t('made_in_rwanda_desc')
                    : t('product_search_desc')}
                </p>
              </div>
              <div className="rounded-xl border border-border-light bg-background-surface px-6 py-4 min-w-[160px]">
                <p className="text-4xl font-bold text-primary">{matchingProducts.length}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-text-muted">{t('products_found')}</p>
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
                <p className="text-xs font-bold uppercase tracking-widest text-primary">{t('no_matching_products_yet')}</p>
                <h3 className="mt-4 text-2xl font-bold text-text-primary">
                  {madeInRwandaIntent ? t('mark_products_mir_prompt') : t('try_different_search_prompt')}
                </h3>
                <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-text-muted">
                  {t('catalog_connected_desc')}
                </p>
              </div>
            )}
          </section>
        )}

        {!showCatalogResults && !loading && marketsToRender.length > 0 && (
          <section className="animate-reveal [animation-delay:500ms] space-y-8">
            {/* Top Row: Active Promotions (Full Width) */}
            {promotionalMarkets.length > 0 && (
              <div className="w-full">
                <MarketShelf 
                  title={t('active_promotions')} 
                  description={t('active_promotions_desc')} 
                  markets={promotionalMarkets} 
                  isFullWidth={true}
                />
              </div>
            )}
 
            {/* Bottom Row: Dynamic Grid for active shelves */}
            {(newMarkets.length > 0 || topSellersMarkets.length > 0 || topRatedMarkets.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {newMarkets.length > 0 && (
                  <MarketShelf 
                    title={t('new_markets')} 
                    description={t('new_markets_desc')} 
                    markets={newMarkets} 
                  />
                )}
                {topSellersMarkets.length > 0 && (
                  <MarketShelf 
                    title={t('most_bought_from')} 
                    description={t('most_bought_from_desc')} 
                    markets={topSellersMarkets} 
                  />
                )}
                {topRatedMarkets.length > 0 && (
                  <MarketShelf 
                    title={t('most_reviewed')} 
                    description={t('most_reviewed_desc')} 
                    markets={topRatedMarkets} 
                  />
                )}
              </div>
            )}
          </section>
        )}

        <main className="animate-reveal [animation-delay:600ms] space-y-8 border-t border-border-light pt-8 mt-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">{t('marketplace_directory')}</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-text-primary md:text-4xl">{t('markets_ready_browsing')}</h2>
            </div>
            <p className="text-sm font-bold text-text-muted">{marketsToRender.length} {t('results_suffix')}</p>
          </div>
 
          {loading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="aspect-[4/5] bg-background-surface animate-pulse border border-border-light rounded-xl"></div>
              ))}
            </div>
          ) : marketsToRender.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-6">
              {marketsToRender.map((market: Market, idx: number) => (
                <MarketCard 
                  key={market._id} 
                  market={market} 
                  index={idx} 
                  isCompact={true}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border-light bg-white p-12 text-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">{t('no_matching_markets')}</p>
              <h3 className="mt-4 text-2xl font-bold text-text-primary">{t('try_different_market_search_prompt')}</h3>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-text-muted">
                {t('live_markets_connected_desc')}
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
                <p className="text-xs font-bold uppercase tracking-widest text-primary">{t('market_map')}</p>
                <h2 className="mt-4 text-3xl font-bold leading-[1.2] tracking-tight text-text-primary md:text-4xl">{t('market_map_title')}</h2>
                <p className="mt-6 text-base leading-relaxed text-text-muted">
                  {t('market_map_desc')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border-light bg-white p-5 shadow-sm">
                  <p className="text-3xl font-bold text-text-primary">{allMarkets.length || marketsToRender.length}</p>
                  <p className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-text-muted">{t('mapped_hubs')}</p>
                </div>
                <div className="rounded-xl border border-border-light bg-white p-5 shadow-sm">
                  <p className="text-3xl font-bold text-text-primary flex items-center gap-2">{t('live_label')} <span className="flex h-2.5 w-2.5 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-premium opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-premium"></span></span></p>
                  <p className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-text-muted">{t('rider_layer')}</p>
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
