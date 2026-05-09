'use client';
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { walletApi, sellerApi, orderApi } from '@/lib/api';
import { ReceiptView, type ReceiptOrder } from '@/components/ui/ReceiptView';
import toast from 'react-hot-toast';

export default function SellerEarningsPage() {
  const { user } = useAuth();
  const { data: wallet, execute: fetchWallet } = useApi(walletApi, 'get', '/wallets/me');
  const { data: ledger, execute: fetchLedger } = useApi(walletApi, 'get', '/wallets/me/transactions');
  const { data: profile, execute: fetchProfile } = useApi(sellerApi, 'get', `/sellers/me?userId=${user?.id}`);
  
  const [payoutForm, setPayoutForm] = useState({ amount: '', phone: '' });
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptOrder | null>(null);
  const [isFetchingReceipt, setIsFetchingReceipt] = useState(false);

  const hasFetched = useRef(false);
  useEffect(() => {
    if (user?.id && !hasFetched.current) {
      fetchWallet();
      fetchLedger();
      fetchProfile();
      hasFetched.current = true;
    }
  }, [user?.id, fetchWallet, fetchLedger, fetchProfile]);

  const requestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(payoutForm.amount) < 500) return toast.error('Minimum payout is 500 RWF');
    
    try {
      await walletApi.post(`/wallets/user/${user?.id}/payout`, { amount: Number(payoutForm.amount), method: 'momo', recipientPhone: payoutForm.phone });
      toast.success('Payout requested successfully. It will be processed shortly.');
      setPayoutForm({ amount: '', phone: '' });
      fetchWallet();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to request payout');
    }
  };
  const fetchAndOpenReceipt = async (transactionId: string) => {
    setIsFetchingReceipt(true);
    try {
      const res = await orderApi.get(`/orders/${transactionId}`);
      if (res.data?.data) {
        setSelectedReceipt(res.data.data);
      } else {
        toast.error('Receipt data not found');
      }
    } catch (err) {
      toast.error('Failed to fetch receipt');
    } finally {
      setIsFetchingReceipt(false);
    }
  };

  return (
    <Layout>
      {selectedReceipt && (
        <ReceiptView order={selectedReceipt} role="seller" onClose={() => setSelectedReceipt(null)} />
      )}
      {isFetchingReceipt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      )}
      <div className="flex flex-col md:flex-row min-h-screen bg-background-main">
        <aside className="w-full md:w-64 bg-background-card border-r border-border p-6 hidden md:block">
          <nav className="space-y-2">
            <Link href="/seller/dashboard" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Dashboard</Link>
            <Link href="/seller/products" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Products</Link>
            <Link href="/seller/promotions" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Promotions</Link>
            <Link href="/seller/earnings" className="block px-4 py-2 bg-primary/10 text-primary font-bold rounded-lg">Earnings</Link>
            <a href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=marketrwanda:stall:${profile?.stallId}`} target="_blank" rel="noreferrer" className="block w-full text-left px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Print QR Code</a>
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
                  <th className="p-4 font-medium text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!ledger || !Array.isArray(ledger) || ledger.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-text-secondary">No transactions yet.</td></tr>
                ) : (
                  ledger.map((tx: any) => (
                    <tr key={tx._id} className="hover:bg-background-surface/50">
                      <td className="p-4 text-sm text-text-secondary">{new Date(tx.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 font-medium">{tx.description}</td>
                      <td className={`p-4 font-bold ${tx.type === 'CREDIT' ? 'text-status-success' : 'text-status-error'}`}>
                        {tx.type === 'CREDIT' ? '+' : '-'}{tx.amount?.toLocaleString() || 0} RWF
                      </td>
                      <td className="p-4 text-text-secondary">{tx.balanceAfter?.toLocaleString() || 0} RWF</td>
                      <td className="p-4 text-center">
                        {tx.transactionId && (
                          <button 
                            onClick={() => fetchAndOpenReceipt(tx.transactionId)}
                            className="text-primary hover:text-primary-hover font-bold text-sm"
                          >
                            🧾 View
                          </button>
                        )}
                      </td>
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
