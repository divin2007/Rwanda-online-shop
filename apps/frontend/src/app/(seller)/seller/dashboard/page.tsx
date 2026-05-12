'use client';
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { sellerApi, adminApi, orderApi, productApi, walletApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';

const AnalyticsCharts = dynamic(() => import('@/components/ui/AnalyticsCharts').then(mod => mod.AnalyticsCharts), { ssr: false });

export default function SellerDashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role === 'BUYER') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const profileUrl = user?.id ? `/sellers/me?userId=${user.id}` : null;
  const { data: profile, loading: profileLoading, error: profileError } = useApi(sellerApi, 'get', profileUrl || '');

  const [isSettled, setIsSettled] = useState(false);
  useEffect(() => {
    if (!profileLoading) {
      const timer = setTimeout(() => setIsSettled(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setIsSettled(false);
    }
  }, [profileLoading]);

  useEffect(() => {
    if (isSettled && user?.id && !profileLoading && profile === null && user.role === 'SELLER') {
      router.push('/seller/onboarding');
    }
  }, [profile, profileLoading, user, router, isSettled]);

  const { data: productsData } = useApi(productApi, 'get', `/products?sellerId=${user?.id}`);
  const { data: ordersData, loading: ordersLoading } = useApi(orderApi, 'get', `/orders?sellerId=${user?.id}&status=awaiting_quote,quote_sent,placed,confirmed,preparing,ready_for_pickup`);
  const { data: walletData } = useApi(walletApi, 'get', `/wallets/me?userId=${user?.id}`);
  const { data: analyticsData } = useApi(adminApi, 'get', `/seller/dashboard/analytics/${user?.id}`);

  const products = productsData || [];
  const activeOrders = ordersData || [];
  const wallet = walletData || { balance: 0 };
  const analytics = analyticsData || { totalRevenue: 0, avgRating: 5 };

  if (profileError) {
    return (
      <Layout>
        <div className="p-20 text-center space-y-6">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-2xl font-serif italic">Connection Error</h2>
          <p className="text-sm text-[#6B665E] italic max-w-md mx-auto">Could not load your seller profile. Please try again.</p>
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
            <div className="w-20 h-20 border-4 border-[#F59E0B]/20 rounded-full" />
            <div className="absolute inset-0 w-20 h-20 border-4 border-t-[#F59E0B] rounded-full animate-spin" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#6B665E] opacity-60">Loading your shop...</p>
        </div>
      </Layout>
    );
  }

  if (profile && !profile.isApproved) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center p-12 animate-reveal">
          <div className="max-w-2xl w-full bg-white border-2 border-[#121212] p-16 shadow-2xl">
            <div className="h-2 bg-[#F59E0B] -mx-16 -mt-16 mb-16" />
            <div className="text-center space-y-4 mb-12">
              <p className="text-[11px] font-black text-[#F59E0B] uppercase tracking-[0.5em]">Status: Under Review</p>
              <h1 className="text-5xl font-serif italic tracking-tighter text-[#121212]">Application Received!</h1>
            </div>
            <div className="space-y-6 bg-[#F8F6F1] p-8 border border-[#E5E1D8] mb-10">
              {[
                { icon: '🛡️', title: 'Verification in Progress', desc: "We're checking your business documents. This ensures all RMF sellers meet our quality standards." },
                { icon: '⏳', title: 'Timeline: Up to 24 hours', desc: "You'll receive a notification once your shop is live and ready to accept orders." },
              ].map(item => (
                <div key={item.title} className="flex gap-6">
                  <div className="w-12 h-12 bg-[#121212] flex items-center justify-center text-xl flex-shrink-0">{item.icon}</div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-widest text-[#121212] mb-1">{item.title}</h4>
                    <p className="text-xs italic text-[#6B665E] leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-[#6B665E] uppercase tracking-widest mb-6">Shop: {profile.shopDetails?.name || 'Your Shop'}</p>
              <Link href="/" className="bg-[#121212] text-white px-10 py-4 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-[#A34D15] transition-all inline-block">
                Back to Homepage
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const statusColors: Record<string, string> = {
    awaiting_quote: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    quote_sent: 'bg-blue-100 text-blue-800 border-blue-300',
    placed: 'bg-purple-100 text-purple-800 border-purple-300',
    confirmed: 'bg-green-100 text-green-800 border-green-300',
    preparing: 'bg-orange-100 text-orange-800 border-orange-300',
    ready_for_pickup: 'bg-teal-100 text-teal-800 border-teal-300',
  };

  return (
    <Layout>
      <div className="animate-reveal space-y-8 pb-16">

        {/* ── Header Bar ── */}
        <div className="bg-[#121212] text-white px-10 py-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
            <div className="absolute -right-4 top-0 text-[180px] font-serif italic leading-none select-none">SHOP</div>
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.5em]">Seller Hub · {profile?.shopDetails?.category || 'General'}</p>
            </div>
            <h1 className="text-4xl font-serif italic tracking-tighter text-white">{profile?.shopDetails?.name || 'My Shop'}</h1>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">Stall: {profile?.stallId || '—'}</p>
          </div>
          <div className="relative z-10 flex flex-wrap gap-3">
            <Link href="/seller/products/new" className="bg-[#F59E0B] text-[#121212] px-6 py-3 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white transition-all">
              + Add Product
            </Link>
            <Link href="/seller/products" className="border border-white/20 text-white px-6 py-3 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white/10 transition-all">
              My Products
            </Link>
            <Link href="/seller/qr" className="border border-white/20 text-white px-6 py-3 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white/10 transition-all">
              🖨 QR Code
            </Link>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-6">
          {[
            { label: 'Wallet Balance', val: `${(wallet.balance || 0).toLocaleString()}`, unit: 'RWF', sub: 'Ready to withdraw', icon: '💰', accent: 'border-l-[#F59E0B]', valColor: 'text-[#121212]', action: { label: 'Withdraw', href: '/seller/earnings' } },
            { label: 'Pending Orders', val: String(activeOrders.length), unit: '', sub: 'Needs your attention', icon: '📦', accent: activeOrders.length > 0 ? 'border-l-red-500' : 'border-l-green-500', valColor: activeOrders.length > 0 ? 'text-red-600' : 'text-green-600', action: { label: 'View Orders', href: '/seller/orders' } },
            { label: 'Products Listed', val: String(products.length), unit: '', sub: 'Active in your shop', icon: '🏪', accent: 'border-l-[#121212]', valColor: 'text-[#121212]', action: { label: 'Manage', href: '/seller/products' } },
            { label: 'Avg. Rating', val: analytics.avgRating?.toFixed(1) || '5.0', unit: '/ 5', sub: 'From customer reviews', icon: '⭐', accent: 'border-l-[#A34D15]', valColor: 'text-[#A34D15]', action: { label: 'See Reviews', href: '/seller/reviews' } },
          ].map((stat, i) => (
            <div key={i} className={`bg-white border border-[#E5E1D8] border-l-4 ${stat.accent} p-6 hover:shadow-md transition-all`}>
              <div className="flex justify-between items-start mb-4">
                <p className="text-[9px] font-black text-[#6B665E] uppercase tracking-widest">{stat.label}</p>
                <span className="text-xl">{stat.icon}</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`text-3xl font-serif italic tracking-tighter ${stat.valColor}`}>{stat.val}</span>
                {stat.unit && <span className="text-sm text-[#6B665E] font-bold">{stat.unit}</span>}
              </div>
              <p className="text-[9px] text-[#6B665E] uppercase tracking-widest opacity-60 mb-4">{stat.sub}</p>
              <Link href={stat.action.href} className="text-[9px] font-black text-[#A34D15] uppercase tracking-widest hover:underline">
                {stat.action.label} →
              </Link>
            </div>
          ))}
        </div>

        {/* ── Orders + Sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6">

          {/* Orders */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center border-b-2 border-[#121212] pb-4">
              <div>
                <p className="text-[9px] font-black text-[#A34D15] uppercase tracking-[0.4em] mb-1">Action Required</p>
                <h2 className="text-3xl font-serif italic tracking-tighter text-[#121212]">Pending Orders</h2>
              </div>
              <Link href="/seller/orders" className="text-[10px] font-black uppercase tracking-[0.3em] text-[#121212] hover:text-[#F59E0B] border-b-2 border-transparent hover:border-[#F59E0B] pb-1 transition-all">
                Full History →
              </Link>
            </div>

            {ordersLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-24 bg-[#F2F0EB] animate-pulse border border-[#E5E1D8]" />)}
              </div>
            ) : activeOrders.length > 0 ? (
              <div className="space-y-3">
                {activeOrders.slice(0, 8).map((order: any) => (
                  <Link href={`/seller/orders/${order._id}`} key={order._id}>
                    <div className="bg-white border border-[#E5E1D8] hover:border-[#121212] transition-all p-5 flex items-center gap-5 group cursor-pointer">
                      <div className="w-16 h-16 bg-[#F8F6F1] border border-[#E5E1D8] flex-shrink-0 overflow-hidden">
                        <img
                          src={order.products?.[0]?.images?.[0] || 'https://placehold.co/64x64/F8F6F1/121212?text=📦'}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          alt=""
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[8px] font-black bg-[#121212] text-white px-2 py-0.5 uppercase tracking-wider">
                            #{order._id.substring(0,8).toUpperCase()}
                          </span>
                          <span className={`text-[8px] font-black px-2 py-0.5 uppercase tracking-wider border ${statusColors[order.status] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                            {order.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-base font-serif italic text-[#121212] truncate">{order.products?.[0]?.name || 'Order'}</p>
                        <p className="text-[9px] text-[#6B665E] uppercase tracking-widest opacity-60">
                          {order.products?.length || 1} item{(order.products?.length || 1) > 1 ? 's' : ''} · {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-serif italic text-[#121212]">{(order.financials?.totalAmount || 0).toLocaleString()}</p>
                        <p className="text-[9px] font-black text-[#A34D15] uppercase tracking-widest">RWF</p>
                      </div>
                      <span className="text-[#E5E1D8] group-hover:text-[#121212] transition-colors">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-[#F0EDE4] py-20 text-center bg-white">
                <div className="text-5xl mb-4">🎉</div>
                <p className="text-lg font-serif italic text-[#6B665E]">No pending orders right now</p>
                <p className="text-sm text-[#6B665E]/60 mt-2">New orders will appear here automatically</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Revenue */}
            <div className="bg-[#121212] text-white p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-white/10 pb-5">
                <span className="text-xl">📊</span>
                <div>
                  <p className="text-[9px] font-black text-[#F59E0B] uppercase tracking-widest">This Month</p>
                  <h3 className="text-2xl font-serif italic tracking-tighter">Revenue</h3>
                </div>
              </div>
              <div>
                <p className="text-5xl font-serif italic tracking-tighter">{(analytics.totalRevenue || 0).toLocaleString()}</p>
                <p className="text-[9px] font-black text-[#F59E0B] uppercase tracking-widest mt-2">RWF Earned</p>
              </div>
              <Link href="/seller/analytics" className="block text-center text-[10px] font-black uppercase tracking-widest border border-white/20 py-3 hover:bg-white/10 transition-all">
                View Analytics →
              </Link>
            </div>

            {/* Performance */}
            <div className="bg-white border border-[#E5E1D8] p-6 space-y-5">
              <p className="text-[9px] font-black text-[#121212] uppercase tracking-[0.4em] border-b border-[#F0EDE4] pb-4">Shop Performance</p>
              {[
                { label: 'Avg. Prep Time', val: '12 min', color: 'text-green-600' },
                { label: 'Fulfillment Rate', val: '98%', color: 'text-[#F59E0B]' },
                { label: 'Repeat Buyers', val: '34%', color: 'text-[#A34D15]' },
              ].map(m => (
                <div key={m.label} className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-[#6B665E] uppercase tracking-widest">{m.label}</span>
                  <span className={`text-lg font-serif italic ${m.color}`}>{m.val}</span>
                </div>
              ))}
            </div>

            {/* Tip */}
            <div className="bg-[#F59E0B] p-6 space-y-3">
              <p className="text-[9px] font-black text-[#121212] uppercase tracking-[0.4em]">💡 Seller Tip</p>
              <p className="text-sm text-[#121212]/80 leading-relaxed font-medium">
                Shops with 5+ product photos get <strong>3× more clicks</strong>. Update your listings today!
              </p>
              <Link href="/seller/products" className="block text-[10px] font-black uppercase tracking-widest text-[#121212] hover:underline">
                Update Products →
              </Link>
            </div>

            {/* Quick links */}
            <div className="bg-white border border-[#E5E1D8] divide-y divide-[#F0EDE4]">
              {[
                { icon: '🏷', label: 'Promotions & Discounts', href: '/seller/promotions' },
                { icon: '💵', label: 'Earnings & Withdrawals', href: '/seller/earnings' },
                { icon: '⭐', label: 'Customer Reviews', href: '/seller/reviews' },
                { icon: '📱', label: 'Stall QR Code', href: '/seller/qr' },
              ].map(link => (
                <Link key={link.href} href={link.href} className="flex items-center gap-4 px-5 py-4 hover:bg-[#F8F6F1] transition-colors group">
                  <span className="text-lg">{link.icon}</span>
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#121212] group-hover:text-[#A34D15] transition-colors flex-1">{link.label}</span>
                  <span className="text-[#D0CBC4] group-hover:text-[#121212] transition-colors">→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Analytics ── */}
        <div className="bg-white border border-[#E5E1D8] mx-6 p-8">
          <div className="flex justify-between items-end border-b border-[#F0EDE4] pb-6 mb-8">
            <div>
              <p className="text-[9px] font-black text-[#A34D15] uppercase tracking-[0.4em] mb-2">Performance</p>
              <h2 className="text-3xl font-serif italic tracking-tighter text-[#121212]">Sales Overview</h2>
              <p className="text-[9px] text-[#6B665E] uppercase tracking-widest mt-1 opacity-60">Last 30 days · Updated live</p>
            </div>
            <div className="flex items-center gap-2 bg-[#F8F6F1] px-4 py-2 border border-[#E5E1D8]">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest">Live</span>
            </div>
          </div>
          <AnalyticsCharts type="seller" data={analyticsData} />
          <div className="mt-6 pt-4 border-t border-[#F0EDE4] flex justify-end">
            <Link href="/seller/analytics" className="text-[10px] font-black uppercase tracking-widest text-[#A34D15] hover:underline">
              View Detailed Report →
            </Link>
          </div>
        </div>

      </div>
    </Layout>
  );
}
