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

export const MarketCard = ({ market }: MarketCardProps) => {
  const marketTypeLabel = market.type === 'individual' ? 'Independent shop' : 'Public market';
  const sellers = Number(market.totalSellers || 0);
  const products = Number(market.activeProducts || 0);
  const rating = Number(market.rating || 0);
  const open = isMarketOpen(market.operatingHours);
  const imageUrl = market.imageUrl || market.image || fallbackImage;

  return (
    <Link
      href={getMarketUrl(market.slug)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border-light bg-white transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl cinematic-shadow"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-background-surface">
        <div
          className="h-full w-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
          style={{ backgroundImage: `url("${imageUrl}")` }}
          aria-label={market.name}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-cinematic via-primary-cinematic/40 to-transparent opacity-90" />

        <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-md border border-white/10 shadow-sm">
          <BadgeCheck size={14} className="text-accent-premium" />
          Verified
        </div>

        <div className={`absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md shadow-sm border border-white/10 ${open ? 'bg-white/95 text-primary' : 'bg-white/10 text-white/70'}`}>
          <Clock3 size={14} />
          {open ? 'Open' : 'Closed'}
        </div>

        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-premium drop-shadow-md">{marketTypeLabel}</p>
            <h3 className="mt-1 line-clamp-1 text-xl font-bold leading-tight tracking-tight text-white drop-shadow-md">
              {market.name}
            </h3>
          </div>
          {rating > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm">
              <Star size={14} className="fill-accent-premium text-accent-premium" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="line-clamp-2 min-h-[2.75rem] text-sm leading-relaxed text-text-secondary font-medium">
          {market.description || 'Shop verified sellers, fresh products, and delivery-ready local goods.'}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border-light bg-background-surface p-3 transition-colors group-hover:border-primary/10 group-hover:bg-primary/5">
            <div className="flex items-center gap-2 text-primary font-black">
              <Store size={16} />
              <span className="text-lg font-black text-text-primary">{market.type === 'individual' ? 1 : sellers}</span>
            </div>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-text-secondary">{market.type === 'individual' ? 'Independent shop' : 'Verified sellers'}</p>
          </div>

          <div className="rounded-xl border border-border-light bg-background-surface p-3 transition-colors group-hover:border-primary/10 group-hover:bg-primary/5">
            <div className="flex items-center gap-2 text-primary font-black">
              <PackageCheck size={16} />
              <span className="text-lg font-black text-text-primary">{products}</span>
            </div>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-text-secondary">Live products</p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-text-secondary">
          <MapPin size={16} className="shrink-0 text-primary" />
          <span className="truncate">{market.location?.address || 'Rwanda'}</span>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-border-light pt-4">
          <span className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wider text-primary">
            <ShieldCheck size={16} className="text-accent-premium" />
            Shop this market
          </span>
          <ArrowRight className="text-primary transition-transform duration-300 group-hover:translate-x-2" size={18} />
        </div>
      </div>
    </Link>
  );
};
