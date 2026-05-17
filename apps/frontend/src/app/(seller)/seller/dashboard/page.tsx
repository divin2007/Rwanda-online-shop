'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { sellerApi, adminApi, orderApi, productApi, walletApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { Layout } from '@/components/layout/Layout';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const AnalyticsCharts = dynamic(() => import('@/components/ui/AnalyticsCharts').then(mod => mod.AnalyticsCharts), { ssr: false });

export default function SellerDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role === 'BUYER') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const profileUrl = user?.id ? `/sellers/me?userId=${user.id}` : null;
  const { data: profile, loading: profileLoading, error: profileError } = useApi(sellerApi, 'get', profileUrl || '');



  const { data: productsData } = useApi(productApi, 'get', `/products?sellerId=${user?.id}`);
  const { data: ordersData, loading: ordersLoading, execute: fetchOrders } = useApi(orderApi, 'get', `/orders?sellerId=${user?.id}&status=awaiting_quote,quote_sent,placed,confirmed,preparing,ready_for_pickup`);
  const { data: walletData } = useApi(walletApi, 'get', `/wallets/me?userId=${user?.id}`);
  const { data: analyticsData } = useApi(adminApi, 'get', `/seller/dashboard/analytics/${user?.id}`);
  const { data: sellerSummary } = useApi(adminApi, 'get', `/analytics/seller/${user?.id}`);
  const orderSocketUrl = process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006';
  const sellerOrderChannel = user?.id ? `order:seller:${user.id}:updates` : '';
  const { data: sellerOrderUpdate, isConnected: orderSocketConnected, emit: emitOrderSocket } = useSocket(orderSocketUrl, sellerOrderChannel);

  useEffect(() => {
    if (orderSocketConnected && user?.id) {
      emitOrderSocket('order:seller:updates', { sellerId: user.id });
    }
  }, [orderSocketConnected, user?.id, emitOrderSocket]);

  useEffect(() => {
    if (sellerOrderUpdate) {
      fetchOrders();
    }
  }, [sellerOrderUpdate, fetchOrders]);

  const products = productsData || [];
  const activeOrders = ordersData || [];
  const wallet = walletData || { balance: 0 };
  const sellerStats = sellerSummary || {
    totalRevenue: 0,
    avgRating: profile?.rating || 0,
    fulfillmentRate: 0,
    repeatBuyerRate: 0,
    avgPrepTime: null,
    totalReviews: 0,
  };
  const ratingValue = Number(sellerStats.avgRating || 0);

  if (profileError) {
    return (
      <Layout>
        <div className="p-20 text-center space-y-6">
          <div className="text-3xl">⚠️</div>
          <h2 className="text-2xl font-sans">Connection Error</h2>
          <p className="text-sm text-[#414844] max-w-md mx-auto">Could not load your seller profile. Please try again.</p>
          <button onClick={() => window.location.reload()} className="rmf-btn-primary px-12">Retry</button>
        </div>
      </Layout>
    );
  }

  if (profileLoading || (profile === null && !profileError)) {
    return (
      <Layout>
        <div className="p-20 text-center flex flex-col items-center justify-center space-y-8 min-h-[60vh] animate-reveal">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-[#c1ecd4]/60 rounded-full" />
            <div className="absolute inset-0 w-20 h-20 border-4 border-t-[#116c4a] rounded-full animate-spin" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#414844] opacity-60">Loading your shop...</p>
        </div>
      </Layout>
    );
  }

  if (profile && !profile.isApproved) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center p-12 animate-reveal">
          <div className="max-w-2xl w-full bg-white border border-[#e0e0e0] rounded-lg p-16 shadow-2xl">
            <div className="h-2 bg-[#c1ecd4] -mx-16 -mt-16 mb-16" />
            <div className="text-center space-y-4 mb-12">
              <p className="text-[11px] font-black text-[#1b4332] uppercase tracking-[0.22em]">Status: Under Review</p>
              <h1 className="text-3xl font-sans tracking-normal text-[#1b1c1c]">Application Received!</h1>
            </div>
            <div className="space-y-6 bg-[#fcf9f8] p-5 border border-[#e0e0e0] mb-10">
              {[
                { icon: '🛡️', title: 'Verification in Progress', desc: "We're checking your business documents. This ensures all RMF sellers meet our quality standards." },
                { icon: '⏳', title: 'Timeline: Up to 24 hours', desc: "You'll receive a notification once your shop is live and ready to accept orders." },
              ].map(item => (
                <div key={item.title} className="flex gap-6">
                  <div className="w-12 h-12 bg-[#012d1d] flex items-center justify-center text-xl flex-shrink-0">{item.icon}</div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-widest text-[#1b1c1c] mb-1">{item.title}</h4>
                    <p className="text-xs text-[#414844] leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-[#414844] uppercase tracking-widest mb-6">Shop: {profile.shopDetails?.name || 'Your Shop'}</p>
              <Link href="/" className="bg-[#012d1d] text-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] hover:bg-[#1b4332] transition-all inline-block">
                Back to Homepage
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const statusColors: Record<string, string> = {
    awaiting_quote: 'bg-[#e8f5ed] text-[#1b4332] border-[#c1ecd4]',
    quote_sent: 'bg-[#edf7f1] text-[#116c4a] border-[#c1ecd4]',
    placed: 'bg-[#f7faf8] text-[#405046] border-[#dfe7e2]',
    confirmed: 'bg-green-50 text-green-700 border-green-200',
    preparing: 'bg-[#f7faf8] text-[#405046] border-[#dfe7e2]',
    ready_for_pickup: 'bg-[#e8f5ed] text-[#1b4332] border-[#c1ecd4]',
  };

  return (
    <Layout>
      <div className="animate-reveal space-y-8 pb-16">

        {/* ── Header Bar ── */}
        <div className="relative overflow-hidden rounded-lg border border-[#0b4b32]/20 bg-[#012d1d] px-6 py-6 text-white shadow-sm md:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
            <div className="absolute -right-4 top-0 text-[180px] font-sans leading-none select-none">SHOP</div>
          </div>
          <div className="relative z-10 flex-grow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.22em]">Seller Hub · {profile?.shopDetails?.category || 'General'}</p>
            </div>
            <h1 className="text-2xl md:text-4xl font-sans tracking-normal text-white">{profile?.shopDetails?.name || 'My Shop'}</h1>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">Stall: {profile?.stallId || '—'}</p>
          </div>
          <div className="relative z-10 flex flex-wrap gap-3">
            <Link href="/seller/products/new" className="rounded-md bg-[#c1ecd4] text-[#012d1d] px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] hover:bg-white transition-all">
              + Add Product
            </Link>
            <Link href="/seller/products" className="rounded-md border border-white/20 text-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] hover:bg-white/10 transition-all">
              My Products
            </Link>
            <Link href="/seller/qr" className="rounded-md border border-white/20 text-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] hover:bg-white/10 transition-all">
              🖨 QR Code
            </Link>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-6">
          {[
            { label: 'Wallet Balance', val: `${(wallet.balance || 0).toLocaleString()}`, unit: 'RWF', sub: 'Ready to withdraw', icon: 'RWF', accent: 'border-l-[#116c4a]', valColor: 'text-[#1b1c1c]', action: { label: 'Withdraw', href: '/seller/earnings' } },
            { label: 'Pending Orders', val: String(activeOrders.length), unit: '', sub: 'Needs your attention', icon: 'ORD', accent: activeOrders.length > 0 ? 'border-l-[#405046]' : 'border-l-[#116c4a]', valColor: activeOrders.length > 0 ? 'text-[#405046]' : 'text-[#116c4a]', action: { label: 'View Orders', href: '/seller/orders' } },
            { label: 'Products Listed', val: String(products.length), unit: '', sub: 'Active in your shop', icon: '🏪', accent: 'border-l-[#1b1c1c]', valColor: 'text-[#1b1c1c]', action: { label: 'Manage', href: '/seller/products' } },
            { label: 'Avg. Rating', val: ratingValue > 0 ? ratingValue.toFixed(1) : 'New', unit: ratingValue > 0 ? '/ 5' : '', sub: `${sellerStats.totalReviews || 0} customer reviews`, icon: '⭐', accent: 'border-l-[#1b4332]', valColor: 'text-[#1b4332]', action: { label: 'See Reviews', href: '/seller/reviews' } },
          ].map((stat, i) => (
            <div key={i} className={`rounded-lg bg-white border border-[#e0e0e0] border-l-4 ${stat.accent} p-5 hover:shadow-md transition-all`}>
              <div className="flex justify-between items-start mb-4">
                <p className="text-[9px] font-black text-[#414844] uppercase tracking-widest">{stat.label}</p>
                <span className="rounded bg-[#f7faf8] px-2 py-1 text-[9px] font-black text-[#1b4332]">{stat.icon}</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`text-3xl font-sans tracking-normal ${stat.valColor}`}>{stat.val}</span>
                {stat.unit && <span className="text-sm text-[#414844] font-bold">{stat.unit}</span>}
              </div>
              <p className="text-[9px] text-[#414844] uppercase tracking-widest opacity-60 mb-4">{stat.sub}</p>
              <Link href={stat.action.href} className="text-[9px] font-black text-[#1b4332] uppercase tracking-widest hover:underline">
                {stat.action.label} →
              </Link>
            </div>
          ))}
        </div>

        {/* ── Orders + Sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6">

          {/* Orders */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center border-b-2 border-[#e0e0e0] pb-4">
              <div>
                <p className="text-[9px] font-black text-[#1b4332] uppercase tracking-[0.18em] mb-1">Action Required</p>
                <h2 className="text-3xl font-sans tracking-normal text-[#1b1c1c]">Pending Orders</h2>
              </div>
              <Link href="/seller/orders" className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1b4332] hover:text-[#012d1d] border-b-2 border-transparent hover:border-[#1b4332] pb-1 transition-all">
                Full History →
              </Link>
            </div>

            {ordersLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-24 bg-[#f0eded] animate-pulse border border-[#e0e0e0]" />)}
              </div>
            ) : activeOrders.length > 0 ? (
              <div className="space-y-3">
                {activeOrders.slice(0, 8).map((order: any) => (
                  <Link href={`/seller/orders/${order._id}`} key={order._id}>
                    <div className="bg-white border border-[#e0e0e0] hover:border-[#1b4332] transition-all p-5 flex items-center gap-5 group cursor-pointer">
                      <div className="w-16 h-16 bg-[#fcf9f8] border border-[#e0e0e0] flex-shrink-0 overflow-hidden">
                        {order.products?.[0]?.imageUrl || order.products?.[0]?.images?.[0] ? (
                          <img
                            src={order.products?.[0]?.imageUrl || order.products?.[0]?.images?.[0]}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            alt=""
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[9px] font-black uppercase tracking-widest text-[#414844]">
                            Item
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[8px] font-black bg-[#012d1d] text-white px-2 py-0.5 uppercase tracking-wider">
                            #{order._id.substring(0,8).toUpperCase()}
                          </span>
                          <span className={`text-[8px] font-black px-2 py-0.5 uppercase tracking-wider border ${statusColors[order.status] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                            {order.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-base font-sans text-[#1b1c1c] truncate">{order.products?.[0]?.name || 'Order'}</p>
                        <p className="text-[9px] text-[#414844] uppercase tracking-widest opacity-60">
                          {order.products?.length || 1} item{(order.products?.length || 1) > 1 ? 's' : ''} · {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-sans text-[#1b1c1c]">{(order.financials?.totalAmount || 0).toLocaleString()}</p>
                        <p className="text-[9px] font-black text-[#1b4332] uppercase tracking-widest">RWF</p>
                      </div>
                      <span className="text-[#e0e0e0] group-hover:text-[#1b1c1c] transition-colors">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-[#f0eded] py-20 text-center bg-white">
                <div className="text-3xl mb-4">🎉</div>
                <p className="text-lg font-sans text-[#414844]">No pending orders right now</p>
                <p className="text-sm text-[#414844]/60 mt-2">New orders will appear here automatically</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Revenue */}
            <div className="rounded-lg bg-[#012d1d] text-white p-6 space-y-6">
              <div className="flex items-center gap-3 border-b border-white/10 pb-5">
                <span className="text-xl">📊</span>
                <div>
                  <p className="text-[9px] font-black text-[#c1ecd4] uppercase tracking-widest">This Month</p>
                  <h3 className="text-2xl font-sans tracking-normal">Revenue</h3>
                </div>
              </div>
              <div>
                <p className="text-3xl font-sans tracking-normal">{(sellerStats.totalRevenue || 0).toLocaleString()}</p>
                <p className="text-[9px] font-black text-[#c1ecd4] uppercase tracking-widest mt-2">RWF Earned</p>
              </div>
              <Link href="/seller/analytics" className="block text-center text-[10px] font-black uppercase tracking-widest border border-white/20 py-3 hover:bg-white/10 transition-all">
                View Analytics →
              </Link>
            </div>

            {/* Performance */}
            <div className="rounded-lg bg-white border border-[#e0e0e0] p-6 space-y-5">
              <p className="text-[9px] font-black text-[#1b1c1c] uppercase tracking-[0.18em] border-b border-[#f0eded] pb-4">Shop Performance</p>
              {[
                { label: 'Avg. Prep Time', val: sellerStats.avgPrepTime === null || sellerStats.avgPrepTime === undefined ? 'No data' : `${sellerStats.avgPrepTime} min`, color: 'text-green-600' },
                { label: 'Fulfillment Rate', val: `${sellerStats.fulfillmentRate || 0}%`, color: 'text-[#1b4332]' },
                { label: 'Repeat Buyers', val: `${sellerStats.repeatBuyerRate || 0}%`, color: 'text-[#1b4332]' },
              ].map(m => (
                <div key={m.label} className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-[#414844] uppercase tracking-widest">{m.label}</span>
                  <span className={`text-lg font-sans ${m.color}`}>{m.val}</span>
                </div>
              ))}
            </div>

            {/* Tip */}
            <div className="rounded-lg border border-[#c1ecd4] bg-[#e8f5ed] p-6 space-y-3">
              <p className="text-[9px] font-black text-[#1b4332] uppercase tracking-[0.18em]">Seller Tip</p>
              <p className="text-sm text-[#1b1c1c]/80 leading-relaxed font-medium">
                Shops with 5+ product photos get <strong>3× more clicks</strong>. Update your listings today!
              </p>
              <Link href="/seller/products" className="block text-[10px] font-black uppercase tracking-widest text-[#1b1c1c] hover:underline">
                Update Products →
              </Link>
            </div>

            {/* Quick links */}
            <div className="overflow-hidden rounded-lg bg-white border border-[#e0e0e0] divide-y divide-[#f0eded]">
              {[
                { icon: '🏷', label: 'Promotions & Discounts', href: '/seller/promotions' },
                { icon: '💵', label: 'Earnings & Withdrawals', href: '/seller/earnings' },
                { icon: '⭐', label: 'Customer Reviews', href: '/seller/reviews' },
                { icon: '📱', label: 'Stall QR Code', href: '/seller/qr' },
              ].map(link => (
                <Link key={link.href} href={link.href} className="flex items-center gap-4 px-5 py-3 hover:bg-[#fcf9f8] transition-colors group">
                  <span className="text-lg">{link.icon}</span>
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#1b1c1c] group-hover:text-[#1b4332] transition-colors flex-1">{link.label}</span>
                  <span className="text-[#D0CBC4] group-hover:text-[#1b1c1c] transition-colors">→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Analytics ── */}
        <div className="rounded-lg bg-white border border-[#e0e0e0] mx-6 p-6">
          <div className="flex justify-between items-end border-b border-[#f0eded] pb-6 mb-8">
            <div>
              <p className="text-[9px] font-black text-[#1b4332] uppercase tracking-[0.18em] mb-2">Performance</p>
              <h2 className="text-3xl font-sans tracking-normal text-[#1b1c1c]">Sales Overview</h2>
              <p className="text-[9px] text-[#414844] uppercase tracking-widest mt-1 opacity-60">Last 30 days · Updated live</p>
            </div>
            <div className="flex items-center gap-2 bg-[#fcf9f8] px-4 py-2 border border-[#e0e0e0]">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest">Live</span>
            </div>
          </div>
          <AnalyticsCharts type="seller" data={analyticsData} />
          <div className="mt-6 pt-4 border-t border-[#f0eded] flex justify-end">
            <Link href="/seller/analytics" className="text-[10px] font-black uppercase tracking-widest text-[#1b4332] hover:underline">
              View Detailed Report →
            </Link>
          </div>
        </div>

      </div>
    </Layout>
  );
}
