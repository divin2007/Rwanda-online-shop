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
        <div className="relative bg-white text-[#121212] p-16 overflow-hidden group shadow-2xl border-2 border-[#121212]">
          <div className="absolute top-0 right-0 p-10 opacity-5">
             <div className="text-[150px] font-serif leading-none italic select-none">SAVE</div>
          </div>
          
          <div className="relative z-10 space-y-6">
             <div className="flex items-center gap-6">
                <div className="w-12 h-px bg-[#F59E0B]"></div>
                 <p className="text-[11px] font-black text-[#F59E0B] uppercase tracking-[0.5em]">Your Wishlist</p>
             </div>
             <h1 className="text-7xl font-serif tracking-tighter italic leading-none text-[#121212]">
               Saved Items
             </h1>
             <p className="text-[10px] font-bold uppercase tracking-widest text-[#121212]/60 italic">
               Products you've saved for later.
             </p>
          </div>
        </div>

        <div className="max-w-[1920px] mx-auto px-0">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse bg-[#F2F0EB] border border-[#E5E1D8] h-96"></div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="border-4 border-dashed border-[#F0EDE4] bg-[#F9F7F2]/50 py-32 text-center group">
               <div className="w-20 h-20 bg-white border border-[#E5E1D8] flex items-center justify-center mx-auto mb-10 group-hover:bg-[#121212] group-hover:text-white transition-all shadow-sm">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
               </div>
               <h2 className="text-3xl font-serif italic tracking-tighter text-[#121212] mb-4">Your wishlist is empty</h2>
               <p className="text-[11px] font-black text-[#6B665E] uppercase tracking-[0.5em] mb-12 opacity-60">You haven't saved any products yet.</p>
               <Link 
                 href="/markets" 
                 className="rmf-btn-primary bg-[#121212] text-white px-12 py-5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.3)] hover:bg-[#F59E0B]"
               >
                 Browse Markets →
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
