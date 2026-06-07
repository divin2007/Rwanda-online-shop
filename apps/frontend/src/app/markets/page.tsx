'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { MarketCard } from '@/components/ui/MarketCard';
import { ProductCard } from '@/components/ui/ProductCard';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/hooks/useSocket';
import { marketApi, productApi, userApi, sellerApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { getMarketUrl } from '@/lib/urls';
import { MapPin, PackageCheck, Search, ShieldCheck, SlidersHorizontal, Sparkles, WifiOff, Clock, TrendingUp, Star, BadgePercent } from 'lucide-react';

const RiderMap = dynamic(() => import('@/components/ui/RiderMap').then(mod => mod.RiderMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-container-low rounded-lg" />,
});

const marketHref = (market: any) => getMarketUrl(market.slug || market._id);
const marketLocation = (market: any) => market.location?.address || 'Kigali, Rwanda';

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
  isSponsored?: boolean;
  premiumTier?: 'none' | 'basic' | 'standard' | 'spotlight';
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

const productSortToQuery: Record<string, string> = {
  relevance: '-totalOrders',
  rating: '-rating',
  newest: '-createdAt',
  price_asc: 'price',
  price_desc: '-price',
};

const getProductQueryPath = (
  searchQuery: string,
  productCategory: string,
  attributeFilters: Record<string, string>,
  priceRange: { min: string; max: string },
  sortMode: string,
) => {
  const params = new URLSearchParams({
    limit: '24',
    isActive: 'true',
    sortBy: productSortToQuery[sortMode] || productSortToQuery.relevance,
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
  const [sortMode, setSortMode] = useState('relevance');
  
  const searchParams = useSearchParams();
  const search = searchParams.get('search');
  const [businessType, setBusinessType] = useState<string>(searchParams.get('businessType') || 'ALL');
  // Set of marketIds that contain at least one approved food seller of the selected business type.
  const [foodMarketIds, setFoodMarketIds] = useState<Set<string> | null>(null);
  const requestedLocation = searchParams.get('location') || '';
  const requestedLat = Number(searchParams.get('lat'));
  const requestedLng = Number(searchParams.get('lng'));
  const hasCoordinateSearch = Number.isFinite(requestedLat) && Number.isFinite(requestedLng);
  const productQueryPath = useMemo(
    () => getProductQueryPath(searchQuery, selectedProductCategory, attributeFilters, priceRange, sortMode),
    [attributeFilters, searchQuery, selectedProductCategory, priceRange, sortMode],
  );
  const facetQueryPath = useMemo(() => getFacetQueryPath(searchQuery), [searchQuery]);
  
  const { user } = useAuth();
  const { data: profileData, execute: refetchProfile } = useApi<any>(userApi, 'get', user ? '/users/profile' : '');
  const { data: marketsData, loading, error, execute: fetchMarkets } = useApi<Market[]>(marketApi, 'get', '/markets');
  // Server-side ranked market search (text + reviews + proximity + capped premium boost).
  // Only used when the buyer has typed a query; returns isSponsored flags.
  const marketSearchPath = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return '';
    const params = new URLSearchParams({ q, sort: sortMode });
    if (hasCoordinateSearch) {
      params.set('lat', String(requestedLat));
      params.set('lng', String(requestedLng));
    }
    return `/markets/search?${params.toString()}`;
  }, [searchQuery, sortMode, hasCoordinateSearch, requestedLat, requestedLng]);
  const { data: searchedMarketsData } = useApi<Market[]>(marketApi, 'get', marketSearchPath);
  const { data: productsData, loading: productsLoading, error: productsError, execute: refetchProducts } = useApi<Product[]>(productApi, 'get', productQueryPath);
  const { data: facetsData, execute: refetchFacets } = useApi<any>(productApi, 'get', facetQueryPath);
  const { data: catalogCategoriesData } = useApi<any[]>(productApi, 'get', '/products/catalog/categories');
  const { data: promotionsData, execute: refetchPromotions } = useApi<any[]>(productApi, 'get', '/promotions/active');

  const orderSocketUrl = process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006';
  const { data: socketMessage } = useSocket(orderSocketUrl, 'order:seller:updates');

  useEffect(() => {
    if (socketMessage) {
      console.log('[WebSocket] Order update received on Markets Page:', socketMessage);
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

  // When a business-type filter is active, resolve which markets contain such sellers.
  useEffect(() => {
    if (businessType === 'ALL') {
      setFoodMarketIds(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await sellerApi.get(`/sellers/discover?businessType=${encodeURIComponent(businessType)}`);
        const ids = new Set<string>();
        for (const s of (res.data?.data || [])) {
          if (!s.isApproved) continue;
          const mId = typeof s.marketId === 'object' ? s.marketId?._id : s.marketId;
          if (mId) ids.add(String(mId));
        }
        if (!cancelled) setFoodMarketIds(ids);
      } catch {
        if (!cancelled) setFoodMarketIds(new Set());
      }
    })();
    return () => { cancelled = true; };
  }, [businessType]);

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
  const showCatalogResults = hasProductFiltersActive;
  const facets = facetsData || { categories: [], attributes: [] };
  
  const activeProductFilterLabel = useMemo(() => {
    if (madeInRwandaIntent) return t('made_in_rwanda_products') || 'Made in Rwanda Collection';
    if (searchQuery.trim()) return t('products_matching_query', { query: searchQuery.trim() }) || `Results matching: ${searchQuery.trim()}`;
    if (selectedProductCategory !== 'all') {
      const facetCategory = (facets.categories || []).find((category: any) => category.id === selectedProductCategory);
      const shortcut = catalogShortcuts.find(item => item.value === selectedProductCategory);
      return facetCategory?.label || shortcut?.label || t('product_results') || 'Products Feed';
    }
    return t('product_results') || 'Products Feed';
  }, [facets.categories, madeInRwandaIntent, searchQuery, selectedProductCategory, t, catalogShortcuts]);

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

    if (selectedCategory !== 'ALL') {
      const typeMap: Record<string, string> = {
        'INDIVIDUAL': 'individual',
        'PUBLIC': 'public',
      };
      const targetType = typeMap[selectedCategory];
      results = results.filter((m: Market) => m.type === targetType);
    }

    // Business-type (food/dining) filter via seller-service data.
    if (businessType !== 'ALL' && foodMarketIds) {
      results = results.filter((m: Market) => foodMarketIds.has(String(m._id)));
    }

    if (sortMode === 'distance' && hasCoordinateSearch) {
      results = [...results].sort((a, b) => (
        getDistanceKm(requestedLat, requestedLng, a.location?.coordinates)
        - getDistanceKm(requestedLat, requestedLng, b.location?.coordinates)
      ));
    } else if (sortMode === 'rating') {
      results = [...results].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    } else if (sortMode === 'newest') {
      results = [...results].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else {
      results = [...results].sort((a, b) => (
        (scoredMarketsMap.get(b._id) || 0) - (scoredMarketsMap.get(a._id) || 0)
      ));
    }

    return results;
  }, [allMarkets, hasCoordinateSearch, productMarketIds, requestedLat, requestedLng, searchQuery, selectedCategory, hasProductFiltersActive, scoredMarketsMap, businessType, foodMarketIds, sortMode]);

  const liveDataUnavailable = Boolean(error);
  // When the buyer has typed a query, prefer the server-ranked search results (which carry
  // isSponsored flags and respect the buyer-trust relevance threshold). Fall back to the
  // legacy client-side filtering only if the search endpoint returned nothing.
  const searchedMarkets = useMemo(
    () => (Array.isArray(searchedMarketsData) ? searchedMarketsData : []),
    [searchedMarketsData],
  );
  const directoryMarkets = searchQuery.trim() && searchedMarkets.length > 0
    ? searchedMarkets
    : (filteredMarkets.length > 0 ? filteredMarkets : (hasProductFiltersActive ? productSourceMarkets : []));

  const promotionalMarketIds = useMemo(() => {
    const ids = new Set<string>();
    matchingProducts.forEach(product => {
      if (product.promotion && (product.promotion.discount > 0 || product.promotion.promotedPrice > 0)) {
        const marketId = getProductMarketId(product);
        if (marketId) ids.add(marketId);
      }
    });
    return ids;
  }, [matchingProducts]);

  const newMarkets = useMemo(
    () => [...filteredMarkets]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 6),
    [filteredMarkets]
  );
  const topSellersMarkets = useMemo(
    () => [...filteredMarkets]
      .filter(m => (m.totalOrders || 0) > 0)
      .sort((a, b) => (b.totalOrders || 0) - (a.totalOrders || 0))
      .slice(0, 6),
    [filteredMarkets]
  );
  const topRatedMarkets = useMemo(
    () => [...filteredMarkets]
      .filter(m => (m.rating || 0) > 0 || (m.productRatingSum || 0) > 0)
      .sort((a, b) => {
        const aScore = (a.rating || 0) + (a.productRatingSum || 0);
        const bScore = (b.rating || 0) + (b.productRatingSum || 0);
        return bScore - aScore;
      })
      .slice(0, 6),
    [filteredMarkets]
  );
  const promotionalMarkets = useMemo(
    () => [...filteredMarkets]
      .filter(m => promotionalMarketIds.has(m._id))
      .sort((a, b) => (promotionsByMarket.get(b._id) || 0) - (promotionsByMarket.get(a._id) || 0))
      .slice(0, 6),
    [filteredMarkets, promotionalMarketIds, promotionsByMarket]
  );

  const recommendedMarkets = useMemo(
    () => [...filteredMarkets]
      .sort((a, b) => (scoredMarketsMap.get(b._id) || 0) - (scoredMarketsMap.get(a._id) || 0))
      .slice(0, 6),
    [filteredMarkets, scoredMarketsMap]
  );

  const getShortcutLabel = (value: string) => {
    switch (value) {
      case 'Made in Rwanda': return t('product_made_in_rwanda') || 'Made in Rwanda';
      case 'grocery': return t('cat_produce') || 'Groceries';
      case 'fashion': return t('cat_textiles') || 'Fashion';
      case 'shoes': return t('cat_shoes') || 'Shoes';
      case 'sportswear': return t('cat_sportswear') || 'Sportswear';
      case 'bakery': return t('cat_bakery') || 'Bakery';
      case 'hardware': return t('cat_hardware') || 'Hardware';
      case 'handicrafts': return t('cat_handcrafts') || 'Handicrafts';
      case 'home': return t('cat_home') || 'Home';
      case 'electronics': return t('cat_electronics') || 'Electronics';
      case 'cosmetics': return t('cat_cosmetics') || 'Cosmetics';
      case 'automotive': return t('cat_automotive') || 'Automotive';
      case 'education': return t('cat_education') || 'Education';
      case 'other': return t('cat_other') || 'Other';
      default: return value;
    }
  };

  const MarketShelf = ({ title, description, markets, isFullWidth = false }: { title: string, description: string, markets: Market[], isFullWidth?: boolean }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const theme = useMemo(() => {
      if (isFullWidth) {
        return {
          icon: <BadgePercent className="text-white shrink-0" size={24} />,
          bg: 'bg-primary-container text-white relative overflow-hidden',
          border: 'border border-outline',
          badge: 'bg-white/20 text-white border border-white/20 font-black',
          glow: '',
          textTitle: 'text-white',
          textDesc: 'text-white/95 leading-relaxed text-sm font-semibold max-w-xl'
        };
      }
      return {
        icon: <Sparkles className="text-primary-container shrink-0" size={20} />,
        bg: 'bg-surface-container-lowest',
        border: 'border border-outline-variant',
        badge: 'bg-primary-container/10 text-primary-container border border-primary-container/20 font-bold',
        glow: 'hover:border-primary',
        textTitle: 'text-on-surface',
        textDesc: 'text-sm font-semibold text-on-surface-variant leading-relaxed max-w-sm'
      };
    }, [isFullWidth]);

    return (
      <div className={`space-y-md rounded-lg p-md transition-colors ${theme.bg} ${theme.border} ${theme.glow} custom-shadow`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-sm">
          <div className="space-y-xs">
            <div className="flex items-center gap-xs">
              {theme.icon}
              <h3 className={`text-xl font-bold tracking-normal ${theme.textTitle} flex items-center gap-xs font-sans`}>
                {title}
              </h3>
            </div>
            <p className={theme.textDesc}>{description}</p>
          </div>
          <span className={`self-start rounded font-data-mono text-[10px] font-black uppercase tracking-wider px-3 py-1 ${theme.badge}`}>
            {markets.length} {markets.length === 1 ? t('market') || 'Market' : t('markets_plural') || 'Markets'}
          </span>
        </div>
        
        <div 
          ref={containerRef}
          className="flex gap-md overflow-x-auto pb-sm snap-x scroll-smooth border-t border-outline-variant/40 pt-md hide-scrollbar"
        >
          {markets.map((market, idx) => {
            const maxDiscount = promotionsByMarket.get(market._id) || 0;
            return (
              <div key={`${market._id}-${idx}`} className="min-w-[185px] max-w-[205px] flex-shrink-0 snap-start">
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
      <div className="flex-grow flex w-full min-h-[calc(100vh-4rem)]">
        
        {/* Main Content Pane */}
        <main className="flex-1 flex flex-col bg-background">
          
          {/* Directory Title / Header */}
          <div className="px-xl py-lg bg-surface border-b border-outline-variant relative overflow-hidden">
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: `radial-gradient(#a04100 1px, transparent 1px)`, backgroundSize: '20px 20px' }}></div>
            <h1 className="font-display-lg text-[32px] md:text-[40px] font-bold text-on-surface relative z-10">Explore Rwanda's Market Hubs</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm relative z-10 flex items-center gap-sm">
              <span className="font-data-mono text-data-mono bg-surface-variant px-2 py-1 rounded text-primary">{directoryMarkets.length}</span>
              Active regional markets integrated
            </p>
          </div>

          {/* Business-type (Food & Dining) Filter Row */}
          <div className="px-md py-sm bg-surface-container-lowest border-b border-outline-variant flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 border-r border-outline-variant pr-md">
              <span className="material-symbols-outlined text-secondary">restaurant_menu</span>
              <span className="font-label-caps text-label-caps text-secondary">Dining</span>
            </div>
            {[
              { value: 'ALL', label: 'All' },
              { value: 'RESTAURANT', label: 'Restaurants' },
              { value: 'HOTEL', label: 'Hotels' },
              { value: 'CAFE', label: 'Cafés' },
              { value: 'BAKERY', label: 'Bakeries' },
              { value: 'CATERING', label: 'Catering' },
              { value: 'FOOD_KIOSK', label: 'Food Kiosks' },
            ].map((bt) => (
              <button
                key={bt.value}
                onClick={() => setBusinessType(bt.value)}
                className={`px-3 py-1 font-label-caps text-label-caps rounded-full transition-colors border ${
                  businessType === bt.value
                    ? 'bg-primary-container border-primary-container text-on-primary font-bold'
                    : 'bg-surface border-outline-variant text-on-surface-variant hover:border-outline'
                }`}
              >
                {bt.label}
              </button>
            ))}
          </div>

          {/* Filter Panel */}
          <div className="px-md py-md bg-surface-container-lowest border-b border-outline-variant shadow-sm z-10 flex flex-wrap items-center gap-md">
            <div className="flex items-center gap-2 border-r border-outline-variant pr-md">
              <span className="material-symbols-outlined text-secondary">filter_list</span>
              <span className="font-label-caps text-label-caps text-secondary">Filters</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => { setSelectedProductCategory('all'); setAttributeFilters({}); }}
                className={`px-3 py-1 font-label-caps text-label-caps rounded-full transition-colors border ${
                  selectedProductCategory === 'all'
                    ? 'bg-primary-container border-primary-container text-on-primary font-bold'
                    : 'bg-surface border-outline-variant text-on-surface-variant hover:border-outline'
                }`}
              >
                All Categories
              </button>
              <button 
                onClick={() => { setSelectedProductCategory('grocery'); setAttributeFilters({}); }}
                className={`px-3 py-1 font-label-caps text-label-caps rounded-full transition-colors border ${
                  selectedProductCategory === 'grocery'
                    ? 'bg-primary-container border-primary-container text-on-primary font-bold'
                    : 'bg-surface border-outline-variant text-on-surface-variant hover:border-outline'
                }`}
              >
                Groceries
              </button>
              <button 
                onClick={() => { setSelectedProductCategory('fashion'); setAttributeFilters({}); }}
                className={`px-3 py-1 font-label-caps text-label-caps rounded-full transition-colors border ${
                  selectedProductCategory === 'fashion'
                    ? 'bg-primary-container border-primary-container text-on-primary font-bold'
                    : 'bg-surface border-outline-variant text-on-surface-variant hover:border-outline'
                }`}
              >
                Fashion
              </button>
              <button 
                onClick={() => { setSelectedProductCategory('electronics'); setAttributeFilters({}); }}
                className={`px-3 py-1 font-label-caps text-label-caps rounded-full transition-colors border ${
                  selectedProductCategory === 'electronics'
                    ? 'bg-primary-container border-primary-container text-on-primary font-bold'
                    : 'bg-surface border-outline-variant text-on-surface-variant hover:border-outline'
                }`}
              >
                Electronics
              </button>
            </div>
            <div className="w-px h-6 bg-outline-variant mx-sm"></div>
            <div className="flex gap-2">
              <select 
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-surface border border-outline-variant rounded font-label-caps text-label-caps py-1 px-3 focus:border-primary-container focus:ring-1 focus:ring-primary-container/20 text-on-surface"
              >
                <option value="ALL">All Types</option>
                <option value="PUBLIC">Wholesale</option>
                <option value="INDIVIDUAL">Retail</option>
              </select>
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value)}
                className="bg-surface border border-outline-variant rounded font-label-caps text-label-caps py-1 px-3 focus:border-primary-container focus:ring-1 focus:ring-primary-container/20 text-on-surface"
                aria-label="Sort market and product results"
              >
                <option value="relevance">Best Match</option>
                <option value="distance">Nearest</option>
                <option value="rating">Top Rated</option>
                <option value="newest">Newest</option>
                <option value="price_asc">Lowest Price</option>
                <option value="price_desc">Highest Price</option>
              </select>
            </div>
          </div>

          {/* Market Directory Grid */}
          <div className="flex-grow overflow-y-auto p-md lg:p-lg bg-background space-y-lg">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-36 bg-surface-container-low animate-pulse border border-outline-variant rounded-lg"></div>
                ))}
              </div>
            ) : directoryMarkets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                {directoryMarkets.map((market: Market, index: number) => {
                  const discount = promotionsByMarket.get(market._id) || 0;
                  return (
                    <Link 
                      key={market._id}
                      href={marketHref(market)}
                      className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md hover:border-outline transition-colors duration-300 custom-shadow flex flex-col cursor-pointer group block"
                    >
                      <div className="flex justify-between items-start mb-md">
                        <div className="space-y-unit">
                          <h3 className="font-headline-md text-[20px] text-on-surface group-hover:text-primary transition-colors">{market.name}</h3>
                          <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-xs mt-unit">
                            <MapPin size={14} className="text-primary" />
                            {marketLocation(market)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {market.isSponsored && (
                            <div className="bg-surface-container-low text-on-surface-variant border border-outline-variant font-label-caps text-[9px] uppercase tracking-wider px-2 py-0.5 rounded h-fit" title="Sponsored placement (paid promotion)">
                              Sponsored
                            </div>
                          )}
                          <div className="bg-surface text-on-surface border border-outline font-label-caps text-label-caps px-2 py-1 rounded flex items-center gap-xs h-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                            Verified
                          </div>
                        </div>
                      </div>
                      <div className="mt-auto pt-md border-t border-outline-variant flex justify-between items-center">
                        <div className="flex gap-2">
                          <span className="bg-surface-container-low text-on-surface-variant font-label-caps text-label-caps px-2 py-1 rounded border border-outline-variant">
                            {market.type === 'public' ? 'Wholesale' : 'Retail'}
                          </span>
                          <span className="bg-surface-container-low text-on-surface-variant font-label-caps text-label-caps px-2 py-1 rounded border border-outline-variant">
                            {market.activeProducts || 24} Products
                          </span>
                        </div>
                        {discount > 0 && (
                          <div className="text-right">
                            <p className="font-label-caps text-label-caps text-secondary">Peak Promo</p>
                            <p className="font-data-mono text-data-mono text-primary font-bold">{discount}% OFF</p>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-xl text-center">
                <span className="material-symbols-outlined text-primary/40 text-5xl">storefront</span>
                <h3 className="mt-4 text-headline-md font-bold text-on-surface font-sans leading-tight">No Matching Markets</h3>
                <p className="mt-2 text-xs text-on-surface-variant font-semibold font-sans">Try adjusting your category or classification filters.</p>
              </div>
            )}
          </div>
        </main>

        {/* Map Explorer Side Panel (Right Column) */}
        <div className="w-full lg:w-2/5 xl:w-1/3 bg-surface-container-low relative border-l border-outline-variant hidden md:block min-h-[calc(100vh-4rem)]">
          <div className="absolute inset-0 bg-[#e4e2e1] overflow-hidden">
            <RiderMap marketId="all-admin" centerLat={-1.9441} centerLng={30.0619} marketName="Kigali markets" />
            
            {/* Overlay UI */}
            <div className="absolute bottom-md left-md bg-surface p-sm rounded shadow-sm border border-outline-variant flex items-center gap-2 z-20">
              <div className="w-3 h-3 rounded-full bg-primary-container animate-pulse"></div>
              <span className="font-label-caps text-label-caps text-on-surface">32 Active Riders</span>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}

export default function MarketsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full"></div>
      </div>
    }>
      <MarketsContent />
    </Suspense>
  );
}
