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
import { resolveUploadUrl } from '@/lib/uploadUrls';
import { SellerDashboardPanels } from '@/components/seller/SellerDashboardPanels';

const AnalyticsCharts = dynamic(() => import('@/components/ui/AnalyticsCharts').then(mod => mod.AnalyticsCharts), { ssr: false });
const SELLER_DASHBOARD_REFRESH_MS = 10000;

export default function SellerDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [vacationMode, setVacationMode] = useState(false);

  useEffect(() => {
    if (user && user.role === 'BUYER') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const profileUrl = user?.id ? `/sellers/me?userId=${user.id}` : null;
  const { data: profile, loading: profileLoading, error: profileError } = useApi(sellerApi, 'get', profileUrl || '');

  const { data: productsData } = useApi(productApi, 'get', `/products?sellerId=${user?.id}`);
  const { data: ordersData, loading: ordersLoading, execute: fetchOrders } = useApi(orderApi, 'get', user?.id ? `/orders?sellerId=${user.id}&status=awaiting_quote,quote_sent,placed,confirmed,preparing,ready_for_pickup,picked_up,in_transit,awaiting_confirmation` : '', { refreshInterval: SELLER_DASHBOARD_REFRESH_MS });
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
  const wallet = walletData || { balance: 0, availableBalance: 0, pendingBalance: 0, totalEarned: 0 };
  const sellerStats = sellerSummary || {
    totalRevenue: 0,
    avgRating: profile?.rating || 0,
    fulfillmentRate: 0,
    repeatBuyerRate: 0,
    avgPrepTime: null,
    totalReviews: 0,
  };
  const ratingValue = Number(sellerStats.avgRating || 0);
  const availableBalance = Number(wallet.availableBalance ?? wallet.balance ?? 0);
  const pendingBalance = Number(wallet.pendingBalance ?? 0);
  const totalEarned = Number(sellerStats.totalRevenue ?? wallet.totalEarned ?? availableBalance);
  const fulfillmentRate = Number(sellerStats.fulfillmentRate || 0);
  const avgPrepTime = sellerStats.avgPrepTime == null ? null : Number(sellerStats.avgPrepTime);

  if (profileError) {
    return (
      <Layout>
        <div className="p-20 text-center space-y-md font-body-md bg-surface-container-low rounded-lg border border-outline-variant max-w-2xl mx-auto mt-xl">
          <span className="material-symbols-outlined text-primary text-4xl">error</span>
          <h2 className="font-headline-md text-headline-md text-on-surface">Connection Error</h2>
          <p className="text-on-surface-variant text-body-md">Could not load your seller profile. Please check your network connection and try again.</p>
          <button onClick={() => window.location.reload()} className="bg-primary-container text-on-primary font-label-caps text-label-caps px-6 py-2.5 rounded hover:bg-primary transition-colors">Retry</button>
        </div>
      </Layout>
    );
  }

  if (profileLoading || (profile === null && !profileError)) {
    return (
      <Layout>
        <div className="p-20 text-center flex flex-col items-center justify-center space-y-lg min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-outline-variant border-t-primary rounded-full animate-spin"></div>
          <p className="font-label-caps text-label-caps text-on-surface-variant">Loading your shop...</p>
        </div>
      </Layout>
    );
  }

  if (profile && !profile.isApproved) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center p-md lg:p-lg">
          <div className="max-w-xl w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-xl shadow-[0_8px_30px_rgba(27,28,28,0.03)] space-y-lg">
            <div className="text-center space-y-sm">
              <span className="font-label-caps text-label-caps text-primary border border-outline-variant rounded-full px-3 py-1 bg-surface-container-low inline-block">Under Review</span>
              <h1 className="font-headline-lg text-headline-lg text-on-surface">Application Received!</h1>
              <p className="text-body-md text-on-surface-variant mt-unit">Stall ID: {profile?.stallId || 'KN-294'}</p>
            </div>
            
            <div className="space-y-md bg-surface-container-low p-md border border-outline-variant rounded">
              <div className="flex gap-md">
                <span className="material-symbols-outlined text-primary text-[24px] shrink-0">shield_person</span>
                <div>
                  <h4 className="font-label-caps text-label-caps text-on-surface mb-unit">Verification in Progress</h4>
                  <p className="text-body-md text-sm text-on-surface-variant">We are checking your business documents and coordinates. This ensures all RMF sellers meet our quality standards.</p>
                </div>
              </div>
              <div className="flex gap-md pt-md border-t border-outline-variant">
                <span className="material-symbols-outlined text-primary text-[24px] shrink-0">schedule</span>
                <div>
                  <h4 className="font-label-caps text-label-caps text-on-surface mb-unit">Timeline: Up to 24 hours</h4>
                  <p className="text-body-md text-sm text-on-surface-variant">You will receive a dashboard notification once your shop is approved and ready to accept live wholesale or retail trades.</p>
                </div>
              </div>
            </div>
            
            <div className="text-center pt-md border-t border-outline-variant">
              <p className="font-label-caps text-label-caps text-on-surface mb-md">Shop: {profile?.shopDetails?.name || 'Your Shop'}</p>
              <Link href="/" className="bg-primary-container text-on-primary px-6 py-2.5 rounded font-label-caps text-label-caps hover:bg-primary transition-colors inline-block">
                Back to Homepage
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const getOrderStatusDisplay = (status: string) => {
    switch (status) {
      case 'awaiting_quote': return { label: 'RFQ', color: 'bg-surface-variant text-on-surface border-outline-variant' };
      case 'quote_sent': return { label: 'QUOTE SENT', color: 'bg-surface-container-low text-on-surface-variant border-outline-variant' };
      case 'placed': return { label: 'PLACED', color: 'bg-primary-fixed-dim/20 text-primary border-outline-variant' };
      case 'preparing': return { label: 'PREPARING', color: 'bg-tertiary-fixed/40 text-on-surface border-outline-variant' };
      case 'ready_for_pickup': return { label: 'READY PICKUP', color: 'bg-primary-container/20 text-primary border-outline-variant' };
      case 'in_transit': return { label: 'IN TRANSIT', color: 'bg-primary-container/10 text-primary border-outline-variant' };
      default: return { label: status.toUpperCase().replace(/_/g, ' '), color: 'bg-surface text-on-surface-variant border-outline-variant' };
    }
  };

  return (
    <Layout>
      <div className="p-gutter md:p-xl space-y-lg bg-background min-h-screen">
        
        {/* Welcome & Context Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-md mb-xl">
          <div>
            <div className="flex items-center gap-xs mb-xs">
              <span className="font-label-caps text-[10px] text-primary border border-outline-variant rounded-full px-2 py-0.5 bg-surface-container-lowest">
                Stall: {profile?.stallId || 'KN-294'}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
              <span className="font-label-caps text-[10px] text-on-surface-variant">Approved Stall</span>
            </div>
            <h2 className="font-display-lg text-headline-lg md:text-display-lg font-bold text-on-surface">
              {profile?.shopDetails?.name || 'Kigali Fresh Produce'}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-unit">Dashboard Overview - Today</p>
          </div>
          <div className="flex gap-sm">
            <button className="bg-surface-container-lowest border border-outline font-label-caps text-label-caps text-on-surface px-md py-sm rounded hover:border-outline-variant transition-colors shadow-sm">
              Export Report
            </button>
            <Link href="/seller/products/new" className="bg-primary-container text-on-primary font-label-caps text-label-caps rounded py-sm px-md flex items-center justify-center gap-sm hover:bg-primary transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[20px]">add</span>
              Add Product
            </Link>
          </div>
        </div>

        {/* Bento Grid KPIs Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
          {/* Revenue Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md shadow-[0_8px_30px_rgba(27,28,28,0.03)] hover:border-outline transition-colors flex flex-col justify-between h-32 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary-fixed/20 rounded-full blur-xl group-hover:bg-primary-fixed/30 transition-all"></div>
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">Est. Revenue (30d)</p>
            <div>
              <p className="font-data-mono text-[24px] font-bold text-on-surface leading-tight">
                RWF {totalEarned.toLocaleString()}
              </p>
              <p className="font-data-mono-sm text-data-mono-sm text-tertiary flex items-center gap-unit mt-unit">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> +12% from last month
              </p>
            </div>
          </div>
          
          {/* Active Listings Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md shadow-[0_8px_30px_rgba(27,28,28,0.03)] hover:border-outline transition-colors flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">Active Listings</p>
              <span className="material-symbols-outlined text-outline">inventory_2</span>
            </div>
            <div>
              <p className="font-headline-md text-headline-md font-bold text-on-surface">{products.length}</p>
              <p className="font-body-md text-sm text-on-surface-variant mt-unit">
                {products.length === 0 ? 'No products active' : 'All items verified'}
              </p>
            </div>
          </div>
          
          {/* Pending Orders Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md shadow-[0_8px_30px_rgba(27,28,28,0.03)] hover:border-outline transition-colors flex flex-col justify-between h-32 relative">
            <div className="flex justify-between items-start">
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">Pending Orders</p>
              <div className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></div>
            </div>
            <div>
              <p className="font-headline-md text-headline-md font-bold text-on-surface">{activeOrders.length}</p>
              <p className="font-body-md text-sm text-on-surface-variant mt-unit">Needs active trade response</p>
            </div>
          </div>
          
          {/* Shop Rating Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md shadow-[0_8px_30px_rgba(27,28,28,0.03)] hover:border-outline transition-colors flex flex-col justify-between h-32">
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">Shop Rating</p>
            <div className="flex items-end gap-sm">
              <p className="font-headline-md text-headline-md font-bold text-on-surface">
                {ratingValue > 0 ? ratingValue.toFixed(1) : 'New'}
              </p>
              <div className="flex text-primary-container pb-unit">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="material-symbols-outlined">star_half</span>
              </div>
            </div>
            <p className="font-body-md text-sm text-on-surface-variant">({Number(sellerStats.totalReviews || 0)} reviews)</p>
          </div>
        </div>

        {/* Tier, freshness check-in and export settings (Features 11, 12, 9) */}
        <SellerDashboardPanels sellerId={profile?._id} />

        {/* Action Queue and Side settlements panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-md mt-lg">

          {/* Main Action Area: Pending Orders Table */}
          <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-lg flex flex-col shadow-[0_8px_30px_rgba(27,28,28,0.03)] overflow-hidden">
            <div className="p-md border-b border-outline-variant flex justify-between items-center bg-surface/50">
              <h3 className="font-label-caps text-label-caps font-bold text-on-surface uppercase">Action Queue: Pending Orders</h3>
              <span className="bg-outline-variant/30 text-on-surface font-data-mono-sm px-2 py-0.5 rounded">
                {activeOrders.length} Total
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low/50 border-b border-outline-variant">
                  <tr>
                    <th className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold py-3 px-md">Order Ref</th>
                    <th className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold py-3 px-md">Items</th>
                    <th className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold py-3 px-md">Value</th>
                    <th className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold py-3 px-md">Status</th>
                    <th className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold py-3 px-md text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="font-body-md text-sm divide-y divide-outline-variant/30">
                  {ordersLoading ? (
                    <tr>
                      <td colSpan={5} className="p-md text-center">
                        <div className="w-6 h-6 border-2 border-outline-variant border-t-primary rounded-full animate-spin mx-auto"></div>
                      </td>
                    </tr>
                  ) : activeOrders.length > 0 ? (
                    activeOrders.map((order: any) => {
                      const display = getOrderStatusDisplay(order.status);
                      return (
                        <tr key={order._id} className="hover:bg-surface-container-low transition-colors cursor-default">
                          <td className="font-data-mono text-on-surface py-3 px-md">#{order._id.substring(0, 8).toUpperCase()}</td>
                          <td className="text-on-surface-variant py-3 px-md max-w-[180px] truncate">
                            {order.products?.[0]?.name || 'Market Goods'} 
                            {order.products?.length > 1 && ` (+${order.products.length - 1} items)`}
                          </td>
                          <td className="font-data-mono text-on-surface py-3 px-md">
                            RWF {(order.financials?.totalAmount || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-md">
                            <span className={`inline-flex items-center gap-1 font-label-caps text-[10px] px-2 py-0.5 rounded border ${display.color}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                              {display.label}
                            </span>
                          </td>
                          <td className="py-3 px-md text-right">
                            <Link 
                              href={`/seller/orders/${order._id}`}
                              className="bg-surface border border-outline text-on-surface font-label-caps text-[11px] px-3 py-1.5 rounded hover:border-outline-variant transition-colors inline-block"
                            >
                              Manage Trade
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-lg text-center text-on-surface-variant">
                        No active seller orders.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-sm text-center border-t border-outline-variant bg-surface-container-low/30">
              <Link className="font-label-caps text-label-caps text-primary hover:underline font-bold" href="/seller/orders">
                View all orders queue →
              </Link>
            </div>
          </div>

          {/* Side Panel: Settlements & Fulfillment Metrics */}
          <div className="flex flex-col gap-md">
            
            {/* MTN MoMo Settlement Ledger Accounting Summary */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md shadow-[0_8px_30px_rgba(27,28,28,0.03)] space-y-md">
              <div className="flex justify-between items-center mb-xs pb-xs border-b border-outline-variant">
                <h3 className="font-label-caps text-label-caps font-bold text-on-surface uppercase flex items-center gap-sm">
                  <span className="material-symbols-outlined text-[20px] text-primary">account_balance</span>
                  MTN MoMo Settlements
                </h3>
              </div>
              
              <div className="space-y-sm">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-body-md text-on-surface-variant">Available Payout</span>
                  <span className="font-data-mono font-bold text-on-surface">RWF {availableBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-body-md text-on-surface-variant">Pending Escrow</span>
                  <span className="font-data-mono text-on-surface-variant">RWF {pendingBalance.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="mt-md pt-sm border-t border-outline-variant border-dashed">
                <Link className="font-label-caps text-label-caps text-primary flex items-center justify-center gap-unit hover:text-primary-container transition-colors font-bold" href="/seller/earnings">
                  View Accounting Ledger <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Shop Fulfillment Metrics */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md shadow-[0_8px_30px_rgba(27,28,28,0.03)] flex-1 space-y-sm">
              <h3 className="font-label-caps text-label-caps font-bold text-on-surface uppercase border-b border-outline-variant pb-xs">Fulfillment Metrics</h3>
              <div className="space-y-md pt-xs">
                <div>
                  <div className="flex justify-between items-end mb-unit">
                    <span className="font-label-caps text-[10px] text-on-surface-variant">Avg. Prep Time</span>
                    <span className="font-data-mono-sm text-on-surface">{avgPrepTime == null ? 'No data' : `${avgPrepTime} mins`}</span>
                  </div>
                  <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                    <div className="bg-outline h-1.5 rounded-full" style={{ width: '45%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-end mb-unit">
                    <span className="font-label-caps text-[10px] text-on-surface-variant">Fulfillment Rate</span>
                    <span className="font-data-mono-sm text-on-surface">{fulfillmentRate}%</span>
                  </div>
                  <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                    <div className="bg-primary-container h-1.5 rounded-full animate-pulse" style={{ width: `${Math.max(0, Math.min(100, fulfillmentRate))}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>

        {/* Live Sales Overview Chart */}
        <div className="rounded-lg bg-surface-container-lowest border border-outline-variant p-md shadow-[0_8px_30px_rgba(27,28,28,0.03)]">
          <div className="flex justify-between items-end border-b border-outline-variant pb-sm mb-md">
            <div>
              <p className="font-label-caps text-[10px] text-primary uppercase mb-unit">Telemetry Performance Node</p>
              <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Sales Overview</h2>
            </div>
            <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1 border border-outline-variant rounded">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
              <span className="font-label-caps text-[10px] text-on-surface-variant">Live Feed</span>
            </div>
          </div>
          
          <div className="p-sm">
            <AnalyticsCharts type="seller" data={analyticsData} />
          </div>
          
          <div className="mt-md pt-sm border-t border-outline-variant flex justify-end">
            <Link href="/seller/analytics" className="font-label-caps text-label-caps text-primary hover:underline font-bold">
              View Detailed Analytics →
            </Link>
          </div>
        </div>

      </div>
    </Layout>
  );
}
