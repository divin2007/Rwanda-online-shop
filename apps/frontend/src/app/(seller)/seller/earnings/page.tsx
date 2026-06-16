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

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [txType, setTxType] = useState<'all' | 'credit' | 'debit'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

  // Filter & Sort Selector Logic
  const filteredLedger = (ledger || []).filter((tx: any) => {
    // 1. Text Search (ID, Description, Account)
    const txId = `#PAY-${tx._id.substring(0,8).toUpperCase()}`;
    const desc = (tx.description || '').toLowerCase();
    const account = (tx.account || '').toLowerCase();
    const query = searchTerm.toLowerCase();
    const matchesSearch = desc.includes(query) || txId.toLowerCase().includes(query) || account.includes(query);

    if (!matchesSearch) return false;

    // 2. Type Filter
    if (txType !== 'all') {
      const isCredit = tx.type?.toLowerCase() === 'credit';
      if (txType === 'credit' && !isCredit) return false;
      if (txType === 'debit' && isCredit) return false;
    }

    // 3. Date Filter
    if (dateFilter !== 'all') {
      const txDate = new Date(tx.createdAt);
      const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const today = startOfDay(new Date());

      if (dateFilter === 'today') {
        if (startOfDay(txDate).getTime() !== today.getTime()) return false;
      } else if (dateFilter === 'week') {
        const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (txDate < sevenDaysAgo) return false;
      } else if (dateFilter === 'month') {
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (txDate < thirtyDaysAgo) return false;
      } else if (dateFilter === 'custom') {
        if (startDate) {
          const start = startOfDay(new Date(startDate));
          if (txDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999); // end of selected day
          if (txDate > end) return false;
        }
      }
    }

    return true;
  }).sort((a: any, b: any) => {
    // 4. Valuation Sorting
    if (sortBy === 'date-desc') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (sortBy === 'date-asc') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sortBy === 'amount-desc') {
      return b.amount - a.amount;
    } else if (sortBy === 'amount-asc') {
      return a.amount - b.amount;
    }
    return 0;
  });
  const paypackSettledTotal = (ledger || [])
    .filter((tx: any) => tx.account === 'seller_paypack_payout' && tx.status === 'posted')
    .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
  const paypackPendingTotal = (ledger || [])
    .filter((tx: any) => tx.account === 'seller_paypack_payout' && tx.status !== 'posted')
    .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);

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
    toast('Manual wallet payouts are disabled. Seller payouts are sent automatically through Paypack when orders settle.');
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

  const handleViewReceipt = async (tx: any) => {
    if (tx.account === 'seller_paypack_payout' || tx.account === 'seller_paypack_payout_failed') {
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
          fullName: profile?.stallName || user?.fullName || 'Verified Seller',
          stallId: profile?.stallId || 'N/A'
        },
        products: [
          {
            productId: 'withdrawal',
            name: 'Paypack Seller Settlement',
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
          sellerPayout: tx.amount,
          riderPayout: 0
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

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-16 animate-reveal">
        {selectedReceipt && (
          <ReceiptView order={selectedReceipt} role="seller" onClose={() => setSelectedReceipt(null)} />
        )}
        
        {/* Institutional Header */}
        <div className="border-b-2 border-[#e0e0e0] pb-10 flex justify-between items-end">
          <div>
            <p className="text-[10px] font-black text-[#ff6b00] uppercase tracking-[0.5em] mb-4">Financial Core</p>
            <h1 className="text-5xl font-sans text-[#1b1c1c] tracking-normal">Earnings & Payouts</h1>
          </div>
          <div className="text-right">
             <p className="text-[10px] font-black text-[#1b1c1c] uppercase tracking-widest">Stall ID: {profile?.stallId || '---'}</p>
             <p className="text-[8px] font-bold text-[#414844] uppercase tracking-widest opacity-40 mt-1">Ledger Sync Active</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Main Wallet Card */}
          <div className="lg:col-span-2 space-y-16">
            <div className="bg-[#e05300] text-white p-16 relative overflow-hidden group shadow-2xl border border-[#e0e0e0] rounded-lg">
               <div className="absolute top-0 right-0 w-64 h-64 bg-[#ffd700]/5 rounded-full -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-1000"></div>
               <div className="relative z-10">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-[#ff6b00] mb-6">Paypack Settled</p>
                  <h2 className="text-8xl font-sans tracking-normal mb-16 text-white drop-shadow-2xl">
                    {walletLoading ? '---' : paypackSettledTotal.toLocaleString()} <span className="text-3xl not-italic opacity-40 ml-4">RWF</span>
                  </h2>
                  <div className="flex gap-12 pt-12 border-t border-white/5">
                     <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-2">Total Settled</p>
                        <p className="text-2xl font-sans text-white/90">{paypackSettledTotal.toLocaleString()} <span className="text-[10px] not-italic opacity-40">RWF</span></p>
                     </div>
                     <div className="w-px h-12 bg-white/10 mt-2"></div>
                     <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-2">Pending Escrow</p>
                        <p className="text-2xl font-sans text-white/40">{paypackPendingTotal.toLocaleString()} <span className="text-[10px] not-italic opacity-40">RWF</span></p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Transaction Table */}
            <div className="space-y-8">
               <div className="border-b border-[#e0e0e0] pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                 <h3 className="text-[12px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]">Synchronization Log</h3>
                 <span className="text-[9px] font-black uppercase tracking-widest text-[#ff6b00] bg-[#ff6b00]/5 border border-[#ff6b00]/10 px-3 py-1 rounded-full">
                   {filteredLedger.length} / {ledger?.length || 0} Ledger Movements
                 </span>
               </div>

               {/* Advanced Filter Control Center */}
               <div className="bg-white border border-[#e0e0e0] p-8 shadow-sm space-y-8 rounded-lg">
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                   
                   {/* Description & ID Search */}
                   <div className="space-y-3 col-span-1 md:col-span-2">
                     <label className="text-[9px] font-black text-[#414844] uppercase tracking-widest opacity-60">Keyword Search</label>
                     <div className="relative">
                       <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs opacity-50">🔍</span>
                       <input 
                         type="text"
                         placeholder="Search reference, description, account..."
                         value={searchTerm}
                         onChange={e => setSearchTerm(e.target.value)}
                         className="w-full rounded-md border border-[#e0e0e0] bg-[#f0eded]/10 pl-10 pr-4 py-3 text-xs font-semibold text-[#1b1c1c] outline-none transition focus:border-[#ff6b00] placeholder:text-[#9da7a0]"
                       />
                     </div>
                   </div>

                   {/* Type Filter */}
                   <div className="space-y-3">
                     <label className="text-[9px] font-black text-[#414844] uppercase tracking-widest opacity-60">Movement Type</label>
                     <select
                       value={txType}
                       onChange={e => setTxType(e.target.value as any)}
                       className="w-full rounded-md border border-[#e0e0e0] bg-white px-4 py-3 text-xs font-semibold text-[#1b1c1c] outline-none transition focus:border-[#ff6b00]"
                     >
                       <option value="all">All Movements</option>
                       <option value="credit">Earnings (+)</option>
                       <option value="debit">Cash Outs (-)</option>
                     </select>
                   </div>

                   {/* Sorting options */}
                   <div className="space-y-3">
                     <label className="text-[9px] font-black text-[#414844] uppercase tracking-widest opacity-60">Valuation Sorting</label>
                     <select
                       value={sortBy}
                       onChange={e => setSortBy(e.target.value as any)}
                       className="w-full rounded-md border border-[#e0e0e0] bg-white px-4 py-3 text-xs font-semibold text-[#1b1c1c] outline-none transition focus:border-[#ff6b00]"
                     >
                       <option value="date-desc">Newest First</option>
                       <option value="date-asc">Oldest First</option>
                       <option value="amount-desc">Highest Amount</option>
                       <option value="amount-asc">Lowest Amount</option>
                     </select>
                   </div>

                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6 border-t border-[#f0eded]">
                   
                   {/* Time Period Filter */}
                   <div className="space-y-3">
                     <label className="text-[9px] font-black text-[#414844] uppercase tracking-widest opacity-60">Time Period</label>
                     <select
                       value={dateFilter}
                       onChange={e => setDateFilter(e.target.value as any)}
                       className="w-full rounded-md border border-[#e0e0e0] bg-white px-4 py-3 text-xs font-semibold text-[#1b1c1c] outline-none transition focus:border-[#ff6b00]"
                     >
                       <option value="all">All Time</option>
                       <option value="today">Today</option>
                       <option value="week">Last 7 Days</option>
                       <option value="month">Last 30 Days</option>
                       <option value="custom">Custom Date Range</option>
                     </select>
                   </div>

                   {/* Custom Date Bounds */}
                   {dateFilter === 'custom' && (
                     <>
                       <div className="space-y-3">
                         <label className="text-[9px] font-black text-[#414844] uppercase tracking-widest opacity-60">Start Date</label>
                         <input 
                           type="date"
                           value={startDate}
                           onChange={e => setStartDate(e.target.value)}
                           className="w-full rounded-md border border-[#e0e0e0] bg-white px-4 py-3 text-xs font-semibold text-[#1b1c1c] outline-none transition focus:border-[#ff6b00]"
                         />
                       </div>
                       <div className="space-y-3">
                         <label className="text-[9px] font-black text-[#414844] uppercase tracking-widest opacity-60">End Date</label>
                         <input 
                           type="date"
                           value={endDate}
                           onChange={e => setEndDate(e.target.value)}
                           className="w-full rounded-md border border-[#e0e0e0] bg-white px-4 py-3 text-xs font-semibold text-[#1b1c1c] outline-none transition focus:border-[#ff6b00]"
                         />
                       </div>
                     </>
                   )}

                 </div>
               </div>

               {/* Log Grid */}
               <div className="bg-white border border-[#e0e0e0] rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-[#f0eded]/50 border-b-2 border-[#e0e0e0]">
                        <th className="p-8 text-[9px] font-black uppercase tracking-widest text-[#414844]">{t('mandate_id')}</th>
                        <th className="p-8 text-[9px] font-black uppercase tracking-widest text-[#414844]">Description</th>
                        <th className="p-8 text-[9px] font-black uppercase tracking-widest text-[#414844]">Valuation</th>
                        <th className="p-8 text-[9px] font-black uppercase tracking-widest text-[#414844]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e0e0e0]">
                      {filteredLedger && filteredLedger.length > 0 ? filteredLedger.map((tx: any) => (
                        <tr key={tx._id} className="hover:bg-[#fcf9f8] transition-colors group">
                          <td className="p-8">
                             <p className="text-[10px] font-black text-[#1b1c1c]">#{tx._id.substring(0,8).toUpperCase()}</p>
                             <p className="text-[8px] text-[#414844] font-bold uppercase mt-1 opacity-60">{new Date(tx.createdAt).toLocaleDateString()}</p>
                          </td>
                          <td className="p-8">
                             <p className="text-[11px] font-black text-[#1b1c1c] uppercase tracking-widest">{tx.description || 'System Entry'}</p>
                          </td>
                          <td className="p-8">
                             <p className={`text-sm font-black ${tx.type?.toLowerCase() === 'credit' ? 'text-green-600' : 'text-[#1b1c1c]'}`}>
                                {tx.type?.toLowerCase() === 'credit' ? '+' : '-'}{tx.amount?.toLocaleString()} RWF
                             </p>
                          </td>
                          <td className="p-8">
                             {tx.transactionId && (
                               <button 
                                 onClick={() => handleViewReceipt(tx)}
                                 className="text-[10px] font-black text-[#ff6b00] uppercase tracking-widest border-b border-[#ffd700]/20 hover:border-[#ffd700] pb-1 transition-all"
                               >
                                 View Artifact 
                               </button>
                             )}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={4} className="p-24 text-center text-[10px] font-black uppercase tracking-[0.4em] opacity-30">
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
            <div className="bg-white border border-[#e0e0e0] rounded-lg p-10 shadow-2xl">
              <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#1b1c1c] mb-12">Paypack Settlement</h3>
              <form onSubmit={requestPayout} className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[9px] font-black text-[#414844] uppercase tracking-widest opacity-60">Liquidation Amount (RWF)</label>
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
                  <label className="text-[9px] font-black text-[#414844] uppercase tracking-widest opacity-60">MTN MoMo Gateway</label>
                  <input 
                    type="tel" 
                    required 
                    value={payoutForm.phone}
                    onChange={e => setPayoutForm({...payoutForm, phone: e.target.value})}
                    placeholder="078..." 
                    className="rmf-input w-full px-6 py-5" 
                  />
                </div>
                <div className="p-8 bg-[#f0eded] space-y-6">
                   <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                      <span className="opacity-60">Network Protocol</span>
                      <span className="text-[#ff6b00]">SECURE-MOMO</span>
                   </div>
                   <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                      <span className="opacity-60">Fee Analysis</span>
                      <span>1.5% Applied</span>
                   </div>
                </div>
                <p className="text-center text-[10px] font-bold uppercase tracking-widest text-[#414844]/60">
                  Manual wallet payouts are disabled. Paypack sends seller payouts automatically.
                </p>
                <button 
                  type="submit" 
                  disabled
                  className="w-full rmf-btn-primary py-5 bg-[#ff6b00] hover:bg-[#e05300]"
                >
                  Initiate Payout →
                </button>
              </form>
            </div>

            <div className="p-10 border border-[#e0e0e0] space-y-8 bg-[#f0eded]/30 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-2 h-full bg-[#ffd700] opacity-20 group-hover:opacity-100 transition-opacity"></div>
               <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]">Ledger Integrity</p>
               <p className="text-[10px] leading-relaxed text-[#414844]">
                 "All settled earnings are audited by the RMF Financial Gateway. Commission is automatically processed during the acquisition lifecycle."
               </p>
               <div className="pt-8 border-t border-[#e0e0e0]">
                  <Link href="/contact" className="text-[9px] font-black uppercase tracking-widest text-[#ff6b00] hover:text-[#1b1c1c] transition-colors">Request Support Handshake →</Link>
               </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
