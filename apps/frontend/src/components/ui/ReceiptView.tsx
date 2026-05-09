'use client';
import React from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { OrderChat } from './OrderChat';
import { orderApi } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { OrderStatus } from '@rmf/shared-types';

export interface ReceiptOrder {
  _id: string;
  orderNumber?: string;
  status: string;
  createdAt?: string;
  buyer: {
    userId?: string;
    fullName: string;
    phone: string;
    deliveryAddress?: {
      address?: string;
      coordinates?: { lat: number; lng: number };
    };
  };
  seller: {
    sellerId?: string;
    userId?: string;
    fullName: string;
    stallId: string;
    marketId?: string;
  };
  products?: Array<{
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    weight?: number;
  }>;
  attributes?: {
    isQuoteRequest?: string;
    prototypeImage?: string;
    isCustomizable?: string;
  };
  product?: {
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    weight?: number;
  };
  financials: {
    subtotal: number;
    deliveryFee: number;
    platformCommission: number;
    gatewayFee: number;
    totalAmount: number;
    sellerPayout: number;
    riderPayout: number;
  };
  payment?: {
    method?: string;
    status?: string;
    transactionRef?: string;
    paidAt?: string;
  };
  deliveryId?: string;
  delivery?: {
    rider?: {
      fullName?: string;
      phone?: string;
      plateNumber?: string;
    };
    status?: string;
    route?: {
      distanceKm?: number;
      estimatedMinutes?: number;
      actualMinutes?: number;
    };
  };
  notes?: string;
}

interface ReceiptViewProps {
  order: ReceiptOrder;
  role: 'buyer' | 'seller' | 'rider' | 'admin';
  onClose?: () => void;
}

const statusBadge = (status: string) => {
  const colors: Record<string, string> = {
    awaiting_quote: 'bg-amber-500/10 text-amber-600 border border-amber-200',
    quote_sent: 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20 animate-pulse',
    placed: 'bg-status-warning/10 text-status-warning',
    confirmed: 'bg-status-info/10 text-status-info',
    preparing: 'bg-status-info/10 text-status-info',
    ready_for_pickup: 'bg-primary/10 text-primary',
    picked_up: 'bg-primary/10 text-primary',
    in_transit: 'bg-primary/10 text-primary',
    awaiting_confirmation: 'bg-status-warning/10 text-status-warning',
    delivered: 'bg-status-success/10 text-status-success',
    cancelled: 'bg-status-error/10 text-status-error',
    disputed: 'bg-status-error/10 text-status-error',
    resolved: 'bg-status-success/10 text-status-success',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors[status] || 'bg-background-surface text-text-secondary'}`}>
      {status.replace(/_/g, ' ').toUpperCase()}
    </span>
  );
};

const paymentMethodIcon = (method?: string) => {
  if (!method) return '💳';
  const m = method.toLowerCase();
  if (m.includes('mtn') || m.includes('momo')) return '📱';
  if (m.includes('airtel')) return '📱';
  return '💳';
};

export function ReceiptView({ order, role, onClose }: ReceiptViewProps) {
  const [buyerName, setBuyerName] = React.useState(order.buyer.fullName);

  React.useEffect(() => {
    // If name is anonymous but we have a ID, try to fetch the REAL name from registration
    if ((buyerName === 'Anonymous Buyer' || !buyerName) && order.buyer.userId) {
      import('@/lib/api').then(({ userApi }) => {
        userApi.get(`/users/${order.buyer.userId}`)
          .then(res => {
            const profile = res.data?.data;
            if (profile?.fullName) {
              setBuyerName(profile.fullName);
            }
          })
          .catch(err => console.error('Failed to fetch real buyer name', err));
      });
    }
  }, [order.buyer.userId, buyerName]);

  const productsList = order.products && order.products.length > 0
    ? order.products
    : order.product
      ? [order.product]
      : [];

  const receiptNumber = order.orderNumber || `ORD-${order._id.substring(0, 8).toUpperCase()}`;
  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-RW', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : 'N/A';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-hidden">
      <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl overflow-hidden animate-scale-in max-h-[95vh] flex flex-col md:flex-row">
        
        {/* Left Side: Messaging & Negotiation (Only for Bespoke/Quotes) */}
        {(order.status === 'awaiting_quote' || order.status === 'quote_sent' || order.attributes?.isQuoteRequest === 'true' || order.financials.totalAmount === 0) && (
          <div className="w-full md:w-[400px] border-r border-gray-100 bg-gray-50/50 flex flex-col p-4 md:p-6 border-b md:border-b-0 overflow-y-auto">
            <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
              <span className="text-brand-primary">💬</span> Negotiation Hub
            </h3>
            
            <div className="flex-1 min-h-[300px]">
              <OrderChat 
                orderId={order._id}
                initialMessages={(order as any).messages || []}
                recipientName={role === 'buyer' ? order.seller.fullName : buyerName}
                userRole={role.toUpperCase() as 'BUYER' | 'SELLER'}
                orderStatus={order.status}
              />
            </div>

            <div className="mt-6 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-text-secondary uppercase mb-2 tracking-wider">Project Quick Actions</p>
              
              {role === 'seller' && order.status === 'awaiting_quote' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-text-secondary leading-tight mb-2">Review the brief and prototype, then propose a final price to the buyer.</p>
                  <Button fullWidth size="sm" onClick={() => {
                    const priceStr = prompt('Enter your final quote price (RWF):');
                    if (!priceStr) return;
                    const price = Number(priceStr);
                    if (isNaN(price) || price < 100) return toast.error('Invalid price');

                    toast.promise(
                      orderApi.post(`/orders/${order._id}/quote`, {
                        financials: {
                          subtotal: price,
                          deliveryFee: 1000,
                          gatewayFee: Math.ceil(price * 0.02),
                          totalAmount: price + 1000 + Math.ceil(price * 0.02),
                          sellerPayout: price * 0.985,
                          riderPayout: 900
                        }
                      }),
                      {
                        loading: 'Sending quote...',
                        success: 'Quote sent! Awaiting buyer acceptance.',
                        error: 'Failed to send quote'
                      }
                    ).then(() => { if (onClose) onClose(); });
                  }}>
                    Propose Final Price
                  </Button>
                </div>
              )}

              {role === 'buyer' && order.status === 'quote_sent' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-text-secondary leading-tight mb-2">The artisan has proposed a price of <span className="font-bold text-brand-primary">{order.financials.subtotal.toLocaleString()} RWF</span>. Accept to proceed to payment.</p>
                  <Button fullWidth size="sm" onClick={async () => {
                    toast.promise(
                      orderApi.put(`/orders/${order._id}/status`, {
                        status: 'placed',
                        userId: (order.buyer as any).userId || (order as any).buyerId
                      }),
                      {
                        loading: 'Accepting quote...',
                        success: 'Quote accepted! Redirecting to payment...',
                        error: 'Failed to accept quote'
                      }
                    ).then(() => {
                       // Trigger payment retry/initiation logic
                       orderApi.post(`/orders/${order._id}/retry-payment`)
                         .then(() => { if (onClose) onClose(); })
                         .catch(() => toast.error('Could not initiate payment. Please try from your dashboard.'));
                    });
                  }}>
                    Accept Quote & Pay
                  </Button>
                  <div className="flex gap-2">
                    <Button fullWidth size="sm" variant="outline" onClick={() => {
                      const priceStr = prompt('Enter your counter-offer price (RWF):');
                      if (!priceStr) return;
                      const price = Number(priceStr);
                      if (isNaN(price) || price < 100) return toast.error('Invalid price');
                      const note = prompt('Reason for counter-offer (optional):');
                      toast.promise(
                        orderApi.post(`/orders/${order._id}/counter-offer`, {
                          subtotal: price,
                          note: note || undefined
                        }),
                        {
                          loading: 'Sending counter-offer...',
                          success: 'Counter-offer sent!',
                          error: 'Failed to send counter-offer'
                        }
                      ).then(() => { if (onClose) onClose(); });
                    }}>
                      Counter Offer
                    </Button>
                    <Button fullWidth size="sm" variant="outline" className="!border-status-error !text-status-error hover:!bg-status-error/5" onClick={async () => {
                      const reason = prompt('Reason for declining (optional):');
                      toast.promise(
                        orderApi.post(`/orders/${order._id}/reject-quote`, { reason: reason || undefined }),
                        {
                          loading: 'Declining quote...',
                          success: 'Quote declined',
                          error: 'Failed to decline quote'
                        }
                      ).then(() => { if (onClose) onClose(); });
                    }}>
                      Decline
                    </Button>
                  </div>
                </div>
              )}

              {role === 'seller' && order.status === 'placed' && order.payment?.status !== 'paid' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-text-secondary leading-tight mb-2">The buyer attempted to pay but the transaction did not complete. You can revise your quote.</p>
                  <Button fullWidth size="sm" variant="outline" onClick={() => {
                    const priceStr = prompt('Enter revised quote price (RWF):');
                    if (!priceStr) return;
                    const price = Number(priceStr);
                    if (isNaN(price) || price < 100) return toast.error('Invalid price');
                    toast.promise(
                      orderApi.post(`/orders/${order._id}/quote`, {
                        financials: { subtotal: price, deliveryFee: 1000 }
                      }),
                      {
                        loading: 'Sending revised quote...',
                        success: 'Revised quote sent!',
                        error: 'Failed to send revised quote'
                      }
                    ).then(() => { if (onClose) onClose(); });
                  }}>
                    Revise Quote
                  </Button>
                </div>
              )}

              {order.status === 'placed' && order.payment?.status === 'paid' && (
                <div className="flex items-center gap-2 text-status-success bg-status-success/5 p-2 rounded-lg">
                  <span className="text-sm">✓</span>
                  <span className="text-[11px] font-medium">Agreement reached. Order in fulfillment.</span>
                </div>
              )}

              {(order.status === 'cancelled') && (
                <div className="flex items-center gap-2 text-status-error bg-status-error/5 p-2 rounded-lg">
                  <span className="text-sm">✕</span>
                  <span className="text-[11px] font-medium">This negotiation has been ended.</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-primary to-primary/90 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-white/70 mb-1">Official Receipt</p>
              <h2 className="text-xl sm:text-2xl font-bold">{receiptNumber}</h2>
              <p className="text-sm text-white/80 mt-1">{orderDate}</p>
            </div>
            <div className="flex items-center gap-2">
              {statusBadge(order.status)}
              {onClose && (
                <button onClick={onClose} className="ml-2 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors text-lg">&times;</button>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Parties Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">Buyer</p>
              <p className="font-bold text-gray-900">{buyerName}</p>
              <p className="text-sm text-gray-600">{order.buyer.phone}</p>
              {order.buyer.deliveryAddress?.address && (
                <p className="text-xs text-gray-500 mt-1">📍 {order.buyer.deliveryAddress.address}</p>
              )}
              {order.buyer.userId && (
                <p className="text-xs text-gray-400 mt-1 font-mono">ID: {order.buyer.userId.substring(0, 10)}...</p>
              )}
            </div>
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-600 mb-2">Seller</p>
              <p className="font-bold text-gray-900">{order.seller.fullName}</p>
              <p className="text-sm text-gray-600">Stall: {order.seller.stallId}</p>
              {role === 'buyer' && order.delivery?.rider && (
                <div className="mt-2 pt-2 border-t border-purple-200">
                  <p className="text-xs font-bold text-purple-600">Rider</p>
                  <p className="text-sm font-medium">{order.delivery.rider.fullName || 'Assigned'}</p>
                  {order.delivery.rider.plateNumber && (
                    <p className="text-xs text-gray-500">🛵 {order.delivery.rider.plateNumber}</p>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Prototype / Reference Photo Section */}
          {(order.attributes?.isQuoteRequest === 'true' || order.notes) && (
            <div className={`rounded-xl p-4 border ${order.status === 'quote_sent' ? 'bg-brand-primary/5 border-brand-primary/20' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex flex-col sm:flex-row gap-4">
                {order.attributes?.prototypeImage && (
                  <div className="w-full sm:w-32 h-32 rounded-lg border border-amber-300 overflow-hidden bg-white flex-shrink-0 shadow-sm">
                    <img 
                      src={order.attributes.prototypeImage} 
                      alt="Prototype" 
                      className="w-full h-full object-cover cursor-zoom-in"
                      onClick={() => window.open(order.attributes?.prototypeImage, '_blank')}
                    />
                  </div>
                )}
                <div className="flex-1">
                  <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${order.status === 'quote_sent' ? 'text-brand-primary' : 'text-amber-700'}`}>
                    {order.attributes?.isQuoteRequest === 'true' ? '📋 Project Brief & Reference Photo' : 'Customer Instructions'}
                  </p>
                  <p className="text-sm italic text-gray-700">"{order.notes || 'No specific instructions provided.'}"</p>
                  
                  {order.status === 'awaiting_quote' && (
                    <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-100/50 px-2 py-1 rounded w-fit">
                      <span className="animate-pulse">●</span> AWAITING ARTISAN QUOTE
                    </div>
                  )}
                  {order.status === 'quote_sent' && (
                    <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-brand-primary bg-brand-primary/10 px-2 py-1 rounded w-fit">
                      <span className="animate-bounce">●</span> QUOTE RECEIVED: {order.financials.subtotal.toLocaleString()} RWF
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Products Table */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Products Ordered</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 px-2 font-semibold text-gray-600">#</th>
                    <th className="text-left py-2 px-2 font-semibold text-gray-600">Item</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-600">Unit Price</th>
                    <th className="text-center py-2 px-2 font-semibold text-gray-600">Qty</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {productsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-400 italic">No product details available</td>
                    </tr>
                  ) : (
                    productsList.map((item, idx) => (
                      <tr key={item.productId || idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2 text-gray-400 font-mono">{idx + 1}</td>
                        <td className="py-3 px-2 font-medium text-gray-800">
                          {item.name}
                          {item.weight && <span className="text-xs text-gray-400 ml-1">({item.weight} kg)</span>}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">{item.unitPrice.toLocaleString()} RWF</td>
                        <td className="py-3 px-2 text-center">
                          <span className="inline-flex items-center justify-center bg-gray-100 rounded-lg px-3 py-0.5 font-bold text-gray-800">
                            {item.quantity}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right font-semibold text-gray-800">{(item.unitPrice * (item.quantity || 0)).toLocaleString()} RWF</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Payment Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{(order.financials.subtotal || 0).toLocaleString()} RWF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivery Fee</span>
                  <span className="font-medium">{(order.financials.deliveryFee || 0).toLocaleString()} RWF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Platform Commission</span>
                  <span className="font-medium text-orange-600">-{(order.financials.platformCommission || 0).toLocaleString()} RWF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Gateway Fee</span>
                  <span className="font-medium text-orange-600">-{(order.financials.gatewayFee || 0).toLocaleString()} RWF</span>
                </div>
                <div className="border-t-2 border-gray-300 pt-2 flex justify-between font-bold text-base">
                  <span>Total Paid</span>
                  <span className="text-primary">{(order.financials.totalAmount || 0).toLocaleString()} RWF</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Payment Info */}
              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <p className="text-xs font-bold uppercase tracking-wider text-green-600 mb-2">Payment</p>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{paymentMethodIcon(order.payment?.method)}</span>
                  <span className="font-bold text-gray-900">{order.payment?.method || 'N/A'}</span>
                  {order.payment?.status && (
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                      order.payment.status === 'paid' ? 'bg-green-200 text-green-800' :
                      order.payment.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-red-200 text-red-800'
                    }`}>{order.payment.status.toUpperCase()}</span>
                  )}
                </div>
                {order.payment?.transactionRef && (
                  <p className="text-xs text-gray-500 font-mono mt-1">Ref: {order.payment.transactionRef}</p>
                )}
                {order.payment?.paidAt && (
                  <p className="text-xs text-gray-500">Paid: {new Date(order.payment.paidAt).toLocaleString()}</p>
                )}
              </div>

              {/* Payout Info (seller/rider/admin views) */}
              {(role === 'seller' || role === 'rider' || role === 'admin') && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">Payout Breakdown</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Seller Payout (98.5%)</span>
                      <span className="font-bold text-green-700">+{(order.financials.sellerPayout || 0).toLocaleString()} RWF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Rider Payout (90% of fee)</span>
                      <span className="font-bold text-green-700">+{(order.financials.riderPayout || 0).toLocaleString()} RWF</span>
                    </div>
                    <div className="flex justify-between border-t border-amber-200 pt-1 mt-1">
                      <span className="text-gray-600">Platform Revenue</span>
                      <span className="font-bold text-blue-700">+{((order.financials.platformCommission || 0) + (order.financials.gatewayFee || 0)).toLocaleString()} RWF</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Delivery Info */}
              {order.delivery && (
                <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-cyan-600 mb-2">Delivery</p>
                  <div className="text-sm space-y-1">
                    <p className="flex justify-between"><span className="text-gray-600">Distance</span><span className="font-medium">{order.delivery.route?.distanceKm?.toFixed(1) || '?'} km</span></p>
                    <p className="flex justify-between"><span className="text-gray-600">Est. Time</span><span className="font-medium">{order.delivery.route?.estimatedMinutes || '?'} min</span></p>
                    <p className="flex justify-between"><span className="text-gray-600">Status</span><span className="font-medium">{order.delivery.status?.replace(/_/g, ' ') || 'N/A'}</span></p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Accounting Footer */}
          <div className="border-t-2 border-gray-200 pt-6 text-center">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8 mb-6">
              <div className="bg-gray-100 rounded-lg px-6 py-3 border border-gray-200 w-full sm:w-auto">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Payment Status</p>
                <p className={`text-lg font-bold mt-0.5 ${
                  order.payment?.status === 'paid' || order.status === 'delivered' || order.status === 'resolved'
                    ? 'text-status-success' : order.status === 'cancelled' || order.status === 'disputed'
                      ? 'text-status-error' : 'text-status-warning'
                }`}>
                  {order.payment?.status === 'paid' || order.status === 'delivered' ? 'SETTLED' :
                   order.status === 'cancelled' ? 'CANCELLED' :
                   order.status === 'disputed' ? 'DISPUTED' : 'PENDING'}
                </p>
              </div>
              <div className="bg-gray-100 rounded-lg px-6 py-3 border border-gray-200 w-full sm:w-auto">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Payee Name</p>
                <p className="text-lg font-bold mt-0.5 text-gray-800">{buyerName}</p>
              </div>
            </div>
            
            <div className="flex justify-center mb-6">
              <div className="border-2 border-primary/30 rounded-full px-6 py-2 transform -rotate-12 opacity-80">
                <p className="text-primary font-bold tracking-widest text-sm uppercase">Official Digital Receipt</p>
                <p className="text-[10px] text-primary/70">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <p className="text-xs text-gray-400 font-mono">
              Receipt #{receiptNumber} • RMF Accounting System • Verified & Secure
            </p>
          </div>
        </div>
        </div>

        {/* Close Button */}
        {onClose && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <Button onClick={onClose} fullWidth variant="outline">Close Receipt</Button>
          </div>
        )}
      </div>
    </div>
  );
}
