'use client';
import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useWishlist } from '@/context/WishlistContext';
import { productApi } from '@/lib/api';
import { ProductCard } from '@/components/ui/ProductCard';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';

export default function WishlistPage() {
  const { wishlist } = useWishlist();
  const { t } = useLanguage();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (wishlist.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const fetchSavedProducts = async () => {
      setLoading(true);
      try {
        const res = await productApi.get(`/products?ids=${wishlist.join(',')}`);
        if (res.data?.data) {
          const fetched = Array.isArray(res.data.data) ? res.data.data : res.data.data.products;
          if (fetched) {
            setProducts(fetched.filter((p: any) => wishlist.includes(p._id)));
          }
        }
      } catch (e) {
        console.error('Failed to load wishlist products', e);
      } finally {
        setLoading(false);
      }
    };

    fetchSavedProducts();
  }, [wishlist]);

  return (
    <Layout>
      <div className="animate-reveal space-y-20 pb-20">
        {/* Tactical Header */}
        <div className="relative bg-white text-[#1b1c1c] p-16 overflow-hidden group shadow-2xl border border-[#e0e0e0] rounded-lg">
          <div className="absolute top-0 right-0 p-10 opacity-5">
             <div className="text-[150px] font-sans leading-none select-none">SAVE</div>
          </div>
          
          <div className="relative z-10 space-y-6">
             <div className="flex items-center gap-6">
                <div className="w-12 h-px bg-[#ffd700]"></div>
                 <p className="text-[11px] font-black text-[#ff6b00] uppercase tracking-[0.5em]">{t('nav_wishlist')}</p>
             </div>
             <h1 className="text-7xl font-sans tracking-normal leading-none text-[#1b1c1c]">
               {t('saved_items')}
             </h1>
             <p className="text-[10px] font-bold uppercase tracking-widest text-[#1b1c1c]/60">
               {t('wishlist_subtitle')}
             </p>
          </div>
        </div>

        <div className="max-w-[1920px] mx-auto px-0">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse bg-[#f0eded] border border-[#e0e0e0] h-80"></div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="border border-dashed border-[#e0e0e0] rounded-lg bg-[#fcf9f8]/50 py-32 text-center group">
               <div className="w-20 h-20 bg-white border border-[#e0e0e0] flex items-center justify-center mx-auto mb-10 group-hover:bg-[#e05300] group-hover:text-white transition-all shadow-sm">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
               </div>
               <h2 className="text-3xl font-sans tracking-normal text-[#1b1c1c] mb-4">{t('wishlist_empty_title')}</h2>
               <p className="text-[11px] font-black text-[#414844] uppercase tracking-[0.5em] mb-12 opacity-60">{t('wishlist_empty_desc')}</p>
               <Link 
                 href="/markets" 
                 className="rmf-btn-primary bg-[#e05300] text-white px-12 py-5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.3)] hover:bg-[#e05300]"
               >
                 {t('home_hero_cta')} →
               </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
              {products.map(product => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
