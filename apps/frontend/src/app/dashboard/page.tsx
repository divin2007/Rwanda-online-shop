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
import { CreditCard, History, TrendingUp, ShoppingBag } from 'lucide-react';
import { resolveUploadUrl } from '@/lib/uploadUrls';
import { getProductUrl } from '@/lib/urls';

const BUYER_DASHBOARD_REFRESH_MS = 10000;

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const { t } = useLanguage();
  const { wishlist } = useWishlist();
  const router = useRouter();
  const isBuyer = user?.role === 'BUYER';

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/login');
    } else if (user.role === 'SELLER') {
      router.replace('/seller/dashboard');
    } else if (user.role === 'RIDER') {
      router.replace('/rider/dashboard');
    } else if (user.role === 'ADMIN') {
      router.replace('/admin');
    }
  }, [user, isLoading, router]);

  // Fetch Real Data
  const { data: ordersData, loading: ordersLoading } = useApi(orderApi, 'get', isBuyer && user?.id ? `/orders?buyerId=${user.id}&status=placed,confirmed,preparing,ready_for_pickup,picked_up,in_transit,awaiting_confirmation` : '', { refreshInterval: BUYER_DASHBOARD_REFRESH_MS });
  const { data: walletData, loading: walletLoading } = useApi(walletApi, 'get', isBuyer && user?.id ? `/wallets/me?userId=${user.id}` : '');
  const { data: transactionsData } = useApi(walletApi, 'get', isBuyer && user?.id ? `/wallets/me/transactions?userId=${user.id}` : '');
  const { data: recommendedData } = useApi(productApi, 'get', isBuyer ? '/products/recommendations/for-me?limit=8' : '');

  const orders = ordersData || [];
  const wallet = walletData || { balance: 0 };
  const transactions = transactionsData?.slice(0, 3) || [];
  const recommended = recommendedData || [];

  if (isLoading || !user || !isBuyer) {
    return (
      <Layout>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ff6b00] border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="rmf-container space-y-24 pb-40 pt-10 animate-reveal">
        {/* Welcome & Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
          <div className="lg:col-span-2 bg-background-surface border border-border-light rounded-2xl p-10 md:p-16 relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 p-8 opacity-5">
               <div className="text-[100px] font-bold leading-none select-none tracking-tighter">RMF</div>
            </div>
            
            <div className="relative z-10 max-w-2xl">
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-10 h-1 bg-accent-premium rounded-full"></div>
                 <p className="text-[11px] font-bold text-primary uppercase tracking-widest">{t('dashboard_welcome')}</p>
              </div>
              
              <h1 className="text-5xl md:text-6xl font-bold mb-8 leading-[1.1] text-text-primary tracking-tight">
                {t('hello')}, <br />
                <span className="text-primary not-italic">{user?.fullName?.split(' ')[0] || t('shopper')}.</span>
              </h1>
              
              <p className="text-lg text-text-muted font-medium leading-relaxed mb-12 border-l-[3px] border-border-light pl-6 max-w-xl">
                {t('you_have_active_orders', { ordersCount: orders.length, wishlistCount: wishlist.length })}
              </p>
              
              <div className="flex flex-wrap gap-4">
                <Link href="/orders" className="rmf-btn-primary rounded-xl px-8 py-3">{t('track_orders')}</Link>
                <Link href="/markets" className="rmf-btn-outline rounded-xl px-8 py-3 bg-white hover:bg-background-surface">{t('browse_markets')}</Link>
                <Link href="/reviews" className="rmf-btn-outline rounded-xl px-8 py-3 bg-white hover:bg-background-surface">My Reviews</Link>
              </div>
            </div>
          </div>
          
          {/* Wallet Card */}
          <div className="bg-primary-cinematic text-white p-10 rounded-2xl relative overflow-hidden group shadow-xl cinematic-shadow h-full border border-white/5">
            <div className="relative z-10 flex flex-col h-full justify-between gap-16">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-accent-premium mb-4">{t('my_wallet')}</p>
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-4xl lg:text-5xl font-bold tracking-tight drop-shadow-md">{wallet.balance?.toLocaleString() || 0}</h2>
                    <span className="text-lg font-bold text-accent-premium uppercase tracking-widest">RWF</span>
                  </div>
                </div>
                <div className="w-14 h-14 bg-accent-premium rounded-full flex items-center justify-center text-primary-dark shadow-[0_0_15px_rgba(255,215,0,0.4)]">
                  <CreditCard size={24} />
                </div>
              </div>
              
              <div className="space-y-6 pt-8 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                    {t('account_status')}
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                     <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                     <span className="text-[10px] font-bold text-white uppercase tracking-widest">{t('active')}</span>
                  </div>
                </div>
                <Link href="/wallet" className="flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-xs font-bold uppercase tracking-widest text-primary shadow-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/90">{t('manage_wallet')}</Link>
              </div>
            </div>
            {/* Visual Decoration */}
            <div className="absolute -bottom-10 -right-10 text-[150px] font-bold opacity-5 select-none tracking-tighter">MOMO</div>
          </div>
        </div>

        {/* Active Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 lg:gap-16">
           <div className="lg:col-span-3">
              <div className="flex justify-between items-end mb-10 border-b border-border-light pb-6">
                <div>
                  <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-2">{t('dashboard_in_progress')}</p>
                  <h2 className="text-3xl font-bold text-text-primary tracking-tight">{t('orders_title')}</h2>
                </div>
                <Link href="/orders" className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/70 transition-colors border-b-2 border-transparent hover:border-accent-premium pb-1">{t('view_all')} →</Link>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {ordersLoading ? (
                   [1,2].map(i => <div key={i} className="aspect-video bg-background-surface rounded-2xl animate-pulse border border-border-light"></div>)
                ) : orders.length > 0 ? orders.map((order: any, idx: number) => (
                  <div key={`${order._id || 'order'}-${idx}`} className="bg-white border border-border-light rounded-2xl p-6 group relative hover:border-primary/30 hover:shadow-md transition-all shadow-sm">
                    <div className="absolute top-4 right-4">
                       <div className="bg-primary/5 text-primary border border-primary/10 text-[9px] font-bold uppercase tracking-widest py-1.5 px-3 rounded-full">
                          {order.status.replace(/_/g, ' ')}
                       </div>
                    </div>
                    
                    <div className="flex gap-6 mb-6">
                       <div className="w-24 h-24 bg-background-surface rounded-xl overflow-hidden border border-border-light">
                          <img src={resolveUploadUrl(order.products?.[0]?.imageUrl || order.products?.[0]?.images?.[0], 'product') || 'https://images.unsplash.com/photo-1590073844006-33379778ae09'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={order.products?.[0]?.name} />
                       </div>
                       <div className="flex-grow pt-2">
                          <p className="text-[9px] font-bold text-accent-premium uppercase tracking-widest mb-1">{t('order')} #{order._id.substring(0,8).toUpperCase()}</p>
                          <h4 className="text-xl font-bold text-text-primary leading-tight tracking-tight line-clamp-2 transition-colors group-hover:text-primary">{order.products?.[0]?.name || t('order_item')}</h4>
                       </div>
                    </div>
                    
                    <div className="flex justify-between items-end pt-5 border-t border-border-light">
                      <div>
                        <p className="text-[10px] font-bold text-text-primary uppercase tracking-widest">{order.seller?.marketName || t('market')}</p>
                        <p className="text-[9px] text-text-muted font-medium tracking-widest mt-1">{t('placed')}: {new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Link href={`/orders/${order._id}/tracking`} className="text-xs font-bold text-primary uppercase tracking-widest group-hover:underline transition-all">{t('track')} →</Link>
                    </div>
                  </div>
                )) : (
                  <div className="md:col-span-2 border border-dashed border-border-light rounded-2xl bg-white py-24 text-center shadow-sm">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">{t('no_active_orders')}</p>
                    <Link href="/markets" className="mt-6 inline-flex min-h-[2.5rem] items-center justify-center rounded-xl bg-primary/5 px-6 text-xs font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-all">+ {t('start_shopping')}</Link>
                  </div>
                )}
              </div>
           </div>
           {/* Activity Sidebar */}
           <div className="bg-white border border-border-light rounded-2xl p-8 shadow-sm">
              <div className="flex justify-between items-center mb-8 border-b border-border-light pb-4">
                <h3 className="text-xl font-bold text-text-primary tracking-tight">{t('recent_activity')}</h3>
                <History size={18} className="opacity-60 text-primary" />
              </div>
              <div className="space-y-6">
                {transactions.length > 0 ? transactions.map((act: any, i: number) => (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className="w-10 h-10 rounded-full bg-background-surface border border-border-light flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                      {act.type === 'deposit' ? (
                        <TrendingUp size={16} className="text-green-600 group-hover:text-white" />
                      ) : (
                        <ShoppingBag size={16} className="text-primary group-hover:text-white" />
                      )}
                    </div>
                    <div className="flex-grow pt-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-primary truncate max-w-[150px]">{act.description || t('transaction')}</p>
                      <p className="text-[9px] text-text-muted font-medium tracking-widest mt-0.5">{new Date(act.createdAt).toLocaleDateString()}</p>
                      <p className={`text-xs font-bold mt-1.5 ${act.type === 'deposit' ? 'text-green-600' : 'text-primary'}`}>
                        {act.type === 'deposit' ? '+' : '-'} {act.amount?.toLocaleString()} RWF
                      </p>
                    </div>
                  </div>
                )) : (
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest py-10 text-center bg-background-surface rounded-xl border border-dashed border-border-light">{t('no_activity_yet')}</p>
                )}
              </div>
              <Link href="/wallet" className="block w-full text-center mt-8 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/70 transition-colors pt-6 border-t border-border-light">
                {t('view_all_transactions')}
              </Link>
            </div>
         </div>

        {/* Wishlist */}
        <section className="bg-background-surface py-20 border-y border-border-light rounded-3xl">
           <div className="px-4 md:px-8">
              <div className="flex justify-between items-end mb-12">
                <div>
                  <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-2">{t('saved_items')}</p>
                  <h2 className="text-3xl font-bold text-text-primary tracking-tight">{t('my_wishlist')}</h2>
                </div>
                <Link href="/wishlist" className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/70 transition-colors border-b-2 border-transparent hover:border-accent-premium pb-1">{t('view_all')} →</Link>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {wishlist.length > 0 ? wishlist.slice(0, 4).map((item: any, idx: number) => (
                  <Link key={`${item._id || 'wishlist'}-${idx}`} href={getProductUrl(item._id)} className="group relative bg-white border border-border-light rounded-2xl p-3 shadow-sm hover:shadow-md transition-all">
                    <div className="aspect-[3/4] bg-background-surface overflow-hidden rounded-xl mb-4 relative">
                      <img src={item.images?.[0]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={item.name} />
                      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors"></div>
                    </div>
                    <p className="text-[9px] font-bold text-accent-premium uppercase tracking-widest mb-1.5 px-1">{item.category || t('product')}</p>
                    <h5 className="text-base font-bold text-text-primary tracking-tight line-clamp-1 px-1 transition-colors group-hover:text-primary">{item.name}</h5>
                  </Link>
                )) : (
                  <div className="col-span-4 py-16 border border-dashed border-border-light rounded-2xl bg-white text-center shadow-sm">
                     <p className="text-xs font-bold text-text-muted uppercase tracking-widest">{t('wishlist_empty_title')}</p>
                  </div>
                )}
              </div>
           </div>
           </section>
         <section className="text-center pt-8">
           <div className="max-w-2xl mx-auto mb-16">
              <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-3">{t('you_might_like')}</p>
              <h2 className="text-4xl font-bold text-text-primary tracking-tight">{t('recommended_for_you')}</h2>
              <p className="text-base text-text-muted font-medium mt-4">{t('products_picked_based_on_popular')}</p>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-left">
             {recommended.map((prod: any, idx: number) => (
               <Link href={getProductUrl(prod._id)} key={`${prod._id || 'recommended'}-${idx}`} className="group relative bg-white border border-border-light rounded-2xl p-3 shadow-sm hover:shadow-md transition-all flex flex-col">
                 <div className="aspect-[4/5] bg-background-surface overflow-hidden rounded-xl mb-4 relative">
                   <img src={prod.images?.[0]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={prod.name} />
                   <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors"></div>
                 </div>
                 <div className="flex-grow flex flex-col justify-between px-1">
                   <h4 className="text-lg font-bold text-text-primary mb-2 leading-tight tracking-tight line-clamp-2 group-hover:text-primary transition-colors">{prod.name}</h4>
                   <div className="flex justify-between items-center mt-2 pt-2 border-t border-border-light/50">
                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest truncate max-w-[50%]">{prod.category || t('product')}</p>
                      <p className="text-sm font-bold text-text-primary">{prod.price?.toLocaleString()} <span className="text-[9px] uppercase font-bold text-primary tracking-widest ml-1">RWF</span></p>
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
