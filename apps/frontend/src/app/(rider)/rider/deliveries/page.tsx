'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { deliveryApi, riderApi } from '@/lib/api';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function RiderDeliveriesPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [filter, setFilter] = useState<'active' | 'history'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: deliveries, loading, execute: fetchDeliveries } = useApi(deliveryApi, 'get', `/deliveries/rider/${user?.id}`);
  const { data: profile } = useApi(riderApi, 'get', `/riders/me?userId=${user?.id}`);

  useEffect(() => {
    if (user?.id) fetchDeliveries();
  }, [user?.id, fetchDeliveries]);

  const filteredDeliveries = useMemo(() => {
    if (!deliveries) return [];
    let list = deliveries;
    if (filter === 'active') {
      list = deliveries.filter((d: any) => d.status !== 'delivered' && d.status !== 'failed');
    } else {
      list = deliveries.filter((d: any) => d.status === 'delivered' || d.status === 'failed');
    }

    if (searchQuery) {
      list = list.filter((d: any) => 
        d.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.pickup?.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.dropoff?.address?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return list;
  }, [deliveries, filter, searchQuery]);

  const stats = useMemo(() => {
    if (!deliveries) return { active: 0, completed: 0, earnings: 0, rating: 4.9 };
    return {
      active: deliveries.filter((d: any) => d.status !== 'delivered' && d.status !== 'failed').length,
      completed: deliveries.filter((d: any) => d.status === 'delivered').length,
      earnings: deliveries.filter((d: any) => d.status === 'delivered')
        .reduce((acc: number, d: any) => acc + (d.financials?.deliveryFee || 0), 0),
      rating: profile?.rating || 4.9
    };
  }, [deliveries, profile]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      delivered: 'bg-green-100 text-green-800 border-green-300',
      failed: 'bg-red-100 text-red-800 border-red-300',
      assigned: 'bg-blue-100 text-blue-800 border-blue-300',
      picked_up: 'bg-purple-100 text-purple-800 border-purple-300',
      en_route_to_pickup: 'bg-amber-100 text-amber-800 border-amber-300',
      en_route_to_dropoff: 'bg-amber-100 text-amber-800 border-amber-300',
      pending_handover: 'bg-orange-100 text-orange-800 border-orange-300',
    };
    return (
      <span className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-widest border ${styles[status] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-10 animate-reveal pb-24 pt-10 px-6">
        
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-[#121212] pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-px bg-[#F59E0B]" />
              <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.4em]">Rider Hub</p>
            </div>
            <h1 className="text-5xl font-serif text-[#121212] italic tracking-tighter leading-none">My Deliveries</h1>
          </div>
          
          <div className="flex gap-8">
            <div className="text-right border-r border-[#E5E1D8] pr-8">
              <p className="text-[9px] font-black text-[#6B665E] uppercase tracking-widest opacity-60 mb-1">Plate No.</p>
              <p className="text-xl font-serif italic text-[#121212] tracking-tighter">{profile?.plateNumber || '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-[#6B665E] uppercase tracking-widest opacity-60 mb-1">Rating</p>
              <p className="text-xl font-serif italic text-[#F59E0B] tracking-tighter">{stats.rating} ★</p>
            </div>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#E5E1D8] border-l-4 border-l-[#F59E0B] p-8 group hover:shadow-md transition-all">
            <p className="text-[9px] font-black text-[#6B665E] uppercase tracking-[0.3em] mb-4">Active Deliveries</p>
            <p className="text-5xl font-serif text-[#121212] italic tracking-tighter">{stats.active}</p>
            <p className="text-[9px] text-[#A34D15] font-black uppercase tracking-widest mt-2">In progress now</p>
          </div>
          
          <div className="bg-white border border-[#E5E1D8] border-l-4 border-l-[#121212] p-8 group hover:shadow-md transition-all">
            <p className="text-[9px] font-black text-[#6B665E] uppercase tracking-[0.3em] mb-4">Completed</p>
            <p className="text-5xl font-serif text-[#121212] italic tracking-tighter">{stats.completed}</p>
            <p className="text-[9px] text-[#6B665E] font-black uppercase tracking-widest mt-2 opacity-50">Total deliveries</p>
          </div>
          
          <div className="bg-[#121212] p-8 group shadow-xl">
            <p className="text-[9px] font-black text-[#F59E0B] uppercase tracking-[0.3em] mb-4">Total Earnings</p>
            <p className="text-5xl font-serif text-white italic tracking-tighter">{stats.earnings.toLocaleString()}</p>
            <p className="text-[9px] text-white/40 font-black uppercase tracking-widest mt-2">RWF earned</p>
          </div>
        </div>

        {/* ── Filter & Search Bar ── */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white border border-[#E5E1D8] p-4 shadow-sm">
          <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={() => setFilter('active')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                filter === 'active' ? 'bg-[#121212] text-white' : 'bg-[#F8F6F1] text-[#121212]/40 hover:text-[#121212] border border-[#E5E1D8]'
              }`}
            >
              Active
            </button>
            <button 
              onClick={() => setFilter('history')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                filter === 'history' ? 'bg-[#121212] text-white' : 'bg-[#F8F6F1] text-[#121212]/40 hover:text-[#121212] border border-[#E5E1D8]'
              }`}
            >
              History
            </button>
          </div>

          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-5 flex items-center pointer-events-none opacity-40 text-sm">🔍</span>
            <input 
              type="text" 
              placeholder="Search deliveries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-5 py-4 bg-[#F8F6F1] border border-[#E5E1D8] text-[10px] font-black uppercase tracking-widest focus:border-[#121212] outline-none transition-colors"
            />
          </div>
        </div>

        {/* ── Deliveries List ── */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-white border border-[#E5E1D8] animate-pulse" />
            ))}
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="py-24 text-center bg-white border-2 border-dashed border-[#E5E1D8]">
            <div className="text-6xl mb-6 opacity-80">🛵</div>
             <h3 className="text-2xl font-serif italic text-[#121212] mb-2">No Deliveries Found</h3>
             <p className="text-[11px] font-black text-[#6B665E] uppercase tracking-[0.5em] opacity-40 italic mb-8">
               {searchQuery ? 'Try adjusting your search criteria' : 'You have no deliveries in this category'}
             </p>
             {filter === 'active' && !searchQuery && (
               <Link href="/rider/dashboard" className="bg-[#121212] text-white px-10 py-4 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-[#A34D15] transition-all inline-block shadow-lg">
                  Go to Dashboard
               </Link>
             )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredDeliveries.map((delivery: any) => (
              <div key={delivery._id} className="bg-white border border-[#E5E1D8] group hover:border-[#121212] transition-all shadow-sm">
                <div className="flex flex-col md:flex-row">
                  
                  {/* Left: Meta Info */}
                  <div className="md:w-64 p-8 border-b md:border-b-0 md:border-r border-[#E5E1D8] bg-[#F8F6F1]/50 group-hover:bg-[#121212]/5 transition-colors">
                    <div className="flex items-center gap-3 flex-wrap mb-4">
                       {getStatusBadge(delivery.status)}
                    </div>
                    <p className="text-[9px] font-black text-[#6B665E] uppercase tracking-[0.3em] mb-1">Delivery ID</p>
                    <h3 className="text-2xl font-serif text-[#121212] tracking-tighter italic">
                      #{delivery.orderNumber?.split('-')[2] || delivery._id.substring(0, 6).toUpperCase()}
                    </h3>
                    <p className="text-[10px] text-[#6B665E] mt-3 font-bold uppercase tracking-widest opacity-60">
                       {new Date(delivery.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {new Date(delivery.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {/* Right: Route & Actions */}
                  <div className="flex-1 p-8 flex flex-col sm:flex-row gap-8 justify-between">
                    <div className="space-y-6 flex-1">
                       <div className="flex gap-5 items-start">
                          <div className="w-8 h-8 bg-white border border-[#E5E1D8] flex items-center justify-center flex-shrink-0 text-sm shadow-sm">🏪</div>
                          <div>
                             <p className="text-[8px] font-black text-[#F59E0B] uppercase tracking-widest mb-1">Pickup</p>
                             <p className="text-sm font-bold text-[#121212] leading-snug">{delivery.pickup?.address || 'Market Location'}</p>
                          </div>
                       </div>
                       <div className="w-px h-6 bg-[#E5E1D8] ml-4 -my-4" />
                       <div className="flex gap-5 items-start">
                          <div className="w-8 h-8 bg-[#121212] text-white flex items-center justify-center flex-shrink-0 text-sm shadow-sm">🏠</div>
                          <div>
                             <p className="text-[8px] font-black text-[#6B665E] uppercase tracking-widest mb-1">Drop-off</p>
                             <p className="text-sm font-bold text-[#121212] leading-snug">{delivery.dropoff?.address || 'Customer Location'}</p>
                          </div>
                       </div>
                    </div>

                    <div className="flex flex-col justify-between items-end sm:items-end items-start border-t sm:border-t-0 border-[#F0EDE4] pt-6 sm:pt-0">
                       <div className="text-left sm:text-right mb-6 sm:mb-0">
                          <p className="text-[8px] font-black text-[#6B665E] uppercase tracking-widest mb-1">Earnings</p>
                          <p className="text-3xl font-serif text-[#121212] italic tracking-tighter">
                            {delivery.financials?.deliveryFee?.toLocaleString() || '500'} <span className="text-xs not-italic font-sans text-[#A34D15] font-black uppercase">RWF</span>
                          </p>
                       </div>
                       <Link href={`/orders/${delivery.orderId}/tracking`} className="w-full sm:w-auto">
                         <button className="w-full sm:w-auto bg-[#121212] hover:bg-[#F59E0B] text-white font-black uppercase tracking-[0.3em] text-[10px] transition-all py-4 px-8 shadow-md">
                            Track Delivery →
                         </button>
                       </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
