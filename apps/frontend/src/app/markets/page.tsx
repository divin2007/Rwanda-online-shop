'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Layout } from '@/components/layout/Layout';
import { MarketCard } from '@/components/ui/MarketCard';
import { ProductCard } from '@/components/ui/ProductCard';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/hooks/useSocket';
import { marketApi, productApi, userApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { MapPin, PackageCheck, Search, ShieldCheck, SlidersHorizontal, Sparkles, WifiOff, Clock, TrendingUp, Star, BadgePercent } from 'lucide-react';
import { logger } from '@/lib/logger';

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

const fallbackCatalogShortcuts = [
  { label: 'Made in Rwanda', value: 'Made in Rwanda', mode: 'search' },
  { label: 'Groceries & Produce', value: 'grocery', mode: 'category' },
  { label: 'Food & Beverage', value: 'food', mode: 'category' },
  { label: 'Fashion & Apparel', value: 'fashion', mode: 'category' },
  { label: 'Shoes & Footwear', value: 'shoes', mode: 'category' },
  { label: 'Sportswear & Fitness', value: 'sportswear', mode: 'category' },
  { label: 'Bakery & Patisserie', value: 'bakery', mode: 'category' },
  { label: 'Hardware & Materials', value: 'hardware', mode: 'category' },
  { label: 'Handicrafts & Art', value: 'handicrafts', mode: 'category' },
  { label: 'Home & Furnishings', value: 'home', mode: 'category' },
  { label: 'Electronics & Tech', value: 'electronics', mode: 'category' },
  { label: 'Cosmetics & Care', value: 'cosmetics', mode: 'category' },
  { label: 'Automotive & Moto', value: 'automotive', mode: 'category' },
  { label: 'Stationery & Books', value: 'education', mode: 'category' },
  { label: 'Agriculture & Farming', value: 'agriculture', mode: 'category' },
  { label: 'Services', value: 'services', mode: 'category' },
  { label: 'Events & Rentals', value: 'events', mode: 'category' },
  { label: 'Real Estate', value: 'property', mode: 'category' },
  { label: 'Pets & Animal Care', value: 'pets', mode: 'category' },
  { label: 'Solar & Clean Water', value: 'solar-energy', mode: 'category' },
  { label: 'Office & Business', value: 'office-business', mode: 'category' },
  { label: 'Finance & Insurance', value: 'finance', mode: 'category' },
  { label: 'Other Goods', value: 'other', mode: 'category' },
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

  return `/products/recommendations/for-me?${params.toString()}`;
};

const getFacetQueryPath = (searchQuery: string) => {
  const params = new URLSearchParams({ limit: '200', isActive: 'true' });
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
  
  const { user } = useAuth();
  const { data: profileData, execute: refetchProfile } = useApi<any>(userApi, 'get', user ? '/users/profile' : '');
  const { data: marketsData, loading, error, execute: fetchMarkets } = useApi<Market[]>(marketApi, 'get', '/markets?activeOnly=true');
  const { data: productsData, loading: productsLoading, error: productsError, execute: refetchProducts } = useApi<Product[]>(productApi, 'get', productQueryPath);
  const { data: facetsData, execute: refetchFacets } = useApi<any>(productApi, 'get', facetQueryPath);
  const { data: catalogCategoriesData } = useApi<any[]>(productApi, 'get', '/products/catalog/categories');
  const { data: promotionsData, execute: refetchPromotions } = useApi<any[]>(productApi, 'get', '/promotions/active');

  // Real-time WebSocket synchronization
  const orderSocketUrl = process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006';
  const { data: socketMessage } = useSocket(orderSocketUrl, 'order:seller:updates');

  useEffect(() => {
    if (socketMessage) {
      logger.debug('[WebSocket] Order update received on Markets Page:', socketMessage);
      if (socketMessage.type === 'STATUS_UPDATE' && (socketMessage.status === 'delivered' || socketMessage.status === 'confirmed')) {
        fetchMarkets();
        refetchProducts();
        refetchFacets();
        refetchPromotions();
        if (user) refetchProfile();
      }
    }
  }, [socketMessage, fetchMarkets, refetchProducts, refetchFacets, refetchPromotions, refetchProfile, user]);

  const catalogShortcuts = useMemo(() => {
    const rootCategories = Array.isArray(catalogCategoriesData)
      ? catalogCategoriesData.filter((category: any) => category.isActive !== false && !category.parentId)
      : [];

    if (rootCategories.length === 0) {
      return fallbackCatalogShortcuts;
    }

    return [
      fallbackCatalogShortcuts[0],
      ...rootCategories.map((category: any) => ({
        label: category.label,
        value: category.id,
        mode: 'category',
      })),
    ];
  }, [catalogCategoriesData]);

  const promotionsByMarket = useMemo(() => {
    const map = new Map<string, number>();
    const promos = Array.isArray(promotionsData) ? promotionsData : [];
    promos.forEach(p => {
      if (p.product) {
        const mId = typeof p.product.marketId === 'object' ? p.product.marketId._id : p.product.marketId;
        const discountPercentage = Number(p.discountPercentage || p.promotion?.discountPercentage || p.discount || 0);
        if (mId && discountPercentage) {
          const currentMax = map.get(mId) || 0;
          if (discountPercentage > currentMax) {
            map.set(mId, discountPercentage);
          }
        }
      }
    });
    return map;
  }, [promotionsData]);

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
    () => (Array.isArray(productsData) ? productsData : []),
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
  const productSourceMarkets = useMemo(() => {
    const marketsById = new Map(allMarkets.map(market => [market._id, market]));
    const sources = new Map<string, Market>();

    matchingProducts.forEach(product => {
      const marketId = getProductMarketId(product);
      const marketFromDirectory = marketId ? marketsById.get(marketId) : undefined;
      if (marketFromDirectory) {
        sources.set(marketFromDirectory._id, marketFromDirectory);
        return;
      }

      if (typeof product.marketId === 'object' && product.marketId?._id) {
        const fallbackMarket = product.marketId;
        const fallbackMarketId = fallbackMarket._id;
        if (!fallbackMarketId) return;
        sources.set(fallbackMarketId, {
          _id: fallbackMarketId,
          name: fallbackMarket.name || 'Product market',
          slug: fallbackMarket.slug || fallbackMarketId,
          type: 'individual',
          activeProducts: matchingProducts.filter(item => getProductMarketId(item) === fallbackMarketId).length,
        });
      }
    });

    return Array.from(sources.values());
  }, [allMarkets, matchingProducts]);
  const hasSearch = Boolean(searchQuery.trim());
  const madeInRwandaIntent = isMadeInRwandaSearch(searchQuery);
  const hasProductFiltersActive = hasSearch || madeInRwandaIntent || selectedProductCategory !== 'all' || Object.keys(attributeFilters).length > 0 || Boolean(priceRange.min) || Boolean(priceRange.max);
  const facets = facetsData || { categories: [], attributes: [] };
  const activeProductFilterLabel = useMemo(() => {
    if (madeInRwandaIntent) return t('made_in_rwanda_products');
    if (searchQuery.trim()) return t('products_matching_query', { query: searchQuery.trim() });
    if (selectedProductCategory !== 'all') {
      const facetCategory = (facets.categories || []).find((category: any) => category.id === selectedProductCategory);
      const shortcut = catalogShortcuts.find(item => item.value === selectedProductCategory);
      return facetCategory?.label || shortcut?.label || t('product_results');
    }
    return t('product_results');
  }, [facets.categories, madeInRwandaIntent, searchQuery, selectedProductCategory, t]);
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

  const recommendationProfile = useMemo(() => profileData?.data?.recommendationProfile, [profileData]);
  const discovery = useMemo(() => profileData?.data?.preferences?.discovery, [profileData]);

  const scoredMarketsMap = useMemo(() => {
    const marketScores = new Map<string, number>();
    if (recommendationProfile?.marketScores) {
      recommendationProfile.marketScores.forEach((m: any) => {
        marketScores.set(String(m.refId), Number(m.score || 0));
      });
    }
    const selectedMarkets = new Set((discovery?.marketIds || []).map((id: any) => String(id)));
    const map = new Map<string, number>();
    allMarkets.forEach(market => {
      let score = 0;
      if (selectedMarkets.has(market._id)) score += 12;
      score += marketScores.get(market._id) || 0;
      score += (market.rating || 0) * 1.5;
      score += (market.totalOrders || 0) * 0.04;
      map.set(market._id, score);
    });
    return map;
  }, [allMarkets, recommendationProfile, discovery]);

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
    } else {
      results = [...results].sort((a, b) => (
        (scoredMarketsMap.get(b._id) || 0) - (scoredMarketsMap.get(a._id) || 0)
      ));
    }

    return results;
  }, [allMarkets, hasCoordinateSearch, productMarketIds, requestedLat, requestedLng, searchQuery, selectedCategory, hasProductFiltersActive, scoredMarketsMap]);

  const liveDataUnavailable = Boolean(error);
  const productDataUnavailable = Boolean(productsError);
  const marketsToRender = filteredMarkets;
  const showCatalogResults = hasProductFiltersActive;
  const directoryMarkets = marketsToRender.length > 0 ? marketsToRender : (showCatalogResults ? productSourceMarkets : []);

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
      .sort((a, b) => (promotionsByMarket.get(b._id) || 0) - (promotionsByMarket.get(a._id) || 0))
      .slice(0, 6),
    [marketsToRender, promotionalMarketIds, promotionsByMarket]
  );

  const recommendedMarkets = useMemo(
    () => [...marketsToRender]
      .sort((a, b) => (scoredMarketsMap.get(b._id) || 0) - (scoredMarketsMap.get(a._id) || 0))
      .slice(0, 6),
    [marketsToRender, scoredMarketsMap]
  );

  // Helper to translate shortcut labels dynamically
  const getShortcutLabel = (value: string) => {
    switch (value) {
      case 'Made in Rwanda': return t('product_made_in_rwanda');
      case 'Groceries': return t('cat_produce');
      case 'Fashion': return t('cat_textiles');
      case 'Shoes': return t('cat_shoes');
      case 'Sportswear': return t('cat_sportswear');
      case 'Bakery': return t('cat_bakery');
      case 'Hardware': return t('cat_hardware');
      case 'Handicrafts': return t('cat_handcrafts');
      case 'Home': return t('cat_home');
      case 'Electronics': return t('cat_electronics');
      case 'Cosmetics': return t('cat_cosmetics');
      case 'Automotive': return t('cat_automotive');
      case 'Education': return t('cat_education');
      case 'Other': return t('cat_other');
      default: return value;
    }
  };

  const MarketShelf = ({ title, description, markets, isFullWidth = false }: { title: string, description: string, markets: Market[], isFullWidth?: boolean }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const theme = useMemo(() => {
      if (isFullWidth) {
        return {
          icon: <BadgePercent className="text-white shrink-0" size={24} />,
          bg: 'bg-[#ff6b00] text-white relative overflow-hidden',
          border: 'border border-[#e2bfb0]',
          badge: 'bg-white/15 text-white border border-white/25 font-black',
          glow: '',
          textTitle: 'text-white',
          textDesc: 'text-white/90 leading-relaxed text-sm font-semibold max-w-xl'
        };
      }
      switch (title) {
        case 'Recommended for You':
        case 'Recommandé pour vous':
        case 'Ibyo twaguhitiyemo':
          return {
            icon: <Sparkles className="text-primary shrink-0" size={22} />,
            bg: 'bg-white',
            border: 'border border-[#e2bfb0]',
            badge: 'bg-primary/10 text-primary border border-primary/20 font-bold',
            glow: 'hover:border-[#ff6b00]',
            textTitle: 'text-text-primary',
            textDesc: 'text-sm font-semibold text-text-muted leading-relaxed max-w-sm'
          };
        case 'New Markets':
        case 'Masoko Mashya':
        case 'Nouveaux Marchés':
          return {
            icon: <Clock className="text-orange-500 shrink-0" size={22} />,
            bg: 'bg-white',
            border: 'border border-[#e2bfb0]',
            badge: 'bg-orange-100 text-orange-850 border border-orange-200',
            glow: 'hover:border-orange-400',
            textTitle: 'text-text-primary',
            textDesc: 'text-sm font-semibold text-text-muted leading-relaxed max-w-sm'
          };
        case 'Most Bought From':
        case 'Ahabitswe cyane':
        case 'Les Plus Achetés':
          return {
            icon: <TrendingUp className="text-red-500 shrink-0" size={22} />,
            bg: 'bg-white',
            border: 'border border-[#e2bfb0]',
            badge: 'bg-red-100 text-red-850 border border-red-200',
            glow: 'hover:border-red-400',
            textTitle: 'text-text-primary',
            textDesc: 'text-sm font-semibold text-text-muted leading-relaxed max-w-sm'
          };
        case 'Most Reviewed':
        case 'Ayashimagijwe cyane':
        case 'Les Plus Évalués':
          return {
            icon: <Star className="text-amber-500 fill-amber-500 shrink-0" size={22} />,
            bg: 'bg-white',
            border: 'border border-[#e2bfb0]',
            badge: 'bg-amber-100 text-amber-850 border border-amber-200',
            glow: 'hover:border-amber-400',
            textTitle: 'text-text-primary',
            textDesc: 'text-sm font-semibold text-text-muted leading-relaxed max-w-sm'
          };
        default:
          return {
            icon: <Sparkles className="text-primary shrink-0" size={22} />,
            bg: 'bg-white',
            border: 'border border-[#e2bfb0]',
            badge: 'bg-primary/10 text-primary border border-primary/20',
            glow: 'hover:border-primary',
            textTitle: 'text-text-primary',
            textDesc: 'text-sm font-semibold text-text-muted leading-relaxed max-w-sm'
          };
      }
    }, [title, isFullWidth]);

    return (
      <div className={`space-y-4 rounded-lg p-4 transition-colors ${theme.bg} ${theme.border} ${theme.glow} shadow-sm`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              {theme.icon}
              <h3 className={`text-xl sm:text-2xl font-black tracking-normal ${theme.textTitle} flex items-center gap-2`}>
                {title}
                {isFullWidth && (
                  <span className="inline-flex items-center gap-1 rounded-sm bg-white/20 px-2.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-white border border-white/20">
                    {t('special_deals')}
                  </span>
                )}
              </h3>
            </div>
            <p className={theme.textDesc}>{description}</p>
          </div>
          <span className={`self-start rounded-sm px-3.5 py-1 font-mono text-[10px] font-black uppercase tracking-wider ${theme.badge}`}>
            {markets.length} {markets.length === 1 ? t('market') : t('markets_plural')}
          </span>
        </div>
        <div 
          ref={containerRef}
          className={`flex gap-4 overflow-x-auto pb-3 snap-x scroll-smooth cursor-grab active:cursor-grabbing border-t pt-4 ${
            isFullWidth ? 'border-white/20 white-scrollbar' : 'scrollbar-hide border-border-light/40'
          }`}
        >
          {markets.map((market, idx) => {
            const maxDiscount = promotionsByMarket.get(market._id) || 0;
            return (
              <div key={`${market._id}-${idx}`} className="min-w-[170px] max-w-[188px] flex-shrink-0 snap-start sm:min-w-[185px] sm:max-w-[205px]">
                <MarketCard market={market} isCompact={true} maxDiscount={maxDiscount} />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="mx-auto max-w-[1280px] space-y-8 px-0 py-2 pb-20 sm:px-4 sm:py-6 md:px-8 md:py-10 md:pb-24">
        {/* Cover Hero Section */}
        <section className="relative h-[260px] w-full overflow-hidden rounded-xl border border-[#e2bfb0] shadow-md bg-[#ff6b00] md:h-[280px]">
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent z-10"></div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent"></div>
          <div className="relative z-20 h-full flex flex-col justify-end space-y-4 px-5 pb-6 sm:px-8 sm:pb-8">
            <div className="inline-flex items-center gap-2 rounded bg-white/15 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white border border-white/20 self-start">
              <ShieldCheck size={16} className="text-accent-premium animate-pulse" />
              {t('verified_local_markets')}
            </div>
            <h1 className="max-w-2xl text-[2rem] font-black leading-tight text-white md:text-5xl">
              {t('find_trusted_market_before')}
            </h1>
            <p className="max-w-xl text-xs md:text-sm text-white/80 leading-relaxed">
              {t('markets_page_hero_description')}
            </p>
          </div>
          <div className="absolute top-6 right-8 hidden md:block bg-black/30 backdrop-blur-md border border-white/10 px-6 py-4 rounded text-white text-right">
            <p className="text-4xl font-black text-[#ffd700]">{marketsToRender.length}</p>
            <p className="text-[10px] font-mono uppercase tracking-wider opacity-85 mt-1">{t('markets_shown')}</p>
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

        {/* Discovery Filter Shelf */}
        <section className="space-y-5 rounded-lg border border-[#e2bfb0] bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-primary">
            <SlidersHorizontal size={18} className="text-primary animate-pulse" />
            {t('search_and_filters')}
          </div>
          <div className="grid min-w-0 gap-5 lg:grid-cols-[1.2fr_0.8fr_1fr] lg:gap-6">
            <div className="space-y-3">
              <label className="text-xs font-bold text-text-muted">{t('search_markets_and_products')}</label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                <input 
                  placeholder={t('home_search_placeholder') || "Search markets..."} 
                  className="rmf-input pl-11 w-full text-xs" 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="grid max-h-36 w-full grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {catalogShortcuts.map(shortcut => (
                  <button
                    key={shortcut.value}
                    onClick={() => {
                      if (shortcut.mode === 'category') {
                        setSelectedProductCategory(shortcut.value);
                        setSearchQuery('');
                        setAttributeFilters({});
                      } else {
                        setSearchQuery(shortcut.value);
                        setSelectedProductCategory('all');
                        setAttributeFilters({});
                      }
                    }}
                    className={`min-h-9 w-full rounded border px-2 py-1.5 font-mono text-[8px] font-bold uppercase leading-tight tracking-wider transition-colors ${
                      searchQuery === shortcut.value || selectedProductCategory === shortcut.value ? 'border-primary bg-primary text-white font-black' : 'border-[#ebdcd0] bg-background-surface text-text-secondary hover:border-primary hover:text-primary'
                    }`}
                  >
                    {getShortcutLabel(shortcut.label)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-text-secondary">{t('price_range_rwf')}</label>
              <div className="grid grid-cols-2 gap-3">
                <input 
                  placeholder="Min" 
                  className="rmf-input text-xs" 
                  type="number" 
                  value={priceRange.min}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                />
                <input 
                  placeholder="Max" 
                  className="rmf-input text-xs" 
                  type="number" 
                  value={priceRange.max}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-text-muted">{t('market_type')}</label>
              <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                {[
                  { key: 'ALL', label: t('all') },
                  { key: 'PUBLIC', label: t('market_type_public') },
                  { key: 'INDIVIDUAL', label: t('market_type_shops') },
                ].map(cat => (
                  <button 
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`min-h-11 rounded border px-2 py-2 font-mono text-[9px] font-bold uppercase tracking-wider leading-tight transition-colors ${
                      selectedCategory === cat.key ? 'border-primary bg-primary text-white font-black' : 'border-[#ebdcd0] bg-white text-text-secondary hover:border-primary hover:text-primary'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid max-h-36 w-full grid-cols-2 gap-2 overflow-y-auto border-t border-border-light/40 pt-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            <button
              onClick={() => { setSelectedProductCategory('all'); setAttributeFilters({}); }}
              className={`min-h-9 w-full rounded border px-2 py-1.5 font-mono text-[8px] font-bold uppercase leading-tight tracking-wider transition-colors ${selectedProductCategory === 'all' ? 'border-primary bg-primary/10 text-primary font-black' : 'border-[#ebdcd0] bg-white text-text-secondary hover:border-primary hover:text-primary'}`}
            >
              {t('all_categories')}
            </button>
            {(facets.categories || []).map((category: any) => (
              <button
                key={category.id}
                onClick={() => { setSelectedProductCategory(category.id); setAttributeFilters({}); }}
                className={`min-h-9 w-full rounded border px-2 py-1.5 font-mono text-[8px] font-bold uppercase leading-tight tracking-wider transition-colors ${selectedProductCategory === category.id ? 'border-primary bg-primary/10 text-primary font-black' : 'border-[#ebdcd0] bg-white text-text-secondary hover:border-primary hover:text-primary'}`}
              >
                {category.label} ({category.count})
              </button>
            ))}
          </div>

          {activeAttributeGroups.length > 0 && (
            <div className="mt-5 grid gap-4 border-t border-border-light/40 pt-5 md:grid-cols-2 xl:grid-cols-4">
              {activeAttributeGroups.flatMap((group: any) => group.fields || []).slice(0, 8).map((field: any, idx: number) => (
                <label key={`${field.key}-${field.label}-${idx}`} className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-text-muted">{field.label}</span>
                  {field.type === 'boolean' ? (
                    <select value={attributeFilters[field.key] || ''} onChange={e => updateAttributeFilter(field.key, e.target.value)} className="rmf-select w-full text-xs">
                      <option value="">{t('any')}</option>
                      <option value="true">{t('yes')}</option>
                      <option value="false">{t('no')}</option>
                    </select>
                  ) : (
                    <select value={attributeFilters[field.key] || ''} onChange={e => updateAttributeFilter(field.key, e.target.value)} className="rmf-select w-full text-xs">
                      <option value="">{t('any')}</option>
                      {((field.values?.length ? field.values.map((item: any) => item.value) : field.options) || []).map((value: string, oIdx: number) => (
                        <option key={`${value}-${oIdx}`} value={value}>{value}</option>
                      ))}
                    </select>
                  )}
                </label>
              ))}
            </div>
          )}
        </section>

        {showCatalogResults && (
          <section className="space-y-6 rounded-lg border border-[#e2bfb0] bg-white p-4 shadow-sm sm:p-6 md:p-8">
            <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-end pb-4 border-b border-border-light">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
                  {madeInRwandaIntent ? <Sparkles size={18} /> : <PackageCheck size={18} />}
                  {madeInRwandaIntent ? t('origin_tagged_catalog') : t('product_results')}
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
                  {activeProductFilterLabel}
                </h2>
              </div>
              <span className="text-xs font-bold text-text-muted">{matchingProducts.length} {t('products_found')}</span>
            </div>

            {productsLoading ? (
              <div className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 md:gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-72 animate-pulse rounded-lg border border-[#e2bfb0] bg-background-surface" />
                ))}
              </div>
            ) : matchingProducts.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 md:gap-6">
                {matchingProducts.map(product => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#e2bfb0] bg-background-surface p-12 text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">{t('no_matching_products_yet')}</p>
                <h3 className="mt-4 text-xl font-bold text-text-primary">
                  {madeInRwandaIntent ? t('mark_products_mir_prompt') : t('try_different_search_prompt')}
                </h3>
              </div>
            )}
          </section>
        )}

        {!showCatalogResults && !loading && marketsToRender.length > 0 && (
          <section className="space-y-8">
            {promotionalMarkets.length > 0 && (
              <MarketShelf 
                title={t('active_promotions')} 
                description={t('active_promotions_desc')} 
                markets={promotionalMarkets} 
                isFullWidth={true}
              />
            )}
 
            {(recommendedMarkets.length > 0 || newMarkets.length > 0 || topSellersMarkets.length > 0 || topRatedMarkets.length > 0) && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 md:gap-6">
                {recommendedMarkets.length > 0 && (
                  <MarketShelf 
                    title={t('recommended_for_you')} 
                    description={t('recommended_markets_desc')} 
                    markets={recommendedMarkets} 
                  />
                )}
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
              </div>
            )}
          </section>
        )}

        <main className="space-y-6 pt-6 border-t border-[#e2bfb0]">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">{t('marketplace_directory')}</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-text-primary">{t('markets_ready_browsing')}</h2>
            </div>
            <span className="text-xs font-bold text-text-muted">{directoryMarkets.length} {t('results_suffix')}</span>
          </div>
          {showCatalogResults && productSourceMarkets.length > 0 && (
            <p className="text-xs font-semibold text-text-muted">
              Products displayed above are available from {productSourceMarkets.length} matching {productSourceMarkets.length === 1 ? 'market' : 'markets'}.
            </p>
          )}
  
          {loading ? (
            <div className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 md:gap-6">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="aspect-[4/5] bg-background-surface animate-pulse border border-[#e2bfb0] rounded-lg"></div>
              ))}
            </div>
          ) : directoryMarkets.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 md:gap-6">
              {directoryMarkets.map((market: Market, idx: number) => {
                const maxDiscount = promotionsByMarket.get(market._id) || 0;
                return (
                  <MarketCard 
                    key={market._id} 
                    market={market} 
                    index={idx} 
                    isCompact={true}
                    maxDiscount={maxDiscount}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#e2bfb0] bg-white p-12 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">{t('no_matching_markets')}</p>
              <h3 className="mt-4 text-xl font-bold text-text-primary">{t('try_different_market_search_prompt')}</h3>
            </div>
          )}
        </main>

        {/* Map Explorer Section */}
        <section className="overflow-hidden rounded-xl border border-[#e2bfb0] bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[0.35fr_0.65fr]">
            <div className="flex flex-col justify-between gap-6 border-b border-border-light/50 bg-[#fdfaf7] p-5 sm:p-8 lg:border-b-0 lg:border-r">
              <div className="space-y-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-white shadow-md">
                  <MapPin size={22} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary">{t('market_map')}</p>
                <h2 className="text-xl font-bold tracking-tight text-text-primary">{t('market_map_title')}</h2>
                <p className="text-xs leading-relaxed text-text-muted">
                  {t('market_map_desc') || 'Explore all local markets mapped geographically. Find closest pickup points and courier hubs near your location.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded border border-[#e2bfb0] bg-white p-4 shadow-sm">
                  <p className="text-2xl font-black text-text-primary">{allMarkets.length || marketsToRender.length}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">{t('mapped_hubs')}</p>
                </div>
                <div className="rounded border border-[#e2bfb0] bg-white p-4 shadow-sm">
                  <p className="text-2xl font-black text-primary flex items-center gap-1.5">
                    {t('live_label')} 
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">{t('rider_layer') || 'COURIER LAYER'}</p>
                </div>
              </div>
            </div>
            <div className="h-[320px] bg-background-surface md:h-[450px]">
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
