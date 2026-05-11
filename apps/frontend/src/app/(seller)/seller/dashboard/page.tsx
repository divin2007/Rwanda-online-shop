'use client';
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { sellerApi, adminApi, orderApi, productApi, walletApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';

const AnalyticsCharts = dynamic(() => import('@/components/ui/AnalyticsCharts').then(mod => mod.AnalyticsCharts), { ssr: false });

export default function SellerDashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role === 'BUYER') {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Real Data Handshaking
  const profileUrl = user?.id ? `/sellers/me?userId=${user.id}` : null;
  const { data: profile, loading: profileLoading, error: profileError } = useApi(sellerApi, 'get', profileUrl || '');
  
  // Grace Period to prevent handshake loops immediately after onboarding
  const [isSettled, setIsSettled] = useState(false);
  useEffect(() => {
    if (!profileLoading) {
      const timer = setTimeout(() => setIsSettled(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setIsSettled(false);
    }
  }, [profileLoading]);

  // 1. Redirection Logic: If no profile exists, send to onboarding
  useEffect(() => {
    // ONLY redirect if we are settled, have a user, and we are CERTAIN no profile exists for them
    if (isSettled && user?.id && !profileLoading && profile === null && user.role === 'SELLER') {
      console.log('[Dashboard] No profile found after grace period. Redirecting to onboarding.');
      router.push('/seller/onboarding');
    }
  }, [profile, profileLoading, user, router, isSettled]);

  const { data: productsData } = useApi(productApi, 'get', `/products?sellerId=${user?.id}`);
  const { data: ordersData, loading: ordersLoading } = useApi(orderApi, 'get', `/orders?sellerId=${user?.id}&status=awaiting_quote,quote_sent,placed,confirmed,preparing,ready_for_pickup`);
  const { data: walletData } = useApi(walletApi, 'get', `/wallets/me?userId=${user?.id}`);
  const { data: analyticsData } = useApi(adminApi, 'get', `/seller/dashboard/analytics/${user?.id}`);

  const products = productsData || [];
  const activeOrders = ordersData || [];
  const wallet = walletData || { balance: 0 };
  const analytics = analyticsData || { totalRevenue: 0, avgRating: 5 };

  if (profileError) {
    return (
      <Layout>
        <div className="p-20 text-center space-y-6">
          <div className="text-red-500 text-6xl">⚠</div>
          <h2 className="text-2xl font-serif">Connection Interrupted</h2>
          <p className="text-sm text-[#6B665E] italic max-w-md mx-auto">The secure link to your vendor profile was lost. Please re-authenticate.</p>
          <button onClick={() => window.location.reload()} className="rmf-btn-primary px-12">Re-initialize Handshake</button>
        </div>
      </Layout>
    );
  }

  // Only show full-page loading if we are actually loading the profile
  if (profileLoading || (profile === null && !profileError)) {
    return (
      <Layout>
        <div className="p-20 text-center flex flex-col items-center justify-center space-y-12 min-h-[60vh] animate-reveal">
          <div className="relative">
             <div className="w-24 h-24 border-2 border-[#121212]/10 rounded-full"></div>
             <div className="absolute top-0 left-0 w-24 h-24 border-t-2 border-[#F59E0B] rounded-full animate-spin"></div>
          </div>
          <div className="space-y-4">
            <h2 className="font-serif text-3xl italic tracking-tighter">Synchronizing Institutional Identity...</h2>
            <div className="flex items-center justify-center gap-4">
               <div className="w-8 h-px bg-[#F59E0B]"></div>
               <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Verifying RMF Merchant Mandate</p>
               <div className="w-8 h-px bg-[#F59E0B]"></div>
            </div>
            <p className="text-[9px] text-[#6B665E] italic max-w-xs mx-auto opacity-60 leading-relaxed mt-6">
               Establishing secure link to regional hub registry. This process ensures your facilitation credentials are live across the network.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // 2. Pending State: If profile exists but not approved
  if (profile && !profile.isApproved) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-12 animate-reveal">
           <div className="max-w-3xl w-full bg-white border-2 border-[#121212] p-16 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-[#F59E0B]"></div>
              <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none">
                 <div className="text-[200px] font-serif italic leading-none">PEND</div>
              </div>
              
              <div className="relative z-10 space-y-12">
                 <div className="space-y-6 text-center">
                    <p className="text-[11px] font-black text-[#F59E0B] uppercase tracking-[0.5em]">Institutional Status: Awaiting Verification</p>
                    <h1 className="text-6xl font-serif tracking-tighter italic leading-none text-[#121212]">
                       Mandate Processing
                    </h1>
                    <div className="w-24 h-px bg-[#121212]/20 mx-auto"></div>
                 </div>

                 <div className="bg-[#F8F6F1] p-10 space-y-8 border border-[#E5E1D8]">
                    <div className="flex gap-8">
                       <div className="w-12 h-12 bg-[#121212] flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xl">🛡</span>
                       </div>
                       <div className="space-y-2">
                          <h4 className="text-[13px] font-black uppercase tracking-widest text-[#121212]">Verification in Progress</h4>
                          <p className="text-xs italic text-[#6B665E] leading-relaxed">Your artisan credentials and facility details are currently being audited by the RMF regional administration to ensure network compliance.</p>
                       </div>
                    </div>

                    <div className="flex gap-8">
                       <div className="w-12 h-12 border-2 border-[#121212] flex items-center justify-center flex-shrink-0">
                          <span className="text-xl">⏳</span>
                       </div>
                       <div className="space-y-2">
                          <h4 className="text-[13px] font-black uppercase tracking-widest text-[#121212]">Deployment Timeline</h4>
                          <p className="text-xs italic text-[#6B665E] leading-relaxed">Typical verification cycles complete within 24 operational hours. You will receive an encrypted notification once your workstation is live.</p>
                       </div>
                    </div>
                 </div>

                 <div className="pt-8 flex flex-col items-center gap-6">
                    <p className="text-[10px] font-bold text-[#6B665E] uppercase tracking-widest opacity-60 italic">Current Facility: {profile.shopDetails?.name || 'RMF Hub Stall'}</p>
                    <Link href="/" className="rmf-btn-primary px-12 bg-transparent text-[#121212] border-2 border-[#121212] hover:bg-[#121212] hover:text-white shadow-none">Return to Network Hub</Link>
                 </div>
              </div>
           </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="animate-reveal space-y-20 pb-20">
        {/* Tactical Header */}
        <div className="relative bg-white text-[#121212] p-16 overflow-hidden group shadow-2xl border-2 border-[#121212]">
          <div className="absolute top-0 right-0 p-10 opacity-5">
             <div className="text-[150px] font-serif leading-none italic select-none">VEND</div>
          </div>
          
          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-12">
            <div className="space-y-6">
               <div className="flex items-center gap-6">
                  <div className="w-12 h-px bg-[#F59E0B]"></div>
                  <p className="text-[11px] font-black text-[#F59E0B] uppercase tracking-[0.5em]">Workstation Active: {profile?.stallId || 'STALL-00'}</p>
               </div>
               <h1 className="text-7xl font-serif tracking-tighter italic leading-none text-[#121212]">
                 {profile?.shopDetails?.name || 'Artisan Facility'}
               </h1>
               <div className="flex items-center gap-8 text-[10px] font-bold uppercase tracking-widest text-[#121212]/60 italic">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> {t('verified_facility')}
                  </span>
                  <span>•</span>
                  <span>{profile?.shopDetails?.category || 'General Artisanal'}</span>
               </div>
            </div>
            
            <div className="flex flex-wrap gap-6">
               <Link href="/seller/products/new" className="rmf-btn-primary bg-[#F59E0B] hover:bg-[#C25D1D] shadow-[0_20px_50px_-15px_rgba(163,77,21,0.4)] border-none">
                 + New Artifact
               </Link>
               <Link href="/seller/qr" className="rmf-btn-outline border-[#121212] text-[#121212] hover:bg-[#121212] hover:text-white">
                 Print Stall QR
               </Link>
            </div>
          </div>
        </div>

        {/* Dynamic Metrics Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
           {[
             { label: 'Network Liquidity', val: `${wallet.balance?.toLocaleString() || 0} RWF`, sub: 'Ready for payout', icon: '💰', color: 'text-white', border: 'border-[#F59E0B]/40' },
             { label: 'Active Mandates', val: activeOrders.length, sub: 'Requires fulfillment', icon: '📦', color: 'text-white', border: 'border-white/10' },
             { label: 'Artifact Inventory', val: products.length, sub: 'Verified collection', icon: '🏺', color: 'text-white', border: 'border-white/10' },
             { label: 'Merchant Trust', val: `${analytics.avgRating?.toFixed(1) || '5.0'} / 5.0`, sub: 'RMF Verification', icon: '⭐', color: 'text-amber-500', border: 'border-white/10' },
           ].map((stat, i) => (
             <div key={i} className={`bg-[#121212] border ${stat.border} p-10 group hover:border-[#F59E0B] transition-all relative`}>
                <div className="flex justify-between items-start mb-8">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#F59E0B] opacity-60">{stat.label}</p>
                  <span className={`text-2xl opacity-30 group-hover:opacity-100 transition-opacity ${stat.color}`}>{stat.icon}</span>
                </div>
                <h3 className={`text-4xl font-serif tracking-tighter ${stat.color}`}>{stat.val}</h3>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mt-3 opacity-40 italic">{stat.sub}</p>
             </div>
           ))}
        </div>

        {/* Operational Analytics: Revenue Velocity */}
        <div className="bg-white border-2 border-[#121212] p-12 relative overflow-hidden shadow-2xl">
           <div className="flex justify-between items-end border-b-2 border-[#121212] pb-8 mb-12">
              <div>
                <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.5em] mb-4">Operational Analytics</p>
                <h2 className="text-5xl font-serif italic tracking-tighter text-[#121212]">Revenue Velocity</h2>
                <p className="text-[9px] font-bold text-[#6B665E] uppercase tracking-widest mt-2 opacity-60">Last 30 Operational Cycles • Active Sync</p>
              </div>
              <div className="flex items-center gap-4 bg-[#F8F6F1] px-6 py-3 border border-[#E5E1D8]">
                 <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                 <span className="text-[9px] font-black uppercase tracking-widest">Live Telemetry</span>
              </div>
           </div>
           
           <div className="w-full">
              <AnalyticsCharts type="seller" data={analyticsData} />
           </div>
           
           <div className="mt-12 pt-8 border-t border-[#F0EDE4] flex justify-between items-center">
              <p className="text-[8px] font-black text-[#6B665E] uppercase tracking-[0.4em] opacity-40 italic">RMF Institutional Analytics Node v4.2</p>
              <Link href="/seller/analytics" className="text-[10px] font-black uppercase tracking-[0.3em] text-[#F59E0B] hover:underline">Access Detailed Dossier →</Link>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
           {/* Centerpiece: Active Commercial Mandates */}
           <div className="lg:col-span-2 space-y-12">
              <div className="flex justify-between items-end border-b-2 border-[#121212] pb-8">
                 <div>
                   <p className="text-[9px] font-black text-[#F59E0B] uppercase tracking-[0.4em] mb-3">Live Operations</p>
                   <h2 className="text-4xl font-serif italic tracking-tighter text-[#121212]">Pending Fulfillment</h2>
                 </div>
                 <Link href="/seller/orders" className="text-[10px] font-black uppercase tracking-[0.3em] text-[#121212] hover:text-[#F59E0B] transition-colors border-b-2 border-[#121212]/10 hover:border-[#F59E0B] pb-2">View History →</Link>
              </div>

              <div className="space-y-6">
                {ordersLoading ? (
                   <div className="h-64 bg-[#F2F0EB] animate-pulse border-2 border-dashed border-[#E5E1D8]"></div>
                ) : activeOrders.length > 0 ? activeOrders.map((order: any) => (
                   <div key={order._id} className="bg-white border border-[#E5E1D8] p-8 flex flex-col md:flex-row gap-10 items-center group hover:border-[#121212] transition-all relative overflow-hidden">
                      <div className="w-24 h-24 bg-[#F8F6F1] flex-shrink-0 border border-[#E5E1D8]">
                         <img src={order.products?.[0]?.images?.[0] || 'https://images.unsplash.com/photo-1544441893-675973e31985'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt={order.products?.[0]?.name} />
                      </div>
                      <div className="flex-grow text-center md:text-left">
                         <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-3">
                            <span className="text-[8px] font-black bg-[#121212] text-white px-3 py-1 uppercase tracking-tighter">#{order._id.substring(0,8).toUpperCase()}</span>
                            <span className="text-[8px] font-black border border-[#F59E0B] text-[#F59E0B] px-3 py-1 uppercase tracking-tighter">{order.status.replace(/_/g, ' ')}</span>
                         </div>
                         <h4 className="text-2xl font-serif text-[#121212] tracking-tighter italic leading-none mb-2">{order.products?.[0]?.name || 'Institutional Mandate'}</h4>
                         <p className="text-[10px] font-bold text-[#6B665E] uppercase tracking-widest opacity-60 italic">Facilitated: {new Date(order.createdAt).toLocaleDateString()} • {order.products?.length || 1} Item(s)</p>
                      </div>
                      <div className="text-right">
                         <p className="text-xl font-serif text-[#121212] mb-4">{(order.financials?.totalAmount || 0).toLocaleString()} RWF</p>
                         <Link href={`/seller/orders/${order._id}`} className="rmf-btn-primary py-3 text-[8px] bg-transparent text-[#121212] border-2 border-[#121212] hover:bg-[#121212] hover:text-white shadow-none">Manage Mandate</Link>
                      </div>
                   </div>
                )) : (
                   <div className="border-4 border-dashed border-[#F0EDE4] bg-[#F9F7F2]/50 py-32 text-center">
                      <p className="text-[12px] font-black text-[#6B665E] uppercase tracking-[0.6em] italic opacity-40">No pending commercial mandates synchronized</p>
                   </div>
                )}
              </div>
           </div>

           {/* Tactical Sidebar: Status & Growth */}
           <div className="space-y-12">
              <div className="bg-[#F8F6F1] border border-[#E5E1D8] p-10 space-y-10">
                 <div>
                    <p className="text-[9px] font-black text-[#121212] uppercase tracking-[0.4em] mb-6 border-b border-[#E5E1D8] pb-4">Merchant Status</p>
                    <div className="space-y-6">
                       <div className="flex justify-between items-end">
                          <span className="text-[10px] font-bold text-[#6B665E] uppercase tracking-widest opacity-60 italic">Handover Delay</span>
                          <span className="text-lg font-serif text-green-600 italic">Optimal (12m)</span>
                       </div>
                       <div className="flex justify-between items-end">
                          <span className="text-[10px] font-bold text-[#6B665E] uppercase tracking-widest opacity-60 italic">Compliance Rating</span>
                          <span className="text-lg font-serif text-[#F59E0B] italic">Premium (98%)</span>
                       </div>
                    </div>
                 </div>
                 
                 <div className="bg-[#121212] text-white p-8">
                    <p className="text-[9px] font-black text-[#F59E0B] uppercase tracking-[0.4em] mb-4 italic">Next Step</p>
                    <p className="text-xs italic leading-relaxed opacity-70 mb-8">You have artifacts waiting for replenishment. Update stock to maintain visibility.</p>
                    <Link href="/seller/products" className="text-[10px] font-black uppercase tracking-widest border-b border-[#F59E0B] pb-1 hover:text-[#F59E0B] transition-colors">Audit Inventory</Link>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </Layout>
  );
}
