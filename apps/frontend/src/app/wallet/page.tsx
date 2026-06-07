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
  // GET /wallets/me/transactions returns { data: { transactions, total, page, limit } }.
  const { data: txData } = useApi<{ transactions?: any[] }>(walletApi, 'get', `/wallets/me/transactions?userId=${user?.id}`);
  const transactions = Array.isArray(txData?.transactions) ? txData!.transactions : [];

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-10 animate-reveal">
        <div className="border-b border-[#e0e0e0] pb-8">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.45em] text-[#ff6b00]">Payment compliance</p>
          <h1 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">Paypack Settlement Ledger</h1>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#414844]">
            RMF does not hold customer, seller, or rider funds. Payments, payouts, and refunds are processed through Paypack; this page only shows historical accounting records.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-lg border border-[#e0e0e0] bg-white p-8 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#414844]/60">Available wallet balance</p>
            <h2 className="mt-4 text-5xl font-sans text-[#1b1c1c]">
              {loading ? '---' : '0'} <span className="text-xl text-[#414844]/40">RWF</span>
            </h2>
            <div className="mt-8 rounded-lg border border-[#e9ded6] bg-[#fcf9f8] p-5 text-sm font-semibold leading-6 text-[#414844]">
              {wallet?.message || 'Wallet balances are disabled. Any legacy balance must be reconciled manually and future movement is Paypack-only.'}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/orders" className="rounded bg-[#1b1c1c] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white">
                View orders
              </Link>
              <Link href="/contact" className="rounded border border-[#e0e0e0] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[#1b1c1c]">
                Contact support
              </Link>
            </div>
          </section>

          <section className="rounded-lg border border-[#e0e0e0] bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-[#e0e0e0] p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#1b1c1c]">Accounting history</p>
              <Link href="/wallet/transactions" className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00] hover:text-[#e05300]">
                View all & filter -&gt;
              </Link>
            </div>
            <div className="divide-y divide-[#e0e0e0]">
              {transactions && transactions.length > 0 ? transactions.map((tx: any) => (
                <div key={tx._id} className="grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-[#1b1c1c]">{tx.description || tx.account}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#414844]/50">
                      {new Date(tx.createdAt).toLocaleDateString()} | {tx.provider || 'internal'} | {tx.status || 'recorded'}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className={`text-sm font-black ${tx.type === 'credit' ? 'text-green-700' : 'text-[#1b1c1c]'}`}>
                      {tx.type === 'credit' ? '+' : '-'}{Number(tx.amount || 0).toLocaleString()} RWF
                    </p>
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-[#414844]/40">{tx.account}</p>
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center text-[10px] font-black uppercase tracking-[0.35em] text-[#414844]/35">
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
