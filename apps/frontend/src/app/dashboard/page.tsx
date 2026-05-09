'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ReceiptView, type ReceiptOrder } from '@/components/ui/ReceiptView';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { orderApi, walletApi, deliveryApi } from '@/lib/api';
import Link from 'next/link';

export default function BuyerDashboardPage() {
  const { user } = useAuth();
  const { data: orders, loading: oLoad, execute: fetchOrders } = useApi(orderApi, 'get', `/orders?buyerId=${user?.id}`);
  const { data: wallet, execute: fetchWallet } = useApi(walletApi, 'get', '/wallets/me');
  const [selectedOrder, setSelectedOrder] = useState<ReceiptOrder | null>(null);
  const [deliveryCache, setDeliveryCache] = useState<Record<string, any>>({});

  const hasFetched = useRef(false);
  useEffect(() => {
    if (user?.id && !hasFetched.current) {
      fetchOrders();
      fetchWallet();
      hasFetched.current = true;
    }
  }, [user?.id, fetchOrders, fetchWallet]);

  // Fetch delivery data for receipt views
  useEffect(() => {
    if (!orders || !Array.isArray(orders)) return;
    
    orders.forEach((order: any) => {
      if (order.deliveryId && !deliveryCache[order.deliveryId]) {
        deliveryApi.get(`/deliveries/${order.deliveryId}`)
          .then(res => {
            if (res.data?.data) {
              setDeliveryCache(prev => ({ ...prev, [order.deliveryId]: res.data.data }));
            }
          })
          .catch(() => {});
      }
    });
  }, [orders]); // Only depend on orders, not deliveryCache itself

  const openReceipt = (order: any) => {
    const delivery = order.deliveryId ? deliveryCache[order.deliveryId] : null;
    setSelectedOrder({
      ...order,
      delivery: delivery ? { rider: delivery.rider, status: delivery.status, route: delivery.route } : undefined,
    });
  };

  const activeOrders = orders?.filter((o: any) => o.status !== 'delivered' && o.status !== 'cancelled') || [];
  const recentOrders = orders?.slice(0, 5) || [];

  return (
    <Layout>
      {selectedOrder && (
        <ReceiptView order={selectedOrder} role="buyer" onClose={() => setSelectedOrder(null)} />
      )}

      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold text-text-primary">Welcome back, {user?.fullName || 'Shopper'}!</h1>
            <p className="text-text-secondary">Manage your orders and account settings.</p>
          </div>
          <div className="flex gap-3">
             <Link href="/orders">
               <Button variant="outline">View All Orders</Button>
             </Link>
             <Link href="/">
               <Button>Continue Shopping</Button>
             </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Wallet Summary */}
          <Card className="bg-primary text-white md:col-span-1 shadow-xl">
            <p className="text-primary-foreground/80 text-sm mb-1 font-medium">My Wallet Balance</p>
            <h2 className="text-3xl font-bold mb-4 tracking-tight">{wallet?.balance?.toLocaleString() || 0} RWF</h2>
            <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 w-full font-bold">Top Up Wallet</Button>
          </Card>

          {/* Activity Overview */}
          <Card className="md:col-span-2 bg-background-card border-border">
            <h3 className="font-bold mb-6 text-text-primary uppercase text-xs tracking-widest">Platform Activity</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="p-4 rounded-xl bg-background-surface">
                <p className="text-3xl font-black text-primary">{orders?.length || 0}</p>
                <p className="text-[10px] font-bold text-text-secondary uppercase mt-1">Total Orders</p>
              </div>
              <div className="p-4 rounded-xl bg-status-info/5">
                <p className="text-3xl font-black text-status-info">{activeOrders.length}</p>
                <p className="text-[10px] font-bold text-text-secondary uppercase mt-1">In Progress</p>
              </div>
              <div className="p-4 rounded-xl bg-status-success/5">
                <p className="text-3xl font-black text-status-success">{orders?.filter((o:any) => o.status === 'delivered').length || 0}</p>
                <p className="text-[10px] font-bold text-text-secondary uppercase mt-1">Delivered</p>
              </div>
              <div className="p-4 rounded-xl bg-status-warning/5">
                <p className="text-3xl font-black text-status-warning">0</p>
                <p className="text-[10px] font-bold text-text-secondary uppercase mt-1">My Vouchers</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Active Deliveries */}
          <div>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-text-primary">
              <span className="w-2 h-2 bg-status-info rounded-full animate-pulse"></span>
              Live Delivery Tracking
            </h3>
            <div className="space-y-4">
              {activeOrders.length === 0 ? (
                <Card className="text-center py-12 text-text-secondary italic border-dashed border-2 border-border bg-transparent">
                  <p>No active deliveries right now.</p>
                  <p className="text-xs not-italic mt-1">Your orders will appear here once they are processed.</p>
                </Card>
              ) : (
                activeOrders.map((order: any) => (
                  <Card key={order._id} className="hover:border-primary hover:shadow-lg transition-all duration-300">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-lg">#{order._id.substring(0,8).toUpperCase()}</p>
                        <p className="text-sm text-text-secondary">
                          {order.products?.length
                            ? `${order.products.length} product(s)`
                            : order.product?.name || 'Market Purchase'}
                        </p>
                      </div>
                      <span className="bg-status-info/10 text-status-info text-xs font-black px-3 py-1 rounded-full uppercase tracking-tight">
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/orders/${order._id}/tracking`} className="flex-1">
                        <Button size="sm" fullWidth variant="outline" className="border-primary/20 hover:border-primary text-primary">Track on Live Map</Button>
                      </Link>
                      <Button size="sm" variant="outline" onClick={() => openReceipt(order)}>🧾 Receipt</Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Recent Orders */}
          <div>
            <h3 className="text-xl font-bold mb-4 text-text-primary">Recent Purchase History</h3>
            <Card noPadding className="overflow-hidden border-border">
              <div className="divide-y divide-border">
                {recentOrders.length === 0 ? (
                  <div className="p-12 text-center text-text-secondary italic">No purchase history found.</div>
                ) : (
                  recentOrders.map((order: any) => (
                    <div key={order._id} className="p-4 flex items-center justify-between hover:bg-background-surface transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-background-main rounded-xl flex items-center justify-center text-xl shadow-inner">🛍️</div>
                        <div>
                          <p className="font-bold text-text-primary">Order #{order._id.substring(0,8).toUpperCase()}</p>
                          <p className="text-xs text-text-secondary font-medium">{new Date(order.createdAt).toLocaleDateString()} • {order.products?.length || 1} items</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          <p className="font-bold text-primary">{order.financials?.totalAmount?.toLocaleString() || 0} RWF</p>
                          <p className={`text-[10px] font-bold uppercase ${order.status === 'delivered' ? 'text-status-success' : 'text-text-secondary'}`}>{order.status}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openReceipt(order)}>🧾</Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {recentOrders.length > 0 && (
                <div className="p-4 text-center bg-background-surface/50 border-t border-border">
                  <Link href="/orders" className="text-sm text-primary font-bold hover:underline flex items-center justify-center gap-1">
                    View Complete History <span className="text-lg">→</span>
                  </Link>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
