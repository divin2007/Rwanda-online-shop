'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ReceiptView, type ReceiptOrder } from '@/components/ui/ReceiptView';
import { OrderChat } from '@/components/ui/OrderChat';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { orderApi, deliveryApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SellerOrderDetailPage({ params }: { params: { orderId: string } }) {
  const { user } = useAuth();
  const { data: order, loading, execute: fetchOrder } = useApi(orderApi, 'get', `/orders/${params.orderId}`);
  const [delivery, setDelivery] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [params.orderId, fetchOrder]);

  useEffect(() => {
    if (order?.deliveryId) {
      deliveryApi.get(`/deliveries/${order.deliveryId}`)
        .then(res => setDelivery(res.data?.data))
        .catch(() => {});
    }
  }, [order?.deliveryId]);

  const updateStatus = async (status: string) => {
    try {
      await orderApi.put(`/orders/${params.orderId}/status`, { status, userId: user?.id });
      toast.success(`Order updated to ${status.replace(/_/g, ' ')}`);
      fetchOrder();
    } catch (e) {
      toast.error('Failed to update order');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center p-20"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div></div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Order Not Found</h1>
          <Link href="/seller/dashboard"><Button variant="outline">Back to Dashboard</Button></Link>
        </div>
      </Layout>
    );
  }

  const productsList = order.products && order.products.length > 0
    ? order.products
    : order.product
      ? [order.product]
      : [];

  const totalQty = productsList.reduce((s: number, p: any) => s + (p.quantity || 1), 0);
  const orderNumber = order.orderNumber || `#${order._id.substring(0, 8).toUpperCase()}`;

  return (
    <Layout>
      {showReceipt && (
        <ReceiptView
          order={{ ...order, delivery: delivery ? { rider: delivery.rider, status: delivery.status, route: delivery.route } : undefined }}
          role="seller"
          onClose={() => setShowReceipt(false)}
        />
      )}

      <div className="flex flex-col md:flex-row min-h-screen bg-background-main">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-background-card border-r border-border p-6 hidden md:block">
          <nav className="space-y-2">
            <Link href="/seller/dashboard" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Dashboard</Link>
            <Link href="/seller/products" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Products</Link>
            <Link href="/seller/promotions" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Promotions</Link>
            <Link href="/seller/earnings" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Earnings</Link>
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 p-4 md:p-8 max-w-5xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <Link href="/seller/dashboard" className="text-sm text-text-secondary hover:text-primary mb-1 inline-block">&larr; Back to Dashboard</Link>
              <h1 className="text-2xl font-heading font-bold text-text-primary">Order {orderNumber}</h1>
              <p className="text-text-secondary text-sm">
                Placed on {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-RW', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowReceipt(true)}>🧾 View Official Receipt</Button>
            </div>
          </div>

          {/* Negotiation Hub & Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Info */}
              <Card>
                <p className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">Customer Information</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-lg">👤</div>
                    <div>
                      <p className="font-bold text-lg">{order.buyer?.fullName || 'N/A'}</p>
                      <p className="text-sm text-text-secondary">{order.buyer?.phone || 'No phone'}</p>
                    </div>
                  </div>
                  {order.buyer?.deliveryAddress?.address && (
                    <div className="bg-gray-50 rounded-lg p-3 mt-2 border border-border">
                      <p className="text-xs font-medium text-text-secondary">Delivery Address</p>
                      <p className="text-sm">{order.buyer.deliveryAddress.address}</p>
                    </div>
                  )}
                  {order.notes && (
                    <div className="bg-amber-50 rounded-lg p-3 mt-2 border border-amber-200">
                      <p className="text-xs font-bold text-amber-700">Customer Note</p>
                      <p className="text-sm italic">"{order.notes}"</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Order Status */}
              <Card>
                <p className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">Order Status</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                      order.status === 'placed' ? 'bg-status-warning/10 text-status-warning' :
                      order.status === 'confirmed' ? 'bg-status-info/10 text-status-info' :
                      order.status === 'preparing' ? 'bg-status-info/10 text-status-info' :
                      order.status === 'ready_for_pickup' ? 'bg-primary/10 text-primary' :
                      order.status === 'delivered' ? 'bg-status-success/10 text-status-success' :
                      order.status === 'cancelled' ? 'bg-status-error/10 text-status-error' :
                      order.status === 'disputed' ? 'bg-status-error/10 text-status-error' :
                      'bg-background-surface text-text-secondary'
                    }`}>
                      {order.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {order.status === 'confirmed' && <Button size="sm" onClick={() => updateStatus('preparing')}>Start Preparing</Button>}
                    {order.status === 'preparing' && <Button size="sm" onClick={() => updateStatus('ready_for_pickup')}>Mark as Ready</Button>}
                  </div>
                </div>
              </Card>
            </div>

            {/* Chat / Negotiation Sidebar */}
            {(order.status === 'awaiting_quote' || order.status === 'quote_sent' || order.financials?.totalAmount === 0 || (order.status === 'placed' && order.payment?.status !== 'paid')) && (
              <div className="lg:col-span-1">
                <div className="sticky top-8">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="text-brand-primary">💬</span> Negotiation
                  </h3>
                  <OrderChat
                    orderId={order._id}
                    initialMessages={(order as any).messages || []}
                    recipientName={order.buyer?.fullName || 'Customer'}
                    userRole="SELLER"
                    orderStatus={order.status}
                    paymentStatus={order.payment?.status}
                    marketId={order.seller?.marketId}
                    deliveryAddress={order.buyer?.deliveryAddress}
                    deliveryFee={order.financials?.deliveryFee}
                    onOrderUpdated={fetchOrder}
                  />

                </div>
              </div>
            )}
          </div>

          {/* Products Ordered */}
          <Card noPadding className="mb-8">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-bold flex items-center gap-2">
                Products Ordered
                <span className="text-sm font-normal text-text-secondary">({totalQty} total items)</span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-background-surface text-text-secondary text-sm">
                  <tr>
                    <th className="p-4 font-medium">#</th>
                    <th className="p-4 font-medium">Product</th>
                    <th className="p-4 font-medium text-right">Unit Price</th>
                    <th className="p-4 font-medium text-center">Quantity</th>
                    <th className="p-4 font-medium text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {productsList.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-text-secondary">No product data available for this order.</td></tr>
                  ) : (
                    productsList.map((item: any, idx: number) => (
                      <tr key={item.productId || idx} className="hover:bg-background-surface/50">
                        <td className="p-4 text-text-secondary font-mono">{idx + 1}</td>
                        <td className="p-4">
                          <p className="font-bold">{item.name || 'Unknown Product'}</p>
                          {item.weight && <p className="text-xs text-text-secondary">{item.weight} kg</p>}
                        </td>
                        <td className="p-4 text-right">{(item.unitPrice || 0).toLocaleString()} RWF</td>
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center justify-center bg-gray-100 rounded-lg px-3 py-1 font-bold text-sm">
                            {item.quantity}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold">{((item.unitPrice || 0) * (item.quantity || 0)).toLocaleString()} RWF</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="p-4 text-right font-medium">Subtotal</td>
                    <td className="p-4 text-right">{(order.financials?.subtotal || 0).toLocaleString()} RWF</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="p-4 text-right text-text-secondary">Delivery Fee</td>
                    <td className="p-4 text-right">{(order.financials?.deliveryFee || 0).toLocaleString()} RWF</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="p-4 text-right text-text-secondary">Platform Commission (1.5%)</td>
                    <td className="p-4 text-right text-orange-600">-{(order.financials?.platformCommission || 0).toLocaleString()} RWF</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="p-4 text-right text-text-secondary">Gateway Fee</td>
                    <td className="p-4 text-right text-orange-600">-{(order.financials?.gatewayFee || 0).toLocaleString()} RWF</td>
                  </tr>
                  <tr className="font-bold text-primary">
                    <td colSpan={4} className="p-4 text-right text-lg">Total Paid</td>
                    <td className="p-4 text-right text-lg">{(order.financials?.totalAmount || 0).toLocaleString()} RWF</td>
                  </tr>
                  <tr className="font-bold text-status-success border-t-2 border-gray-300">
                    <td colSpan={4} className="p-4 text-right">Your Payout (98.5%)</td>
                    <td className="p-4 text-right text-lg">+{(order.financials?.sellerPayout || 0).toLocaleString()} RWF</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Status History */}
          {order.statusHistory && order.statusHistory.length > 0 && (
            <Card noPadding>
              <div className="p-6 border-b border-border">
                <h2 className="text-lg font-bold">Order Timeline</h2>
              </div>
              <div className="divide-y divide-border">
                {order.statusHistory.map((h: any, idx: number) => (
                  <div key={idx} className="p-4 flex items-center gap-4 hover:bg-background-surface/50">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{h.status.replace(/_/g, ' ')}</p>
                      {h.note && <p className="text-xs text-text-secondary">{h.note}</p>}
                    </div>
                    <p className="text-xs text-text-secondary">
                      {h.changedAt ? new Date(h.changedAt).toLocaleString() : ''}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </main>
      </div>
    </Layout>
  );
}
