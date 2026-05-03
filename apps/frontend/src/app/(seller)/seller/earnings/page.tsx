'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { walletApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SellerEarningsPage() {
  const { user } = useAuth();
  const { data: wallet, execute: fetchWallet } = useApi(walletApi, 'get', '/wallets/me');
  const { data: ledger } = useApi(walletApi, 'get', '/wallets/me/transactions');
  
  const [payoutForm, setPayoutForm] = useState({ amount: '', phone: '' });

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const requestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(payoutForm.amount) < 500) return toast.error('Minimum payout is 500 RWF');
    
    try {
      await walletApi.post('/payouts/request', { amount: Number(payoutForm.amount), phone: payoutForm.phone });
      toast.success('Payout requested successfully. It will be processed shortly.');
      setPayoutForm({ amount: '', phone: '' });
      fetchWallet();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to request payout');
    }
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row min-h-screen bg-background-main">
        <aside className="w-full md:w-64 bg-background-card border-r border-border p-6 hidden md:block">
          <nav className="space-y-2">
            <Link href="/seller/dashboard" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Dashboard</Link>
            <Link href="/seller/products" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Products</Link>
            <Link href="/seller/promotions" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Promotions</Link>
            <Link href="/seller/earnings" className="block px-4 py-2 bg-primary/10 text-primary font-bold rounded-lg">Earnings</Link>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          <h1 className="text-2xl font-heading font-bold text-text-primary mb-8">Earnings & Payouts</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <Card className="lg:col-span-2 bg-gradient-to-br from-primary to-primary/80 text-secondary border-none">
              <h2 className="text-secondary/80 font-medium mb-2">Available Balance</h2>
              <p className="text-5xl font-heading font-bold">{wallet?.balance?.toLocaleString() || 0} <span className="text-2xl">RWF</span></p>
              <p className="text-sm mt-4 text-secondary/70">Commission of 1.5% is automatically deducted on every order.</p>
            </Card>

            <Card>
              <h2 className="text-lg font-bold mb-4">Request Payout</h2>
              <form onSubmit={requestPayout} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount (RWF)</label>
                  <input type="number" required min="500" className="w-full p-2 border border-border rounded" value={payoutForm.amount} onChange={e => setPayoutForm({...payoutForm, amount: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">MTN MoMo Number</label>
                  <input type="tel" required className="w-full p-2 border border-border rounded" placeholder="078..." value={payoutForm.phone} onChange={e => setPayoutForm({...payoutForm, phone: e.target.value})} />
                </div>
                <Button type="submit" fullWidth disabled={!wallet || wallet.balance < 500}>Withdraw</Button>
              </form>
            </Card>
          </div>

          <Card noPadding>
            <div className="p-6 border-b border-border"><h2 className="text-lg font-bold">Transaction History</h2></div>
            <table className="w-full text-left">
              <thead className="bg-background-surface text-text-secondary text-sm">
                <tr>
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Description</th>
                  <th className="p-4 font-medium">Amount</th>
                  <th className="p-4 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!ledger || ledger.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-text-secondary">No transactions yet.</td></tr>
                ) : (
                  ledger.map((tx: any) => (
                    <tr key={tx._id} className="hover:bg-background-surface/50">
                      <td className="p-4 text-sm text-text-secondary">{new Date(tx.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 font-medium">{tx.description}</td>
                      <td className={`p-4 font-bold ${tx.type === 'CREDIT' ? 'text-status-success' : 'text-status-error'}`}>
                        {tx.type === 'CREDIT' ? '+' : '-'}{tx.amount.toLocaleString()} RWF
                      </td>
                      <td className="p-4 text-text-secondary">{tx.balanceAfter.toLocaleString()} RWF</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </main>
      </div>
    </Layout>
  );
}
