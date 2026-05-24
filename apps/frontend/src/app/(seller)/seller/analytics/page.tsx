'use client';
import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { adminApi, sellerApi } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/context/LanguageContext';
import { DollarSign, Package, Zap } from 'lucide-react';
import dynamic from 'next/dynamic';

const AnalyticsCharts = dynamic(() => import('@/components/ui/AnalyticsCharts').then(mod => mod.AnalyticsCharts), { ssr: false });

export default function SellerAnalyticsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const { data: profile } = useApi(sellerApi, 'get', `/sellers/me?userId=${user?.id}`);
  const { data: analytics, loading } = useApi(adminApi, 'get', `/seller/dashboard/analytics/${user?.id}`);
  const { data: summary } = useApi(adminApi, 'get', `/analytics/seller/${user?.id}`);
  const ratingValue = Number(summary?.avgRating || profile?.rating || 0);
  const avgPrepTime = summary?.avgPrepTime === null || summary?.avgPrepTime === undefined
    ? 'No data'
    : `${summary.avgPrepTime} min`;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-16 animate-reveal pb-32">
        {/* ── Header Section ── */}
        <div className="border-b-2 border-[#e0e0e0] pb-12">
          <div className="flex items-center gap-4 mb-6">
             <div className="w-12 h-px bg-[#ffd700]" />
             <p className="text-[10px] font-black text-[#ff6b00] uppercase tracking-[0.5em]">Analytics & Reporting</p>
          </div>
          <h1 className="text-7xl md:text-8xl font-sans text-[#1b1c1c] leading-[0.85] tracking-normal">Sales Analytics</h1>
          <p className="text-[10px] font-bold text-[#414844] uppercase tracking-widest mt-6 opacity-80">
            Performance report for {profile?.shopDetails?.name || 'Your Shop'}
          </p>
        </div>

        {/* ── High Level Metrics ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {[
             { label: 'Total Revenue', val: `${summary?.salesToday?.toLocaleString() || 0} RWF`, sub: 'Lifetime sales volume', icon: <DollarSign className="w-12 h-12 text-[#ff6b00]" /> },
             { label: 'Total Orders', val: summary?.totalOrders || 0, sub: 'All processed orders', icon: <Package className="w-12 h-12 text-primary" /> },
             { label: 'Average Prep Time', val: avgPrepTime, sub: 'Time from order to pickup', icon: <Zap className="w-12 h-12 text-amber-500" /> }
           ].map((stat, i) => (
             <div key={i} className="bg-white border border-[#e0e0e0] border-l-4 border-l-[#1b1c1c] p-8 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-40 transition-opacity">{stat.icon}</div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#414844] mb-2">{stat.label}</p>
                <h3 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">{stat.val}</h3>
                <p className="text-[9px] font-medium uppercase tracking-widest text-[#ff6b00] mt-4">{stat.sub}</p>
             </div>
           ))}
        </div>

        {/* ── Detailed Analytics Matrix ── */}
        <div className="space-y-12">
           {/* Revenue Chart */}
           <div className="bg-white border border-[#e0e0e0] p-8 md:p-10 space-y-10 shadow-sm flex flex-col">
              <div className="flex justify-between items-end border-b border-[#e0e0e0] pb-6">
                 <div>
                    <h3 className="text-3xl font-sans tracking-normal text-[#1b1c1c]">Revenue Trend</h3>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#414844] mt-2 opacity-50">Last 30 Days</p>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <p className="text-[9px] font-black text-[#1b1c1c] uppercase tracking-widest">Live</p>
                 </div>
              </div>
              <div className="flex-1 min-h-[300px]">
                 <AnalyticsCharts type="seller" data={analytics} hidePerformance={true} />
              </div>
           </div>

           {/* Top Products */}
           <div className="bg-white border border-[#e0e0e0] p-8 md:p-10 space-y-10 shadow-sm relative overflow-hidden flex flex-col">
              <div className="flex justify-between items-end border-b border-[#e0e0e0] pb-6">
                 <div>
                    <h3 className="text-3xl font-sans tracking-normal text-[#1b1c1c]">Top Products</h3>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#414844] mt-2 opacity-50">Best selling items by volume</p>
                 </div>
              </div>
              
              <div className="space-y-6 flex-1">
                 {analytics?.performance && analytics.performance.length > 0 ? (
                    analytics.performance.map((prod: any, i: number) => (
                       <div key={i} className="group">
                          <div className="flex justify-between items-end mb-2">
                             <span className="text-[10px] font-black uppercase tracking-widest text-[#1b1c1c] line-clamp-1 pr-4">{prod.name}</span>
                             <span className="text-base font-sans text-[#ff6b00] flex-shrink-0">{prod.sales} Sold</span>
                          </div>
                          <div className="h-1.5 bg-[#fcf9f8] relative rounded-full overflow-hidden">
                             <div 
                                className="absolute top-0 left-0 h-full bg-[#e05300] transition-all duration-1000 rounded-full" 
                                style={{ width: `${Math.min(100, (prod.sales / (analytics?.performance?.[0]?.sales || 1)) * 100)}%` }}
                             />
                          </div>
                       </div>
                    ))
                 ) : (
                    <div className="h-full flex items-center justify-center py-20 text-center">
                       <p className="text-lg font-sans text-[#414844]">No sales data available yet.</p>
                    </div>
                 )}
              </div>
           </div>
        </div>

        {/* ── Store Performance Summary ── */}
        <div className="bg-[#e05300] text-white p-10 md:p-12 relative shadow-xl mt-8">
           <div className="absolute top-0 right-0 px-6 py-3 bg-[#ffd700] text-[#1b1c1c] text-[9px] font-black uppercase tracking-[0.4em]">Store Health</div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 pt-8">
              <div className="space-y-3">
                 <p className="text-[9px] font-black uppercase tracking-widest text-white/50">Completed Orders</p>
                 <p className="text-4xl font-sans">{summary?.completedOrders || 0}</p>
                 <div className="h-px bg-white/10 my-4" />
                 <p className="text-[8px] uppercase tracking-widest opacity-40">Successfully delivered to customers</p>
              </div>
              <div className="space-y-3">
                 <p className="text-[9px] font-black uppercase tracking-widest text-white/50">Fulfillment Rate</p>
                 <p className="text-4xl font-sans">{summary?.fulfillmentRate || 0}%</p>
                 <div className="h-px bg-white/10 my-4" />
                 <p className="text-[8px] uppercase tracking-widest opacity-40">Orders completed without cancellation</p>
              </div>
              <div className="space-y-3">
                 <p className="text-[9px] font-black uppercase tracking-widest text-white/50">Customer Rating</p>
                 <p className="text-4xl font-sans text-[#ff6b00]">{ratingValue > 0 ? ratingValue.toFixed(1) : 'New'}</p>
                 <div className="h-px bg-white/10 my-4" />
                 <p className="text-[8px] uppercase tracking-widest opacity-40">{summary?.totalReviews || 0} buyer reviews</p>
              </div>
              <div className="space-y-3">
                 <p className="text-[9px] font-black uppercase tracking-widest text-white/50">Seller Status</p>
                 <p className="text-4xl font-sans text-white">{profile?.isApproved === false ? 'Pending' : 'Active'}</p>
                 <div className="h-px bg-white/10 my-4" />
                 <p className="text-[8px] uppercase tracking-widest opacity-40">Verified and open for business</p>
              </div>
           </div>
        </div>
      </div>
    </Layout>
  );
}
