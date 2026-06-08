'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { deliveryApi, riderApi } from '@/lib/api';
import { Search, Bike, Store, MapPin } from 'lucide-react';
import Link from 'next/link';
import { ProofOfDelivery } from '@/components/ui/ProofOfDelivery';

const RIDER_DELIVERIES_REFRESH_MS = 10000;

export default function RiderDeliveriesPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<'active' | 'history'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: deliveries, loading, execute: fetchDeliveries } = useApi(deliveryApi, 'get', user?.id ? `/deliveries/rider/${user.id}` : '', { refreshInterval: RIDER_DELIVERIES_REFRESH_MS });
  const { data: profile } = useApi(riderApi, 'get', user?.id ? `/riders/me?userId=${user.id}` : '');

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
    if (!deliveries) return { active: 0, completed: 0, earnings: 0, rating: Number(profile?.rating || 0) };
    return {
      active: deliveries.filter((d: any) => d.status !== 'delivered' && d.status !== 'failed').length,
      completed: deliveries.filter((d: any) => d.status === 'delivered').length,
      earnings: deliveries.filter((d: any) => d.status === 'delivered')
        .reduce((acc: number, d: any) => acc + (d.financials?.deliveryFee || 0), 0),
      rating: Number(profile?.rating || 0)
    };
  }, [deliveries, profile]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      delivered: 'bg-green-100 text-green-800 border-green-300',
      failed: 'bg-[#fff5f3] text-[#7b3f3f] border-[#f1cbc3]',
      assigned: 'bg-blue-100 text-blue-800 border-blue-300',
      picked_up: 'bg-purple-100 text-purple-800 border-purple-300',
      en_route_to_pickup: 'bg-[#e8f5ed] text-[#ff6b00] border-[#ffedd5]',
      en_route_to_dropoff: 'bg-[#e8f5ed] text-[#ff6b00] border-[#ffedd5]',
      pending_handover: 'bg-[#f7faf8] text-[#405046] border-[#dfe7e2]',
    };
    return (
      <span className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-widest border ${styles[status] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 animate-reveal pb-20">
        
        {/* ── Header ── */}
        <div className="overflow-hidden rounded-lg border border-[#0b4b32]/20 bg-[#e05300] p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-[#ffedd5]" />
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffedd5]">Rider Hub</p>
            </div>
            <h1 className="text-3xl font-black leading-none tracking-normal text-white md:text-4xl">My Deliveries</h1>
            <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-white/65">Track pickups, handovers, earnings, and proof steps from one place.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-right [&>p:last-child]:!text-white">
              <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-white/45">Plate No.</p>
              <p className="text-xl font-sans text-[#1b1c1c] tracking-normal">{profile?.plateNumber || '—'}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-right">
              <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-white/45">Rating</p>
              <p className="text-xl font-sans tracking-normal text-[#ffedd5]">{stats.rating > 0 ? stats.rating.toFixed(1) : 'New'}</p>
            </div>
            <Link href="/rider/history" className="rounded-md bg-[#ffedd5] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[#e05300] transition hover:bg-white">
              Full history →
            </Link>
          </div>
        </div>

        {/* ── Stats Row ── */}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-lg bg-white border border-[#e0e0e0] border-l-4 border-l-[#ea580c] p-5 group hover:shadow-md transition-all">
            <p className="text-[9px] font-black text-[#414844] uppercase tracking-[0.14em] mb-4">Active Deliveries</p>
            <p className="text-3xl font-sans text-[#1b1c1c] tracking-normal">{stats.active}</p>
            <p className="text-[9px] text-[#ff6b00] font-black uppercase tracking-widest mt-2">In progress now</p>
          </div>
          
          <div className="rounded-lg bg-white border border-[#e0e0e0] border-l-4 border-l-[#1b1c1c] p-5 group hover:shadow-md transition-all">
            <p className="text-[9px] font-black text-[#414844] uppercase tracking-[0.14em] mb-4">Completed</p>
            <p className="text-3xl font-sans text-[#1b1c1c] tracking-normal">{stats.completed}</p>
            <p className="text-[9px] text-[#414844] font-black uppercase tracking-widest mt-2 opacity-50">Total deliveries</p>
          </div>
          
          <div className="rounded-lg bg-[#e05300] p-5 group shadow-sm">
            <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-[0.14em] mb-4">Total Earnings</p>
            <p className="text-3xl font-sans text-white tracking-normal">{stats.earnings.toLocaleString()}</p>
            <p className="text-[9px] text-white/40 font-black uppercase tracking-widest mt-2">RWF earned</p>
          </div>
        </div>

        {/* ── Filter & Search Bar ── */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 rounded-lg bg-white border border-[#e0e0e0] p-4 shadow-sm">
          <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={() => setFilter('active')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                filter === 'active' ? 'bg-[#e05300] text-white' : 'bg-[#fcf9f8] text-[#1b1c1c]/40 hover:text-[#1b1c1c] border border-[#e0e0e0]'
              }`}
            >
              Active
            </button>
            <button 
              onClick={() => setFilter('history')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                filter === 'history' ? 'bg-[#e05300] text-white' : 'bg-[#fcf9f8] text-[#1b1c1c]/40 hover:text-[#1b1c1c] border border-[#e0e0e0]'
              }`}
            >
              History
            </button>
          </div>

          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-5 flex items-center pointer-events-none opacity-40">
              <Search size={16} />
            </span>
            <input 
              type="text" 
              placeholder="Search deliveries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md pl-12 pr-5 py-3 bg-[#fcf9f8] border border-[#e0e0e0] text-[10px] font-black uppercase tracking-widest focus:border-[#ff6b00] outline-none transition-colors"
            />
          </div>
        </div>

        {/* ── Deliveries List ── */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-36 rounded-lg bg-white border border-[#e0e0e0] animate-pulse" />
            ))}
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="rounded-lg py-24 flex flex-col items-center justify-center text-center bg-white border-2 border-dashed border-[#e0e0e0]">
            <div className="mb-6 opacity-60 text-primary">
              <Bike size={56} strokeWidth={1.5} />
            </div>
             <h3 className="text-2xl font-sans text-[#1b1c1c] mb-2">No Deliveries Found</h3>
             <p className="text-[11px] font-black text-[#414844] uppercase tracking-[0.22em] opacity-40 mb-8">
               {searchQuery ? 'Try adjusting your search criteria' : 'You have no deliveries in this category'}
             </p>
             {filter === 'active' && !searchQuery && (
               <Link href="/rider/dashboard" className="bg-[#e05300] text-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] hover:bg-[#ff6b00] transition-all inline-block shadow-lg">
                  Go to Dashboard
               </Link>
             )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredDeliveries.map((delivery: any) => (
              <div key={delivery._id} className="overflow-hidden rounded-lg bg-white border border-[#e0e0e0] group hover:border-[#ff6b00] transition-all shadow-sm">
                <div className="flex flex-col md:flex-row">
                  
                  {/* Left: Meta Info */}
                  <div className="md:w-64 p-5 border-b md:border-b-0 md:border-r border-[#e0e0e0] bg-[#fcf9f8]/50 group-hover:bg-[#e05300]/5 transition-colors">
                    <div className="flex items-center gap-3 flex-wrap mb-4">
                       {getStatusBadge(delivery.status)}
                    </div>
                    <p className="text-[9px] font-black text-[#414844] uppercase tracking-[0.14em] mb-1">Delivery ID</p>
                    <h3 className="text-2xl font-sans text-[#1b1c1c] tracking-normal">
                      #{delivery.orderNumber?.split('-')[2] || delivery._id.substring(0, 6).toUpperCase()}
                    </h3>
                    <p className="text-[10px] text-[#414844] mt-3 font-bold uppercase tracking-widest opacity-60">
                       {new Date(delivery.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {new Date(delivery.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {/* Right: Route & Actions */}
                  <div className="flex-1 p-5 flex flex-col sm:flex-row gap-5 justify-between">
                    <div className="space-y-6 flex-1">
                       <div className="flex gap-5 items-start">
                          <div className="w-8 h-8 bg-white border border-[#e0e0e0] flex items-center justify-center flex-shrink-0 shadow-sm rounded-sm">
                            <Store size={15} className="text-[#ff6b00]" />
                          </div>
                          <div>
                             <p className="text-[8px] font-black text-[#ff6b00] uppercase tracking-widest mb-1">Pickup</p>
                             <p className="text-sm font-bold text-[#1b1c1c] leading-snug">{delivery.pickup?.address || 'Market Location'}</p>
                          </div>
                       </div>
                       <div className="w-px h-6 bg-[#e0e0e0] ml-4 -my-4" />
                       <div className="flex gap-5 items-start">
                          <div className="w-8 h-8 bg-[#e05300] text-white flex items-center justify-center flex-shrink-0 shadow-sm rounded-sm">
                            <MapPin size={15} className="text-white" />
                          </div>
                          <div>
                             <p className="text-[8px] font-black text-[#414844] uppercase tracking-widest mb-1">Drop-off</p>
                             <p className="text-sm font-bold text-[#1b1c1c] leading-snug">{delivery.dropoff?.address || 'Customer Location'}</p>
                          </div>
                       </div>
                    </div>

                    <div className="flex flex-col justify-between items-end sm:items-end items-start border-t sm:border-t-0 border-[#f0eded] pt-6 sm:pt-0">
                       <div className="text-left sm:text-right mb-6 sm:mb-0">
                          <p className="text-[8px] font-black text-[#414844] uppercase tracking-widest mb-1">Earnings</p>
                          <p className="text-3xl font-sans text-[#1b1c1c] tracking-normal">
                            {delivery.financials?.deliveryFee?.toLocaleString() || '500'} <span className="text-xs not-italic font-sans text-[#ff6b00] font-black uppercase">RWF</span>
                          </p>
                       </div>
                       <Link href={`/orders/${delivery.orderId}/tracking`} className="w-full sm:w-auto">
                         <button className="w-full sm:w-auto bg-[#ff6b00] hover:bg-[#e05300] text-white font-black uppercase tracking-[0.14em] text-[10px] transition-all py-3 px-8 shadow-md">
                            Track Delivery →
                         </button>
                       </Link>
                    </div>
                  </div>
                </div>

                {/* Proof-of-delivery steps for active deliveries */}
                {filter === 'active' && delivery.status !== 'delivered' && delivery.status !== 'failed' && (
                  <div className="border-t border-[#e0e0e0] p-5">
                    <ProofOfDelivery
                      deliveryId={delivery._id}
                      status={delivery.status}
                      onUpdated={fetchDeliveries}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
