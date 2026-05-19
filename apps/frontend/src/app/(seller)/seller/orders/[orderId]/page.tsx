'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { ReceiptView, type ReceiptOrder } from '@/components/ui/ReceiptView';
import { OrderChat } from '@/components/ui/OrderChat';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { orderApi, deliveryApi } from '@/lib/api';
import toast from 'react-hot-toast';

type ChatMessage = {
  senderId: string;
  senderRole: 'BUYER' | 'SELLER';
  content: string;
  imageUrl?: string;
  type?: 'TEXT' | 'QUOTE' | 'COUNTER_QUOTE';
  quoteAmount?: number;
  timestamp: string;
};

type OrderLine = {
  productId?: string;
  name?: string;
  unitPrice?: number;
  quantity?: number;
  weight?: number;
  images?: string[];
};

type StatusHistoryItem = {
  status: string;
  changedAt?: string;
  note?: string;
};

type SellerOrder = {
  _id?: string;
  orderNumber?: string;
  status?: string;
  createdAt?: string;
  deliveryId?: string;
  products?: OrderLine[];
  product?: OrderLine;
  financials?: Partial<ReceiptOrder['financials']>;
  payment?: { status?: string; method?: string; transactionRef?: string; paidAt?: string };
  buyer?: ReceiptOrder['buyer'];
  seller?: ReceiptOrder['seller'];
  statusHistory?: StatusHistoryItem[];
  notes?: string;
  messages?: ChatMessage[];
};

type DeliveryInfo = {
  rider?: { fullName?: string; plateNumber?: string; phone?: string };
  status?: string;
  route?: { distanceKm?: number; estimatedMinutes?: number };
  pickup?: { sellerConfirmed?: boolean; qrScannedAt?: string };
};

export default function SellerOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId: routeOrderId } = React.use(params);
  const { user } = useAuth();
  const { data: order, loading, execute: fetchOrder } = useApi<SellerOrder>(orderApi, 'get', `/orders/${routeOrderId}`);
  const [delivery, setDelivery] = useState<DeliveryInfo | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [routeOrderId, fetchOrder]);

  useEffect(() => {
    if (order?.deliveryId) {
      deliveryApi.get(`/deliveries/${order.deliveryId}`)
        .then(res => setDelivery(res.data?.data))
        .catch(() => {});
    }
  }, [order?.deliveryId]);

  const updateStatus = async (status: string) => {
    try {
      await orderApi.put(`/orders/${routeOrderId}/status`, { status, userId: user?.id });
      toast.success(`Order updated to ${status.replace(/_/g, ' ')}`);
      fetchOrder();
    } catch (e) {
      toast.error('Failed to update order');
    }
  };

  const confirmHandover = async () => {
    const deliveryId = order?.deliveryId;
    if (!deliveryId) return;
    try {
      await deliveryApi.post(`/deliveries/${deliveryId}/handover`, { role: 'seller' });
      toast.success('Handover confirmed! Rider is now in transit.');
      fetchOrder();
      // Refresh delivery info
      deliveryApi.get(`/deliveries/${deliveryId}`).then(res => setDelivery(res.data?.data));
    } catch (e) {
      toast.error('Failed to confirm handover');
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

  const totalQty = productsList.reduce((s: number, p: OrderLine) => s + (p.quantity || 1), 0);
  const orderId = order._id || routeOrderId;
  const orderNumber = order.orderNumber || `#${orderId.slice(0, 8).toUpperCase()}`;
  const financials: ReceiptOrder['financials'] = {
    subtotal: 0,
    deliveryFee: 0,
    platformCommission: 0,
    gatewayFee: 0,
    totalAmount: 0,
    sellerPayout: 0,
    riderPayout: 0,
    ...order.financials,
  };
  const orderStatus = order.status || 'placed';
  const statusHistory = order.statusHistory || [];
  const receiptOrder: ReceiptOrder = {
    _id: orderId,
    orderNumber: order.orderNumber,
    status: orderStatus,
    createdAt: order.createdAt,
    buyer: order.buyer || { fullName: 'Anonymous Buyer', phone: 'Hidden' },
    seller: order.seller || { fullName: 'Verified Seller', stallId: 'N/A' },
    products: productsList.map(item => ({
      productId: item.productId || '',
      name: item.name || 'Product',
      unitPrice: item.unitPrice || 0,
      quantity: item.quantity || 1,
      weight: item.weight,
    })),
    financials,
    payment: order.payment,
    deliveryId: order.deliveryId,
    delivery: delivery ? { rider: delivery.rider, status: delivery.status, route: delivery.route } : undefined,
    notes: order.notes,
  };

  return (
    <Layout>
      {showReceipt && (
        <ReceiptView
          order={receiptOrder}
          role="seller"
          onClose={() => setShowReceipt(false)}
        />
      )}

      <div className="animate-reveal space-y-6 pb-20">
        {/* Dossier Header */}
        <div className="flex flex-col items-start justify-between gap-6 rounded-lg border border-[#0b4b32]/20 bg-[#e05300] p-6 text-white shadow-sm md:flex-row md:items-end md:p-8">
          <div>
            <div className="flex items-center gap-4 mb-4">
               <Link href="/seller/dashboard" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white group">
                  <svg className="w-3 h-3 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                  Terminal Dashboard
               </Link>
               <span className="text-white/25">/</span>
               <span className="text-[10px] font-black uppercase tracking-widest text-[#ffedd5]">Active Order</span>
            </div>
            <h1 className="mb-4 text-3xl font-black leading-tight tracking-normal text-white md:text-4xl">
              Order {orderNumber}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-white/55">
               <span>Initialized: {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}</span>
               <span>/</span>
               <span className="flex items-center gap-2">
                 <span className={`w-2 h-2 rounded-full ${order.payment?.status === 'paid' ? 'bg-green-500' : 'bg-[#ffedd5]'}`}></span>
                 Payment {order.payment?.status?.toUpperCase() || 'PENDING'}
               </span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => setShowReceipt(true)}
              className="rounded-md border border-white/20 px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/10"
            >
              <svg className="w-3 h-3 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Review Receipt
            </button>
            <div className="flex gap-2">
               {orderStatus === 'confirmed' && (
                 <button onClick={() => updateStatus('preparing')} className="rounded-md bg-[#ffedd5] px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-[#e05300]">Authorize Production</button>
               )}
               {orderStatus === 'preparing' && (
                 <button onClick={() => updateStatus('ready_for_pickup')} className="rounded-md bg-[#ffedd5] px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-[#e05300]">Signal Readiness</button>
               )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            {/* Artifact Table */}
            <div className="bg-white border border-[#e0e0e0] overflow-hidden shadow-sm">
               <div className="px-8 py-6 bg-[#fcf9f8] border-b border-[#e0e0e0] flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[#1b1c1c]">Items Ordered</h3>
                  <span className="text-[9px] font-bold text-[#414844] uppercase">{totalQty} Total Unit(s)</span>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-white border-b border-[#e0e0e0]">
                     <tr>
                       <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-[#414844]">Item / Specification</th>
                       <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-[#414844] text-right">Valuation</th>
                       <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-[#414844] text-center">Qty</th>
                       <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-[#414844] text-right">Total</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[#f0eded]">
                     {productsList.map((item: OrderLine, idx: number) => (
                       <tr key={idx} className="hover:bg-[#fcf9f8] transition-colors">
                         <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 bg-[#fcf9f8] border border-[#e0e0e0] flex-shrink-0">
                                  <img src={item.images?.[0] || 'https://images.unsplash.com/photo-1544441893-675973e31985'} className="w-full h-full object-cover" alt={item.name} />
                               </div>
                               <div>
                                  <p className="text-sm font-sans text-[#1b1c1c]">{item.name || 'Heritage Item'}</p>
                                  <p className="text-[8px] font-bold text-[#414844] uppercase tracking-widest mt-1 opacity-50">SKU: {item.productId?.substring(0,8).toUpperCase() || 'N/A'}</p>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-6 text-right text-[11px] font-bold text-[#1b1c1c]">{(item.unitPrice || 0).toLocaleString()} RWF</td>
                         <td className="px-8 py-6 text-center text-[11px] font-bold text-[#1b1c1c]">{item.quantity}</td>
                         <td className="px-8 py-6 text-right text-[11px] font-black text-[#1b1c1c]">{( (item.unitPrice || 0) * (item.quantity || 1) ).toLocaleString()} RWF</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>

            {/* Financial Reconciliation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="bg-[#e05300] text-white p-10 space-y-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                     <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-[0.4em] mb-4">Order Total</p>
                    <h3 className="text-5xl font-sans tracking-normal">{(order.financials?.totalAmount || 0).toLocaleString()} RWF</h3>
                  </div>
                  <div className="space-y-4 pt-8 border-t border-white/10">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-60">
                      <span>Subtotal Acquisition</span>
                      <span>{(order.financials?.subtotal || 0).toLocaleString()} RWF</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-60">
                      <span>Facilitation Logistics</span>
                      <span>{(order.financials?.deliveryFee || 0).toLocaleString()} RWF</span>
                    </div>
                  </div>
               </div>

               <div className="bg-white border border-[#e0e0e0] rounded-lg p-10 space-y-8">
                  <p className="text-[9px] font-black text-[#1b1c1c] uppercase tracking-[0.4em] border-b border-[#e0e0e0] pb-4">Merchant Payout Schedule</p>
                  <div className="space-y-4">
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-[#414844] uppercase tracking-widest opacity-60">Net Payout (98.5%)</span>
                        <span className="text-2xl font-sans text-[#1b1c1c] tracking-normal font-bold">{(order.financials?.sellerPayout || 0).toLocaleString()} RWF</span>
                     </div>
                     <div className="flex justify-between items-center text-orange-600">
                        <span className="text-[9px] font-black uppercase tracking-widest">RMF Commission (1.5%)</span>
                        <span className="text-xs font-bold">-{(order.financials?.platformCommission || 0).toLocaleString()} RWF</span>
                     </div>
                     <div className="flex justify-between items-center text-orange-600 opacity-60">
                        <span className="text-[9px] font-black uppercase tracking-widest">Gateway Facilitation</span>
                        <span className="text-xs font-bold">-{(order.financials?.gatewayFee || 0).toLocaleString()} RWF</span>
                     </div>
                  </div>
                  <div className="pt-4 flex items-center gap-3">
                     <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                     <p className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Idempotent Verification Active</p>
                  </div>
               </div>
            </div>
          </div>

          <div className="space-y-10">
            {/* Logistics Handshake Matrix */}
            {orderStatus === 'ready_for_pickup' && (
              <div className="bg-[#e05300] text-white p-10 space-y-10 border-t-4 border-[#ffd700] shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <svg className="w-40 h-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                 </div>
                 <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div className="space-y-4">
                       <p className="text-[10px] font-black text-[#ff6b00] uppercase tracking-[0.5em]">Logistics Handshake Active</p>
                       <h3 className="text-4xl font-sans tracking-normal">Handover Protocol</h3>
                       {delivery?.rider ? (
                         <div className="flex items-center gap-6 mt-6">
                            <div className="w-14 h-14 bg-white/5 border border-white/10 flex items-center justify-center text-2xl">🏍️</div>
                            <div>
                               <p className="text-lg font-sans text-white">{delivery.rider.fullName || 'Authorized Rider'}</p>
                               <p className="text-[10px] font-black text-[#ff6b00] uppercase tracking-widest opacity-60">Plate: {delivery.rider.plateNumber || 'RAA 000X'}</p>
                            </div>
                         </div>
                       ) : (
                         <p className="text-[11px] text-white/40 mt-6 animate-pulse">Awaiting Rider Assignment to Terminal...</p>
                       )}
                    </div>
                    
                    {delivery?.rider && !delivery.pickup?.sellerConfirmed && (
                      <button 
                        onClick={confirmHandover}
                        className="rmf-btn-primary bg-[#ffd700] text-[#1b1c1c] px-12 py-5 shadow-[0_10px_30px_rgba(246,195,67,0.3)] hover:bg-white hover:text-[#1b1c1c]"
                      >
                        Confirm Handover -&gt;
                      </button>
                    )}

                    {delivery?.pickup?.sellerConfirmed && (
                      <div className="flex items-center gap-4 bg-white/5 px-6 py-4 border border-white/10">
                         <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                         <p className="text-[10px] font-black uppercase tracking-widest">Handover Verified by Merchant</p>
                      </div>
                    )}
                 </div>
                 <div className="pt-8 border-t border-white/5 flex gap-8">
                    <div className="flex items-center gap-2">
                       <span className={`w-2 h-2 rounded-full ${delivery?.pickup?.qrScannedAt ? 'bg-green-500' : 'bg-white/20'}`}></span>
                       <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40">Rider Scan</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className={`w-2 h-2 rounded-full ${delivery?.pickup?.sellerConfirmed ? 'bg-green-500' : 'bg-white/20'}`}></span>
                       <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40">Merchant Confirm</span>
                    </div>
                 </div>
              </div>
            )}

            {/* Status Hub */}
            <div className="bg-white border border-[#e0e0e0] p-10 space-y-8 shadow-sm">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-[#1b1c1c] border-b border-[#f0eded] pb-4">Fulfillment Timeline</h3>
               <div className="space-y-8">
                  {statusHistory.map((h: StatusHistoryItem, idx: number) => {
                    const isCurrent = h.status === orderStatus;
                    // In history, index 0 is oldest, last is newest. 
                    // Let's find the current index to determine past/future
                    const currentIndex = statusHistory.findIndex((sh: StatusHistoryItem) => sh.status === orderStatus);
                    const isPast = idx < currentIndex;

                    return (
                      <div key={idx} className="flex gap-6 relative group">
                        {idx !== statusHistory.length - 1 && (
                          <div className={`absolute left-[11px] top-8 w-px h-[calc(100%-12px)] ${isPast ? 'bg-[#ffd700]' : 'bg-[#e0e0e0]'}`}></div>
                        )}
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 transition-all duration-500 ${
                          isCurrent 
                            ? 'bg-[#e05300] border-[#e0e0e0] scale-110 shadow-[0_0_15px_rgba(246,195,67,0.3)]' 
                            : isPast 
                              ? 'bg-[#ffd700] border-[#ffd700]' 
                              : 'bg-white border-[#e0e0e0]'
                        }`}>
                           <div className={`w-1.5 h-1.5 rounded-full ${
                             isCurrent 
                               ? 'bg-[#ffd700] animate-pulse' 
                               : isPast 
                                 ? 'bg-[#e05300]' 
                                 : 'bg-[#e0e0e0]'
                           }`}></div>
                        </div>
                        <div className="flex-grow pt-0.5">
                           <p className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isCurrent ? 'text-[#1b1c1c]' : 'text-[#1b1c1c]/40'}`}>
                             {h.status.replace(/_/g, ' ')}
                             {isCurrent && <span className="ml-3 text-[8px] text-[#ff6b00] font-bold">ACTIVE</span>}
                           </p>
                           <p className="text-[9px] font-bold text-[#414844] uppercase tracking-widest mt-1 opacity-50">{h.changedAt ? new Date(h.changedAt).toLocaleString() : 'Time pending'}</p>
                           {h.note && <p className="text-[11px] text-[#1b1c1c] mt-2 opacity-70 leading-relaxed border-l border-[#f0eded] pl-4">{h.note}</p>}
                        </div>
                      </div>
                    );
                  })}
               </div>
            </div>

            {/* Customer Dossier */}
            <div className="bg-[#fcf9f8] border border-[#e0e0e0] p-10 space-y-10">
               <div>
                  <p className="text-[9px] font-black text-[#1b1c1c] uppercase tracking-[0.4em] mb-8 border-b border-[#e0e0e0] pb-4">Counterparty Dossier</p>
                  <div className="flex items-center gap-6 mb-8">
                     <div className="w-14 h-14 bg-white border border-[#e0e0e0] flex items-center justify-center text-2xl shadow-sm">👤</div>
                     <div>
                        <p className="text-lg font-sans text-[#1b1c1c]">{order.buyer?.fullName || 'Anonymous'}</p>
                        <p className="text-[10px] font-bold text-[#414844] uppercase tracking-widest opacity-60">Verified Member</p>
                     </div>
                  </div>
                  
                  <div className="space-y-6">
                     <div className="space-y-2">
                        <p className="text-[8px] font-black text-[#ff6b00] uppercase tracking-widest">Authorized Contact</p>
                        <p className="text-[11px] font-bold text-[#1b1c1c]">{order.buyer?.phone || 'Encrypted'}</p>
                     </div>
                     <div className="space-y-2">
                        <p className="text-[8px] font-black text-[#ff6b00] uppercase tracking-widest">Delivery Address</p>
                        <p className="text-[11px] font-medium text-[#1b1c1c] leading-relaxed">{order.buyer?.deliveryAddress?.address || 'Terminal Pickup'}</p>
                     </div>
                  </div>
               </div>

               {order.notes && (
                  <div className="bg-[#e05300] text-white p-6 relative overflow-hidden">
                     <div className="relative z-10">
                        <p className="text-[8px] font-black text-[#ff6b00] uppercase tracking-widest mb-3">Operator Instruction</p>
                         <p className="text-xs leading-relaxed opacity-70">{order.notes}</p>
                     </div>
                     <div className="absolute -bottom-4 -right-4 text-4xl opacity-5">💬</div>
                  </div>
               )}
            </div>
          </div>
        </div>

        {/* Negotiation Terminal */}
        {(orderStatus === 'awaiting_quote' || orderStatus === 'quote_sent' || (orderStatus === 'placed' && order.payment?.status !== 'paid')) && (
           <div className="bg-white border border-[#e0e0e0] rounded-lg p-12">
              <div className="flex items-center gap-6 mb-12 border-b border-[#f0eded] pb-6">
                 <h2 className="text-3xl font-sans tracking-normal text-[#1b1c1c]">Order Chat</h2>
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#ffd700] rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Live Handshake Active</span>
                 </div>
              </div>
              <div className="max-w-4xl">
                 <OrderChat
                   orderId={orderId}
                   initialMessages={order.messages || []}
                   recipientName={order.buyer?.fullName || 'Customer'}
                   userRole="SELLER"
                   orderStatus={orderStatus}
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
    </Layout>
  );
}
