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
      <div className="w-full p-6 md:p-8 space-y-lg animate-reveal">
        {/* Banner with brand hero-glow */}
        <section className="relative overflow-hidden rounded-lg border border-outline-variant bg-[#1b1c1b] p-md text-white shadow-md custom-shadow">
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent z-10"></div>
          <div className="absolute inset-0 hero-glow pointer-events-none z-10"></div>
          
          <div className="relative z-20 space-y-xs">
            <p className="flex items-center gap-xs text-[10px] font-black uppercase tracking-wider text-primary-container">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span> {t('nav_wishlist') || 'Wishlist'}
            </p>
            <h1 className="max-w-xl font-display-lg text-headline-lg text-white leading-tight">
              {t('saved_items') || 'Saved Items'}
            </h1>
            <p className="max-w-xl text-xs text-white/80 leading-relaxed font-body-md">
              {t('wishlist_subtitle') || 'Products you have bookmarked for later consideration or pricing negotiations.'}
            </p>
          </div>
        </section>

        <div className="w-full">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-md">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse bg-surface-container-low border border-outline-variant h-72 rounded-lg" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="border border-dashed border-outline-variant rounded-lg bg-surface-container-low/30 py-20 text-center group shadow-sm flex flex-col items-center justify-center">
              <div className="w-14 h-14 bg-surface-container-lowest border border-outline-variant rounded-full flex items-center justify-center mb-6 text-on-surface-variant group-hover:text-primary transition-all shadow-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </div>
              <h2 className="font-headline-md text-headline-md text-on-surface mb-2">{t('wishlist_empty_title') || 'Your wishlist is empty'}</h2>
              <p className="font-data-mono-sm text-[9px] text-on-surface-variant uppercase tracking-wider mb-8">{t('wishlist_empty_desc') || 'Products you save will appear here.'}</p>
              <Link 
                href="/markets" 
                className="rounded-md bg-primary-container text-white px-6 py-3 text-xs font-black uppercase tracking-wider hover:bg-primary transition-all duration-300 shadow-sm active:scale-[0.99]"
              >
                {t('home_hero_cta') || 'Explore Markets'} →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-md">
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
