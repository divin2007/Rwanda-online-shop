'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/hooks/useSocket';
import { sellerApi, orderApi, adminApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SellerDashboardPage() {
  const { user } = useAuth();
  
  const { data: profile, loading: pLoad, execute: fetchProfile } = useApi(sellerApi, 'get', `/sellers/me?userId=${user?.id}`);
  const { data: analytics, loading: aLoad, execute: fetchAnalytics } = useApi(adminApi, 'get', `/analytics/seller/${user?.id}`);
  const { data: activeOrders, loading: oLoad, execute: fetchOrders } = useApi(orderApi, 'get', `/orders?sellerId=${user?.id}&status=placed,confirmed`);
  
  // Real-time updates for orders
  const { data: socketOrder } = useSocket(process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006', 'order:seller:updates', localStorage.getItem('accessToken') || undefined);

  useEffect(() => {
    fetchProfile();
    fetchAnalytics();
    fetchOrders();
  }, [fetchProfile, fetchAnalytics, fetchOrders]);

  useEffect(() => {
    if (socketOrder) {
      // Refresh orders when a socket update comes in
      fetchOrders();
      toast('New order update!', { icon: '🔔' });
    }
  }, [socketOrder, fetchOrders]);

  const confirmPreparation = async (orderId: string) => {
    try {
      await orderApi.put(`/orders/${orderId}/status`, { status: 'confirmed', userId: user?.id });
      toast.success('Order confirmed. Rider will be notified.');
      fetchOrders();
    } catch (e) {
      toast.error('Failed to confirm order');
    }
  };

  if (pLoad || aLoad || oLoad) return <Layout><div className="flex justify-center p-20"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div></div></Layout>;
  
  if (!profile) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-20 text-center">
          <span className="text-6xl mb-4 block">👋</span>
          <h1 className="text-3xl font-bold mb-4">Welcome to Rwanda Market</h1>
          <p className="text-text-secondary mb-8">You need to complete your seller profile and upload documents before you can access the dashboard.</p>
          <Link href="/seller/onboarding">
            <Button size="lg">Complete Onboarding</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  if (profile && !profile.isApproved) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-20 text-center">
          <span className="text-6xl mb-4 block">⏳</span>
          <h1 className="text-3xl font-bold mb-4">Application Pending</h1>
          <p className="text-text-secondary">Your seller application is currently being reviewed by our team. Please check back later.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col md:flex-row min-h-screen bg-background-main">
        
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-background-card border-r border-border p-6 hidden md:block">
          <div className="mb-8">
            <h2 className="font-heading font-bold text-xl">{profile?.shopDetails?.name || 'My Shop'}</h2>
            <p className="text-sm text-text-secondary">Stall: {profile?.stallId}</p>
          </div>
          <nav className="space-y-2">
            <Link href="/seller/dashboard" className="block px-4 py-2 bg-primary/10 text-primary font-bold rounded-lg">Dashboard</Link>
            <Link href="/seller/products" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Products</Link>
            <Link href="/seller/promotions" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Promotions</Link>
            <Link href="/seller/earnings" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Earnings</Link>
            <button className="block w-full text-left px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Print QR Code</button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-heading font-bold text-text-primary">Dashboard Overview</h1>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <p className="text-sm text-text-secondary mb-1">Sales Today</p>
              <p className="text-2xl font-bold text-primary">{analytics?.salesToday?.toLocaleString() || 0} RWF</p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary mb-1">Pending Orders</p>
              <p className="text-2xl font-bold">{activeOrders?.filter((o:any) => o.status === 'placed').length || 0}</p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary mb-1">Avg. Prep Time</p>
              <p className="text-2xl font-bold">{analytics?.avgPrepTime || '12'} mins</p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary mb-1">Customer Rating</p>
              <p className="text-2xl font-bold text-status-warning">⭐ {profile?.rating || 'New'}</p>
            </Card>
          </div>

          {/* Active Orders */}
          <Card noPadding>
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-bold">Active Orders</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-background-surface text-text-secondary text-sm">
                  <tr>
                    <th className="p-4 font-medium">Order ID</th>
                    <th className="p-4 font-medium">Buyer</th>
                    <th className="p-4 font-medium">Product</th>
                    <th className="p-4 font-medium">Qty</th>
                    <th className="p-4 font-medium">Total</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {!activeOrders || activeOrders.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-text-secondary">No active orders right now.</td></tr>
                  ) : (
                    activeOrders.map((order: any) => (
                      <tr key={order._id} className="hover:bg-background-surface/50">
                        <td className="p-4 font-medium">#{order._id.substring(0,6).toUpperCase()}</td>
                        <td className="p-4">{order.buyer?.fullName || 'Customer'}</td>
                        <td className="p-4">{order.product?.name || 'Unknown Product'}</td>
                        <td className="p-4">{order.product?.quantity || 1}</td>
                        <td className="p-4 font-bold">{order.financials?.totalAmount?.toLocaleString()} RWF</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${order.status === 'placed' ? 'bg-status-warning/10 text-status-warning' : 'bg-status-info/10 text-status-info'}`}>
                            {order.status === 'placed' ? 'New' : 'Rider Assigned'}
                          </span>
                        </td>
                        <td className="p-4">
                          {order.status === 'placed' && (
                            <Button size="sm" onClick={() => confirmPreparation(order._id)}>Confirm Prep</Button>
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
      </div>
    </Layout>
  );
}
