'use client';
import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import { useApi } from '@/hooks/useApi';
import { productApi, reviewApi, orderApi } from '@/lib/api';
import { useCart } from '@/components/cart/CartContext';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function ProductDetailPage({ params }: { params: { slug: string, productId: string } }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { addToCart } = useCart();
  
  // Real Data Hooks
  const { data: product, loading, execute: fetchProduct } = useApi(productApi, 'get', `/products/${params.productId}`);
  const { data: reviewsData } = useApi(reviewApi, 'get', `/reviews/target/product/${params.productId}`);
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const [customization, setCustomization] = React.useState('');

  useEffect(() => {
    fetchProduct();
  }, [params.productId, fetchProduct]);

  if (loading) return <Layout><div className="rmf-container py-40 text-center font-serif text-3xl italic animate-pulse">{t('unveiling_heritage_artifact')}...</div></Layout>;
  if (!product) return <Layout><div className="rmf-container py-40 text-center font-serif text-3xl">{t('product_not_found')}</div></Layout>;

  const reviews = reviewsData || [];

  const handleAddToCart = () => {
    addToCart(product, customization);
    toast.success(`${product.name} added to your mandate.`);
  };

  return (
    <Layout>
      <div className="space-y-32 pb-40 animate-reveal">
        {/* Elite Institutional Navigation */}
        <nav className="flex items-center gap-6 py-10 border-b border-[#F0EDE4]">
           <Link href="/" className="text-[10px] font-black text-[#6B665E] uppercase tracking-[0.3em] hover:text-[#121212] transition-colors">Hub</Link>
           <div className="w-1 h-1 bg-[#A34D15] rounded-full"></div>
           <Link href="/markets" className="text-[10px] font-black text-[#6B665E] uppercase tracking-[0.3em] hover:text-[#121212] transition-colors">Network</Link>
           <div className="w-1 h-1 bg-[#A34D15] rounded-full"></div>
           <Link href={`/market/${params.slug}`} className="text-[10px] font-black text-[#6B665E] uppercase tracking-[0.3em] hover:text-[#121212] transition-colors capitalize">{params.slug.replace(/-/g, ' ')} Station</Link>
           <div className="w-1 h-1 bg-[#A34D15] rounded-full"></div>
           <span className="text-[10px] font-black text-[#121212] uppercase tracking-[0.3em] italic opacity-40">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-32 items-start">
          {/* Artifact Gallery: Elite Grid */}
          <div className="space-y-12">
            <div className="aspect-[4/5] bg-white border-2 border-[#121212] overflow-hidden group relative p-6 shadow-2xl">
              <img 
                src={product.images?.[activeImageIndex] || ''} 
                className="w-full h-full object-cover grayscale transition-transform duration-[4000ms] group-hover:scale-110 group-hover:grayscale-0" 
                alt={product.name} 
              />
              <div className="absolute top-12 left-12">
                 <div className="bg-[#121212] text-white text-[9px] font-black uppercase tracking-[0.6em] py-4 px-8 border border-white/20">
                    {t('verified_artifact') || 'RMF Verified'}
                 </div>
              </div>
            </div>
            
            {product.images?.length > 1 && (
              <div className="grid grid-cols-4 gap-8">
                {product.images.map((img: string, idx: number) => (
                  <button 
                    key={idx} 
                    onClick={() => setActiveImageIndex(idx)}
                    className={`aspect-square border-2 transition-all p-2 ${activeImageIndex === idx ? 'border-[#121212] scale-105' : 'border-[#F0EDE4] grayscale hover:grayscale-0'}`}
                  >
                    <img src={img} className="w-full h-full object-cover" alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Artifact Specification Matrix */}
          <div className="space-y-16 flex flex-col pt-12">
            <div className="space-y-8">
              <div className="flex items-center gap-6">
                 <div className="w-12 h-px bg-[#A34D15]"></div>
                 <p className="text-[11px] font-black text-[#A34D15] uppercase tracking-[0.5em] italic">{product.category || 'HERITAGE COLLECTION'}</p>
              </div>
              
              <h1 className="text-[90px] font-serif text-[#121212] leading-[0.85] tracking-tighter italic mb-8">{product.name}</h1>
              
              <div className="flex items-baseline gap-8 py-10 border-y border-[#F0EDE4]">
                <div className="flex items-baseline gap-4">
                   <p className="text-6xl font-serif tracking-tighter italic">{product.price?.toLocaleString()}</p>
                   <span className="text-xl font-serif text-[#A34D15] opacity-60 uppercase tracking-widest">RWF</span>
                </div>
                <div className="h-10 w-px bg-[#F0EDE4]"></div>
                <span className="text-[11px] font-black text-[#6B665E] uppercase tracking-[0.3em] italic">
                  {product.stockType === 'on_demand' ? t('crafted_on_commission') : t('in_facility_storage')}
                </span>
              </div>
            </div>

            {/* Artisan Verification Card */}
            <div className="bg-[#121212] text-white p-12 relative overflow-hidden group">
               <div className="relative z-10 flex items-start gap-10">
                  <div className="w-20 h-20 bg-[#A34D15] flex items-center justify-center font-serif text-3xl italic shadow-2xl">
                    {product.seller?.name?.[0] || 'S'}
                  </div>
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-[#A34D15] uppercase tracking-[0.5em]">{t('master_artisan')}</p>
                    <p className="text-4xl font-serif tracking-tighter italic">{product.seller?.name || t('verified_facilitator')}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] italic">
                       Station: {params.slug.replace(/-/g, ' ')} • ID: {product.stallId || 'SYNC-HUB'}
                    </p>
                  </div>
               </div>
               <div className="absolute -bottom-10 -right-10 text-[120px] font-serif italic opacity-5 select-none">RMF</div>
            </div>

            {/* Descriptive Narrative */}
            <div className="space-y-10">
               <p className="text-xl text-[#6B665E] leading-relaxed italic font-light border-l-2 border-[#A34D15] pl-10">
                 {product.description || 'This authentic piece represents the finest craftsmanship available at this regional market hub. Every acquisition supports local artisans directly through the RMF network.'}
               </p>
            </div>

            {/* Facilitation Requirements */}
            <div className="space-y-8 p-12 bg-[#F8F6F1] border-2 border-[#121212]">
               <div className="flex items-center gap-6">
                  <div className="w-8 h-8 bg-[#121212] text-white flex items-center justify-center text-xs">A</div>
                  <h3 className="text-[11px] font-black text-[#121212] uppercase tracking-[0.4em] italic">{t('facilitation_brief')}</h3>
               </div>
               <textarea 
                  className="rmf-input w-full px-8 py-6 bg-white border-2 border-[#E5E1D8] focus:border-[#121212] text-sm italic min-h-[150px] transition-all"
                  placeholder={t('product_review_placeholder')}
                  value={customization}
                  onChange={(e) => setCustomization(e.target.value)}
               />
               <div className="flex gap-4 items-center">
                  <div className="w-1.5 h-1.5 bg-[#A34D15] rounded-full animate-pulse"></div>
                  <p className="text-[9px] text-[#6B665E] font-black uppercase tracking-widest opacity-60">
                    Authorization: Briefing mandatory for custom commissions.
                  </p>
               </div>
            </div>

            {/* Strategic Actions */}
            <div className="flex flex-col sm:flex-row gap-8 pt-10">
              <button 
                onClick={handleAddToCart}
                className="rmf-btn-primary flex-grow py-8 text-[11px] bg-[#121212] hover:bg-[#A34D15]"
              >
                Initialize Acquisition
              </button>
              <button className="rmf-btn-outline px-12 py-8 text-[11px] border-2 border-[#121212]/10 hover:border-[#121212]">
                Archive for Future Session
              </button>
            </div>
          </div>
        </div>

        {/* Customer Experience: Verified Ledger */}
        <section className="pt-40 border-t-2 border-[#121212]">
           <div className="flex justify-between items-end mb-24">
              <div>
                <p className="text-[11px] font-black text-[#A34D15] uppercase tracking-[0.6em] mb-6">{t('quality_assurance')}</p>
                <h2 className="text-7xl font-serif text-[#121212] tracking-tighter italic leading-none">{t('customer_experience')}</h2>
              </div>
              <div className="text-right">
                 <p className="text-4xl font-serif italic text-[#121212] mb-2">{product.seller?.rating || '5.0'}</p>
                 <p className="text-[10px] font-black text-[#6B665E] uppercase tracking-widest opacity-40">{t('global_rating')} / 5.0</p>
              </div>
           </div>

           {reviews.length === 0 ? (
             <div className="text-center py-32 border-2 border-[#F0EDE4] bg-white italic text-xl text-[#6B665E] font-light">
               No facilitation reports recorded for this artifact in current session.
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
               {reviews.map((review: any) => (
                 <div key={review._id} className="p-12 border-2 border-[#121212] bg-white group hover:shadow-2xl transition-all space-y-10">
                   <div className="flex justify-between items-center">
                     <div className="flex items-center gap-6">
                        <div className="w-16 h-16 border-2 border-[#121212] flex items-center justify-center font-serif text-2xl italic group-hover:bg-[#121212] group-hover:text-white transition-all">
                          {review.buyerName?.[0] || 'U'}
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-[#121212] uppercase tracking-[0.2em]">{review.buyerName || t('verified_buyer')}</p>
                          <p className="text-[9px] text-[#6B665E] uppercase tracking-widest mt-2 opacity-50">{new Date(review.createdAt).toLocaleDateString()}</p>
                        </div>
                     </div>
                     <div className="flex gap-1">
                        {[1,2,3,4,5].map(star => (
                          <span key={star} className={`text-sm ${star <= review.rating ? 'text-[#A34D15]' : 'text-[#E5E1D8]'}`}>★</span>
                        ))}
                     </div>
                   </div>
                   <p className="text-xl text-[#121212] leading-relaxed italic font-light">
                     "{review.comment || 'The facilitation process was seamless and the artifact exceeds expectations.'}"
                   </p>
                 </div>
               ))}
             </div>
           )}
        </section>
      </div>
    </Layout>
  );
}
