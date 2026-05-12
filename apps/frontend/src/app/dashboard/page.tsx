'use client';
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import { useApi } from '@/hooks/useApi';
import { orderApi, walletApi, productApi } from '@/lib/api';
import { useWishlist } from '@/context/WishlistContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { wishlist } = useWishlist();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === 'SELLER') {
      router.push('/seller/dashboard');
    }
  }, [user, router]);

  // Fetch Real Data
  const { data: ordersData, loading: ordersLoading } = useApi(orderApi, 'get', `/orders?buyerId=${user?.id}&status=placed,confirmed,preparing,ready_for_pickup,picked_up,in_transit`);
  const { data: walletData, loading: walletLoading } = useApi(walletApi, 'get', `/wallets/me?userId=${user?.id}`);
  const { data: transactionsData } = useApi(walletApi, 'get', `/wallets/me/transactions?userId=${user?.id}`);
  const { data: recommendedData } = useApi(productApi, 'get', '/products?limit=4');

  const orders = ordersData || [];
  const wallet = walletData || { balance: 0 };
  const transactions = transactionsData?.slice(0, 3) || [];
  const recommended = recommendedData || [];

  return (
    <Layout>
      <div className="space-y-32 pb-20 animate-reveal">
        {/* Welcome & Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start">
          <div className="lg:col-span-2 bg-white border-2 border-[#121212] p-20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-5">
               <div className="text-[120px] font-serif leading-none italic select-none">RMF</div>
            </div>
            
            <div className="relative z-10 max-w-2xl">
              <div className="flex items-center gap-6 mb-12">
                 <div className="w-12 h-px bg-[#F59E0B]"></div>
                 <p className="text-[11px] font-black text-[#F59E0B] uppercase tracking-[0.5em]">Welcome Back</p>
              </div>
              
              <h1 className="text-8xl font-serif mb-10 leading-[0.9] text-[#121212] tracking-tighter italic">
                Hello, <br />
                <span className="text-[#F59E0B] not-italic">{user?.fullName?.split(' ')[0] || 'Shopper'}.</span>
              </h1>
              
              <p className="text-xl text-[#6B665E] font-light italic leading-relaxed mb-16 border-l-2 border-[#F0EDE4] pl-10 max-w-xl">
                You have {orders.length} active order{orders.length !== 1 ? 's' : ''} and {wishlist.length} saved item{wishlist.length !== 1 ? 's' : ''} in your wishlist.
              </p>
              
              <div className="flex flex-wrap gap-8">
                <Link href="/orders" className="rmf-btn-primary bg-[#121212] hover:bg-[#F59E0B]">Track Orders</Link>
                <Link href="/markets" className="rmf-btn-outline border-[#121212]/10 hover:border-[#121212]">Browse Markets</Link>
              </div>
            </div>
          </div>
          
          {/* Wallet Card */}
          <div className="bg-[#121212] text-white p-12 relative overflow-hidden group shadow-[50px_50px_100px_-50px_rgba(0,0,0,0.5)]">
            <div className="relative z-10 flex flex-col h-full justify-between gap-20">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#F59E0B] mb-6">My Wallet</p>
                  <div className="flex items-baseline gap-4">
                    <h2 className="text-7xl font-serif tracking-tighter italic">{wallet.balance?.toLocaleString() || 0}</h2>
                    <span className="text-2xl font-serif text-[#F59E0B] opacity-60">RWF</span>
                  </div>
                </div>
                <div className="w-16 h-16 bg-[#F59E0B] flex items-center justify-center text-2xl shadow-2xl">💳</div>
              </div>
              
              <div className="space-y-8 pt-10 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <div className="text-[9px] font-black text-white/30 uppercase tracking-widest">
                    Account Status
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                     <span className="text-[9px] font-black text-white uppercase tracking-widest">Active</span>
                  </div>
                </div>
                <Link href="/wallet" className="w-full rmf-btn-primary py-4 text-[9px] bg-white text-[#121212] hover:bg-[#F59E0B] hover:text-white border-none">Manage Wallet</Link>
              </div>
            </div>
            {/* Visual Decoration */}
            <div className="absolute -bottom-20 -right-20 text-[200px] font-serif opacity-5 italic select-none">MOMO</div>
          </div>
        </div>

        {/* Active Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-20">
           <div className="lg:col-span-3">
              <div className="flex justify-between items-end mb-16 border-b-2 border-[#121212] pb-10">
                <div>
                  <p className="rmf-label-sm mb-4">In Progress</p>
                  <h2 className="text-5xl font-serif text-[#121212] italic tracking-tighter">My Orders</h2>
                </div>
                <Link href="/orders" className="text-[11px] font-black uppercase tracking-[0.4em] text-[#121212] hover:text-[#F59E0B] transition-colors border-b-2 border-[#121212]/10 hover:border-[#F59E0B] pb-2">View All →</Link>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {ordersLoading ? (
                   [1,2].map(i => <div key={i} className="aspect-video bg-[#F2F0EB] animate-pulse border border-[#E5E1D8]"></div>)
                ) : orders.length > 0 ? orders.map((order: any) => (
                  <div key={order._id} className="bg-white border border-[#E5E1D8] p-10 group relative hover:border-[#121212] transition-all">
                    <div className="absolute top-0 right-0">
                       <div className="bg-[#121212] text-white text-[8px] font-black uppercase tracking-widest py-3 px-5">
                          {order.status.replace(/_/g, ' ')}
                       </div>
                    </div>
                    
                    <div className="flex gap-10 mb-10">
                       <div className="w-32 h-32 bg-[#F8F6F1] overflow-hidden border border-[#E5E1D8]">
                          <img src={order.products?.[0]?.images?.[0] || 'https://images.unsplash.com/photo-1590073844006-33379778ae09'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt={order.products?.[0]?.name} />
                       </div>
                       <div className="flex-grow pt-4">
                          <p className="text-[9px] font-black text-[#F59E0B] uppercase tracking-[0.3em] mb-3">Order #{order._id.substring(0,8).toUpperCase()}</p>
                          <h4 className="text-3xl font-serif text-[#121212] leading-none tracking-tighter line-clamp-2">{order.products?.[0]?.name || 'Order Item'}</h4>
                       </div>
                    </div>
                    
                    <div className="flex justify-between items-end pt-8 border-t border-[#F0EDE4]">
                      <div>
                        <p className="text-[10px] font-black text-[#121212] uppercase tracking-widest">{order.seller?.marketName || 'Market'}</p>
                        <p className="text-[9px] text-[#6B665E] uppercase tracking-widest mt-2 opacity-50">Placed: {new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Link href={`/orders/${order._id}/tracking`} className="text-sm font-black text-[#F59E0B] uppercase tracking-[0.2em] group-hover:underline transition-all">Track →</Link>
                    </div>
                  </div>
                )) : (
                  <div className="md:col-span-2 border-4 border-dashed border-[#F0EDE4] bg-white py-32 text-center">
                    <p className="text-[12px] font-black text-[#6B665E] uppercase tracking-[0.6em] italic opacity-40">No active orders</p>
                    <Link href="/markets" className="mt-10 inline-block text-[11px] font-black text-[#F59E0B] uppercase tracking-widest hover:underline">+ Start Shopping</Link>
                  </div>
                )}
              </div>
           </div>

           {/* Activity Sidebar */}
           <div className="bg-white border-2 border-[#121212] p-12">
              <div className="flex justify-between items-center mb-12 border-b border-[#F0EDE4] pb-6">
                <h3 className="text-2xl font-serif text-[#121212] italic tracking-tighter">Recent Activity</h3>
                <span className="text-xl opacity-20">🕒</span>
              </div>
              <div className="space-y-10">
                {transactions.length > 0 ? transactions.map((act: any, i: number) => (
                  <div key={i} className="flex items-start gap-6 group">
                    <div className="w-12 h-12 bg-[#F8F6F1] border border-[#E5E1D8] flex items-center justify-center text-xl group-hover:bg-[#121212] group-hover:text-white transition-all">
                      {act.type === 'deposit' ? '📈' : '🛍️'}
                    </div>
                    <div className="flex-grow">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#121212] truncate max-w-[150px]">{act.description || 'Transaction'}</p>
                      <p className="text-[9px] text-[#6B665E] uppercase tracking-widest mt-1 opacity-50">{new Date(act.createdAt).toLocaleDateString()}</p>
                      <p className={`text-[11px] font-black mt-2 ${act.type === 'deposit' ? 'text-green-600' : 'text-[#F59E0B]'}`}>
                        {act.type === 'deposit' ? '+' : '-'} {act.amount?.toLocaleString()} RWF
                      </p>
                    </div>
                  </div>
                )) : (
                  <p className="text-[10px] font-black text-[#6B665E] uppercase tracking-widest opacity-30 py-20 text-center">No activity yet</p>
                )}
              </div>
              <Link href="/wallet" className="block w-full text-center mt-12 text-[10px] font-black uppercase tracking-[0.3em] text-[#F59E0B] hover:text-[#121212] transition-colors pt-10 border-t border-[#F0EDE4]">
                View All Transactions
              </Link>
           </div>
        </div>

        {/* Wishlist */}
        <section className="rmf-container-full bg-[#F8F6F1] py-32 border-y border-[#E5E1D8]">
           <div className="rmf-container">
              <div className="flex justify-between items-end mb-20">
                <div>
                  <p className="rmf-label-sm mb-4">Saved Items</p>
                  <h2 className="text-6xl font-serif text-[#121212] tracking-tighter leading-none italic">My Wishlist</h2>
                </div>
                <Link href="/wishlist" className="text-[11px] font-black uppercase tracking-[0.4em] text-[#121212] hover:text-[#F59E0B] transition-colors border-b-2 border-[#121212]/10 hover:border-[#F59E0B] pb-2">View All →</Link>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
                {wishlist.length > 0 ? wishlist.slice(0, 4).map((item: any) => (
                  <Link key={item._id} href={`/product/${item._id}`} className="group relative">
                    <div className="aspect-[3/4] bg-white overflow-hidden mb-6 border border-[#E5E1D8] group-hover:border-[#121212] transition-all p-4 shadow-sm">
                      <img src={item.images?.[0]} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" alt={item.name} />
                    </div>
                    <p className="text-[9px] font-black text-[#F59E0B] uppercase tracking-[0.3em] mb-3">{item.category || 'Product'}</p>
                    <h5 className="text-xl font-serif text-[#121212] tracking-tighter leading-none line-clamp-1 group-hover:italic transition-all">{item.name}</h5>
                  </Link>
                )) : (
                  <div className="col-span-4 py-24 border-4 border-dashed border-[#F0EDE4] bg-white text-center">
                     <p className="text-[11px] font-black text-[#6B665E] uppercase tracking-[0.6em] italic opacity-40">Your wishlist is empty</p>
                  </div>
                )}
              </div>
           </div>
        </section>

        {/* Recommended Products */}
        <section className="text-center">
           <div className="max-w-4xl mx-auto mb-24">
              <p className="rmf-label-sm mb-6">You Might Like</p>
              <h2 className="text-7xl font-serif text-[#121212] tracking-tighter leading-none italic">Recommended for You</h2>
              <p className="text-xl text-[#6B665E] font-light italic mt-8">Products picked based on what's popular in your area.</p>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-4 gap-12 text-left">
             {recommended.map((prod: any) => (
               <Link href={`/product/${prod._id}`} key={prod._id} className="space-y-8 group relative">
                 <div className="aspect-[4/5] bg-white overflow-hidden relative border border-[#E5E1D8] group-hover:border-[#121212] transition-all p-2 shadow-xl">
                   <img src={prod.images?.[0]} className="w-full h-full object-cover transition-transform duration-[4000ms] group-hover:scale-110" alt={prod.name} />
                   <div className="absolute inset-0 bg-[#121212]/0 group-hover:bg-[#121212]/5 transition-all"></div>
                 </div>
                 <div>
                   <h4 className="text-3xl font-serif text-[#121212] mb-3 leading-none tracking-tighter group-hover:text-[#F59E0B] transition-colors">{prod.name}</h4>
                   <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black text-[#6B665E] uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">{prod.category || 'Product'}</p>
                      <p className="text-lg font-serif italic text-[#121212]">{prod.price?.toLocaleString()} <span className="text-[10px] uppercase not-italic opacity-40 ml-1">RWF</span></p>
                   </div>
                 </div>
               </Link>
             ))}
           </div>
        </section>
      </div>
    </Layout>
  );
}
