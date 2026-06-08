'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Filter, MapPin, PackageCheck, Store } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { deliveryApi } from '@/lib/api';

interface Delivery {
  _id: string;
  orderId?: string;
  orderNumber?: string;
  status?: string;
  pickup?: { address?: string };
  dropoff?: { address?: string };
  financials?: { deliveryFee?: number };
  createdAt?: string;
}

export default function RiderHistoryPage() {
  const { user } = useAuth();
  const { data: deliveries, loading } = useApi<Delivery[]>(deliveryApi, 'get', user?.id ? '/deliveries/history' : '');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const list = useMemo(() => (Array.isArray(deliveries) ? deliveries : []), [deliveries]);

  const filtered = useMemo(() => {
    return list.filter(d => {
      const created = d.createdAt ? new Date(d.createdAt).getTime() : 0;
      if (fromDate && created < new Date(fromDate).setHours(0, 0, 0, 0)) return false;
      if (toDate && created > new Date(toDate).setHours(23, 59, 59, 999)) return false;
      return true;
    });
  }, [list, fromDate, toDate]);

  const totalEarnings = useMemo(
    () => filtered.reduce((acc, d) => acc + Number(d.financials?.deliveryFee || 0), 0),
    [filtered],
  );

  const hasFilters = fromDate !== '' || toDate !== '';

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-6 animate-reveal pb-20">
        <div>
          <Link href="/rider/deliveries" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#ff6b00] hover:text-[#e05300]">
            <ArrowLeft size={14} />
            Back to deliveries
          </Link>
          <div className="mt-4 border-b-2 border-[#e0e0e0] pb-6">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.4em] text-[#ff6b00]">Rider · History</p>
            <h1 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">Delivery History</h1>
            <p className="mt-2 text-sm font-semibold text-[#414844]">Your completed deliveries and the fees you earned.</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-[#e0e0e0] bg-white p-5 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#414844]/60">Completed deliveries</p>
            <p className="mt-2 text-3xl font-sans text-[#1b1c1c]">{filtered.length}</p>
          </div>
          <div className="rounded-lg border border-[#e0e0e0] bg-[#e05300] p-5 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#ffedd5]">Total earnings (shown)</p>
            <p className="mt-2 text-3xl font-sans text-white">{totalEarnings.toLocaleString()} <span className="text-sm text-white/50">RWF</span></p>
          </div>
        </div>

        {/* Date filter */}
        <div className="rounded-lg border border-[#e0e0e0] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Filter size={16} className="text-[#ff6b00]" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1b1c1c]">Filter by date</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-2 block text-xs font-black text-[#405046]">From</span>
              <input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} className="h-11 w-full rounded-md border border-[#d9e0db] bg-white px-3 text-sm font-bold outline-none focus:border-[#ff6b00]" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black text-[#405046]">To</span>
              <input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} className="h-11 w-full rounded-md border border-[#d9e0db] bg-white px-3 text-sm font-bold outline-none focus:border-[#ff6b00]" />
            </label>
            {hasFilters && (
              <button type="button" onClick={() => { setFromDate(''); setToDate(''); }} className="h-11 rounded-md border border-[#d9e0db] px-4 text-[10px] font-black uppercase tracking-widest text-[#405046] transition hover:border-[#ff6b00]">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-28 animate-pulse rounded-lg border border-[#e0e0e0] bg-white" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#e0e0e0] bg-white px-4 py-20 text-center">
            <PackageCheck className="mb-4 text-[#ff6b00]/50" size={44} />
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#5f7569]">
              {list.length === 0 ? 'No completed deliveries yet' : 'No deliveries in this date range'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(d => (
              <div key={d._id} className="overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-sm transition hover:border-[#ff6b00]">
                <div className="flex flex-col md:flex-row">
                  <div className="border-b border-[#e0e0e0] bg-[#fcf9f8]/60 p-5 md:w-56 md:border-b-0 md:border-r">
                    <span className="inline-block rounded-sm border border-green-300 bg-green-100 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-green-800">Delivered</span>
                    <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-[#414844]/60">Delivery ID</p>
                    <h3 className="text-xl font-sans text-[#1b1c1c]">
                      #{d.orderNumber?.split('-')[2] || d._id.substring(0, 6).toUpperCase()}
                    </h3>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#414844]/60">
                      {d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    </p>
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-5 p-5 sm:flex-row">
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-sm border border-[#e0e0e0] bg-white">
                          <Store size={14} className="text-[#ff6b00]" />
                        </div>
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-widest text-[#ff6b00]">Pickup</p>
                          <p className="text-sm font-bold leading-snug text-[#1b1c1c]">{d.pickup?.address || 'Market location'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-sm bg-[#e05300]">
                          <MapPin size={14} className="text-white" />
                        </div>
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-widest text-[#414844]">Drop-off</p>
                          <p className="text-sm font-bold leading-snug text-[#1b1c1c]">{d.dropoff?.address || 'Customer location'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between gap-4 border-t border-[#f0eded] pt-4 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                      <div className="text-right">
                        <p className="text-[8px] font-black uppercase tracking-widest text-[#414844]">Earnings</p>
                        <p className="text-2xl font-sans text-[#1b1c1c]">
                          {Number(d.financials?.deliveryFee || 0).toLocaleString()} <span className="text-xs font-black uppercase text-[#ff6b00]">RWF</span>
                        </p>
                      </div>
                      {d.orderId && (
                        <Link href={`/orders/${d.orderId}/tracking`} className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00] hover:underline">
                          View order →
                        </Link>
                      )}
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
