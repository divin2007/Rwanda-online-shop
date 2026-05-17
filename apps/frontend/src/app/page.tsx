'use client';

import React, { useMemo, useState } from 'react';
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
import { formatCurrency } from '@/lib/format';
import { marketApi, productApi } from '@/lib/api';
import { Footer } from '@/components/layout/Footer';

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
  if (typeof product.sellerId === 'object') {
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

const CompactMarketCard = ({ market, index }: { market: Market; index: number }) => {
  const fallback = marketImages[index % marketImages.length];
  const [imageSrc, setImageSrc] = useState(marketImage(market, index));

  return (
    <Link
      href={marketHref(market)}
      className="group block overflow-hidden rounded-2xl border border-border-light bg-white shadow-md transition-all duration-500 hover:-translate-y-2 hover:border-primary/20 hover:shadow-xl"
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
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary shadow-md backdrop-blur-sm">
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
            {marketLocation(market)}
          </p>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border-light/50">
          <span className="text-[12px] font-black text-primary tracking-wide transition-all duration-300">Explore Market</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:scale-105">
            <ArrowRight size={16} />
          </div>
        </div>
      </div>
    </Link>
  );
};

const CompactProductCard = ({ product }: { product: DisplayProduct }) => (
  <Link
    href={product.href}
    className="group block overflow-hidden rounded-2xl border border-border-light bg-white shadow-md transition-all duration-500 hover:-translate-y-2 hover:border-primary/20 hover:shadow-xl"
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
        <span className="absolute left-3 top-3 rounded-full bg-accent-premium px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg backdrop-blur-sm">
          {product.tag}
        </span>
      )}
      {product.madeInRwanda && !product.tag && (
        <span className="absolute left-3 top-3 rounded-full bg-primary/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg backdrop-blur-sm">
          Verified
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
      <p className="mt-1 flex items-center gap-1 line-clamp-1 text-[11px] font-medium text-text-muted">
        <MapPin size={10} className="text-primary/40" />
        {marketLocation(market)}
      </p>
    </Link>
  );
};

const LivePlatformStats = ({ compact = false }: { compact?: boolean }) => (
  <section className="rounded-2xl border border-border-light bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md">
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="text-[13px] font-bold tracking-tight text-text-primary">Platform Pulse</h2>
        <p className="mt-0.5 text-[10px] font-medium text-text-muted">Real-time metrics</p>
      </div>
      <span className="flex h-2 w-2 relative">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
      </span>
    </div>
    <div className="space-y-4 pt-1">
      {[
        { label: 'Active Sellers', value: '1,204', icon: Users, color: 'text-primary' },
        { label: 'Live Deliveries', value: '43', icon: Activity, color: 'text-primary' },
        { label: 'Orders Today', value: '1,892', icon: Package, color: 'text-primary' },
        { label: 'Avg. Delivery', value: '28 min', icon: Clock3, color: 'text-text-muted' },
      ].map((stat, idx) => (
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

const MapPanel = ({ title, compact = false }: { title: string; compact?: boolean }) => (
  <section className="overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm transition-all duration-300 hover:shadow-md">
    <div className="flex items-center justify-between border-b border-background-surface px-4 py-3">
      <div>
        <h2 className="text-[13px] font-bold tracking-tight text-text-primary">{title}</h2>
        {!compact && <p className="mt-0.5 text-[10px] font-medium text-text-muted">Active delivery network</p>}
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

const MostBoughtPanel = ({
  products,
  market,
}: {
  products: DisplayProduct[];
  market?: Market;
}) => (
  <section className="animate-reveal rounded-2xl premium-gradient p-6 text-white shadow-xl cinematic-shadow">
    <div className="mb-6 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold leading-tight tracking-tight">Most Bought Today</h2>
        <p className="mt-1 text-xs font-medium text-white/60">{market?.name || 'Kimironko Market Hub'}</p>
      </div>
      <div className="rounded-lg bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1.5 text-right">
        <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Peak hour</p>
        <p className="text-xs font-bold text-white">11:00 - 13:00</p>
      </div>
    </div>
    <div className="space-y-3">
      {products.slice(0, 4).map((product, index) => (
        <Link href={product.href} key={product.id} className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3 transition-all duration-300 hover:bg-white/10 hover:border-white/10">
          <span className="text-sm font-bold text-white/40 group-hover:text-white transition-colors">{index + 1}</span>
          <div className="min-w-0">
            <p className="line-clamp-1 text-sm font-bold leading-tight text-white">{product.name}</p>
            <p className="line-clamp-1 text-[11px] font-medium text-white/85">{product.seller}</p>
          </div>
          <span className="text-[11px] font-black bg-white/20 text-white px-2.5 py-0.5 rounded-full shadow-sm">
            {(product.orders || fallbackOrderCounts[index] || 120).toLocaleString()} orders
          </span>
        </Link>
      ))}
    </div>
  </section>
);



export default function HomePage() {
  const { data: marketsData, error: marketsError } = useApi<Market[]>(marketApi, 'get', '/markets?activeOnly=true');
  const { data: productsData, error: productsError } = useApi<Product[]>(productApi, 'get', '/products?limit=24&isActive=true&sortBy=-totalOrders');

  const liveMarkets = useMemo(() => (Array.isArray(marketsData) ? marketsData : []), [marketsData]);
  const displayMarkets = liveMarkets.length > 0 ? liveMarkets : fallbackMarkets;

  const marketById = useMemo(() => {
    const map = new Map<string, Market>();
    displayMarkets.forEach(market => {
      map.set(market._id, market);
      map.set(market.slug, market);
    });
    return map;
  }, [displayMarkets]);

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

    return normalized.length > 0 ? normalized : fallbackProducts;
  }, [marketById, productsData]);



  const topProducts = useMemo(
    () => [...displayProducts].sort((a, b) => (b.orders - a.orders) || (b.rating - a.rating)),
    [displayProducts]
  );



  const selectedMarket = displayMarkets[0];
  const liveDataUnavailable = Boolean(marketsError || productsError);

  return (
    <Layout>
      <div className="min-h-screen bg-background-main text-text-primary selection:bg-primary selection:text-white">
        <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-10">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(380px,0.9fr)]">
            <main className="space-y-8">
              {/* Cinematic Hero Section */}
              <section className="animate-reveal relative min-h-[320px] overflow-hidden rounded-2xl border border-border-premium bg-slate-950 shadow-xl lg:min-h-[400px]">
                <Image
                  src={heroImage}
                  alt="Fresh produce stalls at a local market"
                  fill
                  priority
                  unoptimized
                  sizes="(min-width: 1280px) 920px, 100vw"
                  className="object-cover object-[62%_50%] opacity-50 transition-transform duration-1000 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
                <div className="relative z-10 flex min-h-[320px] max-w-2xl flex-col justify-center p-8 md:p-12 lg:min-h-[400px]">
                  <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-bold tracking-wide text-primary-light backdrop-blur-md border border-white/10">
                    <ShieldCheck size={14} className="text-primary" />
                    Rwanda&apos;s verified local marketplace
                  </div>
                  <h1 className="max-w-xl text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">
                    Trusted local markets, <span className="text-primary">delivered</span> to you.
                  </h1>
                  <p className="mt-6 max-w-md text-base font-medium leading-relaxed text-white/70 lg:text-lg">
                    Discover verified sellers across Rwanda. Secure MoMo payments and live delivery tracking for every order.
                  </p>
                  <div className="mt-10 flex flex-wrap items-center gap-4">
                    <Link href="/markets" className="rmf-btn-primary group">
                      Browse Markets
                      <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                    <Link href="/register?role=SELLER" className="rmf-btn-outline text-white hover:text-primary">
                      Start Selling
                    </Link>
                    <div className="ml-2 hidden items-center gap-3 md:flex">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 backdrop-blur-md border border-primary/30">
                        <span className="font-bold text-primary">M</span>
                      </div>
                      <span className="text-xs font-bold text-white/80 tracking-wide uppercase">MoMo Trusted</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Operational Activity and Pulse Side-by-Side */}
              <div className="animate-reveal [animation-delay:200ms] grid gap-6 md:grid-cols-[1fr_280px]">
                <MapPanel title="Live Market Activity Map" />
                <LivePlatformStats compact />
              </div>

              <section className="animate-reveal [animation-delay:400ms] rounded-2xl border border-border-light bg-white p-6 shadow-sm">
                <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-primary/50">Pick a nearby market</p>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {chipLinks.map((chip, index) => {
                    const Icon = chip.icon;
                    return (
                      <Link
                        key={chip.label}
                        href={`/markets?search=${encodeURIComponent(chip.query)}`}
                        className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-5 text-[12px] font-bold transition-all duration-300 ${
                          index === 0
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
              <section className="animate-reveal [animation-delay:600ms] rounded-2xl border border-border-light bg-white p-8 shadow-sm">
                <div className="mb-6">
                  <h2 className="text-3xl font-bold tracking-tight text-text-primary">Rwanda&apos;s Market Hubs</h2>
                  <p className="mt-1.5 text-base font-medium text-text-muted">Choose your preferred local marketplace to discover thousands of verified sellers.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayMarkets.slice(0, 6).map((market, index) => (
                    <CompactMarketCard key={market._id} market={market} index={index} />
                  ))}
                </div>
              </section>

              {/* Spacious Trending Products Shelf */}
              <section id="trending-products" className="animate-reveal [animation-delay:800ms] scroll-mt-24 rounded-2xl border border-border-light bg-white p-8 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-text-primary">Trending Products</h2>
                    <p className="mt-1.5 text-base font-medium text-text-muted">Most popular items hand-picked from our verified local network.</p>
                  </div>
                  <Link href="/markets" className="hidden items-center gap-2 text-base font-bold text-primary hover:underline sm:inline-flex">
                    Shop all trending
                    <ArrowRight size={18} />
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {topProducts.slice(0, 4).map(product => (
                    <CompactProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            </main>

            <aside className="space-y-6">
              <section className="animate-reveal [animation-delay:1000ms] rounded-2xl border border-border-light bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-text-primary">Featured Markets</h2>
                    <p className="mt-1 text-xs font-medium text-text-muted">Explore top local hubs</p>
                  </div>
                  <Link href="/markets" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
                    View all
                    <ChevronDown size={16} />
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {displayMarkets.slice(0, 4).map((market, index) => (
                    <MiniFeaturedMarketCard key={market._id} market={market} index={index} />
                  ))}
                </div>
              </section>

              <MostBoughtPanel products={topProducts} market={selectedMarket} />

              <section className="animate-reveal [animation-delay:1200ms] rounded-2xl border border-border-light bg-white p-6 shadow-sm">
                {/* Adjusted grid to grid-cols-2 to give elements beautiful size */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Verified vendors', BadgeCheck, 'accent-premium'],
                    ['Buyer protection', ShieldCheck, 'primary'],
                    ['MoMo checkout', ShoppingCart, 'primary'],
                    ['Fast delivery', Clock3, 'primary'],
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
          
          <div className="mt-8">
            <Footer />
          </div>
        </div>
      </div>
    </Layout>
  );
}
