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
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState(user?.phone || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');

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
        toast.success('MoMo deposit initiated. Check your phone for the payment prompt.');
        setTopUpAmount('');
        fetchWallet();
      }
    } catch (error) {
      toast.error('Deposit failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) return toast.error('Enter a valid amount');
    if (amount > (wallet?.balance || 0)) return toast.error('Insufficient balance');
    if (!withdrawPhone || withdrawPhone.length < 10) return toast.error('Enter a valid phone number');

    setIsWithdrawing(true);
    try {
      const res = await walletApi.post(`/wallets/user/${user?.id}/payout`, {
        amount,
        method: 'momo',
        recipientPhone: withdrawPhone
      });

      if (res.data?.success || res.data) {
        toast.success('Withdrawal request submitted! You will receive funds shortly.');
        setWithdrawAmount('');
        fetchWallet();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Withdrawal failed. Please try again.');
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-12 animate-reveal">
        <div className="border-b border-[#e0e0e0] pb-10">
          <p className="text-[10px] font-black text-[#ff6b00] uppercase tracking-[0.5em] mb-4">{t('my_account')}</p>
          <h1 className="text-5xl font-sans text-[#1b1c1c] tracking-normal">{t('wallet_title')}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Wallet Card */}
          <div className="lg:col-span-2 space-y-12">
            <div className="bg-[#e05300] text-white p-12 relative overflow-hidden group shadow-2xl">
               <div className="absolute top-0 right-0 w-64 h-64 bg-[#ffd700]/10 rounded-full -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-1000"></div>
               <div className="relative z-10">
                  <div className="flex justify-between items-start mb-20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#ffd700] flex items-center justify-center font-black">RMF</div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.4em]">{t('my_wallet')}</span>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">{t('verified_account')}</span>
                  </div>
                  
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-[#ff6b00] mb-4">{t('available_balance')}</p>
                  <h2 className="text-7xl font-sans tracking-normal mb-12">
                    {loading ? '---' : (wallet?.balance?.toLocaleString() || 0)} <span className="text-3xl not-italic opacity-40 ml-4">RWF</span>
                  </h2>
                  
                  <div className="flex justify-between items-end">
                    <div>
                       <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-2">{t('account_holder')}</p>
                       <p className="text-sm font-sans">{user?.fullName || t('account')}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-2">{t('account_id')}</p>
                       <p className="text-[10px] font-black uppercase tracking-widest">#{user?.id?.substring(0,8)}</p>
                    </div>
                  </div>
               </div>
            </div>

            {/* Transaction History */}
            <div className="space-y-8">
              <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#1b1c1c] border-b border-[#e0e0e0] pb-6">{t('transaction_history')}</h3>
              <div className="bg-white border border-[#e0e0e0] divide-y divide-[#e0e0e0]">
                {transactions && transactions.length > 0 ? transactions.map((tx: any) => (
                  <div key={tx._id} className="p-8 flex justify-between items-center hover:bg-[#fcf9f8] transition-colors">
                    <div className="flex items-center gap-6">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm ${tx.type === 'DEPOSIT' || tx.type === 'credit' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {tx.type === 'DEPOSIT' || tx.type === 'credit' ? '↓' : '↑'}
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-[#1b1c1c] uppercase tracking-widest">{tx.description || tx.type}</p>
                        <p className="text-[9px] text-[#414844] font-bold uppercase tracking-widest opacity-60 mt-1">{new Date(tx.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${tx.type === 'DEPOSIT' || tx.type === 'credit' ? 'text-green-600' : 'text-[#1b1c1c]'}`}>
                        {tx.type === 'DEPOSIT' || tx.type === 'credit' ? '+' : '-'}{tx.amount?.toLocaleString()} RWF
                      </p>
                      <p className="text-[8px] font-bold uppercase tracking-normal opacity-40 mt-1">{tx.status}</p>
                    </div>
                  </div>
                )) : (
                  <div className="p-20 text-center text-[10px] font-black uppercase tracking-[0.4em] opacity-30">
                    {t('no_transactions_yet')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions Sidebar */}
          <div className="space-y-10">
            {/* Tab Selector */}
            <div className="flex border border-[#e0e0e0] rounded-lg">
              <button
                onClick={() => setActiveTab('deposit')}
                className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'deposit' ? 'bg-[#e05300] text-white' : 'bg-white text-[#1b1c1c] hover:bg-[#f0eded]'
                }`}
              >
                {t('deposit')}
              </button>
              <button
                onClick={() => setActiveTab('withdraw')}
                className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'withdraw' ? 'bg-[#e05300] text-white' : 'bg-white text-[#1b1c1c] hover:bg-[#f0eded]'
                }`}
              >
                {t('withdraw')}
              </button>
            </div>

            {activeTab === 'deposit' ? (
              <div className="bg-white border border-[#e0e0e0] rounded-lg p-10 shadow-xl">
                <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#1b1c1c] mb-10">{t('add_money')}</h3>
                <form onSubmit={handleTopUp} className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-[#414844] uppercase tracking-widest opacity-60">{t('amount')} (RWF)</label>
                    <input 
                      type="number" 
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="E.g. 5000"
                      className="rmf-input w-full px-6 py-4"
                    />
                  </div>
                  {/* Quick amounts */}
                  <div className="grid grid-cols-3 gap-2">
                    {[1000, 5000, 10000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTopUpAmount(String(amt))}
                        className="py-3 border border-[#e0e0e0] text-[9px] font-black uppercase tracking-widest hover:border-[#ff6b00] transition-all"
                      >
                        {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <div className="p-6 bg-[#f0eded] space-y-4">
                     <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                        <span className="opacity-60">{t('payment_method')}</span>
                        <span>MTN Mobile Money</span>
                     </div>
                     <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                        <span className="opacity-60">{t('confirmation')}</span>
                        <span>{t('instant_via_sms')}</span>
                     </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={isProcessing}
                    className="w-full rmf-btn-primary py-5 group"
                  >
                    {isProcessing ? t('processing') : t('deposit_now')}
                    <span className="ml-4 group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-white border border-[#e0e0e0] rounded-lg p-10 shadow-xl">
                <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#1b1c1c] mb-10">{t('withdraw_money')}</h3>
                <form onSubmit={handleWithdraw} className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-[#414844] uppercase tracking-widest opacity-60">{t('amount')} (RWF)</label>
                    <input 
                      type="number" 
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="E.g. 5000"
                      className="rmf-input w-full px-6 py-4"
                    />
                    <p className="text-[8px] font-bold text-[#414844] opacity-50">
                      {t('available')}: {wallet?.balance?.toLocaleString() || 0} RWF
                    </p>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-[#414844] uppercase tracking-widest opacity-60">{t('momo_phone_number')}</label>
                    <input 
                      type="tel" 
                      value={withdrawPhone}
                      onChange={(e) => setWithdrawPhone(e.target.value)}
                      placeholder="07XXXXXXXX"
                      className="rmf-input w-full px-6 py-4"
                    />
                  </div>
                  <div className="p-6 bg-[#f0eded] space-y-4">
                     <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                        <span className="opacity-60">{t('method')}</span>
                        <span>MTN Mobile Money</span>
                     </div>
                     <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                        <span className="opacity-60">{t('processing_time')}</span>
                        <span>{t('within_24_hours')}</span>
                     </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={isWithdrawing}
                    className="w-full rmf-btn-primary py-5 group"
                  >
                    {isWithdrawing ? t('processing') : t('request_withdrawal')}
                    <span className="ml-4 group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </button>
                </form>
              </div>
            )}

            <div className="p-10 border border-[#e0e0e0] space-y-6 bg-[#f0eded]/30">
               <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#ff6b00]">{t('wallet_security')}</p>
               <p className="text-[10px] leading-relaxed text-[#414844]">
                 {t('wallet_security_desc')}
               </p>
               <div className="pt-6 border-t border-[#e0e0e0]">
                  <Link href="/orders" className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c] hover:text-[#ff6b00] transition-colors">{t('need_help_contact')} →</Link>
               </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
