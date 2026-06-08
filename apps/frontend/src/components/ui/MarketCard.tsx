'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Clock3, MapPin, PackageCheck, ShieldCheck, Star, Store, TrendingUp } from 'lucide-react';
import { getMarketUrl } from '@/lib/urls';
import { resolveUploadUrl } from '@/lib/uploadUrls';

interface MarketCardProps {
  market: {
    _id: string;
    name: string;
    slug: string;
    type?: string;
    imageUrl?: string;
    image?: string;
    description?: string;
    rating?: number;
    activeProducts?: number;
    location?: {
      address?: string;
    };
    operatingHours?: {
      open?: string;
      close?: string;
      daysOpen?: string[];
    };
    totalSellers?: number;
    totalOrders?: number;
  };
  index?: number;
  variant?: 'standard' | 'featured';
  isCompact?: boolean;
  maxDiscount?: number;
}

const fallbackImage = 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&q=80&w=1200';

const isMarketOpen = (operatingHours?: MarketCardProps['market']['operatingHours']) => {
  if (!operatingHours?.open || !operatingHours?.close) return true;
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'short' });
  if (operatingHours.daysOpen?.length && !operatingHours.daysOpen.includes(currentDay)) return false;

  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  };

  const current = now.getHours() * 60 + now.getMinutes();
  return current >= toMinutes(operatingHours.open) && current <= toMinutes(operatingHours.close);
};

export const MarketCard = ({ market, isCompact = false, maxDiscount }: MarketCardProps) => {
  const marketTypeLabel = market.type === 'individual' ? 'Independent shop' : 'Public market';
  const sellers = Number(market.totalSellers || 0);
  const products = Number(market.activeProducts || 0);
  const rating = Number(market.rating || 0);
  const open = isMarketOpen(market.operatingHours);
  const rawImageUrl = market.imageUrl || market.image;
  const imageUrl = rawImageUrl
    ? resolveUploadUrl(rawImageUrl, 'market')
    : fallbackImage;

  return (
    <Link
      href={getMarketUrl(market.slug)}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest custom-shadow hover:border-primary transition-all duration-300"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-container-low">
        <div
          className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.03]"
          style={{ backgroundImage: `url("${imageUrl}")` }}
          aria-label={market.name}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        <div className="absolute left-2 top-2 flex gap-xs">
          <span className="inline-flex items-center gap-xs rounded-sm bg-surface-container-lowest px-2 py-0.5 border border-outline font-label-caps text-[9px] text-primary shadow-sm">
            <BadgeCheck size={10} className="text-primary-container" />
            Verified
          </span>
          {maxDiscount && maxDiscount > 0 ? (
            <span className="rounded-sm bg-error text-on-error font-label-caps text-[9px] px-2 py-0.5 shadow-sm">
              {maxDiscount}% off
            </span>
          ) : null}
        </div>

        <div className={`absolute inline-flex items-center gap-xs rounded-sm font-label-caps text-[9px] px-2 py-0.5 right-2 top-2 ${
          open ? 'bg-surface-container-lowest text-primary-container border border-outline-variant' : 'bg-inverse-surface text-inverse-on-surface'
        }`}>
          <Clock3 size={10} />
          {open ? 'Open' : 'Closed'}
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <p className="font-label-caps text-[9px] text-[#ffb693] tracking-widest font-black uppercase">
            {marketTypeLabel}
          </p>
          <div className="mt-xs flex items-end justify-between gap-md">
            <h3 className="text-xl line-clamp-1 font-bold leading-tight text-white drop-shadow-sm font-sans">
              {market.name}
            </h3>
            {rating > 0 && (
              <span className="inline-flex shrink-0 items-center gap-xs rounded-sm bg-surface-container-lowest px-2 py-0.5 font-data-mono text-data-mono-sm text-on-surface shadow-sm">
                <Star size={10} className="fill-[#f59e0b] text-[#f59e0b]" />
                {rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-md space-y-sm">
        <p className="font-body-md text-on-surface-variant text-sm line-clamp-2 leading-relaxed">
          {market.description || 'Shop verified sellers, fresh products, and delivery-ready local goods.'}
        </p>

        <div className="grid grid-cols-3 gap-xs pt-xs">
          <div className="rounded border border-outline-variant bg-surface-container-low p-sm text-center">
            <div className="flex items-center justify-center gap-xs text-primary-container">
              <Store size={12} />
              <span className="font-data-mono text-data-mono text-on-surface text-sm font-bold">{market.type === 'individual' ? 1 : sellers}</span>
            </div>
            <p className="mt-xs font-label-caps text-[8px] text-on-surface-variant leading-none">
              {market.type === 'individual' ? 'Shop' : 'Sellers'}
            </p>
          </div>

          <div className="rounded border border-outline-variant bg-surface-container-low p-sm text-center">
            <div className="flex items-center justify-center gap-xs text-primary-container">
              <PackageCheck size={12} />
              <span className="font-data-mono text-data-mono text-on-surface text-sm font-bold">{products}</span>
            </div>
            <p className="mt-xs font-label-caps text-[8px] text-on-surface-variant leading-none">Products</p>
          </div>

          <div className="rounded border border-outline-variant bg-surface-container-low p-sm text-center">
            <div className="flex items-center justify-center gap-xs text-primary-container">
              <TrendingUp size={12} />
              <span className="font-data-mono text-data-mono text-on-surface text-sm font-bold">{market.totalOrders || 12}</span>
            </div>
            <p className="mt-xs font-label-caps text-[8px] text-on-surface-variant leading-none">Orders</p>
          </div>
        </div>

        <div className="flex items-center gap-xs font-body-md text-on-surface-variant text-xs pt-xs">
          <MapPin size={12} className="shrink-0 text-primary-container" />
          <span className="truncate">{market.location?.address || 'Rwanda'}</span>
        </div>

        <div className="pt-sm mt-auto flex items-center justify-between border-t border-outline-variant">
          <span className="inline-flex items-center gap-xs font-label-caps text-label-caps text-primary">
            <ShieldCheck size={12} className="text-primary-container" />
            Visit Market
          </span>
          <ArrowRight className="text-primary-container transition-transform group-hover:translate-x-xs" size={14} />
        </div>
      </div>
    </Link>
  );
};
