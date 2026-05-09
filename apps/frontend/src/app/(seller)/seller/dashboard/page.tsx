'use client';
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ReceiptView, type ReceiptOrder } from '@/components/ui/ReceiptView';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/hooks/useSocket';
import { sellerApi, orderApi, adminApi, deliveryApi } from '@/lib/api';
import toast from 'react-hot-toast';

const RiderMap = dynamic(
  () => import('@/components/ui/RiderMap').then((mod) => mod.RiderMap),
  { ssr: false, loading: () => <div className="w-full h-48 bg-background-surface animate-pulse"></div> }
);

export default function SellerDashboardPage() {
  const { user } = useAuth();
  const [showNearbyRiders, setShowNearbyRiders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ReceiptOrder | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [deliveryCache, setDeliveryCache] = useState<Record<string, any>>({});

  const { data: profile, loading: pLoad, execute: fetchProfile } = useApi(sellerApi, 'get', `/sellers/me?userId=${user?.id}`);
  const { data: analytics, loading: aLoad, execute: fetchAnalytics } = useApi(adminApi, 'get', `/analytics/seller/${user?.id}`);
  const { data: activeOrders, loading: oLoad, execute: fetchOrders } = useApi(orderApi, 'get', `/orders?sellerId=${user?.id}&status=awaiting_quote,quote_sent,placed,confirmed,preparing,ready_for_pickup,picked_up,in_transit,awaiting_confirmation,delivered`, { refreshInterval: 5000 });

  // Real-time updates for orders
  const { data: socketOrder } = useSocket(process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006', 'order:seller:updates', localStorage.getItem('accessToken') || undefined);

  const hasFetched = useRef(false);
  useEffect(() => {
    if (user?.id && !hasFetched.current) {
      fetchProfile();
      fetchAnalytics();
      fetchOrders();
      hasFetched.current = true;
    }
  }, [user?.id, fetchProfile, fetchAnalytics, fetchOrders]);

  useEffect(() => {
    if (socketOrder) {
      fetchOrders();
      toast('New order update!', { icon: '🔔' });
    }
  }, [socketOrder, fetchOrders]);

  // Fetch delivery data for orders that have deliveryId
  useEffect(() => {
    if (!activeOrders || !Array.isArray(activeOrders)) return;
    
    activeOrders.forEach((order: any) => {
      if (order.deliveryId && !deliveryCache[order.deliveryId]) {
        // Only fetch if not already in cache
        deliveryApi.get(`/deliveries/${order.deliveryId}`)
          .then(res => {
            if (res.data?.data) {
              setDeliveryCache(prev => ({ ...prev, [order.deliveryId]: res.data.data }));
            }
          })
          .catch(() => {});
      }
    });
  }, [activeOrders]); // Only depend on activeOrders 

  const updateStatus = async (orderId: string, status: string) => {
    try {
      await orderApi.put(`/orders/${orderId}/status`, { status, userId: user?.id });
      toast.success(`Order updated to ${status.replace(/_/g, ' ')}`);
      fetchOrders();
    } catch (e) {
      toast.error('Failed to update order');
    }
  };

  const confirmHandover = async (deliveryId: string) => {
    try {
      await deliveryApi.post(`/deliveries/${deliveryId}/handover`, { role: 'seller' });
      toast.success('Handover confirmed! Waiting for rider to confirm receipt.');
      fetchOrders();
    } catch (e) {
      toast.error('Failed to confirm handover');
    }
  };

  // Compute totals across all products
  const totalItems = (order: any) => {
    if (order.products?.length) {
      return order.products.reduce((s: number, p: any) => s + p.quantity, 0);
    }
    return order.product?.quantity || 0;
  };

  const productSummary = (order: any) => {
    const items = order.products || (order.product ? [order.product] : []);
    if (items.length === 0) return 'No products';
    const first = items[0];
    const firstName = first.name || 'Unknown';
    const firstQty = first.quantity || 1;
    
    if (items.length === 1) {
      return firstQty > 1 ? `${firstQty}x ${firstName}` : firstName;
    }
    return `${firstQty > 1 ? `${firstQty}x ` : ''}${firstName} +${items.length - 1} more`;
  };

  const openReceipt = (order: any, delivery?: any) => {
    setSelectedOrder({
      ...order,
      delivery: delivery ? {
        rider: delivery.rider,
        status: delivery.status,
        route: delivery.route,
      } : undefined,
    });
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
      {selectedOrder && (
        <ReceiptView order={selectedOrder} role="seller" onClose={() => setSelectedOrder(null)} />
      )}

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
            <a href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=marketrwanda:stall:${profile?.stallId}`} target="_blank" rel="noreferrer" className="block w-full text-left px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Print QR Code</a>
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
          <Card noPadding className="mb-8">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold">Active Orders</h2>
              <Button variant="outline" size="sm" onClick={() => setShowNearbyRiders(!showNearbyRiders)}>
                {showNearbyRiders ? 'Hide Nearby Riders' : 'View Nearby Riders'}
              </Button>
            </div>

            {showNearbyRiders && (
              <div className="h-64 w-full border-b border-border">
                <RiderMap marketId={profile?.marketId || 'default'} marketName={profile?.shopDetails?.name} />
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-background-surface text-text-secondary text-sm">
                  <tr>
                    <th className="p-4 font-medium">Order ID</th>
                    <th className="p-4 font-medium">Buyer</th>
                    <th className="p-4 font-medium">Products</th>
                    <th className="p-4 font-medium">Items</th>
                    <th className="p-4 font-medium">Total</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Receipt</th>
                    <th className="p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {!activeOrders || activeOrders.length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-text-secondary">No active orders right now.</td></tr>
                  ) : (
                    activeOrders.map((order: any) => {
                      const delivery = order.deliveryId ? deliveryCache[order.deliveryId] : null;
                      return (
                        <React.Fragment key={order._id}>
                          <tr className="hover:bg-background-surface/50">
                            <td className="p-4 font-medium">#{order._id.substring(0,6).toUpperCase()}</td>
                            <td className="p-4">
                              <div>
                                <p className="font-medium">{order.buyer?.fullName || 'Customer'}</p>
                                <p className="text-xs text-text-secondary">{order.buyer?.phone || ''}</p>
                              </div>
                            </td>
                            <td className="p-4">
                              <button
                                onClick={() => setExpandedOrderId(expandedOrderId === order._id ? null : order._id)}
                                className="text-left hover:text-primary transition-colors"
                              >
                                <p className="font-medium">{productSummary(order)}</p>
                                <p className="text-xs text-text-secondary mt-0.5">
                                  {order.products?.length || (order.product ? 1 : 0)} product type(s)
                                  <span className="ml-1">{expandedOrderId === order._id ? '▲' : '▼'}</span>
                                </p>
                              </button>
                            </td>
                            <td className="p-4">
                              <span className="inline-flex items-center justify-center bg-gray-100 rounded-lg px-3 py-1 font-bold">
                                {totalItems(order)}
                              </span>
                            </td>
                            <td className="p-4 font-bold">{order.financials?.totalAmount?.toLocaleString()} RWF</td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                order.status === 'awaiting_quote' ? 'bg-amber-600 text-white animate-pulse' :
                                order.status === 'quote_sent' ? 'bg-purple-600/10 text-purple-700' :
                                order.status === 'placed' && order.attributes?.isQuoteRequest === 'true' && order.financials.totalAmount === 0 ? 'bg-amber-600 text-white animate-pulse' :
                                order.status === 'placed' ? 'bg-status-warning/10 text-status-warning' :
                                order.status === 'confirmed' ? 'bg-status-info/10 text-status-info' :
                                order.status === 'picked_up' ? 'bg-primary/10 text-primary' :
                                order.status === 'in_transit' ? 'bg-primary/10 text-primary animate-pulse' :
                                order.status === 'awaiting_confirmation' ? 'bg-status-info/20 text-status-info border border-status-info/30' :
                                order.status === 'delivered' ? 'bg-status-success/10 text-status-success' :
                                order.status === 'disputed' ? 'bg-status-error/10 text-status-error' :
                                'bg-background-surface text-text-secondary'
                              }`}>
                                {order.status === 'awaiting_quote' ? '💬 QUOTE REQUESTED' :
                                 order.status === 'quote_sent' ? '📋 QUOTE SENT' :
                                 order.status === 'placed' && order.attributes?.isQuoteRequest === 'true' && order.financials.totalAmount === 0 ? 'QUOTE REQUESTED' :
                                 order.status === 'placed' ? 'New' :
                                 order.status === 'confirmed' ? 'Confirmed' :
                                 order.status === 'preparing' ? 'Preparing' :
                                 order.status === 'ready_for_pickup' ? 'Ready' :
                                 order.status === 'picked_up' ? 'In Transit' :
                                 order.status === 'in_transit' ? 'In Transit' :
                                 order.status === 'awaiting_confirmation' ? 'Buyer Confirming' :
                                 order.status === 'delivered' ? 'Completed' :
                                 order.status === 'disputed' ? 'Disputed' :
                                 order.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-4">
                              <Button size="sm" variant="outline" onClick={() => openReceipt(order, delivery)}>
                                {(order.status === 'awaiting_quote' || order.status === 'quote_sent' || order.financials.totalAmount === 0) ? '💬 Negotiate & Quote' : '🧾 Receipt'}
                              </Button>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1.5">
                                {(order.status === 'awaiting_quote' || order.status === 'quote_sent' || (order.status === 'placed' && order.attributes?.isQuoteRequest === 'true' && order.financials.totalAmount === 0)) ? (
                                  <Link href={`/seller/orders/${order._id}`}>
                                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700" fullWidth>
                                      {order.status === 'awaiting_quote' ? '💬 Respond with Quote' : order.status === 'quote_sent' ? '📋 View Negotiation' : 'Respond with Quote'}
                                    </Button>
                                  </Link>
                                ) : (
                                  <Link href={`/seller/orders/${order._id}`}>
                                    <Button size="sm" variant="outline" fullWidth>View Details</Button>
                                  </Link>
                                )}
                                
                                {order.status === 'confirmed' && (
                                  <Button size="sm" onClick={() => updateStatus(order._id, 'preparing')}>Start Prep</Button>
                                )}
                                {order.status === 'preparing' && (
                                  <Button size="sm" onClick={() => updateStatus(order._id, 'ready_for_pickup')}>Ready</Button>
                                )}
                                {order.status === 'ready_for_pickup' && order.deliveryId && (
                                  <div className="flex flex-col gap-1">
                                    <Button size="sm" variant="outline" onClick={() => confirmHandover(order.deliveryId)}>
                                      {order.handoverConfirmedBySeller ? 'Waiting for Rider...' : 'Confirm Handover'}
                                    </Button>
                                  </div>
                                )}
                                {order.deliveryId && ['ready_for_pickup', 'picked_up', 'in_transit', 'awaiting_confirmation'].includes(order.status) && (
                                  <div className="mt-2 p-2 bg-background-surface rounded border border-border">
                                    <p className="text-[10px] font-bold text-text-secondary uppercase mb-1">Rider Status</p>
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span>{delivery?.rider?.fullName || 'Searching...'}</span>
                                      <span>
                                        {delivery?.status === 'pending_handover' ? 'At Store ✅' : 
                                         delivery?.status === 'picked_up' || delivery?.status === 'en_route_to_dropoff' ? 'On Trip 🛵' : 
                                         delivery?.status === 'delivered' ? 'Arrived 📍' : '⏳'}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                          {/* Expanded products detail row */}
                          {expandedOrderId === order._id && (
                            <tr className="bg-background-surface/30">
                              <td colSpan={8} className="p-4">
                                <div className="bg-white rounded-lg border border-border overflow-hidden">
                                  <p className="text-xs font-bold uppercase tracking-wider text-text-secondary px-4 py-2 bg-gray-50 border-b border-border">
                                    Full Order Breakdown — Buyer: {order.buyer?.fullName} | {order.buyer?.phone}
                                  </p>
                                  {order.notes && (
                                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-sm">
                                      <span className="font-bold text-amber-800">Note: </span>
                                      <span className="italic text-amber-700">"{order.notes}"</span>
                                    </div>
                                  )}
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-border text-text-secondary text-xs">
                                        <th className="text-left px-4 py-2 font-medium">Product</th>
                                        <th className="text-right px-4 py-2 font-medium">Unit Price</th>
                                        <th className="text-center px-4 py-2 font-medium">Quantity</th>
                                        <th className="text-right px-4 py-2 font-medium">Line Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(order.products || (order.product ? [order.product] : [])).map((item: any, idx: number) => (
                                        <tr key={item.productId || idx} className="border-b border-border/50 hover:bg-gray-50">
                                          <td className="px-4 py-2 font-medium">{item.name || 'Unknown Product'}</td>
                                          <td className="px-4 py-2 text-right">{(item.unitPrice || 0).toLocaleString()} RWF</td>
                                          <td className="px-4 py-2 text-center">
                                            <span className="inline-flex items-center justify-center bg-gray-100 rounded px-2 py-0.5 font-bold text-sm">
                                              {item.quantity}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2 text-right font-semibold">{((item.unitPrice || 0) * (item.quantity || 0)).toLocaleString()} RWF</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="bg-gray-50 font-bold">
                                        <td colSpan={3} className="px-4 py-2 text-right text-sm">Subtotal</td>
                                        <td className="px-4 py-2 text-right">{(order.financials?.subtotal || 0).toLocaleString()} RWF</td>
                                      </tr>
                                      <tr className="bg-gray-50">
                                        <td colSpan={3} className="px-4 py-2 text-right text-sm text-text-secondary">Delivery Fee</td>
                                        <td className="px-4 py-2 text-right">{(order.financials?.deliveryFee || 0).toLocaleString()} RWF</td>
                                      </tr>
                                      <tr className="bg-gray-50">
                                        <td colSpan={3} className="px-4 py-2 text-right text-sm text-text-secondary">Platform Commission</td>
                                        <td className="px-4 py-2 text-right text-orange-600">-{(order.financials?.platformCommission || 0).toLocaleString()} RWF</td>
                                      </tr>
                                      <tr className="bg-gray-50 font-bold text-primary">
                                        <td colSpan={3} className="px-4 py-2 text-right">Total</td>
                                        <td className="px-4 py-2 text-right">{(order.financials?.totalAmount || 0).toLocaleString()} RWF</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
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
