'use client';
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { walletApi, sellerApi, orderApi } from '@/lib/api';
import { ReceiptView, type ReceiptOrder } from '@/components/ui/ReceiptView';
import { useLanguage } from '@/context/LanguageContext';
import toast from 'react-hot-toast';

export default function SellerEarningsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  
  const { data: wallet, loading: walletLoading, error: walletError, execute: fetchWallet } = useApi(walletApi, 'get', `/wallets/me?userId=${user?.id}`);
  const { data: ledger, execute: fetchLedger } = useApi(walletApi, 'get', `/wallets/me/transactions?userId=${user?.id}`);
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
      const res = await walletApi.post(`/wallets/user/${user?.id}/payout`, { 
        amount: Number(payoutForm.amount), 
        method: 'momo', 
        recipientPhone: payoutForm.phone 
      });
      if (res.data?.success) {
        toast.success('Payout requested successfully.');
        setPayoutForm({ amount: '', phone: '' });
        fetchWallet();
        fetchLedger();
      }
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
      <div className="max-w-7xl mx-auto space-y-16 animate-reveal">
        {selectedReceipt && (
          <ReceiptView order={selectedReceipt} role="seller" onClose={() => setSelectedReceipt(null)} />
        )}
        
        {/* Institutional Header */}
        <div className="border-b-2 border-[#121212] pb-10 flex justify-between items-end">
          <div>
            <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.5em] mb-4">Financial Core</p>
            <h1 className="text-5xl font-serif text-[#121212] italic tracking-tighter">Earnings & Payouts</h1>
          </div>
          <div className="text-right">
             <p className="text-[10px] font-black text-[#121212] uppercase tracking-widest">Stall ID: {profile?.stallId || '---'}</p>
             <p className="text-[8px] font-bold text-[#6B665E] uppercase tracking-widest opacity-40 mt-1">Ledger Sync Active</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Main Wallet Card */}
          <div className="lg:col-span-2 space-y-16">
            <div className="bg-[#121212] text-white p-16 relative overflow-hidden group shadow-2xl border-2 border-[#121212]">
               <div className="absolute top-0 right-0 w-64 h-64 bg-[#F59E0B]/5 rounded-full -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-1000"></div>
               <div className="relative z-10">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-[#F59E0B] mb-6">Available Liquidity</p>
                  <h2 className="text-8xl font-serif italic tracking-tighter mb-16 text-white drop-shadow-2xl">
                    {walletLoading ? '---' : (wallet?.balance?.toLocaleString() || 0)} <span className="text-3xl not-italic opacity-40 ml-4">RWF</span>
                  </h2>
                  <div className="flex gap-12 pt-12 border-t border-white/5">
                     <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-2">Total Settled</p>
                        <p className="text-2xl font-serif italic text-white/90">{(wallet?.totalEarnings || 0).toLocaleString()} <span className="text-[10px] not-italic opacity-40">RWF</span></p>
                     </div>
                     <div className="w-px h-12 bg-white/10 mt-2"></div>
                     <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-2">Pending Escrow</p>
                        <p className="text-2xl font-serif italic text-white/40">{(wallet?.pendingBalance || 0).toLocaleString()} <span className="text-[10px] not-italic opacity-40">RWF</span></p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Transaction Table */}
            <div className="space-y-8">
               <h3 className="text-[12px] font-black uppercase tracking-[0.4em] text-[#121212] border-b border-[#E5E1D8] pb-6 italic">Synchronization Log</h3>
               <div className="bg-white border-2 border-[#121212] overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-[#F2F0EB]/50 border-b-2 border-[#121212]">
                        <th className="p-8 text-[9px] font-black uppercase tracking-widest text-[#6B665E]">{t('mandate_id')}</th>
                        <th className="p-8 text-[9px] font-black uppercase tracking-widest text-[#6B665E]">Description</th>
                        <th className="p-8 text-[9px] font-black uppercase tracking-widest text-[#6B665E]">Valuation</th>
                        <th className="p-8 text-[9px] font-black uppercase tracking-widest text-[#6B665E]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E1D8]">
                      {ledger && ledger.length > 0 ? ledger.map((tx: any) => (
                        <tr key={tx._id} className="hover:bg-[#F9F7F2] transition-colors group">
                          <td className="p-8">
                             <p className="text-[10px] font-black text-[#121212]">#{tx._id.substring(0,8).toUpperCase()}</p>
                             <p className="text-[8px] text-[#6B665E] font-bold uppercase mt-1 opacity-60">{new Date(tx.createdAt).toLocaleDateString()}</p>
                          </td>
                          <td className="p-8">
                             <p className="text-[11px] font-black text-[#121212] uppercase tracking-widest">{tx.description || 'System Entry'}</p>
                          </td>
                          <td className="p-8">
                             <p className={`text-sm font-black ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-[#121212]'}`}>
                                {tx.type === 'CREDIT' ? '+' : '-'}{tx.amount?.toLocaleString()} RWF
                             </p>
                          </td>
                          <td className="p-8">
                             {tx.transactionId && (
                               <button 
                                 onClick={() => fetchAndOpenReceipt(tx.transactionId)}
                                 className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest border-b border-[#F59E0B]/20 hover:border-[#F59E0B] pb-1 transition-all"
                               >
                                 View Artifact 
                               </button>
                             )}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={4} className="p-24 text-center text-[10px] font-black uppercase tracking-[0.4em] opacity-30 italic">
                            No Financial Movements Recorded
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
               </div>
            </div>
          </div>

          {/* Payout Action Sidebar */}
          <div className="space-y-12">
            <div className="bg-white border-2 border-[#121212] p-10 shadow-2xl">
              <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#121212] mb-12 italic">Tactical Liquidation</h3>
              <form onSubmit={requestPayout} className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[9px] font-black text-[#6B665E] uppercase tracking-widest opacity-60">Liquidation Amount (RWF)</label>
                  <input 
                    type="number" 
                    required 
                    min="500" 
                    value={payoutForm.amount}
                    onChange={e => setPayoutForm({...payoutForm, amount: e.target.value})}
                    placeholder="Min 500 RWF"
                    className="rmf-input w-full px-6 py-5" 
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[9px] font-black text-[#6B665E] uppercase tracking-widest opacity-60">MTN MoMo Gateway</label>
                  <input 
                    type="tel" 
                    required 
                    value={payoutForm.phone}
                    onChange={e => setPayoutForm({...payoutForm, phone: e.target.value})}
                    placeholder="078..." 
                    className="rmf-input w-full px-6 py-5" 
                  />
                </div>
                <div className="p-8 bg-[#F2F0EB] space-y-6">
                   <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                      <span className="opacity-60">Network Protocol</span>
                      <span className="text-[#F59E0B]">SECURE-MOMO</span>
                   </div>
                   <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                      <span className="opacity-60">Fee Analysis</span>
                      <span>1.5% Applied</span>
                   </div>
                </div>
                <button 
                  type="submit" 
                  disabled={!wallet || wallet.balance < 500}
                  className="w-full rmf-btn-primary py-5 bg-[#121212] hover:bg-[#F59E0B]"
                >
                  Initiate Payout →
                </button>
              </form>
            </div>

            <div className="p-10 border border-[#E5E1D8] space-y-8 bg-[#F2F0EB]/30 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-2 h-full bg-[#F59E0B] opacity-20 group-hover:opacity-100 transition-opacity"></div>
               <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#121212]">Ledger Integrity</p>
               <p className="text-[10px] leading-relaxed italic text-[#6B665E]">
                 "All settled earnings are audited by the RMF Financial Gateway. Commission is automatically processed during the acquisition lifecycle."
               </p>
               <div className="pt-8 border-t border-[#E5E1D8]">
                  <Link href="/support" className="text-[9px] font-black uppercase tracking-widest text-[#F59E0B] hover:text-[#121212] transition-colors">Request Support Handshake →</Link>
               </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
