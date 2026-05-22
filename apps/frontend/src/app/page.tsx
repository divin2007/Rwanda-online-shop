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

const fallbackMarkets: Market[] = [
  {
    _id: 'kimironko-market',
    name: 'Kimironko Market',
    slug: 'kimironko-market',
    location: { address: 'Kigali, Remera' },
    image: marketImages[0],
    totalSellers: 240,
    activeProducts: 3300,
    rating: 4.8,
  },
  {
    _id: 'nyabugogo-market',
    name: 'Nyabugogo',
    slug: 'nyabugogo',
    location: { address: 'Kigali, Nyarugenge' },
    image: marketImages[1],
    totalSellers: 160,
    activeProducts: 3200,
    rating: 4.6,
  },
  {
    _id: 'nironko-market',
    name: 'Nironko Market',
    slug: 'nironko-market',
    location: { address: 'Kigali, Remera' },
    image: marketImages[2],
    totalSellers: 240,
    activeProducts: 3200,
    rating: 4.7,
  },
  {
    _id: 'kigali-city-market',
    name: 'Kigali City Market',
    slug: 'kigali-city-market',
    location: { address: 'Kigali, Nyarugenge' },
    image: marketImages[3],
    totalSellers: 210,
    activeProducts: 4100,
    rating: 4.8,
  },
  {
    _id: 'gisozi-market',
    name: 'Gisozi Market',
    slug: 'gisozi-market',
    location: { address: 'Kigali, Gasabo' },
    image: marketImages[4],
    totalSellers: 95,
    activeProducts: 1600,
    rating: 4.5,
  },
  {
    _id: 'made-in-rwanda-shops',
    name: 'Made in Rwanda',
    slug: 'made-in-rwanda',
    location: { address: 'Rwanda' },
    image: marketImages[5],
    totalSellers: 130,
    activeProducts: 980,
    rating: 4.9,
  },
];

const fallbackProducts: DisplayProduct[] = [
  {
    id: 'arabica-coffee',
    name: 'Arabica Coffee Beans',
    category: 'Food',
    price: 6500,
    market: 'Kimironko Market',
    seller: 'Arabica Coffee',
    image: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&q=80&w=700',
    href: '/markets?search=Arabica%20Coffee',
    rating: 4.9,
    orders: 450,
    madeInRwanda: true,
    tag: 'Best seller',
  },
  {
    id: 'imigongo-art',
    name: 'Imigongo Art Cut',
    category: 'Crafts',
    price: 12000,
    market: 'Kigali City Market',
    seller: 'Imigongo Art',
    image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&q=80&w=700',
    href: '/markets?search=Imigongo',
    rating: 4.8,
    orders: 312,
    madeInRwanda: true,
    tag: 'Made in Rwanda',
  },
  {
    id: 'kitenge-fabric',
    name: 'Kitenge Fabric',
    category: 'Textiles',
    price: 8500,
    market: 'Nyabugogo',
    seller: 'Kitenge House',
    image: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&q=80&w=700',
    href: '/markets?search=Kitenge',
    rating: 4.7,
    orders: 290,
    madeInRwanda: true,
    tag: 'Verified',
  },
  {
    id: 'agaseke-basket',
    name: 'Agaseke Basket Set',
    category: 'Crafts',
    price: 18000,
    market: 'Made in Rwanda',
    seller: 'Umurava Crafts',
    image: 'https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&q=80&w=700',
    href: '/markets?search=Agaseke',
    rating: 4.9,
    orders: 188,
    madeInRwanda: true,
  },
  {
    id: 'fresh-green-beans',
    name: 'High-Grade Beans',
    category: 'Food',
    price: 3200,
    market: 'Kimironko Market',
    seller: 'Fresh Trade',
    image: 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?auto=format&fit=crop&q=80&w=700',
    href: '/markets?search=Beans',
    rating: 4.6,
    orders: 260,
  },
  {
    id: 'traditional-pottery',
    name: 'Traditional Pottery',
    category: 'Crafts',
    price: 24000,
    market: 'Made in Rwanda',
    seller: 'Sed by Traditional',
    image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&q=80&w=700',
    href: '/markets?search=Pottery',
    rating: 4.8,
    orders: 144,
    madeInRwanda: true,
  },
  {
    id: 'kitenge-wrap',
    name: 'Authentic Kitenge Wrap',
    category: 'Textiles',
    price: 15500,
    market: 'Kigali City Market',
    seller: 'Haye Textiles',
    image: 'https://images.unsplash.com/photo-1604176354204-9268737828e4?auto=format&fit=crop&q=80&w=700',
    href: '/markets?search=Made%20in%20Rwanda',
    rating: 4.7,
    orders: 134,
    madeInRwanda: true,
  },
  {
    id: 'seasonal-produce',
    name: 'Seasonal Produce Box',
    category: 'Food',
    price: 9800,
    market: 'Kimironko Market',
    seller: 'Aline Fresh Foods',
    image: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?auto=format&fit=crop&q=80&w=700',
    href: '/markets?search=Produce',
    rating: 4.6,
    orders: 205,
  },
];

const fallbackSellers: SellerSummary[] = [
  { name: 'Arabica Coffee', specialty: '8,500 RWF Source', market: 'Kimironko', rating: 5, products: 36, image: sellerImages[0], source: 'RMF' },
  { name: 'Imigongo Art', specialty: 'Verified Sellers', market: 'Kigali', rating: 5, products: 24, image: sellerImages[1] },
  { name: 'Kinongo', specialty: 'Verified Sellers', market: 'Kigali, Remera', rating: 4, products: 21, image: sellerImages[2] },
  { name: 'Emile N.', specialty: 'Verified Sellers', market: 'Kigali', rating: 4, products: 18, image: sellerImages[3] },
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

const fallbackSellerCounts = [240, 160, 240, 210, 95, 130, 84, 76];
const fallbackProductCounts = [3300, 3200, 3200, 4100, 1600, 980, 1200, 860];
const fallbackOrderCounts = [450, 312, 290, 188, 144];

const isRemoteImage = (value?: string) => Boolean(value && /^https?:\/\//i.test(value));

const marketHref = (market: Market) => `/market/${market.slug || market._id}`;

const marketImage = (market: Market, index: number) => {
  const candidate = market.imageUrl || market.image;
  return isRemoteImage(candidate) ? candidate! : marketImages[index % marketImages.length];
};

const marketLocation = (market: Market) => market.location?.address || 'Kigali, Rwanda';

const marketSellerCount = (market: Market, index: number) => {
  const count = Number(market.totalSellers || 0);
  return count > 0 ? count : fallbackSellerCounts[index % fallbackSellerCounts.length];
};

const marketProductCount = (market: Market, index: number) => {
  const count = Number(market.activeProducts || 0);
  return count > 0 ? count : fallbackProductCounts[index % fallbackProductCounts.length];
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

const getMarketSlug = (product: Product, market?: Market) => {
  if (typeof product.marketId === 'object' && product.marketId.slug) return product.marketId.slug;
  return market?.slug;
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
      <div className="relative h-36 overflow-hidden bg-background-surface">
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
      <div className="space-y-3 p-5">
        <div>
          <h3 className="line-clamp-1 text-base font-bold tracking-tight text-text-primary group-hover:text-primary transition-colors">{market.name}</h3>
          <p className="mt-1 line-clamp-1 text-xs font-semibold text-text-secondary">
            <span className="text-primary font-black">{marketSellerCount(market, index)}</span> Sellers · <span className="text-primary font-black">{marketProductCount(market, index).toLocaleString()}</span> Products
          </p>
          <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
            <MapPin size={13} className="text-primary/50" />
            <span className="truncate max-w-[120px]">{marketLocation(market)}</span>
            {market.distance !== undefined && market.distance !== Number.POSITIVE_INFINITY && (
              <span className="ml-auto inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-black text-primary animate-reveal">
                📍 {market.distance.toFixed(1)} km
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
      <div className="relative h-44 overflow-hidden bg-background-surface">
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
      <div className="p-5">
        <p className="line-clamp-1 text-base font-bold tracking-tight text-text-primary group-hover:text-primary transition-colors">{product.name}</p>
        <p className="mt-1 line-clamp-1 text-xs font-semibold text-text-muted">by {product.seller}</p>
        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted/60">{product.category}</p>
            <p className="text-lg font-bold text-text-primary mt-0.5">{formatCurrency(product.price)}</p>
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
    <Link href={marketHref(market)} className="group block">
      <div className="relative h-32 overflow-hidden rounded-xl bg-background-surface shadow-sm transition-all duration-300 group-hover:shadow-md">
        <Image
          src={imageSrc}
          alt={market.name}
          fill
          unoptimized
          sizes="180px"
          className="object-cover transition duration-700 group-hover:scale-110"
          onError={() => setImageSrc(fallback)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>
      <h3 className="mt-3 line-clamp-1 text-sm font-bold leading-tight text-text-primary group-hover:text-primary transition-colors">{market.name}</h3>
      <p className="mt-1 flex items-center justify-between gap-1 text-[11px] font-medium text-text-muted">
        <span className="flex items-center gap-1 truncate">
          <MapPin size={10} className="text-primary/40 shrink-0" />
          <span className="truncate">{marketLocation(market)}</span>
        </span>
        {market.distance !== undefined && market.distance !== Number.POSITIVE_INFINITY && (
          <span className="text-[9px] font-black text-primary shrink-0 animate-reveal">
            ({market.distance.toFixed(1)} km)
          </span>
        )}
      </p>
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
                🏆 {market.totalOrders} orders
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
              {(product.orders || fallbackOrderCounts[index] || 120).toLocaleString()} orders
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

  // Real-time WebSocket synchronization
  const orderSocketUrl = process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006';
  const { data: socketMessage } = useSocket(orderSocketUrl, 'order:seller:updates');

  useEffect(() => {
    if (socketMessage) {
      console.log('[WebSocket] Order update received on Home Page:', socketMessage);
      if (socketMessage.type === 'STATUS_UPDATE' && (socketMessage.status === 'delivered' || socketMessage.status === 'confirmed')) {
        refetchMarkets();
        refetchProducts();
        if (user) refetchProfile();
      }
    }
  }, [socketMessage, refetchMarkets, refetchProducts, refetchProfile, user]);

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
          console.warn('[Geolocation] Error getting location:', error);
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
      .map((product, index) => {
        const market = marketById.get(getMarketId(product));
        const objectMarket = typeof product.marketId === 'object' ? product.marketId : undefined;
        const marketName = objectMarket?.name || market?.name || 'Local market';
        const marketSlug = getMarketSlug(product, market);

        return {
          id: product._id,
          name: product.name,
          category: product.category || 'Market goods',
          price: product.price,
          market: marketName,
          seller: sellerNameFromProduct(product),
          image: isRemoteImage(product.images?.[0]) ? product.images![0] : fallbackProducts[index % fallbackProducts.length].image,
          href: marketSlug ? `/market/${marketSlug}` : '/markets',
          rating: Number(product.rating || 4.7),
          orders: Number(product.totalOrders || fallbackOrderCounts[index % fallbackOrderCounts.length]),
          madeInRwanda: Boolean(product.isMadeInRwanda),
          tag: product.isMadeInRwanda ? 'Made in Rwanda' : undefined,
        };
      });

    return normalized;
  }, [marketById, productsData]);

  const topProducts = useMemo(
    () => [...displayProducts].sort((a, b) => (b.orders - a.orders) || (b.rating - a.rating)),
    [displayProducts]
  );

  const selectedMarket = featuredMarkets[0] || liveMarkets[0];
  const liveDataUnavailable = Boolean(marketsError || productsError);

  return (
    <Layout>
      <div className="min-h-screen bg-background-main text-text-primary selection:bg-primary selection:text-white">
        <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-10">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(380px,0.9fr)]">
            <main className="space-y-8">
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
                <div className="relative z-10 flex min-h-[320px] max-w-2xl flex-col justify-center p-8 md:p-12 lg:min-h-[400px]">
                  <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-bold tracking-wide text-primary-light backdrop-blur-md border border-white/10">
                    <ShieldCheck size={14} className="text-primary" />
                    {t('verified_hub')}
                  </div>
                  <h1 className="max-w-xl text-3xl font-black leading-tight tracking-normal text-white md:text-4xl lg:text-5xl">
                    {t('trusted_markets')} <span className="text-primary">{t('delivered')}</span> {t('to_you')}
                  </h1>
                  <p className="mt-6 max-w-md text-base font-medium leading-relaxed text-white/70 lg:text-lg">
                    {t('discover_verified_sellers')}
                  </p>
                  <div className="mt-10 flex flex-wrap items-center gap-4">
                    <Link href="/markets" className="rmf-btn-primary group">
                      {t('browse_markets')}
                      <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                    <Link href="/register?role=SELLER" className="rmf-btn-outline text-white hover:text-primary">
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
              <div className="animate-reveal [animation-delay:200ms] grid gap-6 md:grid-cols-[1fr_280px]">
                <MapPanel title="Live Market Activity Map" />
                <LivePlatformStats compact markets={liveMarkets} />
              </div>

              <section className="animate-reveal [animation-delay:400ms] rounded-lg border border-[#e2bfb0] bg-white p-6">
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
              <section className="animate-reveal [animation-delay:600ms] rounded-lg border border-[#e2bfb0] bg-white p-8">
                <div className="mb-6">
                  <h2 className="text-3xl font-bold tracking-tight text-text-primary">{t('rwandas_market_hubs')}</h2>
                  <p className="mt-1.5 text-base font-medium text-text-muted">{t('choose_preferred_marketplace')}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayMarkets.slice(0, 6).map((market, index) => (
                    <CompactMarketCard key={market._id} market={market} index={index} />
                  ))}
                </div>
              </section>

              {/* Spacious Trending Products Shelf */}
              <section id="trending-products" className="animate-reveal [animation-delay:800ms] scroll-mt-24 rounded-lg border border-[#e2bfb0] bg-white p-8">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-text-primary">{t('trending_products')}</h2>
                    <p className="mt-1.5 text-base font-medium text-text-muted">{t('most_popular_items')}</p>
                  </div>
                  <Link href="/markets" className="hidden items-center gap-2 text-base font-bold text-primary hover:underline sm:inline-flex">
                    {t('shop_all_trending')}
                    <ArrowRight size={18} />
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {topProducts.slice(0, 4).map(product => (
                    <CompactProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>

              {/* Made in Rwanda Brands Section */}
              <section className="animate-reveal [animation-delay:900ms] rounded-lg border border-[#e2bfb0] bg-[#f5f3f3]/50 p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none">
                  <svg className="fill-primary" viewBox="0 0 100 100">
                    <path d="M50 0 L100 50 L50 100 L0 50 Z"></path>
                  </svg>
                </div>
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-text-primary">Made in Rwanda</h2>
                    <p className="mt-1.5 text-base font-medium text-text-muted">{t('supporting_local_brands_desc') || 'Supporting local industry and manufacturing excellence'}</p>
                  </div>
                  <Link href="/markets?search=Made%20in%20Rwanda" className="rmf-btn-primary self-start text-xs uppercase tracking-wider py-2 px-4 flex items-center gap-2">
                    {t('view_all_brands') || 'View All Local Brands'}
                    <ArrowRight size={14} />
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  {[
                    { label: 'Textiles', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=150' },
                    { label: 'Tech', image: 'https://images.unsplash.com/photo-1588508065123-287b28e013da?auto=format&fit=crop&q=80&w=150' },
                    { label: 'Furniture', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&q=80&w=150' },
                    { label: 'Agri-Processing', image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=150' },
                  ].map((brand) => (
                    <Link href={`/markets?search=${encodeURIComponent(brand.label)}`} key={brand.label} className="group block text-center space-y-3 cursor-pointer">
                      <div className="aspect-square bg-white border border-[#e2bfb0] rounded-full flex items-center justify-center p-4 group-hover:bg-[#ffedd5]/20 group-hover:border-[#ff6b00] transition-all duration-300 shadow-sm relative overflow-hidden">
                        <Image
                          src={brand.image}
                          alt={`${brand.label} brand preview`}
                          fill
                          unoptimized
                          sizes="120px"
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-[#a04100]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                      <span className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-text-secondary group-hover:text-primary transition-colors">{brand.label}</span>
                    </Link>
                  ))}
                </div>
              </section>
            </main>

            <aside className="space-y-6">
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
                <Link href="/videos" className="relative block aspect-[9/16] rounded-xl overflow-hidden shadow-md group border border-[#e2bfb0]">
                  <Image
                    src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400"
                    alt="Market story preview"
                    fill
                    unoptimized
                    sizes="300px"
                    className="object-cover transition duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex flex-col justify-end p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-6 w-6 rounded-full border border-white bg-primary/20 backdrop-blur-md overflow-hidden relative">
                        <Image
                          src={sellerImages[0]}
                          alt="Seller Avatar"
                          fill
                          unoptimized
                          sizes="24px"
                        />
                      </div>
                      <span className="text-[10px] font-black text-white uppercase tracking-wider">@HuyeProducer</span>
                    </div>
                    <h4 className="text-white font-bold text-sm line-clamp-2 leading-snug">Morning harvest ready for Kigali transport!</h4>
                    <div className="flex justify-between items-center text-white/70 text-[9px] font-bold uppercase tracking-wider mt-2.5">
                      <span>12.4k Views</span>
                      <span className="inline-flex items-center gap-1 rounded bg-[#ff6b00] px-2 py-0.5 text-[8px] font-black tracking-widest text-white shadow-md animate-pulse">
                        LIVE
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
                  <Link href="/markets" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
                    {t('view_all')}
                    <ChevronDown size={16} />
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {featuredMarkets.slice(0, 4).map((market, index) => (
                    <MiniFeaturedMarketCard key={market._id} market={market} index={index} />
                  ))}
                </div>
              </section>

              <MostBoughtPanel products={topProducts} market={selectedMarket} />

              <section className="animate-reveal [animation-delay:1200ms] rounded-lg border border-[#e2bfb0] bg-white p-6">
                {/* Adjusted grid to grid-cols-2 to give elements beautiful size */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    [t('verified_vendors'), BadgeCheck, 'accent-premium'],
                    [t('buyer_protection'), ShieldCheck, 'primary'],
                    [t('momo_checkout'), ShoppingCart, 'primary'],
                    [t('fast_delivery'), Clock3, 'primary'],
                  ].map(([label, Icon, color]) => {
                    const TrustIcon = Icon as typeof BadgeCheck;
                    return (
                      <div key={label as string} className="group rounded-xl bg-background-surface p-4 transition-all duration-300 hover:bg-white hover:shadow-md hover:border-border-light border border-transparent">
                        <TrustIcon size={20} className={`text-${color} transition-transform duration-500 group-hover:scale-110`} />
                        <p className="mt-3 text-[12px] font-bold leading-tight text-text-primary">{label as string}</p>
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
