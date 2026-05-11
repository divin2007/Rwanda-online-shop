'use client';
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { walletApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function WalletPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [topUpAmount, setTopUpAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: wallet, loading, execute: fetchWallet } = useApi(walletApi, 'get', `/wallets/me?userId=${user?.id}`);
  const { data: transactions } = useApi(walletApi, 'get', `/wallets/me/transactions?userId=${user?.id}`);

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topUpAmount || isNaN(Number(topUpAmount))) return toast.error('Enter a valid amount');
    
    setIsProcessing(true);
    try {
      const res = await walletApi.post(`/wallets/${user?.id}/deposit`, {
        amount: Number(topUpAmount),
        method: 'momo',
        phone: user?.phone || '07XXXXXXXX'
      });
      
      if (res.data?.success) {
        toast.success('MoMo Deposit Initiated. Check your phone for prompt.');
        setTopUpAmount('');
        fetchWallet();
      }
    } catch (error) {
      toast.error('Deposit failed. System handshake error.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-12 animate-reveal">
        <div className="border-b border-[#E5E1D8] pb-10">
          <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.5em] mb-4">Financial Core</p>
          <h1 className="text-5xl font-serif text-[#121212] italic tracking-tighter">Heritage Wallet</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Wallet Card */}
          <div className="lg:col-span-2 space-y-12">
            <div className="bg-[#121212] text-white p-12 relative overflow-hidden group shadow-2xl">
               <div className="absolute top-0 right-0 w-64 h-64 bg-[#F59E0B]/10 rounded-full -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-1000"></div>
               <div className="relative z-10">
                  <div className="flex justify-between items-start mb-20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#F59E0B] flex items-center justify-center font-black">RMF</div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Official Vault</span>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-40 italic">System Verified</span>
                  </div>
                  
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-[#F59E0B] mb-4">Available Liquidity</p>
                  <h2 className="text-7xl font-serif italic tracking-tighter mb-12">
                    {loading ? '---' : (wallet?.balance?.toLocaleString() || 0)} <span className="text-3xl not-italic opacity-40 ml-4">RWF</span>
                  </h2>
                  
                  <div className="flex justify-between items-end">
                    <div>
                       <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-2">Account Bearer</p>
                       <p className="text-sm font-serif italic">{user?.fullName || 'Registry Identity'}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-2">Network ID</p>
                       <p className="text-[10px] font-black uppercase tracking-widest">#{user?.id?.substring(0,8)}</p>
                    </div>
                  </div>
               </div>
            </div>

            {/* Transaction Ledger */}
            <div className="space-y-8">
              <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#121212] border-b border-[#E5E1D8] pb-6 italic">Transaction Ledger</h3>
              <div className="bg-white border border-[#E5E1D8] divide-y divide-[#E5E1D8]">
                {transactions && transactions.length > 0 ? transactions.map((tx: any) => (
                  <div key={tx._id} className="p-8 flex justify-between items-center hover:bg-[#F9F7F2] transition-colors">
                    <div className="flex items-center gap-6">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm ${tx.type === 'DEPOSIT' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {tx.type === 'DEPOSIT' ? '↓' : '↑'}
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-[#121212] uppercase tracking-widest">{tx.description || tx.type}</p>
                        <p className="text-[9px] text-[#6B665E] font-bold uppercase tracking-widest opacity-60 mt-1">{new Date(tx.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${tx.type === 'DEPOSIT' ? 'text-green-600' : 'text-[#121212]'}`}>
                        {tx.type === 'DEPOSIT' ? '+' : '-'}{tx.amount?.toLocaleString()} RWF
                      </p>
                      <p className="text-[8px] font-bold uppercase tracking-tighter opacity-40 mt-1">{tx.status}</p>
                    </div>
                  </div>
                )) : (
                  <div className="p-20 text-center text-[10px] font-black uppercase tracking-[0.4em] opacity-30 italic">
                    No Recorded Movements
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions Sidebar */}
          <div className="space-y-10">
            <div className="bg-white border-2 border-[#121212] p-10 shadow-xl">
              <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#121212] mb-10 italic">Tactical Liquidity</h3>
              <form onSubmit={handleTopUp} className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-[#6B665E] uppercase tracking-widest opacity-60">Deposit Amount (RWF)</label>
                  <input 
                    type="number" 
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    placeholder="E.g. 5000"
                    className="rmf-input w-full px-6 py-4"
                  />
                </div>
                <div className="p-6 bg-[#F2F0EB] space-y-4">
                   <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                      <span className="opacity-60">Protocol</span>
                      <span>MTN Mobile Money</span>
                   </div>
                   <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                      <span className="opacity-60">Verification</span>
                      <span>Instant SMS</span>
                   </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isProcessing}
                  className="w-full rmf-btn-primary py-5 group"
                >
                  {isProcessing ? 'Processing...' : 'Initiate Deposit'}
                  <span className="ml-4 group-hover:translate-x-1 transition-transform inline-block">→</span>
                </button>
              </form>
            </div>

            <div className="p-10 border border-[#E5E1D8] space-y-6 bg-[#F2F0EB]/30">
               <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#F59E0B]">Vault Security Note</p>
               <p className="text-[10px] leading-relaxed italic text-[#6B665E]">
                 "All transactions within the RMF network are secured by end-to-end encryption. Your Heritage Wallet ensures seamless acquisition of artisanal artifacts."
               </p>
               <div className="pt-6 border-t border-[#E5E1D8]">
                  <Link href="/help/wallet" className="text-[9px] font-black uppercase tracking-widest text-[#121212] hover:text-[#F59E0B] transition-colors">Dispute a Transaction →</Link>
               </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
