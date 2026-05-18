'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Clock3, MapPin, PackageCheck, ShieldCheck, Star, Store } from 'lucide-react';
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
  };
  index?: number;
  variant?: 'standard' | 'featured';
  isCompact?: boolean;
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

export const MarketCard = ({ market, isCompact = false }: MarketCardProps) => {
  const marketTypeLabel = market.type === 'individual' ? 'Independent shop' : 'Public market';
  const sellers = Number(market.totalSellers || 0);
  const products = Number(market.activeProducts || 0);
  const rating = Number(market.rating || 0);
  const open = isMarketOpen(market.operatingHours);
  const imageUrl = market.imageUrl || market.image || fallbackImage;

  return (
    <Link
      href={getMarketUrl(market.slug)}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border-light bg-white transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl cinematic-shadow"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-background-surface">
        <div
          className="h-full w-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
          style={{ backgroundImage: `url("${imageUrl}")` }}
          aria-label={market.name}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-cinematic via-primary-cinematic/40 to-transparent opacity-90" />

        <div className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[8px] font-bold uppercase tracking-widest text-white backdrop-blur-md border border-white/10 shadow-sm ${isCompact ? 'left-2 top-2 px-1.5 py-0.5 text-[7px]' : ''}`}>
          <BadgeCheck size={isCompact ? 10 : 14} className="text-accent-premium" />
          Verified
        </div>

        <div className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-widest backdrop-blur-md shadow-sm border border-white/10 ${open ? 'bg-white/95 text-primary' : 'bg-white/10 text-white/70'} ${isCompact ? 'right-2 top-2 px-1.5 py-0.5 text-[7px]' : ''}`}>
          <Clock3 size={isCompact ? 10 : 14} />
          {open ? 'Open' : 'Closed'}
        </div>

        <div className={`absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 text-white ${isCompact ? 'bottom-2 left-2 right-2 gap-1' : ''}`}>
          <div>
            <p className={`text-[8px] font-bold uppercase tracking-[0.2em] text-accent-premium drop-shadow-md ${isCompact ? 'text-[7px] tracking-wider' : ''}`}>{marketTypeLabel}</p>
            <h3 className={`mt-0.5 line-clamp-1 font-bold leading-tight tracking-tight text-white drop-shadow-md ${isCompact ? 'text-base' : 'text-xl'}`}>
              {market.name}
            </h3>
          </div>
          {rating > 0 && (
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 px-2 py-1 text-[9px] font-bold text-white shadow-sm ${isCompact ? 'px-1.5 py-0.5 text-[8px]' : ''}`}>
              <Star size={isCompact ? 10 : 14} className="fill-accent-premium text-accent-premium" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      <div className={`flex flex-1 flex-col ${isCompact ? 'p-3' : 'p-5'}`}>
        <p className={`line-clamp-2 text-text-secondary font-medium leading-relaxed ${isCompact ? 'text-xs min-h-[2rem]' : 'text-sm min-h-[2.75rem]'}`}>
          {market.description || 'Shop verified sellers, fresh products, and delivery-ready local goods.'}
        </p>

        <div className={`grid grid-cols-2 gap-2 ${isCompact ? 'mt-2.5 gap-1.5' : 'mt-4'}`}>
          <div className={`rounded-xl border border-border-light bg-background-surface transition-colors group-hover:border-primary/10 group-hover:bg-primary/5 ${isCompact ? 'p-1.5' : 'p-3'}`}>
            <div className="flex items-center gap-1.5 text-primary font-black">
              <Store size={isCompact ? 12 : 16} />
              <span className={`font-black text-text-primary ${isCompact ? 'text-sm' : 'text-lg'}`}>{market.type === 'individual' ? 1 : sellers}</span>
            </div>
            <p className={`mt-0.5 font-black uppercase tracking-widest text-text-secondary ${isCompact ? 'text-[6.5px]' : 'text-[10px]'}`}>{market.type === 'individual' ? 'Shop' : 'Sellers'}</p>
          </div>

          <div className={`rounded-xl border border-border-light bg-background-surface transition-colors group-hover:border-primary/10 group-hover:bg-primary/5 ${isCompact ? 'p-1.5' : 'p-3'}`}>
            <div className="flex items-center gap-1.5 text-primary font-black">
              <PackageCheck size={isCompact ? 12 : 16} />
              <span className={`font-black text-text-primary ${isCompact ? 'text-sm' : 'text-lg'}`}>{products}</span>
            </div>
            <p className={`mt-0.5 font-black uppercase tracking-widest text-text-secondary ${isCompact ? 'text-[6.5px]' : 'text-[10px]'}`}>Products</p>
          </div>
        </div>

        <div className={`flex items-center gap-1.5 font-semibold text-text-secondary ${isCompact ? 'mt-3 text-xs' : 'mt-5 text-sm'}`}>
          <MapPin size={isCompact ? 12 : 16} className="shrink-0 text-primary" />
          <span className="truncate">{market.location?.address || 'Rwanda'}</span>
        </div>

        <div className={`flex items-center justify-between border-t border-border-light ${isCompact ? 'mt-3 pt-2 text-xs' : 'mt-5 pt-4 text-sm'}`}>
          <span className={`inline-flex items-center gap-1.5 font-black uppercase tracking-wider text-primary ${isCompact ? 'text-[10px]' : ''}`}>
            <ShieldCheck size={isCompact ? 12 : 16} className="text-accent-premium" />
            Shop market
          </span>
          <ArrowRight className="text-primary transition-transform duration-300 group-hover:translate-x-1.5" size={isCompact ? 14 : 18} />
        </div>
      </div>
    </Link>
  );
};
