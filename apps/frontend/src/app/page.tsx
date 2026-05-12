'use client';
import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import { ProductCard } from '@/components/ui/ProductCard';
import { MarketCard } from '@/components/ui/MarketCard';
import { useApi } from '@/hooks/useApi';
import { marketApi, productApi, adminApi } from '@/lib/api';

export default function HomePage() {
  const { t } = useLanguage();

  const { data: marketsData, loading: marketsLoading } = useApi(marketApi, 'get', '/markets');
  const { data: productsData, loading: productsLoading } = useApi(productApi, 'get', '/products?limit=8&isActive=true');
  const { data: featuredData } = useApi(productApi, 'get', '/products?limit=4&hasPromotion=true');
  const { data: statsData } = useApi(adminApi, 'get', '/analytics/summary');

  const markets = marketsData || [];
  const products = productsData || [];
  const featured = featuredData || [];
  const stats = statsData || {};

  return (
    <Layout>
      <div className="space-y-0 pb-0 animate-reveal">

        {/* ═══════════════════════════════════════════
            HERO — Full-bleed cinematic
        ═══════════════════════════════════════════ */}
        <section className="relative min-h-[92vh] flex items-end bg-[#121212] overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1542223175-75bc9dd5b4b0?auto=format&fit=crop&q=80&w=2400"
              className="w-full h-full object-cover opacity-35 scale-105 transition-transform duration-[15000ms] hover:scale-100"
              alt="Rwandan Market"
            />
          </div>
          {/* Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#121212]/80 via-transparent to-transparent" />

          {/* Content */}
          <div className="relative z-10 w-full px-8 md:px-20 pb-24 md:pb-36">
            <div className="max-w-4xl">
              {/* Tag */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-10 h-px bg-[#F59E0B]" />
                <span className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.6em]">Rwanda's #1 Local Marketplace</span>
              </div>

              {/* Headline */}
              <h1 className="text-6xl sm:text-8xl md:text-[110px] font-serif text-white leading-[0.9] tracking-tighter italic mb-8">
                Shop Local.<br />
                <span className="text-[#F59E0B] not-italic">Delivered Fast.</span>
              </h1>

              <p className="text-lg md:text-xl text-white/60 font-light italic leading-relaxed mb-12 max-w-2xl">
                Browse hundreds of verified sellers from Kigali's top markets — Kimironko, Nyamirambo, Gisozi and more. Order with confidence, pay via MoMo, delivered to your door.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap gap-5">
                <Link
                  href="/markets"
                  className="bg-[#F59E0B] text-[#121212] px-10 py-5 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-white transition-all shadow-[0_20px_50px_-10px_rgba(245,158,11,0.4)] hover:shadow-[0_20px_50px_-10px_rgba(255,255,255,0.3)]"
                >
                  Browse Markets →
                </Link>
                <Link
                  href="/register?role=SELLER"
                  className="border-2 border-white/30 text-white px-10 py-5 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-white hover:text-[#121212] hover:border-white transition-all"
                >
                  Start Selling
                </Link>
              </div>
            </div>
          </div>

          {/* Floating Stats Pill */}
          <div className="absolute bottom-10 right-8 hidden lg:flex items-center gap-6 bg-white/10 backdrop-blur-md border border-white/20 px-8 py-4">
            <div className="text-center">
              <p className="text-2xl font-serif italic text-white">{stats.marketCount || markets.length || '10'}+</p>
              <p className="text-[8px] font-black text-[#F59E0B] uppercase tracking-widest">Markets</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <p className="text-2xl font-serif italic text-white">{stats.sellerCount || '120'}+</p>
              <p className="text-[8px] font-black text-[#F59E0B] uppercase tracking-widest">Sellers</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <p className="text-2xl font-serif italic text-white">{stats.orderCount || '500'}+</p>
              <p className="text-[8px] font-black text-[#F59E0B] uppercase tracking-widest">Orders</p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            HOW IT WORKS — 3-step visual strip
        ═══════════════════════════════════════════ */}
        <section className="bg-[#F59E0B] py-5 overflow-x-auto">
          <div className="flex items-center justify-center gap-0 min-w-max mx-auto px-8">
            {[
              { step: '01', icon: '🛒', label: 'Browse & Add to Cart' },
              { step: '→', icon: '', label: '' },
              { step: '02', icon: '📱', label: 'Pay via MTN MoMo' },
              { step: '→', icon: '', label: '' },
              { step: '03', icon: '🛵', label: 'Rider Delivers to You' },
            ].map((item, i) => item.icon ? (
              <div key={i} className="flex items-center gap-4 px-10 py-3">
                <div className="w-10 h-10 bg-[#121212] text-[#F59E0B] flex items-center justify-center font-black text-sm">{item.step}</div>
                <div>
                  <div className="text-lg">{item.icon}</div>
                  <p className="text-[9px] font-black text-[#121212] uppercase tracking-widest whitespace-nowrap">{item.label}</p>
                </div>
              </div>
            ) : (
              <div key={i} className="text-[#121212]/40 font-black text-xl px-2">→</div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            MARKETS — Card grid
        ═══════════════════════════════════════════ */}
        <section className="py-24 px-8 md:px-20 bg-white">
          <div className="flex justify-between items-end mb-16 border-b-2 border-[#121212] pb-10">
            <div>
              <p className="text-[10px] font-black text-[#A34D15] uppercase tracking-[0.5em] mb-3">Shop by Location</p>
              <h2 className="text-6xl font-serif text-[#121212] italic tracking-tighter">Local Markets</h2>
            </div>
            <Link href="/markets" className="text-[11px] font-black uppercase tracking-[0.4em] text-[#121212] hover:text-[#F59E0B] transition-colors border-b-2 border-transparent hover:border-[#F59E0B] pb-1">
              View All →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {marketsLoading ? (
              [1,2,3].map(i => <div key={i} className="aspect-[4/3] bg-[#F2F0EB] animate-pulse" />)
            ) : markets.length > 0 ? (
              markets.slice(0, 3).map((market: any, idx: number) => (
                <MarketCard key={market._id} market={market} index={idx} />
              ))
            ) : (
              <p className="text-sm italic text-[#6B665E] col-span-3">No markets yet — check back soon.</p>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            FEATURED PRODUCTS — Dark section
        ═══════════════════════════════════════════ */}
        <section className="bg-[#121212] py-24 px-8 md:px-20">
          <div className="flex justify-between items-end mb-16 border-b border-white/10 pb-10">
            <div>
              <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.5em] mb-3">Handpicked for You</p>
              <h2 className="text-6xl font-serif text-white italic tracking-tighter">Featured Products</h2>
            </div>
            <Link href="/markets" className="text-[11px] font-black uppercase tracking-[0.4em] text-white hover:text-[#F59E0B] transition-colors">
              Shop All →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {productsLoading ? (
              [1,2,3,4].map(i => <div key={i} className="aspect-[3/4] bg-white/5 animate-pulse" />)
            ) : products.length > 0 ? (
              products.slice(0, 8).map((product: any) => (
                <ProductCard key={product._id} product={product} />
              ))
            ) : (
              <p className="text-sm italic text-white/40 col-span-4">No products listed yet.</p>
            )}
          </div>

          <div className="mt-16 text-center">
            <Link href="/markets" className="border-2 border-white/20 text-white px-12 py-5 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-white hover:text-[#121212] transition-all inline-block">
              Browse All Products
            </Link>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            WHY RMF — Trust section
        ═══════════════════════════════════════════ */}
        <section className="py-24 px-8 md:px-20 bg-[#F8F6F1]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center max-w-7xl mx-auto">
            {/* Text */}
            <div className="space-y-12">
              <div>
                <p className="text-[10px] font-black text-[#A34D15] uppercase tracking-[0.5em] mb-4">Why Choose RMF</p>
                <h2 className="text-6xl font-serif text-[#121212] leading-[0.95] tracking-tighter italic">
                  Shop Rwandan,<br />
                  <span className="text-[#F59E0B] not-italic">Shop Smart</span>
                </h2>
              </div>

              <div className="space-y-8">
                {[
                  { icon: '🛡️', title: 'Verified Sellers Only', desc: 'Every seller is verified with valid RDB registration. No fakes, no scams.' },
                  { icon: '🔒', title: 'Escrow Payment Protection', desc: 'Your money is held safely until your order is delivered and confirmed.' },
                  { icon: '🛵', title: 'Real-Time Delivery Tracking', desc: 'Track your order live on the map as our moto-riders bring it to you.' },
                  { icon: '🇷🇼', title: 'Supporting Local Rwanda', desc: 'Every purchase directly supports local market sellers and artisans.' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-6 items-start group cursor-default">
                    <div className="w-14 h-14 bg-white border-2 border-[#E5E1D8] flex items-center justify-center text-2xl flex-shrink-0 group-hover:bg-[#121212] group-hover:border-[#121212] transition-all shadow-sm">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-base font-black text-[#121212] mb-1 uppercase tracking-tight">{item.title}</h4>
                      <p className="text-sm text-[#6B665E] leading-relaxed italic opacity-80">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Image + Quote */}
            <div className="relative">
              <div className="aspect-[4/5] bg-white border border-[#E5E1D8] overflow-hidden shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=1200"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-1000"
                  alt="Rwandan Artisan"
                />
              </div>
              <div className="absolute -bottom-10 -left-8 bg-[#121212] text-white p-10 max-w-xs shadow-2xl border-l-4 border-[#F59E0B]">
                <p className="text-base italic leading-relaxed text-white/70 font-light">
                  "Since joining RMF, my sales increased by 300%. Customers from across Kigali find my products every day."
                </p>
                <p className="mt-6 text-[9px] font-black text-[#F59E0B] uppercase tracking-[0.4em]">Verified Seller — Kimironko Market</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            STATS BAR
        ═══════════════════════════════════════════ */}
        <section className="bg-[#121212] border-t border-white/10">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
            {[
              { val: `${stats.marketCount || markets.length || '10'}+`, label: 'Active Markets', sub: 'Across Kigali' },
              { val: `${stats.sellerCount || '120'}+`, label: 'Verified Sellers', sub: 'Checked & Approved' },
              { val: `${stats.orderCount || '500'}+`, label: 'Orders Delivered', sub: 'and counting' },
              { val: `${stats.trustRating || '99.2'}%`, label: 'Satisfaction Rate', sub: 'Buyer Confirmed' },
            ].map((stat, i) => (
              <div key={i} className="py-16 px-12 text-center group hover:bg-white/5 transition-colors">
                <p className="text-5xl font-serif italic text-white mb-3 group-hover:text-[#F59E0B] transition-colors">{stat.val}</p>
                <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.4em] mb-1">{stat.label}</p>
                <p className="text-[9px] text-white/30 uppercase tracking-widest">{stat.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            CTA — Seller Signup
        ═══════════════════════════════════════════ */}
        <section className="py-24 px-8 md:px-20 bg-[#F59E0B] flex flex-col md:flex-row items-center justify-between gap-12">
          <div>
            <p className="text-[10px] font-black text-[#121212]/50 uppercase tracking-[0.5em] mb-3">For Sellers</p>
            <h2 className="text-5xl font-serif text-[#121212] italic tracking-tighter leading-tight">Have Products to Sell?<br />Join the Marketplace.</h2>
          </div>
          <div className="flex gap-4 flex-wrap">
            <Link href="/register?role=SELLER" className="bg-[#121212] text-white px-10 py-5 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-white hover:text-[#121212] transition-all shadow-xl">
              Start Selling Today →
            </Link>
            <Link href="/contact" className="border-2 border-[#121212] text-[#121212] px-10 py-5 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-[#121212] hover:text-white transition-all">
              Contact Sales
            </Link>
          </div>
        </section>

      </div>
    </Layout>
  );
}
