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
import { marketApi, productApi, orderApi, userApi, sellerApi } from '@/lib/api';
import { Footer } from '@/components/layout/Footer';
import { PriceIndexWidget } from '@/components/ui/PriceIndexWidget';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { getMarketUrl, getProductUrl } from '@/lib/urls';
import { resolveUploadUrl } from '@/lib/uploadUrls';

const RiderMap = dynamic(() => import('@/components/ui/RiderMap').then(mod => mod.RiderMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-container-low rounded-lg" />,
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

const productFallbackImage = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400';

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

const hasDisplayableImage = (value?: string | null) => Boolean(value && value.trim());

const marketHref = (market: Market) => getMarketUrl(market.slug || market._id);

const marketImage = (market: Market, index: number) => {
  const candidate = market.imageUrl || market.image;
  return hasDisplayableImage(candidate) ? resolveUploadUrl(candidate, 'market') : marketImages[index % marketImages.length];
};

const productImage = (images?: string[]) => {
  const candidate = Array.isArray(images) ? images.find(image => hasDisplayableImage(image)) : '';
  return candidate ? resolveUploadUrl(candidate, 'product') : productFallbackImage;
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
      className="group block overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest custom-shadow hover:border-primary transition-all duration-300"
    >
      <div className="relative h-32 overflow-hidden bg-surface-container-low sm:h-36">
        <Image
          src={imageSrc}
          alt={market.name}
          fill
          unoptimized
          sizes="(min-width: 1024px) 300px, 46vw"
          className="object-cover transition duration-700 group-hover:scale-110"
          onError={() => setImageSrc(fallback)}
        />
        <div className="absolute inset-0 bg-[#ff6b00]/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-xs bg-surface-container-lowest px-2 py-1 rounded border border-outline font-label-caps text-label-caps text-primary shadow-sm">
          <BadgeCheck size={12} className="text-primary-container shrink-0" />
          Verified Hub
        </span>
      </div>
      <div className="space-y-sm p-md">
        <div>
          <h3 className="line-clamp-1 text-body-lg font-bold text-on-surface group-hover:text-primary transition-colors">{market.name}</h3>
          <div className="mt-xs flex items-center gap-sm font-data-mono text-data-mono-sm text-on-surface-variant">
            <span><strong className="text-primary-container">{marketSellerCount(market, index)}</strong> Sellers</span>
            <span className="text-outline-variant">/</span>
            <span><strong className="text-primary-container">{marketProductCount(market, index).toLocaleString()}</strong> Products</span>
          </div>
          <div className="mt-md flex items-center gap-xs text-body-md text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-primary">location_on</span>
            <span className="truncate max-w-[120px] font-label-caps text-label-caps">{marketLocation(market)}</span>
            {market.distance !== undefined && market.distance !== Number.POSITIVE_INFINITY && (
              <span className="ml-auto inline-flex items-center gap-xs rounded bg-primary-container/10 px-2 py-0.5 font-data-mono text-[10px] text-primary-container animate-reveal">
                {market.distance.toFixed(1)} km
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between pt-sm border-t border-outline-variant">
          <span className="font-label-caps text-label-caps text-primary">{t('markets_explore_button') || 'Explore Hub'}</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-primary transition-all duration-300 group-hover:bg-primary-container group-hover:text-on-primary group-hover:scale-105">
            <ArrowRight size={14} />
          </div>
        </div>
      </div>
    </Link>
  );
};

const CompactProductCard = ({ product }: { product: DisplayProduct }) => {
  const { t } = useLanguage();
  const [imageSrc, setImageSrc] = useState(product.image || productFallbackImage);

  useEffect(() => {
    setImageSrc(product.image || productFallbackImage);
  }, [product.image]);

  return (
    <Link
      href={product.href}
      className="group block overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest custom-shadow hover:border-primary transition-all duration-300"
    >
      <div className="relative h-36 overflow-hidden bg-surface-container-low sm:h-44">
        <Image
          src={imageSrc}
          alt={product.name}
          fill
          unoptimized
          sizes="(min-width: 1024px) 250px, 45vw"
          className="object-cover transition duration-700 group-hover:scale-110"
          onError={() => setImageSrc(productFallbackImage)}
        />
        <div className="absolute inset-0 bg-[#ff6b00]/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        {product.tag && (
          <span className="absolute left-3 top-3 rounded bg-primary-container text-on-primary px-2 py-1 font-label-caps text-label-caps shadow-sm">
            {product.tag}
          </span>
        )}
        {product.madeInRwanda && !product.tag && (
          <div className="absolute left-3 top-3 bg-surface-container-lowest border border-outline rounded-full px-2 py-1 flex items-center gap-xs shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
            <span className="font-label-caps text-label-caps text-[9px] text-on-surface">Made in Rwanda</span>
          </div>
        )}
        <div className="absolute bottom-4 right-4 translate-y-8 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 z-10">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-on-primary shadow-lg hover:bg-primary transition-colors">
            <ShoppingCart size={15} />
          </div>
        </div>
      </div>
      <div className="p-md space-y-xs">
        <p className="line-clamp-2 text-body-md font-bold text-on-surface group-hover:text-primary transition-colors leading-tight">{product.name}</p>
        <p className="font-label-caps text-label-caps text-on-surface-variant">by {product.seller}</p>
        <div className="pt-sm border-t border-outline-variant flex items-center justify-between mt-sm">
          <div>
            <p className="font-label-caps text-[9px] tracking-wider text-on-surface-variant uppercase">{product.category}</p>
            <p className="font-data-mono text-data-mono text-primary-container font-bold text-base mt-0.5">{formatCurrency(product.price)}</p>
          </div>
          <div className="flex items-center gap-xs font-data-mono text-data-mono-sm text-amber-800 bg-amber-500/10 px-2 py-0.5 rounded-full">
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
    <Link href={marketHref(market)} className="group flex items-center gap-md rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow hover:border-primary transition-all duration-300">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-surface-container-low">
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
        <h3 className="line-clamp-1 text-body-md font-bold text-on-surface group-hover:text-primary transition-colors leading-tight">{market.name}</h3>
        <p className="mt-xs flex items-center gap-xs font-label-caps text-label-caps text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px] text-primary">location_on</span>
          <span className="truncate">{marketLocation(market)}</span>
        </p>
      </div>
      {market.distance !== undefined && market.distance !== Number.POSITIVE_INFINITY && (
        <span className="shrink-0 font-data-mono text-data-mono-sm text-primary-container bg-primary-container/10 px-2 py-0.5 rounded-full">
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

  const stats = [
    { label: t('active_sellers') || 'Active Sellers', value: activeSellersCount > 0 ? `${activeSellersCount}+` : '1,240+', icon: Users, color: 'text-primary-container' },
    { label: t('live_deliveries') || 'Deliveries Today', value: liveDeliveries > 0 ? String(liveDeliveries) : '8,452', icon: Activity, color: 'text-primary-container' },
    { label: t('orders_today') || 'Successful Orders', value: ordersToday > 0 ? `${ordersToday}%` : '99.8%', icon: Package, color: 'text-primary-container' },
  ];

  return (
    <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow hover:border-primary transition-all duration-300">
      <div className="mb-md flex items-center justify-between border-b border-outline-variant pb-sm">
        <div>
          <h2 className="font-label-caps text-label-caps text-on-surface">{t('platform_pulse') || 'Platform Pulse'}</h2>
          <p className="mt-xs text-data-mono-sm text-on-surface-variant">{t('real_time_metrics') || 'Operational stats'}</p>
        </div>
        <span className="flex h-2.5 w-2.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary-container"></span>
        </span>
      </div>
      <div className="space-y-md">
        {stats.map((stat, idx) => (
          <div key={idx} className="flex items-center justify-between border-b border-outline-variant/40 pb-md last:border-0 last:pb-0">
            <div className="flex items-center gap-md">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low text-primary-container">
                <stat.icon size={16} />
              </div>
              <span className="font-body-md text-body-md text-on-surface-variant">{stat.label}</span>
            </div>
            <span className="font-data-mono text-data-mono text-on-surface text-base">{stat.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

const MapPanel = ({ title, compact = false }: { title: string; compact?: boolean }) => {
  const { t } = useLanguage();
  return (
    <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest custom-shadow hover:border-primary transition-all duration-300">
      <div className="flex items-center justify-between border-b border-outline-variant px-md py-sm">
        <div>
          <h2 className="font-label-caps text-label-caps text-on-surface">{title}</h2>
          {!compact && <p className="mt-xs text-data-mono-sm text-on-surface-variant">{t('active_delivery_network') || 'Rider delivery network'}</p>}
        </div>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
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
    <section className="animate-reveal rounded-lg bg-[#a04100] p-md text-white border border-outline custom-shadow">
      <div className="mb-md flex items-start justify-between gap-sm">
        <div>
          <h2 className="font-headline-md text-headline-md text-white leading-tight">{t('most_bought_today') || 'Most Bought Today'}</h2>
          <div className="mt-xs flex flex-wrap items-center gap-xs">
            <p className="font-body-md text-body-md text-white/95">{market?.name || 'Kimironko Market Hub'}</p>
            {market?.totalOrders !== undefined && market.totalOrders > 0 && (
              <span className="inline-flex items-center gap-xs rounded-full bg-primary-container px-2.5 py-0.5 font-data-mono text-[10px] font-bold text-white shadow-md animate-pulse">
                <Trophy size={10} className="shrink-0" />
                {market.totalOrders} orders
              </span>
            )}
          </div>
        </div>
        <div className="rounded border border-white/20 bg-white/10 px-md py-sm text-right shrink-0">
          <p className="font-label-caps text-[9px] text-white/60">{t('peak_hour') || 'Peak Hour'}</p>
          <p className="font-data-mono text-data-mono-sm text-white font-bold">11:00 - 13:00</p>
        </div>
      </div>
      <div className="space-y-sm">
        {products.slice(0, 4).map((product, index) => (
          <Link href={product.href} key={product.id} className="group grid grid-cols-[auto_1fr_auto] items-center gap-md rounded border border-white/10 bg-white/[0.04] p-md transition-colors hover:bg-white/10">
            <span className="font-data-mono text-data-mono-sm text-white/40 group-hover:text-white transition-colors">{index + 1}</span>
            <div className="min-w-0">
              <p className="line-clamp-1 text-body-md font-semibold leading-tight text-white">{product.name}</p>
              <p className="line-clamp-1 font-label-caps text-[10px] text-white/80">{product.seller}</p>
            </div>
            <span className="rounded bg-white/20 px-2 py-0.5 font-data-mono text-[11px] font-black text-white">
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
  const { data: marketsData, error: marketsError, execute: refetchMarkets } = useApi<Market[]>(marketApi, 'get', '/markets');
  const { data: productsData, error: productsError, execute: refetchProducts } = useApi<Product[]>(productApi, 'get', '/products?limit=24');
  const { data: videosData, execute: refetchVideos } = useApi<any>(productApi, 'get', '/seller-videos?limit=8');
  const { data: madeInRwandaData, execute: refetchMadeInRwanda } = useApi<Product[]>(productApi, 'get', '/products?isMadeInRwanda=true&limit=8');
  const { data: catalogCategoriesData, execute: refetchCatalogCategories } = useApi<any[]>(productApi, 'get', '/products/catalog/categories');
  const { data: statsData } = useApi<any>(orderApi, 'get', '/orders/public/stats');
  const [activeVideoIdx, setActiveVideoIdx] = useState(0);

  // Food & Dining: approved restaurant/hotel/café sellers with a menu preview.
  const [foodSellers, setFoodSellers] = useState<Array<{ seller: any; items: any[] }>>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await sellerApi.get('/sellers/discover?businessType=RESTAURANT,HOTEL,CAFE');
        const sellers = (res.data?.data || []).filter((s: any) => s.isApproved).slice(0, 8);
        const withPreview = await Promise.all(
          sellers.map(async (seller: any) => {
            try {
              const menuRes = await sellerApi.get(`/sellers/menu/public/${seller._id}`);
              const menu = menuRes.data?.data;
              const items = (menu?.sections || []).flatMap((sec: any) => sec.items || []).slice(0, 3);
              if (items.length > 0) return { seller, items };
            } catch { /* no menu */ }
            return null;
          })
        );
        if (!cancelled) setFoodSellers(withPreview.filter(Boolean).slice(0, 6) as Array<{ seller: any; items: any[] }>);
      } catch {
        if (!cancelled) setFoodSellers([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const liveVideos = useMemo(() => {
    return Array.isArray(videosData) ? videosData : [];
  }, [videosData]);

  const activeVideo = liveVideos[activeVideoIdx] || liveVideos[0] || null;

  const latestVideo = useMemo(() => {
    return liveVideos.length > 0 ? liveVideos[0] : null;
  }, [liveVideos]);

  const orderSocketUrl = process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006';
  const { data: socketMessage } = useSocket(orderSocketUrl, 'order:seller:updates');

  useEffect(() => {
    if (socketMessage) {
      console.log('[WebSocket] Order update received on Home Page:', socketMessage);
      if (socketMessage.type === 'STATUS_UPDATE' && (socketMessage.status === 'delivered' || socketMessage.status === 'confirmed')) {
        refetchMarkets();
        refetchProducts();
        refetchVideos();
        refetchMadeInRwanda();
      }
    }
  }, [socketMessage, refetchMarkets, refetchProducts, refetchVideos, refetchMadeInRwanda]);

  const liveMarkets = useMemo(() => {
    return Array.isArray(marketsData) ? marketsData : [];
  }, [marketsData]);

  const liveProducts = useMemo(() => {
    return Array.isArray(productsData) ? productsData : [];
  }, [productsData]);

  const madeInRwandaRaw = useMemo(() => {
    return Array.isArray(madeInRwandaData) ? madeInRwandaData : [];
  }, [madeInRwandaData]);

  const userLocation = useMemo(() => {
    if (typeof window !== 'undefined' && profileData?.location?.coordinates) {
      const [lng, lat] = profileData.location.coordinates;
      return { lat, lng };
    }
    return null;
  }, [profileData]);

  const featuredMarkets = useMemo(() => {
    return liveMarkets.filter(m => m.rating && m.rating >= 4.5);
  }, [liveMarkets]);

  const sortedMarkets = useMemo(() => {
    if (!userLocation) return liveMarkets;
    return [...liveMarkets].map(m => {
      const dist = getDistanceKm(userLocation.lat, userLocation.lng, m.location?.coordinates);
      return { ...m, distance: dist };
    }).sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }, [liveMarkets, userLocation]);

  const displayMarkets = useMemo(() => {
    return sortedMarkets.map(m => {
      let imageIdx = 0;
      if (m._id) {
        let sum = 0;
        for (let i = 0; i < m._id.length; i++) sum += m._id.charCodeAt(i);
        imageIdx = sum;
      }
      return {
        ...m,
        imageUrl: marketImage(m, imageIdx),
      };
    });
  }, [sortedMarkets]);

  const displayProducts = useMemo((): DisplayProduct[] => {
    return liveProducts.map(p => {
      const marketObj = p.marketId && typeof p.marketId === 'object' ? p.marketId : null;
      const sellerName = sellerNameFromProduct(p);
      return {
        id: p._id,
        name: p.name,
        category: p.category || 'Grocery',
        price: p.price,
        market: marketObj?.name || 'Kigali Central Hub',
        seller: sellerName,
        image: productImage(p.images),
        href: `/product/${p._id}`,
        rating: p.rating || 4.5,
        orders: p.totalOrders || 12,
        madeInRwanda: p.isMadeInRwanda,
      };
    });
  }, [liveProducts]);

  const madeInRwandaProducts = useMemo((): DisplayProduct[] => {
    return madeInRwandaRaw.map(p => {
      const marketObj = p.marketId && typeof p.marketId === 'object' ? p.marketId : null;
      const sellerName = sellerNameFromProduct(p);
      return {
        id: p._id,
        name: p.name,
        category: p.category || 'Grocery',
        price: p.price,
        market: marketObj?.name || 'Kigali Central Hub',
        seller: sellerName,
        image: productImage(p.images),
        href: `/product/${p._id}`,
        rating: p.rating || 4.8,
        orders: p.totalOrders || 24,
        madeInRwanda: true,
      };
    });
  }, [madeInRwandaRaw]);

  const categoryImages: Record<string, string> = {
    grocery: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200',
    food: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=200',
    bakery: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=200',
    fashion: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=200',
    shoes: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=200',
    sportswear: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&q=80&w=200',
    hardware: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=200',
    handicrafts: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=200',
    home: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=200',
    electronics: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&q=80&w=200',
    cosmetics: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=200',
    automotive: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=200',
    education: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=200',
    agriculture: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=200',
    services: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=200',
    events: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=200',
    property: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=200',
    pets: 'https://images.unsplash.com/photo-1477884218264-755734d2f763?auto=format&fit=crop&q=80&w=200',
    'solar-energy': 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&q=80&w=200',
    'office-business': 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=200',
    finance: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&q=80&w=200',
    other: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&q=80&w=200',
  };

  const dynamicBrandCategories = useMemo(() => {
    const list = Array.isArray(catalogCategoriesData) ? catalogCategoriesData : [];
    const categoryById = new Map(list.map((c: any) => [c._id || c.id, c]));
    
    const labelMap: Record<string, string> = {
      grocery: 'Groceries & Produce',
      food: 'Food & Beverage',
      bakery: 'Bakery & Patisserie',
      fashion: 'Fashion & Apparel',
      shoes: 'Shoes & Footwear',
      sportswear: 'Sportswear & Fitness',
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
  const supportingLocalBrandsDescription = t('supporting_local_brands_desc') === 'supporting_local_brands_desc'
    ? 'Supporting local industry and manufacturing excellence'
    : t('supporting_local_brands_desc');
  const viewAllBrandsLabel = t('view_all_brands') === 'view_all_brands'
    ? 'View All Local Brands'
    : t('view_all_brands');

  return (
    <Layout>
      <div className="min-h-screen bg-background text-on-surface selection:bg-primary-container selection:text-on-primary animate-reveal">
        <div className="w-full px-gutter md:px-xl py-md md:py-lg space-y-xl">
          
          {/* Hero Section */}
          <section className="relative rounded-xl bg-surface-container-lowest border border-outline-variant overflow-hidden custom-shadow min-h-[400px] flex flex-col items-center justify-center text-center p-xl">
            <div className="absolute inset-0 hero-glow pointer-events-none"></div>
            <div className="absolute inset-0 opacity-10 bg-cover bg-center mix-blend-multiply" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&q=80&w=1000')` }}></div>
            <div className="relative z-10 max-w-2xl mx-auto space-y-lg">
              <h1 className="font-display-lg text-display-lg text-on-surface">Trusted markets delivered to you.</h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant">Connecting you with premium sellers across Rwanda through verified operational networks.</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const searchInput = (e.currentTarget.elements.namedItem('search') as HTMLInputElement).value;
                if (searchInput.trim()) {
                  window.location.assign(`/markets?search=${encodeURIComponent(searchInput.trim())}`);
                }
              }} className="relative mt-lg max-w-xl mx-auto w-full group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary text-xl">search</span>
                <input name="search" className="w-full pl-12 pr-4 py-4 bg-surface border border-outline-variant rounded-full font-body-md text-on-surface shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all group-hover:border-primary-container" placeholder="Search products, markets, or sellers..." type="text"/>
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary-container text-on-primary px-6 py-2 rounded-full font-label-caps text-label-caps hover:bg-primary transition-colors">Search</button>
              </form>
            </div>
          </section>

          {/* Market Price Index (Feature 10) */}
          <section className="space-y-md">
            <PriceIndexWidget title="Weekly Market Price Index" />
          </section>

          {/* Food & Dining */}
          {foodSellers.length > 0 && (
            <section className="space-y-md">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container">restaurant_menu</span>
                <h2 className="font-display-md text-[24px] font-bold text-on-surface">Food &amp; Dining</h2>
                <Link href="/markets?businessType=RESTAURANT" className="ml-auto font-label-caps text-label-caps text-primary hover:text-primary-container">
                  See all
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
                {foodSellers.map(({ seller, items }) => (
                  <Link
                    key={seller._id}
                    href={marketHref({ slug: (typeof seller.marketId === 'object' ? seller.marketId?.slug : undefined) || seller.shopDetails?.slug, _id: typeof seller.marketId === 'object' ? seller.marketId?._id : seller.marketId } as any)}
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow hover:border-primary transition-all duration-300 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-label-caps text-label-caps text-on-surface truncate">
                        {seller.shopDetails?.name || seller.stallName || 'Kitchen'}
                      </h3>
                      <span className="text-[10px] font-bold uppercase text-primary-container">
                        {seller.businessType === 'HOTEL' ? 'Hotel' : seller.businessType === 'CAFE' ? 'Café' : 'Restaurant'}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-1">
                      {items.map((it: any, i: number) => (
                        <li key={i} className="flex justify-between text-body-sm text-on-surface-variant">
                          <span className="truncate">{it.name}</span>
                          <span className="font-data-mono text-primary-container ml-2 flex-shrink-0">{Number(it.price).toLocaleString()} RWF</span>
                        </li>
                      ))}
                    </ul>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Platform Pulse Row */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-md">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md custom-shadow hover:border-outline transition-colors flex items-center gap-md">
              <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[24px]">storefront</span>
              </div>
              <div>
                <div className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-xs">Active Sellers</div>
                <div className="font-data-mono text-data-mono text-on-surface text-xl">
                  {statsData?.activeSellers !== undefined ? `${statsData.activeSellers}+` : '1,240+'}
                </div>
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md custom-shadow hover:border-outline transition-colors flex items-center gap-md">
              <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[24px]">local_shipping</span>
              </div>
              <div>
                <div className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-xs">Deliveries Today</div>
                <div className="font-data-mono text-data-mono text-on-surface text-xl">
                  {statsData?.liveDeliveries !== undefined ? statsData.liveDeliveries.toLocaleString() : '8,452'}
                </div>
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md custom-shadow hover:border-outline transition-colors flex items-center gap-md">
              <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[24px]">check_circle</span>
              </div>
              <div>
                <div className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-xs">Successful Orders</div>
                <div className="font-data-mono text-data-mono text-on-surface text-xl">
                  {statsData?.ordersToday !== undefined ? `${statsData.ordersToday}%` : '99.8%'}
                </div>
              </div>
            </div>
          </section>

          {/* Rwanda's Market Hubs */}
          <section className="space-y-md">
            <div className="flex justify-between items-end border-b border-outline-variant pb-sm">
              <h2 className="font-headline-md text-headline-md text-on-surface">Rwanda's Market Hubs</h2>
              <Link className="font-label-caps text-label-caps text-primary hover:text-primary-container transition-colors uppercase" href="/markets">View All Hubs</Link>
            </div>
            {displayMarkets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 rounded border border-dashed border-outline-variant bg-surface-container-low text-center">
                <span className="material-symbols-outlined text-primary/40 text-4xl">storefront</span>
                <h3 className="mt-md text-body-md font-bold text-on-surface">No Active Market Hubs</h3>
                <p className="mt-xs text-xs text-on-surface-variant">Check back soon or register as a merchant.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
                {displayMarkets.slice(0, 4).map((market, index) => {
                  const image = marketImage(market, index);
                  return (
                    <Link 
                      key={market._id}
                      href={marketHref(market)}
                      className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden custom-shadow group hover:border-outline transition-all cursor-pointer block"
                    >
                      <div className="h-32 bg-surface-container-low relative overflow-hidden">
                        <img 
                          alt={market.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                          src={image}
                          onError={(event) => {
                            event.currentTarget.src = marketImages[index % marketImages.length];
                          }}
                        />
                        <div className="absolute top-sm right-sm bg-[#ffffff] bg-opacity-90 px-2 py-1 rounded font-label-caps text-label-caps text-[10px] text-primary flex items-center gap-xs">
                          <span className="w-2 h-2 rounded-full bg-primary-container"></span> Open
                        </div>
                      </div>
                      <div className="p-md space-y-sm">
                        <div className="flex justify-between items-start">
                          <h3 className="font-body-md text-body-md font-semibold text-on-surface line-clamp-1">{market.name}</h3>
                          <span className="material-symbols-outlined text-primary text-[16px]" title="Verified Hub">verified</span>
                        </div>
                        <div className="flex items-center gap-xs text-on-surface-variant">
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          <span className="font-label-caps text-label-caps truncate">{marketLocation(market)}</span>
                        </div>
                        <div className="pt-sm border-t border-outline-variant flex justify-between items-center mt-sm">
                          <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
                            {marketSellerCount(market, index)} Sellers
                          </span>
                          <div className="text-primary hover:text-primary-container transition-colors">
                            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Trending Products */}
          <section className="space-y-md">
            <div className="flex justify-between items-end border-b border-outline-variant pb-sm">
              <h2 className="font-headline-md text-headline-md text-on-surface">Trending Products</h2>
              <Link className="font-label-caps text-label-caps text-primary hover:text-primary-container transition-colors uppercase" href="/products">Shop All Products</Link>
            </div>
            {topProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 rounded border border-dashed border-outline-variant bg-surface-container-low text-center">
                <span className="material-symbols-outlined text-primary/40 text-4xl">package</span>
                <h3 className="mt-md text-body-md font-bold text-on-surface">No Trending Products Found</h3>
                <p className="mt-xs text-xs text-on-surface-variant">Products will appear once listed by merchants.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-md">
                {topProducts.slice(0, 5).map((product) => (
                  <Link 
                    key={product.id}
                    href={product.href}
                    className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md custom-shadow hover:border-outline transition-colors flex flex-col h-full group block"
                  >
                    <div className="relative w-full aspect-square bg-surface-container-low rounded-md mb-md overflow-hidden">
                      <img 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        src={product.image}
                      />
                      {product.madeInRwanda && (
                        <div className="absolute bottom-xs left-xs bg-white bg-opacity-90 border border-outline rounded-full px-2 py-1 flex items-center gap-xs shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                          <span className="font-label-caps text-label-caps text-[9px] text-on-surface">Made in Rwanda</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-grow flex flex-col justify-between">
                      <div>
                        <h4 className="font-body-md text-body-md text-on-surface line-clamp-2 leading-tight mb-xs">{product.name}</h4>
                        <p className="font-label-caps text-label-caps text-on-surface-variant mb-sm">{product.seller}</p>
                      </div>
                      <div className="mt-auto pt-sm border-t border-outline-variant">
                        <div className="flex items-baseline gap-xs">
                          <span className="font-data-mono text-data-mono text-primary-container text-lg">RWF {product.price.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </Layout>
  );
}
