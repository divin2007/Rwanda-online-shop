'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { walletApi } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import Link from 'next/link';

export default function WalletPage() {
  const { user } = useAuth();
  const { data: wallet, loading } = useApi(walletApi, 'get', `/wallets/me?userId=${user?.id}`);
  const { data: transactionsData } = useApi(walletApi, 'get', `/wallets/me/transactions?userId=${user?.id}`);
  const transactions = (Array.isArray(transactionsData) ? transactionsData : transactionsData?.transactions) || [];

  // The wallet endpoint may return the wallet directly or wrapped in { data }.
  const w = (wallet?.availableBalance !== undefined ? wallet : wallet?.data) || {};
  const availableBalance = Number(w?.availableBalance ?? 0);
  const pendingBalance = Number(w?.pendingBalance ?? 0);
  const totalWithdrawn = Number(w?.totalWithdrawn ?? 0);

  return (
    <Layout>
      <div className="w-full p-6 md:p-8 space-y-lg animate-reveal">
        {/* Header telemetry area */}
        <div className="border-b border-outline-variant pb-md">
          <div className="flex items-center gap-xs mb-xs">
            <span className="w-1.5 h-4 bg-primary-container rounded-full" />
            <p className="font-label-caps text-label-caps text-primary">Payment & Escrow Compliance</p>
          </div>
          <h1 className="font-display-lg text-headline-lg text-on-surface">Wallet & Earnings</h1>
          <p className="mt-sm max-w-3xl text-xs font-semibold leading-relaxed text-on-surface-variant font-sans">
            Your RMF wallet holds your settled earnings. Payouts, payments, and refunds are processed over MTN MoMo; this page shows your balance and accounting history.
          </p>
        </div>

        <div className="grid gap-md lg:grid-cols-[0.9fr_1.1fr]">
          {/* Left panel: Balance view */}
          <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow flex flex-col justify-between">
            <div className="space-y-sm">
              <span className="font-label-caps text-[10px] text-on-surface-variant tracking-wider block">Available Wallet Balance</span>
              <div className="flex items-baseline gap-xs">
                <span className="font-data-mono text-4xl font-bold text-on-surface">
                  {loading ? '---' : availableBalance.toLocaleString()}
                </span>
                <span className="font-label-caps text-sm text-on-surface-variant font-bold">RWF</span>
              </div>
              <div className="grid grid-cols-2 gap-xs">
                <div className="rounded border border-outline-variant bg-surface-container-low p-sm">
                  <span className="font-label-caps text-[9px] text-on-surface-variant tracking-wider block">Pending (in transfer)</span>
                  <span className="font-data-mono text-sm font-bold text-on-surface">
                    {loading ? '---' : pendingBalance.toLocaleString()} <span className="text-[9px] font-normal text-on-surface-variant">RWF</span>
                  </span>
                </div>
                <div className="rounded border border-outline-variant bg-surface-container-low p-sm">
                  <span className="font-label-caps text-[9px] text-on-surface-variant tracking-wider block">Total Withdrawn</span>
                  <span className="font-data-mono text-sm font-bold text-on-surface">
                    {loading ? '---' : totalWithdrawn.toLocaleString()} <span className="text-[9px] font-normal text-on-surface-variant">RWF</span>
                  </span>
                </div>
              </div>
              {w?.message && (
                <div className="rounded border border-outline-variant bg-surface-container-low p-md text-xs font-semibold leading-relaxed text-on-surface-variant font-sans">
                  {w.message}
                </div>
              )}
            </div>
            
            <div className="mt-md flex flex-wrap gap-xs pt-md border-t border-outline-variant/40">
              <Link href="/orders" className="rounded-md bg-primary-container text-white px-4 py-2.5 text-xs font-black uppercase tracking-wider hover:bg-primary transition-all duration-300 shadow-sm active:scale-[0.99]">
                View Orders
              </Link>
              <Link href="/contact" className="rounded-md border border-outline-variant bg-surface-container-lowest text-on-surface px-4 py-2.5 text-xs font-black uppercase tracking-wider hover:border-primary hover:text-primary transition-all duration-300">
                Contact Support
              </Link>
            </div>
          </section>

          {/* Right panel: Accounting history table */}
          <section className="rounded-lg border border-outline-variant bg-surface-container-lowest custom-shadow overflow-hidden">
            <div className="border-b border-outline-variant bg-surface-container-low/50 px-md py-sm flex justify-between items-center">
              <span className="font-label-caps text-[10px] text-on-surface font-black">Accounting History</span>
              <span className="font-data-mono text-[9px] text-on-surface-variant bg-surface-container-high/60 px-2 py-0.5 rounded border border-outline-variant/50">
                {transactions.length} Records
              </span>
            </div>
            
            <div className="divide-y divide-outline-variant/50 custom-scrollbar max-h-[380px] overflow-y-auto">
              {transactions && transactions.length > 0 ? transactions.map((tx: any) => (
                <div key={tx._id} className="grid gap-sm p-md md:grid-cols-[1fr_auto] md:items-center table-row-hover transition-colors">
                  <div className="space-y-xs">
                    <p className="text-xs font-black uppercase tracking-wide text-on-surface">{tx.description || tx.account}</p>
                    <p className="font-data-mono-sm text-[9px] text-on-surface-variant flex items-center gap-xs flex-wrap">
                      <span>{new Date(tx.createdAt).toLocaleDateString()}</span>
                      <span className="w-1 h-1 bg-outline-variant rounded-full" />
                      <span className="uppercase">{tx.provider || 'internal'}</span>
                      <span className="w-1 h-1 bg-outline-variant rounded-full" />
                      <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary-container text-[8px] font-bold uppercase">{tx.status || 'recorded'}</span>
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className={`font-data-mono text-sm font-bold ${tx.type === 'credit' ? 'text-emerald-700' : 'text-on-surface'}`}>
                      {tx.type === 'credit' ? '+' : '-'}{Number(tx.amount || 0).toLocaleString()} RWF
                    </p>
                    <p className="font-data-mono-sm text-[9px] text-on-surface-variant uppercase">{tx.account}</p>
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center font-label-caps text-[10px] tracking-wider text-on-surface-variant opacity-60">
                  No accounting records yet
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
