'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { walletApi, riderApi, orderApi } from '@/lib/api';
import { ReceiptView, type ReceiptOrder } from '@/components/ui/ReceiptView';
import { useLanguage } from '@/context/LanguageContext';
import toast from 'react-hot-toast';
import { Wallet, FileText, Bike } from 'lucide-react';

export default function RiderEarningsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data: wallet, execute: fetchWallet } = useApi(walletApi, 'get', `/wallets/me?userId=${user?.id}`);
  const { data: ledger, execute: fetchLedger } = useApi(walletApi, 'get', `/wallets/me/transactions?userId=${user?.id}`);
  const { data: profile, execute: fetchProfile } = useApi(riderApi, 'get', `/riders/me?userId=${user?.id}`);

  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptOrder | null>(null);
  const [isFetchingReceipt, setIsFetchingReceipt] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutPhone, setPayoutPhone] = useState('');
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);

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
      if (res.data?.data) setSelectedReceipt(res.data.data);
      else toast.error('Receipt data not found');
    } catch {
      toast.error('Failed to fetch receipt');
    } finally {
      setIsFetchingReceipt(false);
    }
  };

  const handleViewReceipt = async (tx: any) => {
    if (tx.account === 'rider_wallet_credit' || tx.account === 'rider_wallet_credit_failed') {
      const mockReceipt: ReceiptOrder = {
        _id: tx.transactionId,
        orderNumber: `PAY-${tx.transactionId.substring(0,8).toUpperCase()}`,
        status: tx.status === 'posted' ? 'delivered' : tx.status === 'failed' ? 'cancelled' : 'placed',
        createdAt: tx.createdAt,
        buyer: {
          fullName: 'Mobile Money Gateway',
          phone: tx.description.match(/07\d{8}/)?.[0] || 'MTN MoMo'
        },
        seller: {
          fullName: profile?.fullName || 'Verified Rider',
          stallId: 'Rider Portal'
        },
        products: [
          {
            productId: 'withdrawal',
            name: 'MTN MoMo Rider Settlement',
            unitPrice: tx.amount,
            quantity: 1
          }
        ],
        financials: {
          subtotal: tx.amount,
          deliveryFee: 0,
          platformCommission: 0,
          gatewayFee: 0,
          totalAmount: tx.amount,
          sellerPayout: 0,
          riderPayout: tx.amount
        },
        payment: {
          method: 'MTN Mobile Money',
          status: tx.status === 'posted' ? 'paid' : 'pending',
          transactionRef: tx.transactionId
        },
        notes: tx.description
      };
      setSelectedReceipt(mockReceipt);
    } else {
      await fetchAndOpenReceipt(tx.transactionId);
    }
  };

  const handlePayoutRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    toast('Manual wallet payouts are disabled. Rider payouts are sent automatically via MTN MoMo when deliveries settle.');
  };

  // Stats derived from ledger
  const ledgerTransactions = (Array.isArray(ledger) ? ledger : ledger?.transactions) || [];
  const completedDeliveries = ledgerTransactions.filter((tx: any) => tx.type === 'credit').length || 0;
  const thisMonthEarnings = ledgerTransactions.filter((tx: any) => {
    const txDate = new Date(tx.createdAt);
    const now = new Date();
    return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear() && tx.type === 'credit';
  }).reduce((sum: number, tx: any) => sum + tx.amount, 0) || 0;
  const settledTotal = ledgerTransactions.filter((tx: any) => (
    tx.account === 'rider_wallet_credit' && tx.status === 'posted'
  )).reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0) || 0;
  const availableBalance = Number(wallet?.availableBalance ?? wallet?.balance ?? settledTotal ?? 0);
  const pendingBalance = Number(wallet?.pendingBalance ?? 0);
  const totalEarned = Number(wallet?.totalEarned ?? settledTotal ?? availableBalance);

  return (
    <Layout>
      {/* Receipt Modal */}
      {selectedReceipt && <ReceiptView order={selectedReceipt} role="rider" onClose={() => setSelectedReceipt(null)} />}
      {isFetchingReceipt && (
        <div className="rmf-modal-overlay">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      )}

      {/* Payout Request Modal */}
      {isPayoutModalOpen && (
        <div className="rmf-modal-overlay animate-reveal">
          <div className="rmf-modal-panel max-w-4xl">
            <div className="rmf-modal-header">
              <div>
                <p className="rmf-kicker">Wallet payout</p>
                <h2 className="mt-2 flex items-center gap-2 text-2xl font-bold text-text-primary">
                  <Wallet size={24} className="text-primary" />
                  {t('rider_request_payout')}
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold text-text-secondary">
                  Funds will be sent to your MTN MoMo account within 24 hours.
                </p>
              </div>
              <button onClick={() => setIsPayoutModalOpen(false)} className="rmf-modal-close" aria-label="Close payout request">&times;</button>
            </div>

            <form onSubmit={handlePayoutRequest} className="flex min-h-0 flex-1 flex-col">
              <div className="rmf-modal-body grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
                  <p className="text-xs font-black uppercase tracking-wider text-text-secondary">Available to withdraw</p>
                  <p className="mt-3 text-4xl font-bold text-primary">{availableBalance.toLocaleString()} RWF</p>
                  <p className="mt-4 text-sm font-semibold leading-6 text-text-secondary">
                    Minimum payout is 1,000 RWF. Confirm the phone number carefully before sending the request.
                  </p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-text-primary mb-1">Amount (RWF)</label>
                    <input
                      type="number"
                      required
                      min="1000"
                      max={availableBalance}
                      className="rmf-input w-full text-lg font-bold"
                      placeholder="e.g. 5000"
                      value={payoutAmount}
                      onChange={e => setPayoutAmount(e.target.value)}
                    />
                    <p className="text-xs text-text-muted mt-1">Minimum: 1,000 RWF</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-text-primary mb-1">MoMo Phone Number</label>
                    <input
                      type="tel"
                      required
                      className="rmf-input w-full"
                      placeholder="e.g. 0788000000"
                      value={payoutPhone}
                      onChange={e => setPayoutPhone(e.target.value)}
                    />
                    <p className="text-xs text-text-muted mt-1">Accepts MTN Rwanda numbers</p>
                  </div>
                </div>
              </div>
              <div className="rmf-modal-footer">
                <Button type="button" variant="outline" onClick={() => setIsPayoutModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isRequestingPayout}>
                  {isRequestingPayout ? 'Submitting...' : 'Request Payout'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="min-h-screen bg-background-main p-4 md:p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-heading font-bold text-text-primary">{t('rider_earnings')}</h1>
            <Button
              onClick={() => setIsPayoutModalOpen(true)}
              disabled
              className="flex items-center gap-2"
            >
              <Wallet size={16} /> {t('rider_request_payout')}
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-primary to-primary/80 text-white">
              <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Paid via MTN MoMo</p>
              <h2 className="text-3xl font-bold">{availableBalance.toLocaleString()}</h2>
              <p className="text-white/70 text-sm mt-1">RWF settled</p>
            </Card>
            <Card>
              <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Total Career</p>
              <h2 className="text-3xl font-bold text-text-primary">{totalEarned.toLocaleString()}</h2>
              <p className="text-text-muted text-sm mt-1">{pendingBalance.toLocaleString()} RWF pending</p>
            </Card>
            <Card>
              <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">This Month</p>
              <h2 className="text-3xl font-bold text-status-success">{thisMonthEarnings.toLocaleString()}</h2>
              <p className="text-text-muted text-sm mt-1">RWF</p>
            </Card>
            <Card>
              <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">{t('rider_completed')}</p>
              <h2 className="text-3xl font-bold text-text-primary">{completedDeliveries}</h2>
              <p className="text-text-muted text-sm mt-1">deliveries</p>
            </Card>
          </div>

          {/* Payout prompt if balance is sufficient */}
          {availableBalance >= 1000 && (
            <div className="mb-6 p-4 bg-status-success/5 border border-status-success/20 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet size={24} className="text-status-success shrink-0" />
                <div>
                  <p className="font-bold text-status-success">You have funds ready to withdraw!</p>
                  <p className="text-sm text-text-secondary">Request a payout to your MoMo account anytime.</p>
                </div>
              </div>
              <button
                onClick={() => setIsPayoutModalOpen(true)}
                className="text-sm font-bold text-status-success hover:underline whitespace-nowrap ml-4"
              >
                Withdraw →
              </button>
            </div>
          )}

          {/* Transaction History */}
          <Card noPadding>
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-text-primary">Transaction History</h3>
              <span className="text-xs text-text-muted">{ledgerTransactions.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-background-surface text-text-secondary text-xs uppercase">
                  <tr>
                    <th className="p-4 font-medium">Date</th>
                    <th className="p-4 font-medium">Description</th>
                    <th className="p-4 font-medium">Amount</th>
                    <th className="p-4 font-medium">Balance After</th>
                    <th className="p-4 font-medium text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ledgerTransactions.length === 0 ? (
                    <tr><td colSpan={5} className="p-12 text-center text-text-secondary">
                      <div className="flex flex-col items-center gap-2">
                        <Bike size={48} className="text-primary animate-pulse" />
                        <p className="font-medium">Complete your first delivery to see earnings here!</p>
                      </div>
                    </td></tr>
                  ) : (
                    ledgerTransactions.map((tx: any) => (
                      <tr key={tx._id} className="hover:bg-background-surface/50">
                        <td className="p-4 text-sm text-text-secondary">{new Date(tx.createdAt).toLocaleDateString('en-RW', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="p-4 text-sm font-medium">{tx.description}</td>
                        <td className={`p-4 text-sm font-bold ${tx.type === 'credit' ? 'text-status-success' : 'text-status-error'}`}>
                          {tx.type === 'credit' ? '+' : '-'}{tx.amount.toLocaleString()} RWF
                        </td>
                        <td className="p-4 text-sm text-text-secondary">{tx.balanceAfter.toLocaleString()} RWF</td>
                        <td className="p-4 text-center">
                          {tx.transactionId && (
                            <button onClick={() => handleViewReceipt(tx)} className="text-primary hover:text-primary-hover font-bold text-sm inline-flex items-center gap-1 justify-center">
                              <FileText size={14} /> View
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
    </Layout>
  );
}
