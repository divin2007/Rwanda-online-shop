'use client';
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { riderApi, deliveryApi, walletApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import Link from 'next/link';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
const RiderMap = dynamic(() => import('@/components/ui/RiderMap').then(mod => mod.RiderMap), { ssr: false });

export default function RiderDashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  
  // Real Data Hooks
  const { data: profile, loading: profileLoading } = useApi(riderApi, 'get', `/riders/me?userId=${user?.id}`);
  const { data: statsData } = useApi(riderApi, 'get', `/riders/stats/${user?.id}`);
  const { data: deliveriesData, execute: fetchDeliveries } = useApi(deliveryApi, 'get', `/deliveries/rider/${user?.id}?status=assigned,picked_up,en_route_to_dropoff`);
  const { data: availableData, execute: fetchAvailable } = useApi(deliveryApi, 'get', '/deliveries/available');
  const { data: walletData } = useApi(walletApi, 'get', `/wallets/me?userId=${user?.id}`);

  const stats = statsData || { earnings: 0, completion: 100, rating: 5, drops: 0 };
  const activeDeliveries = deliveriesData || [];
  const availableDeliveries = availableData || [];
  const wallet = walletData || { balance: 0 };

  const handleAccept = async (id: string) => {
    try {
      await deliveryApi.patch(`/deliveries/${id}/accept`, { riderId: user?.id });
      toast.success('Delivery accepted! Check your active deliveries.');
      fetchDeliveries();
      fetchAvailable();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to accept delivery');
    }
  };

  if (profileLoading) {
    return <Layout><div className="p-20 text-center font-serif text-2xl animate-pulse italic text-[#121212]">Loading your dashboard...</div></Layout>;
  }

  if (!profile) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto py-32 text-center space-y-12 animate-reveal">
          <div className="w-24 h-24 bg-[#F59E0B]/10 border-2 border-[#F59E0B]/30 flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(245,158,11,0.1)]">
            <svg className="w-12 h-12 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </div>
          <h1 className="text-6xl font-serif tracking-tighter italic text-[#121212]">Profile Not Found</h1>
          <p className="text-[#6B665E] uppercase tracking-[0.3em] text-[10px] font-black max-w-md mx-auto leading-relaxed">
            Your rider profile hasn't been set up yet. 
            Complete your registration to start accepting deliveries.
          </p>
          <button 
            onClick={() => window.location.href = '/rider/register'}
            className="rmf-btn-primary bg-[#121212] border-none text-white px-12 py-5 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-[#F59E0B] transition-all"
          >
            Register as Rider →
          </button>
        </div>
      </Layout>
    );
  }

  const currentTask = activeDeliveries[0];

  return (
    <Layout>
      <div className="animate-reveal space-y-10 pb-20">
        {/* RMF Logistics Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-[#121212] pb-8">
          <div>
            <p className="text-[10px] font-black text-[#A34D15] uppercase tracking-[0.5em] mb-4">Rider Dashboard</p>
            <h1 className="text-5xl font-serif italic tracking-tighter text-[#121212] leading-none">My Dashboard</h1>
          </div>
          <div className="flex items-center gap-4 bg-white border-2 border-[#121212] px-6 py-3 shadow-[4px_4px_0_0_#121212]">
             <div className="w-2 h-2 bg-[#F59E0B] rounded-full animate-pulse"></div>
             <p className="text-[10px] font-black uppercase tracking-widest text-[#121212]">Rider: {user?.fullName}</p>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Earnings', value: `${wallet.balance?.toLocaleString() || 0} RWF`, icon: 'W' },
            { label: 'Completion Rate', value: `${stats.completion}%`, sub: 'Target: 95%+', icon: 'R' },
            { label: 'Your Rating', value: stats.rating?.toFixed(2) || '5.0', sub: 'Customer reviews', icon: 'S' },
            { label: 'Total Deliveries', value: `${stats.drops}`, sub: 'Lifetime total', icon: 'D' },
          ].map((stat, i) => (
            <div key={i} className="bg-white border border-[#E5E1D8] p-6 flex flex-col justify-between group hover:border-[#121212] transition-all shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#6B665E] opacity-60">{stat.label}</p>
                <span className="text-[10px] font-serif italic text-[#F59E0B] font-bold">{stat.icon}</span>
              </div>
              <h2 className="text-2xl font-serif italic text-[#121212] tracking-tighter">{stat.value}</h2>
              {stat.sub && <p className="text-[8px] text-[#A34D15] mt-3 font-black uppercase tracking-widest opacity-50">{stat.sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            {/* Map Matrix */}
            <div className="bg-white border border-[#E5E1D8] overflow-hidden shadow-sm relative group">
               <div className="px-8 py-5 bg-[#F8F6F1] border-b border-[#E5E1D8] flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[#121212]">Delivery Map</h3>
                  <span className="text-[8px] font-bold text-[#6B665E] uppercase tracking-widest opacity-40">Kigali Area</span>
               </div>
               <div className="h-[500px] relative">
                  <RiderMap marketId="" centerLat={profile.currentLocation?.lat || -1.9441} centerLng={profile.currentLocation?.lng || 30.0619} />
               </div>
               <div className="absolute top-20 right-8 z-10 space-y-2">
                  <div className="bg-[#121212] text-white px-4 py-2 text-[9px] font-black uppercase tracking-widest border border-[#F59E0B]/30 shadow-2xl">
                    Live Tracking Active
                  </div>
               </div>
            </div>

            {/* Available Mandates Matrix */}
            <div className="bg-white border-2 border-[#121212] shadow-[8px_8px_0_0_#121212]">
               <div className="px-8 py-6 bg-[#121212] flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Available Deliveries</h3>
                    <div className="w-2 h-2 bg-[#F59E0B] rounded-full animate-pulse"></div>
                  </div>
                  <button onClick={fetchAvailable} className="text-[8px] font-black text-[#F59E0B] uppercase tracking-widest border-b border-[#F59E0B]/30">Refresh</button>
               </div>
               <div className="divide-y divide-[#F0EDE4]">
                 {availableDeliveries.length > 0 ? availableDeliveries.map((delivery: any) => (
                   <div key={delivery._id} className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-[#F9F7F2] transition-colors group">
                      <div className="space-y-4">
                         <div className="flex items-center gap-4">
                            <span className="text-xl font-serif italic text-[#121212]">#{delivery.orderNumber?.substring(0,8) || delivery._id.substring(0,8).toUpperCase()}</span>
                            <span className="text-[8px] font-black text-[#A34D15] border border-[#A34D15]/20 px-3 py-1 uppercase tracking-tighter">UNASSIGNED</span>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[11px] text-[#121212] font-medium italic leading-relaxed opacity-80">
                               Pickup: {delivery.pickup?.address || 'Market'}
                            </p>
                            <p className="text-[11px] text-[#121212] font-medium italic leading-relaxed opacity-80">
                               Drop-off: {delivery.dropoff?.address || 'Customer address'}
                            </p>
                         </div>
                      </div>
                      <div className="flex items-center gap-8">
                         <div className="text-right">
                            <p className="text-[9px] font-black text-[#6B665E] uppercase tracking-widest mb-1 opacity-40 italic">Delivery Fee</p>
                            <p className="text-xl font-serif text-[#121212] italic tracking-tighter">{(delivery.financials?.deliveryFee || 0).toLocaleString()} RWF</p>
                         </div>
                         <button 
                           onClick={() => handleAccept(delivery._id)}
                           className="bg-[#121212] text-white px-10 py-4 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-[#F59E0B] transition-all"
                         >
                           Accept Delivery
                         </button>
                      </div>
                   </div>
                 )) : (
                   <div className="p-20 text-center space-y-4">
                      <p className="text-[10px] font-black text-[#6B665E] uppercase tracking-[0.5em] opacity-30 italic">No deliveries available right now</p>
                      <div className="w-10 h-1 bg-[#121212]/10 mx-auto"></div>
                   </div>
                 )}
               </div>
            </div>
          </div>

          {/* Active Workload Sidebar */}
          <div className="space-y-10">
            {currentTask ? (
              <div className="bg-[#121212] text-white p-10 relative overflow-hidden group shadow-2xl border-t-4 border-[#F59E0B]">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                   <svg className="w-32 h-32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </div>
                <p className="text-[9px] font-black uppercase tracking-[0.5em] mb-8 text-[#F59E0B]">Current Delivery</p>
                <h2 className="text-4xl font-serif italic mb-10 leading-tight tracking-tighter">Order #{currentTask.orderNumber?.substring(0,8) || currentTask._id.substring(0,8).toUpperCase()}</h2>
                
                <div className="space-y-8 mb-12">
                   <div className="flex items-start gap-4">
                      <div className="w-1.5 h-1.5 bg-[#F59E0B] rounded-full mt-1.5"></div>
                      <div>
                        <p className="text-[8px] font-black text-[#F59E0B] uppercase tracking-widest mb-1 opacity-60 italic">Drop-off Address</p>
                        <p className="text-xs font-medium leading-relaxed italic opacity-80">{currentTask.dropoff?.address || 'Customer address'}</p>
                      </div>
                   </div>
                   <div className="flex items-start gap-4">
                      <div className="w-1.5 h-1.5 bg-[#F59E0B] rounded-full mt-1.5 opacity-30"></div>
                      <div>
                        <p className="text-[8px] font-black text-[#F59E0B] uppercase tracking-widest mb-1 opacity-60 italic">Delivery Fee</p>
                        <p className="text-xl font-serif italic">{(currentTask.financials?.deliveryFee || 0).toLocaleString()} RWF</p>
                      </div>
                   </div>
                </div>

                <Link href={`/orders/${currentTask.orderId}/tracking`} className="block w-full bg-[#F59E0B] text-[#121212] py-5 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-white transition-all shadow-[0_10px_30px_rgba(245,158,11,0.3)]">
                  Track Delivery →
                </Link>
              </div>
            ) : (
              <div className="bg-[#F8F6F1] border-2 border-dashed border-[#121212]/20 p-12 text-center space-y-6">
                 <div className="w-12 h-12 border border-[#121212]/10 flex items-center justify-center mx-auto opacity-30">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 </div>
                 <p className="text-[10px] font-black text-[#6B665E] uppercase tracking-[0.4em] opacity-40 italic">No active delivery — check available orders</p>
              </div>
            )}

            <div className="space-y-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#121212] border-b border-[#F0EDE4] pb-4">Queued Deliveries</h3>
              {activeDeliveries.slice(1).length > 0 ? activeDeliveries.slice(1).map((delivery: any, i: number) => (
                <div key={i} className="bg-white border border-[#E5E1D8] p-8 flex justify-between items-center group cursor-pointer hover:border-[#121212] transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[8px] font-black text-[#F59E0B] border border-[#F59E0B]/20 px-3 py-1 uppercase tracking-tighter">QUEUED</span>
                      <span className="text-[8px] font-bold text-[#6B665E] uppercase tracking-widest opacity-40 italic">#{delivery.orderNumber?.substring(0,8) || delivery._id.substring(0,8).toUpperCase()}</span>
                    </div>
                    <h4 className="text-sm font-serif italic text-[#121212] line-clamp-1">{delivery.dropoff?.address || 'Customer address'}</h4>
                  </div>
                  <span className="text-xl opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all">→</span>
                </div>
              )) : (
                <div className="px-2">
                   <p className="text-[9px] font-black text-[#6B665E] uppercase tracking-widest opacity-20 italic">No queued deliveries</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
