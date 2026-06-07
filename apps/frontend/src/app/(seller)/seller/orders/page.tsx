'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock3, PackageCheck, Search, ShieldCheck } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { orderApi } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

type SellerOrder = {
  _id: string;
  orderNumber?: string;
  status?: string;
  createdAt?: string;
  products?: Array<{ name?: string; quantity?: number; unitPrice?: number; images?: string[]; imageUrl?: string }>;
  buyer?: { fullName?: string };
  financials?: { totalAmount?: number; sellerPayout?: number };
  payment?: { status?: string };
};

const statusTone = (status?: string) => {
  const normalized = status || 'placed';
  if (['delivered', 'resolved', 'completed', 'closed', 'confirmed', 'picked_up'].includes(normalized)) return 'bg-[#e8f5ed] text-[#ff6b00] border-[#ffedd5]';
  if (['awaiting_quote', 'quote_sent', 'placed', 'preparing', 'ready_for_pickup'].includes(normalized)) return 'bg-[#f7faf8] text-[#405046] border-[#dfe7e2]';
  if (['cancelled', 'failed', 'disputed'].includes(normalized)) return 'bg-[#fff5f3] text-[#7b3f3f] border-[#f1cbc3]';
  return 'bg-[#eef3ee] text-[#405046] border-[#dfe7e2]';
};

const SELLER_ORDERS_REFRESH_MS = 10000;

export default function SellerOrdersPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const { data: ordersData, loading } = useApi<SellerOrder[]>(orderApi, 'get', user?.id ? `/orders?sellerId=${user.id}&limit=200` : '', { refreshInterval: SELLER_ORDERS_REFRESH_MS });

  const orders = useMemo(() => (Array.isArray(ordersData) ? ordersData : []), [ordersData]);
  const filtered = useMemo(() => {
    return orders.filter(order => {
      const matchesStatus = status === 'all' || order.status === status;
      const haystack = `${order.orderNumber || ''} ${order._id} ${order.buyer?.fullName || ''} ${order.products?.map(item => item.name).join(' ') || ''}`.toLowerCase();
      return matchesStatus && haystack.includes(query.toLowerCase());
    });
  }, [orders, query, status]);

  const stats = useMemo(() => ({
    total: orders.length,
    active: orders.filter(order => !['delivered', 'resolved', 'completed', 'closed', 'cancelled', 'failed'].includes(order.status || '')).length,
    paid: orders.filter(order => order.payment?.status === 'paid').length,
    payout: orders.reduce((sum, order) => sum + Number(order.financials?.sellerPayout || 0), 0),
  }), [orders]);

  return (
    <Layout>
      <div className="w-full p-6 md:p-8 space-y-6 pb-20">
        <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-primary p-6 text-white shadow-sm md:p-8">
          <div className="absolute inset-0 hero-glow opacity-30 pointer-events-none"></div>
          <div className="relative z-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/80 border border-white/10 backdrop-blur-md">
                <PackageCheck size={14} />
                Seller operations
              </div>
              <h1 className="text-3xl font-black tracking-normal md:text-4xl">Order History</h1>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-white/70">
                Search, review, and continue every seller order from quote to payout.
              </p>
            </div>
            <Link href="/seller/dashboard" className="inline-flex h-11 items-center justify-center rounded-full border border-white/20 px-6 text-sm font-black text-white transition hover:bg-white/10">
              Back to dashboard
            </Link>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-4">
          {[
            ['Total orders', stats.total, Clock3],
            ['Active orders', stats.active, PackageCheck],
            ['Paid orders', stats.paid, ShieldCheck],
            ['Expected payout', formatCurrency(stats.payout), ArrowRight],
          ].map(([label, value, Icon]) => {
            const StatIcon = Icon as typeof Clock3;
            return (
              <div key={label as string} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
                <StatIcon size={18} className="text-primary" />
                <p className="mt-3 text-2xl font-black text-on-surface">{value as React.ReactNode}</p>
                <p className="text-xs font-bold text-on-surface-variant">{label as string}</p>
              </div>
            );
          })}
        </div>

        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search by buyer, product, or order number..."
                className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-low text-on-surface pl-10 pr-3 text-sm font-semibold outline-none focus:border-primary transition-colors"
              />
            </div>
            <select
              value={status}
              onChange={event => setStatus(event.target.value)}
              className="h-11 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface px-3 text-sm font-black outline-none focus:border-primary transition-colors"
            >
              <option value="all" className="bg-surface-container-low text-on-surface">All statuses</option>
              <option value="awaiting_quote" className="bg-surface-container-low text-on-surface">Awaiting quote</option>
              <option value="quote_sent" className="bg-surface-container-low text-on-surface">Quote sent</option>
              <option value="placed" className="bg-surface-container-low text-on-surface">Placed</option>
              <option value="confirmed" className="bg-surface-container-low text-on-surface">Confirmed</option>
              <option value="preparing" className="bg-surface-container-low text-on-surface">Preparing</option>
              <option value="ready_for_pickup" className="bg-surface-container-low text-on-surface">Ready for pickup</option>
              <option value="picked_up" className="bg-surface-container-low text-on-surface">Picked up</option>
              <option value="delivered" className="bg-surface-container-low text-on-surface">Delivered</option>
              <option value="resolved" className="bg-surface-container-low text-on-surface">Resolved</option>
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
          {loading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4].map(item => <div key={item} className="h-24 animate-pulse rounded-lg bg-surface-container-low" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">No orders found</p>
              <p className="mt-2 text-sm font-semibold text-on-surface-variant">Try a different search or status filter.</p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/40">
              {filtered.map(order => {
                const firstProduct = order.products?.[0];
                return (
                  <Link key={order._id} href={`/seller/orders/${order._id}`} className="grid gap-4 p-4 transition hover:bg-surface-container-low md:grid-cols-[1fr_auto] md:items-center">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low">
                        {firstProduct?.imageUrl || firstProduct?.images?.[0] ? (
                          <img src={firstProduct.imageUrl || firstProduct.images?.[0]} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-on-surface">{order.orderNumber || `#${order._id.slice(0, 8).toUpperCase()}`}</span>
                          <span className={`rounded border px-2 py-0.5 text-[10px] font-black uppercase ${statusTone(order.status)}`}>
                            {(order.status || 'placed').replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="line-clamp-1 text-sm font-black text-on-surface">{firstProduct?.name || 'Order items'}</p>
                        <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                          {order.buyer?.fullName || 'Buyer'} · {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Date pending'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-5 md:justify-end">
                      <div className="text-right">
                        <p className="text-lg font-black text-on-surface">{formatCurrency(order.financials?.totalAmount || 0)}</p>
                        <p className="text-[10px] font-black uppercase text-primary">{order.payment?.status || 'payment pending'}</p>
                      </div>
                      <ArrowRight size={18} className="text-primary" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
