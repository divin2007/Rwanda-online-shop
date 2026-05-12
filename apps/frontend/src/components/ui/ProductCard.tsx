'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/components/cart/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { formatCurrency } from '@/lib/format';
import { getProductUrl } from '@/lib/urls';

interface ProductCardProps {
  product: {
    _id: string;
    name: string;
    price: number;
    unit: string;
    images: string[];
    inStock: boolean;
    marketId?: {
      slug: string;
    };
    promotion?: {
      type: 'percentage' | 'fixed_amount';
      discount: number;
      promotedPrice: number;
    };
    stockType?: 'finite' | 'infinite' | 'on_demand';
    isMadeInRwanda?: boolean;
    category?: string;
  };
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const { t } = useLanguage();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  if (!product.images || product.images.length === 0) return null;

  const hasPromotion = product.promotion && product.promotion.promotedPrice > 0;
  const displayPrice = hasPromotion ? product.promotion!.promotedPrice : product.price;
  const discountLabel = hasPromotion 
    ? (product.promotion!.type === 'percentage' 
        ? `-${product.promotion!.discount}%` 
        : `-${formatCurrency(product.promotion!.discount)}`)
    : null;

  return (
    <div className="glass-card group flex flex-col h-full animate-reveal relative overflow-hidden bg-white">
      {/* Image Area */}
      <div className="relative aspect-[3/4] overflow-hidden bg-[#F2F0EB]">
        {/* Badges */}
        <div className="absolute top-0 left-0 z-20 flex flex-col gap-1">
           <div className="bg-[#121212] text-white text-[7px] font-black uppercase tracking-[0.4em] py-3 px-5">
              Verified
           </div>
           {hasPromotion && (
             <div className="bg-[#E53E3E] text-white text-[8px] font-black uppercase tracking-[0.2em] py-2 px-5 animate-pulse">
                {discountLabel} OFF
             </div>
           )}
           {product.stockType === 'on_demand' && (
             <div className="bg-[#F59E0B] text-[#121212] text-[7px] font-black uppercase tracking-[0.3em] py-2 px-5">
                Custom Order
             </div>
           )}
        </div>

        {/* Wishlist Toggle */}
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(product._id);
          }}
          className="absolute top-5 right-5 z-20 w-10 h-10 bg-white/90 backdrop-blur-md border border-[#E5E1D8] flex items-center justify-center transition-all hover:bg-[#121212] hover:text-white"
        >
          <span className="text-sm font-light">{isInWishlist(product._id) ? '●' : '○'}</span>
        </button>

        <Link href={getProductUrl(product._id, product.marketId?.slug)} className="block w-full h-full relative">
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            className={`object-cover transition-transform duration-[2000ms] group-hover:scale-110 ${!product.inStock && product.stockType !== 'infinite' ? 'opacity-40 grayscale' : ''}`}
          />
          {/* Overlay gradient for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212]/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
        </Link>

        {/* Floating Add to Cart */}
        <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-500 z-30">
           <button 
             onClick={() => addToCart(product)}
             className="w-full bg-[#121212] text-white py-5 text-[9px] font-black uppercase tracking-[0.5em] hover:bg-[#A34D15] transition-colors"
           >
             {product.stockType === 'on_demand' ? 'Request Quote' : t('product_add_to_cart')}
           </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-5 flex flex-col flex-grow bg-white border-t border-[#E5E1D8]">
        <div className="flex justify-between items-start mb-3">
           <span className="rmf-label-sm">{product.category || 'Product'}</span>
           {product.isMadeInRwanda && (
             <span className="text-[10px] grayscale opacity-50">🇷🇼</span>
           )}
        </div>

        <h3 className="text-lg font-serif text-[#121212] mb-4 leading-[1.2] line-clamp-2 italic tracking-tight group-hover:text-[#A34D15] transition-colors">
          <Link href={getProductUrl(product._id, product.marketId?.slug)}>
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto pt-4 border-t border-[#F0EDE4] flex justify-between items-end">
          <div className="flex flex-col">
            <span className="text-[8px] font-bold text-[#6B665E] uppercase tracking-widest mb-0.5 opacity-50">Price</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-[#121212] tracking-tighter">
                {formatCurrency(displayPrice)}
              </span>
              {hasPromotion && (
                <span className="text-[11px] font-medium text-[#6B665E] line-through opacity-50">
                  {formatCurrency(product.price)}
                </span>
              )}
            </div>
            <span className="text-[9px] font-normal text-[#6B665E] lowercase">per {product.unit}</span>
          </div>
          
          <div className="flex flex-col items-end">
            <span className={`text-[9px] font-black uppercase tracking-widest ${product.inStock ? 'text-green-800' : 'text-red-800'}`}>
               {product.inStock ? 'In Stock' : (product.stockType === 'on_demand' ? 'Made to Order' : 'Out of Stock')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
