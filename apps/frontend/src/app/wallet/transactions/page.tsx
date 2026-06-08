'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Filter, ReceiptText } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { walletApi } from '@/lib/api';

interface Transaction {
  _id: string;
  type?: 'credit' | 'debit' | string;
  amount?: number;
  description?: string;
  account?: string;
  provider?: string;
  status?: string;
  createdAt?: string;
}

type TypeFilter = 'all' | 'credit' | 'debit';

export default function WalletTransactionsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login?redirect=/wallet/transactions');
    }
  }, [isLoading, user, router]);

  // GET /wallets/me/transactions returns { success, data: { transactions, total, page, limit } }.
  // userId is derived from the JWT, so no query param is needed.
  const { data: txData, loading } = useApi<{ transactions?: Transaction[] }>(
    walletApi,
    'get',
    user?.id ? '/wallets/me/transactions' : '',
  );

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const list = useMemo(() => (Array.isArray(txData?.transactions) ? txData!.transactions : []), [txData]);

  const filtered = useMemo(() => {
    return list.filter(tx => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      const created = tx.createdAt ? new Date(tx.createdAt).getTime() : 0;
      if (fromDate) {
        const from = new Date(fromDate).setHours(0, 0, 0, 0);
        if (created < from) return false;
      }
      if (toDate) {
        const to = new Date(toDate).setHours(23, 59, 59, 999);
        if (created > to) return false;
      }
      return true;
    });
  }, [list, typeFilter, fromDate, toDate]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, tx) => {
        const amt = Number(tx.amount || 0);
        if (tx.type === 'credit') acc.credit += amt;
        else acc.debit += amt;
        return acc;
      },
      { credit: 0, debit: 0 },
    );
  }, [filtered]);

  const clearFilters = () => {
    setTypeFilter('all');
    setFromDate('');
    setToDate('');
  };

  const hasFilters = typeFilter !== 'all' || fromDate !== '' || toDate !== '';

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-6 animate-reveal pb-20">
        {/* Header */}
        <div>
          <Link href="/wallet" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#ff6b00] hover:text-[#e05300]">
            <ArrowLeft size={14} />
            Back to wallet
          </Link>
          <div className="mt-4 border-b border-[#e0e0e0] pb-6">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-[#ff6b00]">Accounting</p>
            <h1 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">Transaction History</h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[#414844]">
              A historical record of payments, payouts, and refunds. Filter by date range or transaction direction.
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-[#e0e0e0] bg-white p-5 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#414844]/60">Records shown</p>
            <p className="mt-2 text-2xl font-sans text-[#1b1c1c]">{filtered.length}</p>
          </div>
          <div className="rounded-lg border border-[#e0e0e0] border-l-4 border-l-green-500 bg-white p-5 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#414844]/60">Total credit</p>
            <p className="mt-2 text-2xl font-sans text-green-700">+{totals.credit.toLocaleString()} <span className="text-xs text-[#414844]/40">RWF</span></p>
          </div>
          <div className="rounded-lg border border-[#e0e0e0] border-l-4 border-l-[#e05300] bg-white p-5 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#414844]/60">Total debit</p>
            <p className="mt-2 text-2xl font-sans text-[#1b1c1c]">-{totals.debit.toLocaleString()} <span className="text-xs text-[#414844]/40">RWF</span></p>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-lg border border-[#e0e0e0] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Filter size={16} className="text-[#ff6b00]" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1b1c1c]">Filters</p>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="block">
              <span className="mb-2 block text-xs font-black text-[#405046]">From date</span>
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={e => setFromDate(e.target.value)}
                className="h-11 w-full rounded-md border border-[#d9e0db] bg-white px-3 text-sm font-bold outline-none focus:border-[#ff6b00]"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black text-[#405046]">To date</span>
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={e => setToDate(e.target.value)}
                className="h-11 w-full rounded-md border border-[#d9e0db] bg-white px-3 text-sm font-bold outline-none focus:border-[#ff6b00]"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {(['all', 'credit', 'debit'] as TypeFilter[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`h-11 rounded-md border px-4 text-[10px] font-black uppercase tracking-widest transition ${
                    typeFilter === t
                      ? 'border-[#e05300] bg-[#e05300] text-white'
                      : 'border-[#d9e0db] bg-white text-[#414844] hover:border-[#ff6b00]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 text-[10px] font-black uppercase tracking-widest text-[#ff6b00] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* List */}
        <section className="overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-sm">
          <div className="border-b border-[#e0e0e0] bg-[#fcf9f8] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#1b1c1c]">Records</p>
          </div>
          {loading ? (
            <div className="divide-y divide-[#e0e0e0]">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="p-6">
                  <div className="h-10 animate-pulse rounded-md bg-[#f0eded]" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <ReceiptText className="mb-4 text-[#ff6b00]/50" size={40} />
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#414844]/50">
                {list.length === 0 ? 'No accounting records yet' : 'No records match these filters'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#e0e0e0]">
              {filtered.map(tx => (
                <div key={tx._id} className="grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-[#1b1c1c]">{tx.description || tx.account || 'Transaction'}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#414844]/50">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : '—'} | {tx.provider || 'internal'} | {tx.status || 'recorded'}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className={`text-sm font-black ${tx.type === 'credit' ? 'text-green-700' : 'text-[#1b1c1c]'}`}>
                      {tx.type === 'credit' ? '+' : '-'}{Number(tx.amount || 0).toLocaleString()} RWF
                    </p>
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-[#414844]/40">{tx.account || tx.type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
