'use client';
import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { orderApi } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import { Gavel } from 'lucide-react';

const DISPUTE_LIST_REFRESH_MS = 15000;

const resolutionLabels: Record<string, string> = {
  refund_full: 'Full refund',
  refund_partial: 'Partial refund',
  partial_refund: 'Partial refund',
  replace: 'Replacement',
  release_to_seller: 'Released to seller',
  rejected: 'Dispute rejected',
};

export default function DisputesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  const { data: orders, loading } = useApi(
    orderApi,
    'get',
    user?.id ? `/orders?buyerId=${user.id}&isDisputed=true` : '',
    { refreshInterval: DISPUTE_LIST_REFRESH_MS },
  );

  const disputes = useMemo(
    () => (Array.isArray(orders) ? orders.filter((o: any) => o?.dispute?.isDisputed) : []),
    [orders],
  );

  if (isLoading || !user) {
    return (
      <Layout>
        <div className="flex min-h-[40vh] items-center justify-center text-on-surface-variant">Loading…</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full p-6 md:p-8 space-y-8">
        <div className="flex items-center gap-3 border-b border-outline-variant pb-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-error-container/20 text-error">
            <Gavel size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Disputes</h1>
            <p className="text-sm text-on-surface-variant">Orders where you raised a problem and their resolution status.</p>
          </div>
        </div>

        {loading && disputes.length === 0 && (
          <div className="py-16 text-center text-on-surface-variant">Loading your disputes…</div>
        )}

        {!loading && disputes.length === 0 && (
          <div className="rounded-xl border border-outline-variant bg-surface-container-low py-20 text-center">
            <Gavel size={40} className="mx-auto mb-4 text-on-surface-variant/50" />
            <p className="font-semibold text-on-surface">No disputes</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              You have not raised any disputes. If an order goes wrong, you can open one from the order detail.
            </p>
            <Link href="/orders" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
              View your orders
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {disputes.map((order: any) => {
            const resolved = Boolean(order.dispute?.resolvedAt);
            const resolutionKey = String(order.dispute?.resolution || '');
            const total = Number(order.financials?.totalAmount || 0);
            return (
              <Link
                key={order._id}
                href={`/orders?open=${order._id}`}
                className="block rounded-xl border border-outline-variant bg-surface-container-low p-5 transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-on-surface">Order #{order.orderNumber || String(order._id).slice(-6)}</p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {order.seller?.shopName || order.seller?.fullName || 'Seller'}
                    </p>
                    {order.dispute?.reason && (
                      <p className="mt-2 max-w-xl text-sm text-on-surface-variant">
                        <span className="font-medium text-on-surface">Reason: </span>
                        {order.dispute.reason}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${
                        resolved
                          ? 'border-[#bfe3cb] bg-[#e8f5ed] text-[#12805c]'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}
                    >
                      {resolved ? 'Resolved' : 'Open'}
                    </span>
                    <p className="mt-2 text-sm font-bold text-on-surface">{total.toLocaleString()} RWF</p>
                    {resolved && resolutionKey && (
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {resolutionLabels[resolutionKey] || resolutionKey}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
