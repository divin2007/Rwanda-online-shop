'use client';
import React from 'react';
import Link from 'next/link';
import { getMarketUrl } from '@/lib/urls';
import { useLanguage } from '@/context/LanguageContext';

interface MarketCardProps {
  market: {
    _id: string;
    name: string;
    slug: string;
    type?: string;
    imageUrl?: string;
    description?: string;
    location?: {
      address?: string;
    };
    totalSellers?: number;
  };
  index?: number;
  variant?: 'standard' | 'featured';
}

export const MarketCard = ({ market, index = 0, variant = 'standard' }: MarketCardProps) => {
  const { t } = useLanguage();
  
  // Dynamic mapping of hub types to professional facilitation labels
  const hubTypeLabel = market.type === 'INDIVIDUAL' 
    ? 'Private Artisanal Hub' 
    : market.type === 'COOPERATIVE' 
    ? 'Artisan Cooperative' 
    : 'Regional Facilitation Hub';

  return (
    <Link href={getMarketUrl(market.slug)} className="group flex flex-col h-full animate-reveal bg-white">
      {/* Visual Header */}
      <div className={`relative overflow-hidden border border-[#E5E1D8] bg-[#F2F0EB] aspect-[4/5]`}>
        <div 
          className="w-full h-full bg-cover bg-center transition-transform duration-[4000ms] group-hover:scale-105"
          style={{ 
            backgroundImage: `url("${market.imageUrl || 'https://images.unsplash.com/photo-1542223175-75bc9dd5b4b0'}")` 
          }}
          aria-label={market.name}
        />
        
        {/* Hub ID Badge */}
        <div className="absolute top-0 right-0 z-20">
           <div className="bg-[#121212] text-white text-[8px] font-black uppercase tracking-[0.3em] py-2 px-4 border-l-2 border-[#A34D15]">
              #{index + 1}
           </div>
        </div>

        {/* Tactical Overlay */}
        <div className="absolute inset-0 bg-[#121212]/0 group-hover:bg-[#121212]/10 transition-colors duration-700"></div>
        
        <div className="absolute bottom-4 left-4">
           <span className="text-[7px] font-black uppercase tracking-widest bg-white/95 backdrop-blur-md px-3 py-1 border border-[#E5E1D8] shadow-lg">
             {t('verified_facility')}
           </span>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 flex-grow flex flex-col border border-t-0 border-[#E5E1D8] shadow-sm group-hover:shadow-xl transition-shadow">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-serif text-[#121212] leading-tight italic tracking-tight group-hover:text-[#A34D15] transition-colors line-clamp-2">
            {market.name}
          </h3>
        </div>
        
        <div className="flex flex-col gap-2 mb-4">
           <div className="flex flex-col">
              <span className="text-[7px] font-bold text-[#6B665E] uppercase tracking-widest opacity-60">Classification</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-[#121212] truncate">{hubTypeLabel}</span>
           </div>
           <div className="flex flex-col">
              <span className="text-[7px] font-bold text-[#6B665E] uppercase tracking-widest opacity-60">Capacity</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-[#121212]">{market.totalSellers || '0'} Merchants</span>
           </div>
        </div>

        <div className="mb-4">
           <p className="text-[7px] font-black text-[#A34D15] uppercase tracking-[0.3em] mb-0.5">Deployment Zone</p>
           <p className="text-[9px] font-medium text-[#121212] uppercase tracking-wider italic truncate">
              {market.location?.address || 'Metropolitan'}
           </p>
        </div>

        <p className="text-[9px] text-[#6B665E] leading-relaxed italic mb-4 border-l border-[#F0EDE4] pl-3 line-clamp-2">
          {market.description || 'Verified regional hub facilitating authentic artisanal commerce.'}
        </p>
        
        <div className="mt-auto pt-4 border-t border-[#F0EDE4] flex justify-between items-center group/btn">
          <span className="text-[9px] font-black text-[#121212] uppercase tracking-[0.3em] group-hover/btn:text-[#A34D15] transition-colors">
            Access →
          </span>
          <div className="w-6 h-px bg-[#E5E1D8] group-hover/btn:w-10 group-hover/btn:bg-[#A34D15] transition-all"></div>
        </div>
      </div>
    </Link>
  );
};
