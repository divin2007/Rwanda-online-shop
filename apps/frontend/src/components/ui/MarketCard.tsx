'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Clock3, MapPin, PackageCheck, ShieldCheck, Star, Store, TrendingUp } from 'lucide-react';
import { getMarketUrl } from '@/lib/urls';

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
  const imageUrl = market.imageUrl || market.image || fallbackImage;

  return (
    <Link
      href={getMarketUrl(market.slug)}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-[#e2bfb0] bg-white transition-colors hover:border-[#a04100]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#efeded]">
        <div
          className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.03]"
          style={{ backgroundImage: `url("${imageUrl}")` }}
          aria-label={market.name}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-sm bg-[#ff9f1c] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#221b00]">
            <BadgeCheck size={12} />
            Verified
          </span>
          {maxDiscount && maxDiscount > 0 ? (
            <span className="rounded-sm bg-[#ba1a1a] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-white">
              {maxDiscount}% off
            </span>
          ) : null}
        </div>

        <div className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-sm px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] ${
          open ? 'bg-white text-[#a04100]' : 'bg-[#1b1c1c] text-white'
        }`}>
          <Clock3 size={12} />
          {open ? 'Open' : 'Closed'}
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffb693]">
            {marketTypeLabel}
          </p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h3 className={`${isCompact ? 'text-lg' : 'text-2xl'} line-clamp-1 font-black leading-tight text-white drop-shadow`}>
              {market.name}
            </h3>
            {rating > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-white px-2 py-1 text-xs font-bold text-[#1b1c1c]">
                <Star size={12} className="fill-[#f59e0b] text-[#f59e0b]" />
                {rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={`flex flex-1 flex-col ${isCompact ? 'p-3' : 'p-4'}`}>
        <p className={`line-clamp-2 font-medium leading-6 text-[#574e47] ${isCompact ? 'text-xs' : 'text-sm'}`}>
          {market.description || 'Shop verified sellers, fresh products, and delivery-ready local goods.'}
        </p>

        <div className={`grid gap-2 ${market.totalOrders && market.totalOrders > 0 ? 'grid-cols-3' : 'grid-cols-2'} ${isCompact ? 'mt-3' : 'mt-4'}`}>
          <div className="rounded border border-[#ebdcd0] bg-[#fbf9f8] p-3">
            <div className="flex items-center gap-1.5 text-[#a04100]">
              <Store size={15} />
              <span className="text-lg font-black text-[#1b1c1c]">{market.type === 'individual' ? 1 : sellers}</span>
            </div>
            <p className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#574e47]">
              {market.type === 'individual' ? 'Shop' : 'Sellers'}
            </p>
          </div>

          <div className="rounded border border-[#ebdcd0] bg-[#fbf9f8] p-3">
            <div className="flex items-center gap-1.5 text-[#a04100]">
              <PackageCheck size={15} />
              <span className="text-lg font-black text-[#1b1c1c]">{products}</span>
            </div>
            <p className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#574e47]">Products</p>
          </div>

          {market.totalOrders !== undefined && market.totalOrders > 0 && (
            <div className="rounded border border-[#e2bfb0] bg-[#ffedd5] p-3">
              <div className="flex items-center gap-1.5 text-[#a04100]">
                <TrendingUp size={15} />
                <span className="text-lg font-black text-[#1b1c1c]">{market.totalOrders}</span>
              </div>
              <p className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#7a3000]">Orders</p>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-[#574e47]">
          <MapPin size={15} className="shrink-0 text-[#a04100]" />
          <span className="truncate">{market.location?.address || 'Rwanda'}</span>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-[#ebdcd0] pt-4">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#a04100]">
            <ShieldCheck size={14} />
            Visit market
          </span>
          <ArrowRight className="text-[#a04100] transition-transform group-hover:translate-x-1" size={17} />
        </div>
      </div>
    </Link>
  );
};
