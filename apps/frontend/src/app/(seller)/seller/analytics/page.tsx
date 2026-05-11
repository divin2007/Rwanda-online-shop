'use client';
import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { adminApi, sellerApi } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/context/LanguageContext';
import dynamic from 'next/dynamic';

const AnalyticsCharts = dynamic(() => import('@/components/ui/AnalyticsCharts').then(mod => mod.AnalyticsCharts), { ssr: false });

export default function SellerAnalyticsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const { data: profile } = useApi(sellerApi, 'get', `/sellers/me?userId=${user?.id}`);
  const { data: analytics, loading } = useApi(adminApi, 'get', `/seller/dashboard/analytics/${user?.id}`);
  const { data: summary } = useApi(adminApi, 'get', `/analytics/seller/${user?.id}`);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-16 animate-reveal">
        {/* Header Section */}
        <div className="border-b-2 border-[#121212] pb-12">
          <div className="flex items-center gap-6 mb-6">
             <div className="w-12 h-px bg-[#A34D15]"></div>
             <p className="text-[11px] font-black text-[#A34D15] uppercase tracking-[0.5em]">Tactical Intelligence Unit</p>
          </div>
          <h1 className="text-8xl font-serif text-[#121212] leading-[0.85] tracking-tighter italic">Full Analytics</h1>
          <p className="text-[10px] font-bold text-[#6B665E] uppercase tracking-[0.3em] mt-8 opacity-60">
            Institutional performance audit for {profile?.shopDetails?.name || 'Authorized Merchant'}
          </p>
        </div>

        {/* High Level Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
           {[
             { label: 'Cumulative GMV', val: `${summary?.salesToday?.toLocaleString() || 0} RWF`, sub: 'Lifetime synchronized value', icon: '💰' },
             { label: 'Mandate Volume', val: summary?.totalOrders || 0, sub: 'Total acquisitions processed', icon: '📦' },
             { label: 'Operational Efficiency', val: `${summary?.avgPrepTime || 15} MIN`, sub: 'Average handover readiness', icon: '⚡' }
           ].map((stat, i) => (
             <div key={i} className="bg-[#121212] text-white p-10 border-l-8 border-[#A34D15] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 text-4xl group-hover:opacity-20 transition-opacity">{stat.icon}</div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#A34D15] mb-4">{stat.label}</p>
                <h3 className="text-4xl font-serif tracking-tighter italic">{stat.val}</h3>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mt-4 italic">{stat.sub}</p>
             </div>
           ))}
        </div>

        {/* Detailed Intelligence Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
           {/* Revenue Velocity (Area Chart) */}
           <div className="bg-white border-2 border-[#121212] p-12 space-y-12 shadow-xl">
              <div className="flex justify-between items-end border-b border-[#121212]/10 pb-6">
                 <div>
                    <h3 className="text-2xl font-serif italic tracking-tighter">Revenue Velocity</h3>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#6B665E] mt-2 opacity-50">Last 30 Operational Cycles</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-[#A34D15] uppercase tracking-widest">Active Sync</p>
                 </div>
              </div>
              <div className="h-[400px]">
                 <AnalyticsCharts type="seller" data={analytics} />
              </div>
           </div>

           {/* Inventory Performance (Bar Chart of products) */}
           <div className="bg-white border-2 border-[#121212] p-12 space-y-12 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-end border-b border-[#121212]/10 pb-6">
                 <div>
                    <h3 className="text-2xl font-serif italic tracking-tighter">Artifact Performance</h3>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#6B665E] mt-2 opacity-50">Top Volume Contributors</p>
                 </div>
              </div>
              
              <div className="space-y-8">
                 {analytics?.performance?.map((prod: any, i: number) => (
                    <div key={i} className="group">
                       <div className="flex justify-between items-end mb-3">
                          <span className="text-[11px] font-black uppercase tracking-widest text-[#121212]">{prod.name}</span>
                          <span className="text-lg font-serif italic text-[#A34D15]">{prod.sales} Units</span>
                       </div>
                       <div className="h-2 bg-[#F2F0EB] relative">
                          <div 
                             className="h-full bg-[#121212] transition-all duration-1000" 
                             style={{ width: `${Math.min(100, (prod.sales / (analytics?.performance?.[0]?.sales || 1)) * 100)}%` }}
                          ></div>
                       </div>
                    </div>
                 )) || (
                    <div className="py-20 text-center opacity-30 italic font-serif">Insufficient artifact movement recorded</div>
                 )}
              </div>

              {/* Decorative Protocol Text */}
              <div className="absolute -bottom-10 -right-10 text-[120px] font-serif opacity-[0.02] italic select-none pointer-events-none">PERF</div>
           </div>
        </div>

        {/* Transactional Integrity Audit */}
        <div className="bg-[#F8F6F1] border-2 border-[#121212] p-12 relative">
           <div className="absolute top-0 right-0 px-8 py-4 bg-[#121212] text-white text-[9px] font-black uppercase tracking-[0.4em]">Audit Trail</div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 pt-8">
              <div className="space-y-4">
                 <p className="text-[10px] font-black uppercase tracking-widest text-[#6B665E]">Successful Mandates</p>
                 <p className="text-4xl font-serif italic">{summary?.completedOrders || 0}</p>
                 <div className="h-px bg-[#121212]/10"></div>
                 <p className="text-[8px] font-bold uppercase tracking-widest opacity-40 italic">Orders delivered with full integrity</p>
              </div>
              <div className="space-y-4">
                 <p className="text-[10px] font-black uppercase tracking-widest text-[#6B665E]">Acquisition Rate</p>
                 <p className="text-4xl font-serif italic">{summary?.totalOrders ? Math.round((summary.completedOrders / summary.totalOrders) * 100) : 100}%</p>
                 <div className="h-px bg-[#121212]/10"></div>
                 <p className="text-[8px] font-bold uppercase tracking-widest opacity-40 italic">Successful conversion ratio</p>
              </div>
              <div className="space-y-4">
                 <p className="text-[10px] font-black uppercase tracking-widest text-[#6B665E]">Platform Trust Score</p>
                 <p className="text-4xl font-serif italic text-green-600">A+</p>
                 <div className="h-px bg-[#121212]/10"></div>
                 <p className="text-[8px] font-bold uppercase tracking-widest opacity-40 italic">Market-service verification status</p>
              </div>
              <div className="space-y-4">
                 <p className="text-[10px] font-black uppercase tracking-widest text-[#6B665E]">Regional Rank</p>
                 <p className="text-4xl font-serif italic text-[#A34D15]">Top 5%</p>
                 <div className="h-px bg-[#121212]/10"></div>
                 <p className="text-[8px] font-bold uppercase tracking-widest opacity-40 italic">Benchmark against regional artisans</p>
              </div>
           </div>
        </div>
      </div>
    </Layout>
  );
}
