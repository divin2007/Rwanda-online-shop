'use client';

import React, { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Clock3,
  MapPin,
  MoreHorizontal,
  Package,
  Palette,
  ShieldCheck,
  Shirt,
  ShoppingCart,
  Star,
  Trophy,
  Users,
  Utensils,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/hooks/useSocket';
import { formatCurrency } from '@/lib/format';
import { marketApi, productApi, orderApi, userApi } from '@/lib/api';
import { Footer } from '@/components/layout/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { getMarketUrl, getProductUrl } from '@/lib/urls';
import { logger } from '@/lib/logger';

const RiderMap = dynamic(() => import('@/components/ui/RiderMap').then(mod => mod.RiderMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#f7f1eb]" />,
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
  activeProducts?: number;
  totalSellers?: number;
  totalOrders?: number;
  distance?: number;
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

interface SellerProfile {
  _id?: string;
  stallName?: string;
  rating?: number;
  shopDetails?: {
    name?: string;
    imageUrl?: string;
  };
}

interface Product {
  _id: string;
  name: string;
  price: number;
  unit?: string;
  images?: string[];
  inStock?: boolean;
  category?: string;
  rating?: number;
  totalOrders?: number;
  isMadeInRwanda?: boolean;
  marketId?: string | {
    _id?: string;
    slug?: string;
    name?: string;
  };
  sellerId?: string | SellerProfile;
}

interface DisplayProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  market: string;
  seller: string;
  image: string;
  href: string;
  rating: number;
  orders: number;
  madeInRwanda?: boolean;
  tag?: string;
}

interface SellerSummary {
  name: string;
  specialty: string;
  market: string;
  rating: number;
  products: number;
  image: string;
  source?: string;
}

const heroImage = 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&q=85&w=1800';

const marketImages = [
  'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&q=80&w=900',
  'https://images.unsplash.com/photo-1506617564039-2f3b650b7010?auto=format&fit=crop&q=80&w=900',
  'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&q=80&w=900',
  'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&q=80&w=900',
  'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=900',
  'https://images.unsplash.com/photo-1518843875459-f738682238a6?auto=format&fit=crop&q=80&w=900',
];

const sellerImages = [
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1512486130939-2c4f79935e4f?auto=format&fit=crop&q=80&w=300',
];

const chipLinks = [
  { label: 'Kimironko', query: 'Kimironko' },
  { label: 'Nyabugogo', query: 'Nyabugogo' },
  { label: 'Kigali City Market', query: 'Kigali City Market' },
  { label: 'Made in Rwanda', query: 'Made in Rwanda' },
  { label: 'Food', query: 'Food', icon: Utensils },
  { label: 'Crafts', query: 'Crafts', icon: Palette },
  { label: 'Textiles', query: 'Textiles', icon: Shirt },
  { label: 'Others', query: 'All', icon: MoreHorizontal },
];

const isRemoteImage = (value?: string) => Boolean(value && /^https?:\/\//i.test(value));

const marketHref = (market: Market) => getMarketUrl(market.slug || market._id);

const marketImage = (market: Market, index: number) => {
  const candidate = market.imageUrl || market.image;
  return isRemoteImage(candidate) ? candidate! : marketImages[index % marketImages.length];
};

const marketLocation = (market: Market) => market.location?.address || 'Kigali, Rwanda';

const marketSellerCount = (market: Market, index: number) => {
  return Number(market.totalSellers || 0);
};

const marketProductCount = (market: Market, index: number) => {
  return Number(market.activeProducts || 0);
};

const sellerNameFromProduct = (product: Product) => {
  if (product.sellerId && typeof product.sellerId === 'object') {
    return product.sellerId.shopDetails?.name || product.sellerId.stallName || 'Verified Seller';
  }
  return 'Verified Seller';
};

const getMarketId = (product: Product) => {
  if (!product.marketId) return '';
  return typeof product.marketId === 'object' ? product.marketId._id || '' : product.marketId;
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

const CompactMarketCard = ({ market, index }: { market: Market; index: number }) => {
  const { t } = useLanguage();
  const fallback = marketImages[index % marketImages.length];
  const [imageSrc, setImageSrc] = useState(marketImage(market, index));

  return (
    <Link
      href={marketHref(market)}
      className="group block overflow-hidden rounded-lg border border-[#e2bfb0] bg-white transition-colors hover:border-[#a04100]"
    >
      <div className="relative h-32 overflow-hidden bg-background-surface sm:h-36">
        <Image
          src={imageSrc}
          alt={market.name}
          fill
          unoptimized
          sizes="(min-width: 1024px) 300px, 46vw"
          className="object-cover transition duration-700 group-hover:scale-110"
          onError={() => setImageSrc(fallback)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-sm bg-[#ff9f1c] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#221b00]">
          <BadgeCheck size={12} className="text-accent-premium" />
          Verified
        </span>
      </div>
      <div className="space-y-3 p-3 sm:p-5">
        <div>
          <h3 className="line-clamp-1 text-base font-bold tracking-tight text-text-primary group-hover:text-primary transition-colors">{market.name}</h3>
          <p className="mt-1 line-clamp-1 text-xs font-semibold text-text-secondary">
            <span className="text-primary font-black">{marketSellerCount(market, index)}</span> Sellers · <span className="text-primary font-black">{marketProductCount(market, index).toLocaleString()}</span> Products
          </p>
          <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
            <MapPin size={13} className="text-primary/50" />
            <span className="truncate max-w-[120px]">{marketLocation(market)}</span>
            {market.distance !== undefined && market.distance !== Number.POSITIVE_INFINITY && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-black text-primary animate-reveal">
                <MapPin size={10} className="shrink-0" />
                {market.distance.toFixed(1)} km
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border-light/50">
          <span className="text-[12px] font-black text-primary tracking-wide transition-all duration-300">{t('markets_explore_button')}</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:scale-105">
            <ArrowRight size={16} />
          </div>
        </div>
      </div>
    </Link>
  );
};

const CompactProductCard = ({ product }: { product: DisplayProduct }) => {
  const { t } = useLanguage();
  return (
    <Link
      href={product.href}
      className="group block overflow-hidden rounded-lg border border-[#e2bfb0] bg-white transition-colors hover:border-[#a04100]"
    >
      <div className="relative h-36 overflow-hidden bg-background-surface sm:h-44">
        <Image
          src={product.image}
          alt={product.name}
          fill
          unoptimized
          sizes="(min-width: 1024px) 250px, 45vw"
          className="object-cover transition duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        {product.tag && (
          <span className="absolute left-3 top-3 rounded-sm bg-[#ff9f1c] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#221b00]">
            {product.tag}
          </span>
        )}
        {product.madeInRwanda && !product.tag && (
          <span className="absolute left-3 top-3 rounded-sm bg-[#ff6b00] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-white">
            {t('verified_partner')}
          </span>
        )}
        <div className="absolute bottom-4 right-4 translate-y-8 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary shadow-lg hover:bg-primary hover:text-white transition-colors">
            <ShoppingCart size={16} />
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-5">
        <p className="line-clamp-2 text-sm font-bold tracking-tight text-text-primary transition-colors group-hover:text-primary sm:text-base">{product.name}</p>
        <p className="mt-1 line-clamp-1 text-xs font-semibold text-text-muted">by {product.seller}</p>
        <div className="mt-4 flex items-end justify-between gap-2 sm:mt-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted/60">{product.category}</p>
            <p className="mt-0.5 text-base font-bold text-text-primary sm:text-lg">{formatCurrency(product.price)}</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
            <Star size={12} className="fill-amber-600 text-amber-600" />
            {product.rating}
          </div>
        </div>
      </div>
    </Link>
  );
};

const MiniFeaturedMarketCard = ({ market, index }: { market: Market; index: number }) => {
  const fallback = marketImages[index % marketImages.length];
  const [imageSrc, setImageSrc] = useState(marketImage(market, index));

  return (
    <Link href={marketHref(market)} className="group flex items-center gap-3 rounded-lg border border-border-light/40 bg-background-surface/30 p-2.5 transition-all hover:bg-background-surface/80 hover:border-[#a04100]/30">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-background-surface">
        <Image
          src={imageSrc}
          alt={market.name}
          fill
          unoptimized
          sizes="48px"
          className="object-cover transition duration-700 group-hover:scale-105"
          onError={() => setImageSrc(fallback)}
        />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-xs font-bold leading-tight text-text-primary group-hover:text-primary transition-colors">{market.name}</h3>
        <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-text-muted">
          <MapPin size={9} className="text-primary/50 shrink-0" />
          <span className="truncate">{marketLocation(market)}</span>
        </p>
      </div>
      {market.distance !== undefined && market.distance !== Number.POSITIVE_INFINITY && (
        <span className="shrink-0 text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
          {market.distance.toFixed(1)} km
        </span>
      )}
    </Link>
  );
};

const LivePlatformStats = ({ compact = false, markets = [] }: { compact?: boolean; markets?: Market[] }) => {
  const { t } = useLanguage();

  const { data: responseData } = useApi<any>(orderApi, 'get', '/orders/public/stats');
  const statsData = responseData;

  const activeSellersCount = statsData?.activeSellers !== undefined ? statsData.activeSellers : 0;
  const liveDeliveries = statsData?.liveDeliveries !== undefined ? statsData.liveDeliveries : 0;
  const ordersToday = statsData?.ordersToday !== undefined ? statsData.ordersToday : 0;
  const avgDeliveryTime = statsData?.avgDeliveryTime !== undefined ? statsData.avgDeliveryTime : 0;

  const stats = [
    { label: t('active_sellers'), value: activeSellersCount.toLocaleString(), icon: Users, color: 'text-primary' },
    { label: t('live_deliveries'), value: String(liveDeliveries), icon: Activity, color: 'text-primary' },
    { label: t('orders_today'), value: ordersToday.toLocaleString(), icon: Package, color: 'text-primary' },
    { label: t('avg_delivery'), value: avgDeliveryTime > 0 ? `${avgDeliveryTime} min` : '0 min', icon: Clock3, color: 'text-text-muted' },
  ];

  return (
    <section className="rounded-lg border border-[#e2bfb0] bg-white p-5 transition-colors hover:border-[#a04100]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-bold tracking-tight text-text-primary">{t('platform_pulse')}</h2>
          <p className="mt-0.5 text-[10px] font-medium text-text-muted">{t('real_time_metrics')}</p>
        </div>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
        </span>
      </div>
      <div className="space-y-4 pt-1">
        {stats.map((stat, idx) => (
          <div key={idx} className="flex items-center justify-between border-b border-border-light/40 pb-3 last:border-0 last:pb-0">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background-surface transition-colors group-hover:bg-primary/5">
                <stat.icon size={14} className={stat.color} />
              </div>
              <span className="text-xs font-bold text-text-secondary">{stat.label}</span>
            </div>
            <span className="text-sm font-black text-text-primary">{stat.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

const MapPanel = ({ title, compact = false }: { title: string; compact?: boolean }) => {
  const { t } = useLanguage();
  return (
    <section className="overflow-hidden rounded-lg border border-[#e2bfb0] bg-white transition-colors hover:border-[#a04100]">
      <div className="flex items-center justify-between border-b border-background-surface px-4 py-3">
        <div>
          <h2 className="text-[13px] font-bold tracking-tight text-text-primary">{title}</h2>
          {!compact && <p className="mt-0.5 text-[10px] font-medium text-text-muted">{t('active_delivery_network')}</p>}
        </div>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MapPin size={16} />
        </span>
      </div>
      <div className={compact ? 'h-[172px]' : 'h-[218px]'}>
        <RiderMap marketId="all-admin" centerLat={-1.9441} centerLng={30.0619} marketName="Kigali markets" />
      </div>
    </section>
  );
};

const MostBoughtPanel = ({
  products,
  market,
}: {
  products: DisplayProduct[];
  market?: Market;
}) => {
  const { t } = useLanguage();
  return (
    <section className="animate-reveal rounded-lg bg-[#a04100] p-6 text-white">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold leading-tight tracking-tight">{t('most_bought_today')}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-white/90">{market?.name || 'Kimironko Market Hub'}</p>
            {market?.totalOrders !== undefined && market.totalOrders > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#ff6b00] px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-white shadow-md border border-[#ff6b00]/30 animate-pulse">
                <Trophy size={10} className="shrink-0" />
                {market.totalOrders} orders
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1.5 text-right shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">{t('peak_hour')}</p>
          <p className="text-xs font-bold text-white">11:00 - 13:00</p>
        </div>
      </div>
      <div className="space-y-3">
        {products.slice(0, 4).map((product, index) => (
          <Link href={product.href} key={product.id} className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded border border-white/10 bg-white/[0.04] px-3 py-3 transition-colors hover:bg-white/10">
            <span className="text-sm font-bold text-white/40 group-hover:text-white transition-colors">{index + 1}</span>
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-bold leading-tight text-white">{product.name}</p>
              <p className="line-clamp-1 text-[11px] font-medium text-white/85">{product.seller}</p>
            </div>
            <span className="rounded-sm bg-white/20 px-2.5 py-0.5 font-mono text-[11px] font-black text-white">
              {(product.orders || 0).toLocaleString()} orders
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};



export default function HomePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: profileData, execute: refetchProfile } = useApi<any>(userApi, 'get', user ? '/users/profile' : '');
  const { data: marketsData, error: marketsError, execute: refetchMarkets } = useApi<Market[]>(marketApi, 'get', '/markets?activeOnly=true');
  const { data: productsData, error: productsError, execute: refetchProducts } = useApi<Product[]>(productApi, 'get', '/products/recommendations/for-me?limit=24');
  const { data: videosData, execute: refetchVideos } = useApi<any>(productApi, 'get', '/seller-videos?limit=8');
  const { data: madeInRwandaData, execute: refetchMadeInRwanda } = useApi<Product[]>(productApi, 'get', '/products?isMadeInRwanda=true&limit=8');
  const { data: catalogCategoriesData, execute: refetchCatalogCategories } = useApi<any[]>(productApi, 'get', '/products/catalog/categories');
  const [activeVideoIdx, setActiveVideoIdx] = useState(0);

  const liveVideos = useMemo(() => {
    return Array.isArray(videosData) ? videosData : [];
  }, [videosData]);

  const activeVideo = liveVideos[activeVideoIdx] || liveVideos[0] || null;

  const latestVideo = useMemo(() => {
    return liveVideos.length > 0 ? liveVideos[0] : null;
  }, [liveVideos]);


  // Real-time WebSocket synchronization
  const orderSocketUrl = process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006';
  const { data: socketMessage } = useSocket(orderSocketUrl, 'order:seller:updates');

  useEffect(() => {
    if (socketMessage) {
      logger.debug('[WebSocket] Order update received on Home Page:', socketMessage);
      if (socketMessage.type === 'STATUS_UPDATE' && (socketMessage.status === 'delivered' || socketMessage.status === 'confirmed')) {
        refetchMarkets();
        refetchProducts();
        refetchVideos();
        refetchMadeInRwanda();
        refetchCatalogCategories();
        if (user) refetchProfile();
      }
    }
  }, [socketMessage, refetchMarkets, refetchProducts, refetchVideos, refetchMadeInRwanda, refetchCatalogCategories, refetchProfile, user]);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          logger.warn('[Geolocation] Error getting location:', error?.message || 'unavailable');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  const liveMarkets = useMemo(() => (Array.isArray(marketsData) ? marketsData : []), [marketsData]);

  const marketsWithDistance = useMemo(() => {
    return liveMarkets.map((market) => {
      let distance = Number.POSITIVE_INFINITY;
      if (userLocation) {
        distance = getDistanceKm(userLocation.lat, userLocation.lng, market.location?.coordinates);
      }
      return {
        ...market,
        distance,
      };
    });
  }, [liveMarkets, userLocation]);

  const regionalMarkets = useMemo(() => {
    const sorted = [...marketsWithDistance];
    if (userLocation) {
      sorted.sort((a, b) => a.distance - b.distance);
    }
    return sorted;
  }, [marketsWithDistance, userLocation]);

  const recommendationProfile = useMemo(() => profileData?.data?.recommendationProfile, [profileData]);
  const discovery = useMemo(() => profileData?.data?.preferences?.discovery, [profileData]);

  const scoredMarkets = useMemo(() => {
    const marketScores = new Map<string, number>();
    if (recommendationProfile?.marketScores) {
      recommendationProfile.marketScores.forEach((m: any) => {
        marketScores.set(String(m.refId), Number(m.score || 0));
      });
    }
    const selectedMarkets = new Set((discovery?.marketIds || []).map((id: any) => String(id)));

    return marketsWithDistance.map(market => {
      let score = 0;
      if (selectedMarkets.has(market._id)) score += 12;
      score += marketScores.get(market._id) || 0;
      score += (market.rating || 0) * 1.5;
      score += (market.totalOrders || 0) * 0.04;
      return { ...market, score };
    });
  }, [marketsWithDistance, recommendationProfile, discovery]);

  const featuredMarkets = useMemo(() => {
    return [...scoredMarkets].sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [scoredMarkets]);

  const displayMarkets = regionalMarkets;

  const marketById = useMemo(() => {
    const map = new Map<string, Market>();
    marketsWithDistance.forEach(market => {
      map.set(market._id, market);
      map.set(market.slug, market);
    });
    return map;
  }, [marketsWithDistance]);

  const displayProducts = useMemo<DisplayProduct[]>(() => {
    const liveProducts = Array.isArray(productsData) ? productsData : [];
    const normalized = liveProducts
      .filter(product => product.name && Number(product.price || 0) > 0)
      .map((product) => {
        const market = marketById.get(getMarketId(product));
        const objectMarket = typeof product.marketId === 'object' ? product.marketId : undefined;
        const marketName = objectMarket?.name || market?.name || 'Local market';
        return {
          id: product._id,
          name: product.name,
          category: product.category || 'Market goods',
          price: product.price,
          market: marketName,
          seller: sellerNameFromProduct(product),
          image: isRemoteImage(product.images?.[0]) ? product.images![0] : 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600',
          href: getProductUrl(product._id),
          rating: Number(product.rating || 4.7),
          orders: Number(product.totalOrders || 0),
          madeInRwanda: Boolean(product.isMadeInRwanda),
          tag: product.isMadeInRwanda ? 'Made in Rwanda' : undefined,
        };
      });

    return normalized;
  }, [marketById, productsData]);

  const madeInRwandaProducts = useMemo<DisplayProduct[]>(() => {
    const rawList = Array.isArray(madeInRwandaData) ? madeInRwandaData : [];
    return rawList
      .filter(product => product.name && Number(product.price || 0) > 0)
      .map((product) => {
        const market = marketById.get(getMarketId(product));
        const objectMarket = typeof product.marketId === 'object' ? product.marketId : undefined;
        const marketName = objectMarket?.name || market?.name || 'Local market';
        return {
          id: product._id,
          name: product.name,
          category: product.category || 'Market goods',
          price: product.price,
          market: marketName,
          seller: sellerNameFromProduct(product),
          image: isRemoteImage(product.images?.[0]) ? product.images![0] : 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600',
          href: getProductUrl(product._id),
          rating: Number(product.rating || 4.7),
          orders: Number(product.totalOrders || 0),
          madeInRwanda: true,
          tag: 'Made in Rwanda',
        };
      });
  }, [marketById, madeInRwandaData]);

  const categoryImages: Record<string, string> = {
    grocery: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=200',
    food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=200',
    bakery: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=200',
    fashion: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200',
    shoes: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=200',
    sportswear: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&q=80&w=200',
    hardware: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&q=80&w=200',
    handicrafts: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&q=80&w=200',
    home: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&q=80&w=200',
    electronics: 'https://images.unsplash.com/photo-1588508065123-287b28e013da?auto=format&fit=crop&q=80&w=200',
    cosmetics: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=200',
    automotive: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&q=80&w=200',
    education: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=200',
    agriculture: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=200',
    services: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&q=80&w=200',
    events: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=200',
    property: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=200',
    pets: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&q=80&w=200',
    'solar-energy': 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&q=80&w=200',
    'office-business': 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&q=80&w=200',
    finance: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=200',
    other: 'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&q=80&w=200',
  };

  const dynamicBrandCategories = useMemo(() => {
    const rawList = Array.isArray(catalogCategoriesData) ? catalogCategoriesData : [];
    const categoryById = new Map(rawList.map(cat => [cat.id, cat]));

    const labelMap: Record<string, string> = {
      grocery: 'Groceries & Produce',
      food: 'Food & Beverage',
      fashion: 'Fashion & Apparel',
      shoes: 'Shoes & Footwear',
      sportswear: 'Sportswear & Fitness',
      bakery: 'Bakery & Patisserie',
      hardware: 'Hardware & Materials',
      handicrafts: 'Handicrafts & Art',
      home: 'Home & Furnishings',
      electronics: 'Electronics & Tech',
      cosmetics: 'Cosmetics & Care',
      automotive: 'Automotive & Moto',
      education: 'Stationery & Books',
      agriculture: 'Agriculture & Farming',
      services: 'Services',
      events: 'Events & Rentals',
      property: 'Real Estate',
      pets: 'Pets & Animal Care',
      'solar-energy': 'Solar & Clean Water',
      'office-business': 'Office & Business',
      finance: 'Finance & Insurance',
      other: 'Other Goods',
    };

    // Fallbacks if database has no categories or is empty
    const fallbackList = [
      { id: 'grocery', label: 'Groceries & Produce', image: categoryImages.grocery },
      { id: 'food', label: 'Food & Beverage', image: categoryImages.food },
      { id: 'bakery', label: 'Bakery & Patisserie', image: categoryImages.bakery },
      { id: 'fashion', label: 'Fashion & Apparel', image: categoryImages.fashion },
      { id: 'shoes', label: 'Shoes & Footwear', image: categoryImages.shoes },
      { id: 'sportswear', label: 'Sportswear & Fitness', image: categoryImages.sportswear },
      { id: 'hardware', label: 'Hardware & Materials', image: categoryImages.hardware },
      { id: 'handicrafts', label: 'Handicrafts & Art', image: categoryImages.handicrafts },
      { id: 'home', label: 'Home & Furnishings', image: categoryImages.home },
      { id: 'electronics', label: 'Electronics & Tech', image: categoryImages.electronics },
      { id: 'cosmetics', label: 'Cosmetics & Care', image: categoryImages.cosmetics },
      { id: 'automotive', label: 'Automotive & Moto', image: categoryImages.automotive },
      { id: 'education', label: 'Stationery & Books', image: categoryImages.education },
      { id: 'agriculture', label: 'Agriculture & Farming', image: categoryImages.agriculture },
      { id: 'services', label: 'Services', image: categoryImages.services },
      { id: 'events', label: 'Events & Rentals', image: categoryImages.events },
      { id: 'property', label: 'Real Estate', image: categoryImages.property },
      { id: 'pets', label: 'Pets & Animal Care', image: categoryImages.pets },
      { id: 'solar-energy', label: 'Solar & Clean Water', image: categoryImages['solar-energy'] },
      { id: 'office-business', label: 'Office & Business', image: categoryImages['office-business'] },
      { id: 'finance', label: 'Finance & Insurance', image: categoryImages.finance },
      { id: 'other', label: 'Other Goods', image: categoryImages.other },
    ];

    return fallbackList.slice(0, 12).map((fallback) => {
      const cat = categoryById.get(fallback.id);
      return {
        id: fallback.id,
        label: labelMap[fallback.id] || cat?.label || cat?.name || fallback.label,
        image: fallback.image,
      };
    });
  }, [catalogCategoriesData]);

  const topProducts = useMemo(
    () => [...displayProducts].sort((a, b) => (b.orders - a.orders) || (b.rating - a.rating)),
    [displayProducts]
  );

  const selectedMarket = featuredMarkets[0] || liveMarkets[0];
  const liveDataUnavailable = Boolean(marketsError || productsError);
  const supportingLocalBrandsDescription = t('supporting_local_brands_desc') === 'supporting_local_brands_desc'
    ? 'Supporting local industry and manufacturing excellence'
    : t('supporting_local_brands_desc');
  const viewAllBrandsLabel = t('view_all_brands') === 'view_all_brands'
    ? 'View All Local Brands'
    : t('view_all_brands');

  return (
    <Layout>
      <div className="min-h-screen bg-background-main text-text-primary selection:bg-primary selection:text-white">
        <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-10">
          <div className="grid min-w-0 grid-cols-1 gap-5 md:gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(340px,0.9fr)]">
            <main className="min-w-0 space-y-6 md:space-y-8">
              {/* Cinematic Hero Section */}
              <section className="animate-reveal relative min-h-[320px] overflow-hidden border border-[#e2bfb0] bg-[#1b1c1c] lg:min-h-[400px]">
                <Image
                  src={heroImage}
                  alt="Fresh produce stalls at a local market"
                  fill
                  priority
                  unoptimized
                  sizes="(min-width: 1280px) 920px, 100vw"
                  className="object-cover object-[62%_50%] opacity-50 transition-transform duration-1000 hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/35" />
                <div className="relative z-10 flex min-h-[320px] max-w-2xl flex-col justify-center p-5 sm:p-8 md:p-12 lg:min-h-[400px]">
                  <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-bold tracking-wide text-primary-light backdrop-blur-md border border-white/10">
                    <ShieldCheck size={14} className="text-primary" />
                    {t('verified_hub')}
                  </div>
                  <h1 className="max-w-xl text-[2rem] font-black leading-tight tracking-normal text-white sm:text-3xl md:text-4xl lg:text-5xl">
                    {t('trusted_markets')} <span className="text-primary">{t('delivered')}</span> {t('to_you')}
                  </h1>
                  <p className="mt-6 max-w-md text-base font-medium leading-relaxed text-white/70 lg:text-lg">
                    {t('discover_verified_sellers')}
                  </p>
                  <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-4 md:mt-10">
                    <Link href="/markets" className="rmf-btn-primary group">
                      {t('browse_markets')}
                      <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                    <Link href="/register?role=SELLER" className="inline-flex min-h-11 items-center justify-center rounded border border-white/35 bg-white/10 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white hover:text-[#ff6b00]">
                      {t('start_selling')}
                    </Link>
                    <div className="ml-2 hidden items-center gap-3 md:flex">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 backdrop-blur-md border border-primary/30">
                        <span className="font-bold text-primary">M</span>
                      </div>
                      <span className="text-xs font-bold text-white/80 tracking-wide uppercase">{t('momo_trusted')}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Operational Activity and Pulse Side-by-Side */}
              <div className="animate-reveal [animation-delay:200ms] grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] md:gap-6">
                <MapPanel title="Live Market Activity Map" />
                <LivePlatformStats compact markets={liveMarkets} />
              </div>

              <section className="animate-reveal [animation-delay:400ms] rounded-lg border border-[#e2bfb0] bg-white p-4 sm:p-6">
                <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-primary/50">{t('pick_nearby_market')}</p>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {chipLinks.map((chip, index) => {
                    const Icon = chip.icon;
                    return (
                      <Link
                        key={chip.label}
                        href={`/markets?search=${encodeURIComponent(chip.query)}`}
                        className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-5 text-[12px] font-bold transition-all duration-300 ${index === 0
                            ? 'border-primary bg-primary text-white shadow-md shadow-primary/20'
                            : 'border-border-light bg-background-surface text-text-secondary hover:border-primary hover:text-primary'
                          }`}
                      >
                        {Icon && <Icon size={14} />}
                        {chip.label}
                      </Link>
                    );
                  })}
                </div>
              </section>

              {/* Flattened layout to give sections full breathability and prevent squashing */}
              <section className="animate-reveal [animation-delay:600ms] rounded-lg border border-[#e2bfb0] bg-white p-4 sm:p-6 md:p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">{t('rwandas_market_hubs')}</h2>
                  <p className="mt-1.5 text-base font-medium text-text-muted">{t('choose_preferred_marketplace')}</p>
                </div>
                {displayMarkets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-[#e2bfb0] bg-background-surface/50 text-center">
                    <MapPin className="h-10 w-10 text-primary/45" />
                    <h3 className="mt-4 text-base font-bold text-text-primary">No Active Market Hubs</h3>
                    <p className="mt-2 text-xs font-semibold text-text-secondary">Please check back later or start onboarding as a seller.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayMarkets.slice(0, 6).map((market, index) => (
                      <CompactMarketCard key={market._id} market={market} index={index} />
                    ))}
                  </div>
                )}
              </section>

              {/* Spacious Trending Products Shelf */}
              <section id="trending-products" className="animate-reveal [animation-delay:800ms] scroll-mt-24 rounded-lg border border-[#e2bfb0] bg-white p-4 sm:p-6 md:p-8">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">{t('trending_products')}</h2>
                    <p className="mt-1.5 text-base font-medium text-text-muted">{t('most_popular_items')}</p>
                  </div>
                  {topProducts.length > 0 && (
                    <Link href="/markets" className="hidden items-center gap-2 text-base font-bold text-primary hover:underline sm:inline-flex">
                      {t('shop_all_trending')}
                      <ArrowRight size={18} />
                    </Link>
                  )}
                </div>
                {topProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-[#e2bfb0] bg-background-surface/50 text-center">
                    <Package className="h-10 w-10 text-primary/45" />
                    <h3 className="mt-4 text-base font-bold text-text-primary">No Trending Products Found</h3>
                    <p className="mt-2 text-xs font-semibold text-text-secondary">Sellers haven't listed any items today.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 md:gap-6">
                    {topProducts.slice(0, 4).map(product => (
                      <CompactProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
              </section>
              {/* Made in Rwanda Brands Section */}
              <section className="animate-reveal [animation-delay:900ms] rounded-lg border border-[#e2bfb0] bg-[#f5f3f3]/50 p-4 sm:p-6 md:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none">
                  <svg className="fill-primary" viewBox="0 0 100 100">
                    <path d="M50 0 L100 50 L50 100 L0 50 Z"></path>
                  </svg>
                </div>
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Made in Rwanda</h2>
                    <p className="mt-1.5 text-base font-medium text-text-muted">{supportingLocalBrandsDescription}</p>
                  </div>
                  <Link href="/markets?search=Made%20in%20Rwanda" className="rmf-btn-primary self-start text-xs uppercase tracking-wider py-2 px-4 flex items-center gap-2">
                    {viewAllBrandsLabel}
                    <ArrowRight size={14} />
                  </Link>
                </div>
                                 {/* Compact category bubbles */}
                <div className="grid grid-cols-2 min-[360px]:grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 xl:flex xl:flex-wrap xl:justify-center gap-4 mb-8">
                  {dynamicBrandCategories.map((brand) => (
                    <Link href={`/markets?category=${brand.id}`} key={brand.id} className="group block text-center space-y-2 cursor-pointer">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-white border border-[#e2bfb0] rounded-full flex items-center justify-center group-hover:bg-[#ffedd5]/20 group-hover:border-[#ff6b00] transition-all duration-300 shadow-sm relative overflow-hidden">
                        <Image
                           src={brand.image}
                           alt={`${brand.label} brand preview`}
                           fill
                           unoptimized
                           sizes="80px"
                           className="object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-[#a04100]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                      <span className="block text-[10px] sm:text-xs font-black uppercase tracking-[0.08em] text-text-secondary group-hover:text-primary transition-colors">{brand.label}</span>
                    </Link>
                  ))}
                </div>

                {/* Dynamic Made in Rwanda product shelf */}
                {madeInRwandaProducts.length > 0 && (
                  <div className="border-t border-[#e2bfb0]/40 pt-6">
                    <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.25em] text-[#a04100]">{t('featured_local_products') || 'Featured Local Products'}</p>
                    <div className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 sm:grid-cols-4">
                      {madeInRwandaProducts.slice(0, 4).map(product => (
                        <CompactProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </main>
 
            <aside className="min-w-0 space-y-5 md:space-y-6">
              {/* Market Stories Section */}
              <section className="animate-reveal [animation-delay:950ms] rounded-lg border border-[#e2bfb0] bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-text-primary">{t('market_stories') || 'Market Stories'}</h2>
                    <p className="mt-0.5 text-xs font-medium text-text-muted">{t('watch_local_producers') || 'Watch live from local producers'}</p>
                  </div>
                  <Link href="/videos" className="text-xs font-bold text-primary hover:underline">
                    {t('open_feed') || 'Open feed'}
                  </Link>
                </div>

                {/* Instagram style story bubbles */}
                {liveVideos.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                    {liveVideos.slice(0, 5).map((video, idx) => {
                      const seller = video.sellerId && typeof video.sellerId === 'object' ? video.sellerId : null;
                      const avatar = seller?.avatar || sellerImages[idx % sellerImages.length];
                      const isActive = idx === activeVideoIdx;
                      return (
                        <button
                          key={video._id}
                          onClick={() => setActiveVideoIdx(idx)}
                          className="flex flex-col items-center shrink-0 space-y-1 focus:outline-none"
                        >
                          <div className={`relative p-0.5 rounded-full border-2 transition-all duration-300 ${
                            isActive ? 'border-[#ff6b00]' : 'border-border-light hover:border-[#ff9f1c]'
                          }`}>
                            <div className="w-12 h-12 rounded-full overflow-hidden relative">
                              <Image src={avatar} alt="Seller Avatar" fill unoptimized sizes="48px" className="object-cover" />
                            </div>
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-[#ff6b00] px-1 py-0.25 text-[7px] font-black text-white uppercase scale-90">LIVE</span>
                          </div>
                          <span className="text-[9px] font-bold text-text-muted truncate max-w-[50px]">
                            {seller ? `@${seller.stallName || seller.shopDetails?.name || 'Seller'}` : '@Seller'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <Link href="/videos" className="relative block aspect-[16/10] rounded-xl overflow-hidden shadow-sm group border border-[#e2bfb0] bg-background-surface">
                  <Image
                    src={activeVideo ? activeVideo.thumbnailUrl || activeVideo.videoUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400" : "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400"}
                    alt={activeVideo ? activeVideo.title : "Market story preview"}
                    fill
                    unoptimized
                    sizes="320px"
                    className="object-cover transition duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3">
                    <h4 className="text-white font-bold text-xs line-clamp-1 leading-snug">
                      {activeVideo ? activeVideo.title : 'Authentic Made in Rwanda products'}
                    </h4>
                    <div className="flex justify-between items-center text-white/70 text-[9px] font-bold uppercase tracking-wider mt-1.5">
                      <span>{activeVideo ? `${activeVideo.viewsCount || activeVideo.views || 45} views` : '12.4k Views'}</span>
                      <span className="inline-flex items-center gap-0.5 text-primary-light">
                        View Story <ArrowRight size={10} />
                      </span>
                    </div>
                  </div>
                </Link>
              </section>
 
              <section className="animate-reveal [animation-delay:1000ms] rounded-lg border border-[#e2bfb0] bg-white p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-text-primary">{t('featured_markets')}</h2>
                    <p className="mt-1 text-xs font-medium text-text-muted">{t('explore_top_local_hubs')}</p>
                  </div>
                  {featuredMarkets.length > 0 && (
                    <Link href="/markets" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
                      {t('view_all')}
                      <ChevronDown size={16} />
                    </Link>
                  )}
                </div>
                {featuredMarkets.length === 0 ? (
                  <div className="py-6 text-center text-xs font-semibold text-text-muted">No featured hubs available.</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {featuredMarkets.slice(0, 4).map((market, index) => (
                      <MiniFeaturedMarketCard key={market._id} market={market} index={index} />
                    ))}
                  </div>
                )}
              </section>

              {topProducts.length > 0 && (
                <MostBoughtPanel products={topProducts} market={selectedMarket} />
              )}

              <section className="animate-reveal [animation-delay:1200ms] rounded-lg border border-[#e2bfb0] bg-white p-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    [t('verified_vendors'), BadgeCheck, 'text-[#ff9f1c] bg-[#ff9f1c]/10'],
                    [t('buyer_protection'), ShieldCheck, 'text-[#ff6b00] bg-[#ff6b00]/10'],
                    [t('momo_checkout'), ShoppingCart, 'text-[#a04100] bg-[#a04100]/10'],
                    [t('fast_delivery'), Clock3, 'text-text-muted bg-background-surface'],
                  ].map(([label, Icon, colorClass]) => {
                    const TrustIcon = Icon as typeof BadgeCheck;
                    return (
                      <div key={label as string} className="flex items-center gap-2 rounded-lg bg-background-surface/40 p-2 border border-border-light/20 transition-all hover:bg-white hover:shadow-sm">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${colorClass}`}>
                          <TrustIcon size={14} />
                        </div>
                        <p className="text-[10px] font-bold leading-tight text-text-primary truncate">{label as string}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </aside>
          </div>
        </div>
        <Footer />
      </div>
    </Layout>
  );
}
