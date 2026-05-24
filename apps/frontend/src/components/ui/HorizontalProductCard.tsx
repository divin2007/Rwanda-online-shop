'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatCurrency } from '@/lib/format';
import { getProductUrl } from '@/lib/urls';
import { useLanguage } from '@/context/LanguageContext';
import { resolveUploadUrl } from '@/lib/uploadUrls';

interface HorizontalProductCardProps {
  product: {
    _id: string;
    name: string;
    price: number;
    images: string[];
    category?: string;
    marketId?: {
      slug: string;
    };
    sellerId?: {
      shopDetails?: {
        name: string;
      };
    };
  };
}

export const HorizontalProductCard = ({ product }: HorizontalProductCardProps) => {
  const { t } = useLanguage();
  const imageUrl = product.images?.[0]
    ? resolveUploadUrl(product.images[0], 'product')
    : 'https://images.unsplash.com/photo-1590073844006-33379778ae09';

  return (
    <Link 
      href={getProductUrl(product._id)}
      className="flex items-center gap-6 p-4 bg-white border border-transparent hover:border-[#e0e0e0] transition-all group"
    >
      <div className="relative w-24 h-24 flex-shrink-0 bg-[#fcf9f8] overflow-hidden border border-[#e0e0e0]">
        <Image
          src={imageUrl}
          alt={product.name}
          fill
          unoptimized
          sizes="96px"
          className="object-cover group-hover:scale-110 transition-transform duration-1000"
        />
      </div>
      
      <div className="flex-grow space-y-1">
        <p className="text-[8px] font-bold text-[#ff6b00] uppercase tracking-widest">{product.category || t('heritage_artifacts')}</p>
        <h4 className="text-sm font-sans text-[#1b1c1c] group-hover:text-[#ff6b00] transition-colors line-clamp-1">{product.name}</h4>
        <div className="flex justify-between items-end pt-1">
          <div>
            <p className="text-[8px] text-[#414844] uppercase tracking-normal opacity-60">{t('starting_from') || 'Starting From'}</p>
            <p className="text-xs font-bold text-[#1b1c1c]">RF {product.price?.toLocaleString()}</p>
          </div>
          <span className="text-xs opacity-20 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">→</span>
        </div>
      </div>
    </Link>
  );
};
