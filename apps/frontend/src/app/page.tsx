'use client';
import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import { ProductCard } from '@/components/ui/ProductCard';
import { MarketCard } from '@/components/ui/MarketCard';
import { HorizontalProductCard } from '@/components/ui/HorizontalProductCard';
import { useApi } from '@/hooks/useApi';
import { marketApi, productApi, adminApi } from '@/lib/api';

export default function HomePage() {
  const { t } = useLanguage();
  
  // Real Data Hooks
  const { data: marketsData, loading: marketsLoading } = useApi(marketApi, 'get', '/markets');
  const { data: productsData, loading: productsLoading } = useApi(productApi, 'get', '/products?limit=8');
  const { data: trendingData } = useApi(productApi, 'get', '/products?limit=4&sort=trending');
  const { data: statsData } = useApi(adminApi, 'get', '/analytics/summary');

  const markets = marketsData || [];
  const products = productsData || [];
  const trendingProducts = trendingData || [];
  const stats = statsData || { 
    marketCount: markets.length || 0, 
    sellerCount: 0, 
    orderCount: 0, 
    trustRating: 0 
  };

  return (
    <Layout>
      <div className="space-y-40 pb-20 animate-reveal">
        {/* RMF Command Hero */}
        <section className="relative h-[85vh] flex items-center bg-[#121212] overflow-hidden group">
          <div className="absolute inset-0 opacity-40 transition-transform duration-[10000ms] group-hover:scale-110">
             <img 
               src="https://images.unsplash.com/photo-1542223175-75bc9dd5b4b0?auto=format&fit=crop&q=80&w=2000" 
               className="w-full h-full object-cover" 
               alt="Artisan Background" 
             />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#121212] via-[#121212]/80 to-transparent"></div>
          
          <div className="relative z-10 w-full max-w-5xl p-16 md:p-24">
            <div className="flex items-center gap-6 mb-8">
               <div className="w-12 h-px bg-[#F59E0B]"></div>
               <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.5em]">{t('official_facilitator')}</p>
            </div>
            
            <h1 className="text-6xl md:text-8xl font-serif text-white mb-10 leading-[1.05] tracking-tighter italic" 
                dangerouslySetInnerHTML={{ __html: t('home_hero_title').replace('\n', '<br />') }} />
            
            <p className="text-lg md:text-xl text-white/60 max-w-2xl leading-relaxed mb-16 italic font-light">
              {t('home_hero_desc')}
            </p>
            
            <div className="flex flex-wrap gap-8">
              <Link href="/markets" className="rmf-btn-primary bg-[#F59E0B] border-none text-[#121212] px-10 py-5 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-white transition-all shadow-[0_20px_50px_-15px_rgba(245,158,11,0.4)]">
                {t('home_hero_cta')}
              </Link>
              <Link href="/register" className="rmf-btn-outline border-white/30 text-white px-10 py-5 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-white hover:text-[#121212] hover:border-white transition-all">
                {t('become_seller')}
              </Link>
            </div>
          </div>

          <div className="absolute bottom-20 right-24 hidden lg:flex flex-col items-end">
             <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.8em] mb-4 text-right">Coordinate Alpha</span>
             <div className="text-white font-serif italic text-6xl opacity-10">KIGALI_HQ</div>
          </div>
        </section>

        {/* Global Stats Bar */}
        <section className="bg-white border-y border-[#E5E1D8] py-24">
          <div className="rmf-container grid grid-cols-1 md:grid-cols-4 gap-24">
            {[
              { label: t('nav_markets'), val: stats.marketCount || markets.length, cat: t('verified_facility') },
              { label: t('active_sellers'), val: stats.sellerCount || '120+', cat: t('creative_partners') },
              { label: t('order_summary'), val: stats.orderCount || '450+', cat: t('secure_transit') },
              { label: t('trust_rating') || 'Trust Rating', val: `${stats.trustRating || '99.2'}%`, cat: t('citizen_approval') },
            ].map((stat, i) => (
              <div key={i} className="text-center md:text-left group relative">
                <div className="absolute -left-10 top-0 w-px h-full bg-[#F0EDE4] hidden md:block"></div>
                <p className="text-7xl font-serif text-[#121212] mb-4 tracking-tighter group-hover:text-[#F59E0B] transition-colors">{stat.val}</p>
                <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.3em] mb-2">{stat.label}</p>
                <p className="text-[9px] text-[#6B665E] uppercase opacity-40 font-bold tracking-widest">{stat.cat}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Regional Hubs Deployment */}
        <section className="rmf-container">
          <div className="flex justify-between items-end mb-24 border-b-2 border-[#121212] pb-12">
            <div>
              <p className="rmf-label-sm mb-4">{t('regional_hubs')}</p>
              <h2 className="text-7xl font-serif text-[#121212] italic tracking-tighter">{t('home_explore_heading')}</h2>
            </div>
            <Link href="/markets" className="text-[11px] font-black uppercase tracking-[0.4em] text-[#121212] hover:text-[#F59E0B] transition-colors border-b-2 border-[#121212]/10 hover:border-[#F59E0B] pb-2">{t('view_all_markets')} →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-20">
            {marketsLoading ? (
              [1,2,3].map(i => <div key={i} className="aspect-square bg-[#F2F0EB] animate-pulse border border-[#E5E1D8]"></div>)
            ) : markets.length > 0 ? markets.slice(0, 3).map((market: any, idx: number) => (
              <MarketCard key={market._id} market={market} index={idx} />
            )) : (
              <p className="text-[10px] font-black text-[#6B665E] uppercase tracking-widest opacity-40 italic">No active hubs deployed in network</p>
            )}
          </div>
        </section>

        {/* Curation: Master Artifacts */}
        <section className="bg-[#121212] py-40">
           <div className="rmf-container">
              <div className="text-center mb-32">
                <p className="text-[11px] font-black text-[#F59E0B] uppercase tracking-[0.6em] mb-8">{t('new_standards')}</p>
                <h2 className="text-8xl font-serif text-white tracking-tighter leading-none italic">{t('heritage_artifacts')}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
                {productsLoading ? (
                  [1,2,3,4].map(i => <div key={i} className="aspect-[3/4] bg-white/5 animate-pulse border border-white/10"></div>)
                ) : products.length > 0 ? products.map((product: any) => (
                  <ProductCard key={product._id} product={product} />
                )) : (
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest col-span-4 text-center">No artifacts initialized</p>
                )}
              </div>
              <div className="mt-32 flex justify-center">
                 <Link href="/markets" className="rmf-btn-outline border-white/20 text-white hover:border-white">Explore Full Collection</Link>
              </div>
           </div>
        </section>

        {/* Mission Statement */}
        <section className="rmf-container grid grid-cols-1 lg:grid-cols-2 gap-40 items-center">
          <div className="space-y-16">
            <h2 className="text-7xl font-serif text-[#121212] leading-[0.9] tracking-tighter italic">
               {t('facilitation_mission_title')} <br />
               <span className="text-[#F59E0B] not-italic">{t('facilitation_mission_span')}</span>
            </h2>
            <div className="space-y-12">
              {[
                { title: t('trust_point_2_title'), desc: t('trust_point_2_desc'), icon: '🛡️' },
                { title: t('secure_payments_title'), desc: t('secure_payments_desc'), icon: '🔒' },
                { title: t('trust_point_3_title'), desc: t('trust_point_3_desc'), icon: '🛵' },
              ].map((item, i) => (
                <div key={i} className="flex gap-10 items-start group">
                  <div className="w-16 h-16 bg-white border-2 border-[#E5E1D8] flex items-center justify-center text-2xl group-hover:bg-[#121212] group-hover:text-white transition-all shadow-sm">
                    {item.icon}
                  </div>
                  <div className="max-w-md">
                    <h4 className="text-xl font-black text-[#121212] mb-3 uppercase tracking-tighter italic">{item.title}</h4>
                    <p className="text-sm text-[#6B665E] leading-relaxed italic opacity-70">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative aspect-[4/5] bg-white p-6 border border-[#E5E1D8] shadow-[50px_50px_100px_-50px_rgba(0,0,0,0.1)]">
            <img src="https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=1200" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000" alt="Artisan Work" />
            <div className="absolute -bottom-16 -left-16 bg-[#121212] text-white p-16 max-w-sm shadow-[30px_30px_60px_-15px_rgba(0,0,0,0.5)]">
               <p className="text-lg italic leading-relaxed opacity-60 font-light">{t('artisan_testimonial')}</p>
               <div className="mt-10 pt-10 border-t border-white/10">
                  <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.5em]">{t('master_weaver_label')}</p>
               </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
