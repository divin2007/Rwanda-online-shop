'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { walletApi, riderApi, orderApi } from '@/lib/api';
import { ReceiptView, type ReceiptOrder } from '@/components/ui/ReceiptView';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function RiderEarningsPage() {
  const { user } = useAuth();
  const { data: wallet, execute: fetchWallet } = useApi(walletApi, 'get', `/wallets/me?userId=${user?.id}`);
  const { data: ledger, execute: fetchLedger } = useApi(walletApi, 'get', `/wallets/me/transactions?userId=${user?.id}`);
  const { data: profile, execute: fetchProfile } = useApi(riderApi, 'get', `/riders/me?userId=${user?.id}`);
  
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
        <ReceiptView order={selectedReceipt} role="rider" onClose={() => setSelectedReceipt(null)} />
      )}
      {isFetchingReceipt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      )}
      <div className="flex flex-col md:flex-row min-h-screen bg-background-main">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-background-card border-r border-border p-6 hidden md:block">
          <div className="mb-8">
            <h2 className="font-heading font-bold text-xl">{profile?.fullName || 'Rider'}</h2>
            <p className="text-sm text-text-secondary">{profile?.plateNumber || 'No Vehicle'}</p>
          </div>
          <nav className="space-y-2">
            <Link href="/rider/dashboard" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Live Tasks</Link>
            <Link href="/rider/earnings" className="block px-4 py-2 bg-primary/10 text-primary font-bold rounded-lg">My Earnings</Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8">
          <h1 className="text-2xl font-heading font-bold text-text-primary mb-8">Financial Overview</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="bg-primary text-white">
              <p className="text-primary-foreground/80 text-sm mb-1">Available Balance</p>
              <h2 className="text-4xl font-bold">{wallet?.balance?.toLocaleString() || 0} RWF</h2>
            </Card>
            <Card>
              <p className="text-text-secondary text-sm mb-1">Total Career Earnings</p>
              <h2 className="text-4xl font-bold">{wallet?.totalEarnings?.toLocaleString() || 0} RWF</h2>
            </Card>
          </div>

          <Card noPadding>
            <div className="p-6 border-b border-border">
              <h3 className="font-bold">Transaction History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-background-surface text-text-secondary text-xs uppercase">
                  <tr>
                    <th className="p-4 font-medium">Date</th>
                    <th className="p-4 font-medium">Description</th>
                    <th className="p-4 font-medium">Amount</th>
                    <th className="p-4 font-medium">Balance</th>
                    <th className="p-4 font-medium text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {!ledger || ledger.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-text-secondary">No transactions recorded yet.</td></tr>
                  ) : (
                    ledger.map((tx: any) => (
                      <tr key={tx._id} className="hover:bg-background-surface/50">
                        <td className="p-4 text-sm">{new Date(tx.createdAt).toLocaleDateString()}</td>
                        <td className="p-4 text-sm font-medium">{tx.description}</td>
                        <td className="p-4 text-sm font-bold text-status-success">+{tx.amount.toLocaleString()} RWF</td>
                        <td className="p-4 text-sm text-text-secondary">{tx.balanceAfter.toLocaleString()} RWF</td>
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
            </div>
          </Card>
        </main>
      </div>
    </Layout>
  );
}
