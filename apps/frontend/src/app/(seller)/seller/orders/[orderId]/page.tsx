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

  const confirmHandover = async () => {
    if (!order.deliveryId) return;
    try {
      await deliveryApi.post(`/deliveries/${order.deliveryId}/handover`, { role: 'seller' });
      toast.success('Handover confirmed. Mandate transitioning to transit.');
      fetchOrder();
      // Refresh delivery info
      deliveryApi.get(`/deliveries/${order.deliveryId}`).then(res => setDelivery(res.data?.data));
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

      <div className="animate-reveal space-y-8">
        {/* Dossier Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-[#121212] pb-8">
          <div>
            <div className="flex items-center gap-4 mb-4">
               <Link href="/seller/dashboard" className="text-[10px] font-black uppercase tracking-widest text-[#6B665E] hover:text-[#121212] flex items-center gap-2 group">
                  <svg className="w-3 h-3 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                  Terminal Dashboard
               </Link>
               <span className="text-[#E5E1D8]">/</span>
               <span className="text-[10px] font-black uppercase tracking-widest text-[#A34D15]">Active Mandate</span>
            </div>
            <h1 className="text-5xl font-serif tracking-tighter italic text-[#121212] leading-none mb-4">
              Mandate {orderNumber}
            </h1>
            <div className="flex items-center gap-6 text-[10px] font-bold text-[#6B665E] uppercase tracking-widest italic opacity-60">
               <span>Initialized: {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}</span>
               <span>•</span>
               <span className="flex items-center gap-2">
                 <span className={`w-2 h-2 rounded-full ${order.payment?.status === 'paid' ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                 Payment {order.payment?.status?.toUpperCase() || 'PENDING'}
               </span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => setShowReceipt(true)}
              className="rmf-btn-outline border-[#121212] text-[#121212] py-3 text-[9px]"
            >
              <svg className="w-3 h-3 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Review Receipt
            </button>
            <div className="flex gap-2">
               {order.status === 'confirmed' && (
                 <button onClick={() => updateStatus('preparing')} className="rmf-btn-primary bg-[#F59E0B] border-none py-3 text-[9px]">Authorize Production</button>
               )}
               {order.status === 'preparing' && (
                 <button onClick={() => updateStatus('ready_for_pickup')} className="rmf-btn-primary bg-[#121212] border-none py-3 text-[9px]">Signal Readiness</button>
               )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            {/* Artifact Table */}
            <div className="bg-white border border-[#E5E1D8] overflow-hidden shadow-sm">
               <div className="px-8 py-6 bg-[#F8F6F1] border-b border-[#E5E1D8] flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[#121212]">Artifact Collection</h3>
                  <span className="text-[9px] font-bold text-[#6B665E] uppercase">{totalQty} Total Unit(s)</span>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-white border-b border-[#E5E1D8]">
                     <tr>
                       <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-[#6B665E]">Item / Specification</th>
                       <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-[#6B665E] text-right">Valuation</th>
                       <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-[#6B665E] text-center">Qty</th>
                       <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-[#6B665E] text-right">Total</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[#F0EDE4]">
                     {productsList.map((item: any, idx: number) => (
                       <tr key={idx} className="hover:bg-[#F9F7F2] transition-colors">
                         <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 bg-[#F8F6F1] border border-[#E5E1D8] flex-shrink-0">
                                  <img src={item.images?.[0] || 'https://images.unsplash.com/photo-1544441893-675973e31985'} className="w-full h-full object-cover" alt={item.name} />
                               </div>
                               <div>
                                  <p className="text-sm font-serif italic text-[#121212]">{item.name || 'Heritage Item'}</p>
                                  <p className="text-[8px] font-bold text-[#6B665E] uppercase tracking-widest mt-1 opacity-50">SKU: {item.productId?.substring(0,8).toUpperCase() || 'N/A'}</p>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-6 text-right text-[11px] font-bold text-[#121212]">{(item.unitPrice || 0).toLocaleString()} RWF</td>
                         <td className="px-8 py-6 text-center text-[11px] font-bold text-[#121212]">{item.quantity}</td>
                         <td className="px-8 py-6 text-right text-[11px] font-black text-[#121212]">{( (item.unitPrice || 0) * (item.quantity || 1) ).toLocaleString()} RWF</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>

            {/* Financial Reconciliation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="bg-[#121212] text-white p-10 space-y-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                     <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-[#F59E0B] uppercase tracking-[0.4em] mb-4">Mandate Valuation</p>
                    <h3 className="text-5xl font-serif italic tracking-tighter">{(order.financials?.totalAmount || 0).toLocaleString()} RWF</h3>
                  </div>
                  <div className="space-y-4 pt-8 border-t border-white/10">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-60 italic">
                      <span>Subtotal Acquisition</span>
                      <span>{(order.financials?.subtotal || 0).toLocaleString()} RWF</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-60 italic">
                      <span>Facilitation Logistics</span>
                      <span>{(order.financials?.deliveryFee || 0).toLocaleString()} RWF</span>
                    </div>
                  </div>
               </div>

               <div className="bg-white border-2 border-[#121212] p-10 space-y-8">
                  <p className="text-[9px] font-black text-[#121212] uppercase tracking-[0.4em] border-b border-[#E5E1D8] pb-4">Merchant Payout Schedule</p>
                  <div className="space-y-4">
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-[#6B665E] uppercase tracking-widest italic opacity-60">Net Payout (98.5%)</span>
                        <span className="text-2xl font-serif text-[#121212] tracking-tighter font-bold">{(order.financials?.sellerPayout || 0).toLocaleString()} RWF</span>
                     </div>
                     <div className="flex justify-between items-center text-orange-600">
                        <span className="text-[9px] font-black uppercase tracking-widest italic">RMF Commission (1.5%)</span>
                        <span className="text-xs font-bold">-{(order.financials?.platformCommission || 0).toLocaleString()} RWF</span>
                     </div>
                     <div className="flex justify-between items-center text-orange-600 opacity-60">
                        <span className="text-[9px] font-black uppercase tracking-widest italic">Gateway Facilitation</span>
                        <span className="text-xs font-bold">-{(order.financials?.gatewayFee || 0).toLocaleString()} RWF</span>
                     </div>
                  </div>
                  <div className="pt-4 flex items-center gap-3">
                     <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                     <p className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Idempotent Verification Active</p>
                  </div>
               </div>
            </div>
          </div>

          <div className="space-y-10">
            {/* Logistics Handshake Matrix */}
            {order.status === 'ready_for_pickup' && (
              <div className="bg-[#121212] text-white p-10 space-y-10 border-t-4 border-[#F59E0B] shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <svg className="w-40 h-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                 </div>
                 <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div className="space-y-4">
                       <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.5em]">Logistics Handshake Active</p>
                       <h3 className="text-4xl font-serif italic tracking-tighter">Handover Protocol</h3>
                       {delivery?.rider ? (
                         <div className="flex items-center gap-6 mt-6">
                            <div className="w-14 h-14 bg-white/5 border border-white/10 flex items-center justify-center text-2xl">🏍️</div>
                            <div>
                               <p className="text-lg font-serif italic text-white">{delivery.rider.fullName || 'Authorized Rider'}</p>
                               <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest opacity-60">Plate: {delivery.rider.plateNumber || 'RAA 000X'}</p>
                            </div>
                         </div>
                       ) : (
                         <p className="text-[11px] text-white/40 italic mt-6 animate-pulse">Awaiting Rider Assignment to Terminal...</p>
                       )}
                    </div>
                    
                    {delivery?.rider && !delivery.pickup?.sellerConfirmed && (
                      <button 
                        onClick={confirmHandover}
                        className="rmf-btn-primary bg-[#F59E0B] text-[#121212] px-12 py-5 shadow-[0_10px_30px_rgba(245,158,11,0.3)] hover:bg-white hover:text-[#121212]"
                      >
                        Confirm Handover →
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
            <div className="bg-white border border-[#E5E1D8] p-10 space-y-8 shadow-sm">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-[#121212] border-b border-[#F0EDE4] pb-4">Fulfillment Timeline</h3>
               <div className="space-y-8">
                  {order.statusHistory?.map((h: any, idx: number) => {
                    const isCurrent = h.status === order.status;
                    // In history, index 0 is oldest, last is newest. 
                    // Let's find the current index to determine past/future
                    const currentIndex = order.statusHistory.findIndex((sh: any) => sh.status === order.status);
                    const isPast = idx < currentIndex;

                    return (
                      <div key={idx} className="flex gap-6 relative group">
                        {idx !== order.statusHistory.length - 1 && (
                          <div className={`absolute left-[11px] top-8 w-px h-[calc(100%-12px)] ${isPast ? 'bg-[#F59E0B]' : 'bg-[#E5E1D8]'}`}></div>
                        )}
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 transition-all duration-500 ${
                          isCurrent 
                            ? 'bg-[#121212] border-[#121212] scale-110 shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                            : isPast 
                              ? 'bg-[#F59E0B] border-[#F59E0B]' 
                              : 'bg-white border-[#E5E1D8]'
                        }`}>
                           <div className={`w-1.5 h-1.5 rounded-full ${
                             isCurrent 
                               ? 'bg-[#F59E0B] animate-pulse' 
                               : isPast 
                                 ? 'bg-[#121212]' 
                                 : 'bg-[#E5E1D8]'
                           }`}></div>
                        </div>
                        <div className="flex-grow pt-0.5">
                           <p className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isCurrent ? 'text-[#121212]' : 'text-[#121212]/40'}`}>
                             {h.status.replace(/_/g, ' ')}
                             {isCurrent && <span className="ml-3 text-[8px] text-[#A34D15] italic font-bold">● ACTIVE</span>}
                           </p>
                           <p className="text-[9px] font-bold text-[#6B665E] uppercase tracking-widest mt-1 opacity-50 italic">{new Date(h.changedAt).toLocaleString()}</p>
                           {h.note && <p className="text-[11px] text-[#121212] italic mt-2 opacity-70 leading-relaxed border-l border-[#F0EDE4] pl-4">{h.note}</p>}
                        </div>
                      </div>
                    );
                  })}
               </div>
            </div>

            {/* Customer Dossier */}
            <div className="bg-[#F8F6F1] border border-[#E5E1D8] p-10 space-y-10">
               <div>
                  <p className="text-[9px] font-black text-[#121212] uppercase tracking-[0.4em] mb-8 border-b border-[#E5E1D8] pb-4">Counterparty Dossier</p>
                  <div className="flex items-center gap-6 mb-8">
                     <div className="w-14 h-14 bg-white border border-[#E5E1D8] flex items-center justify-center text-2xl shadow-sm">👤</div>
                     <div>
                        <p className="text-lg font-serif italic text-[#121212]">{order.buyer?.fullName || 'Anonymous'}</p>
                        <p className="text-[10px] font-bold text-[#6B665E] uppercase tracking-widest opacity-60">Verified Member</p>
                     </div>
                  </div>
                  
                  <div className="space-y-6">
                     <div className="space-y-2">
                        <p className="text-[8px] font-black text-[#A34D15] uppercase tracking-widest">Authorized Contact</p>
                        <p className="text-[11px] font-bold text-[#121212]">{order.buyer?.phone || 'Encrypted'}</p>
                     </div>
                     <div className="space-y-2">
                        <p className="text-[8px] font-black text-[#A34D15] uppercase tracking-widest">Deployment Address</p>
                        <p className="text-[11px] font-medium text-[#121212] italic leading-relaxed">{order.buyer?.deliveryAddress?.address || 'Terminal Pickup'}</p>
                     </div>
                  </div>
               </div>

               {order.notes && (
                  <div className="bg-[#121212] text-white p-6 relative overflow-hidden">
                     <div className="relative z-10">
                        <p className="text-[8px] font-black text-[#F59E0B] uppercase tracking-widest mb-3">Operator Instruction</p>
                        <p className="text-xs italic leading-relaxed opacity-70">"{order.notes}"</p>
                     </div>
                     <div className="absolute -bottom-4 -right-4 text-4xl opacity-5">💬</div>
                  </div>
               )}
            </div>
          </div>
        </div>

        {/* Negotiation Terminal */}
        {(order.status === 'awaiting_quote' || order.status === 'quote_sent' || (order.status === 'placed' && order.payment?.status !== 'paid')) && (
           <div className="bg-white border-2 border-[#121212] p-12">
              <div className="flex items-center gap-6 mb-12 border-b border-[#F0EDE4] pb-6">
                 <h2 className="text-3xl font-serif italic tracking-tighter text-[#121212]">Mandate Negotiation Terminal</h2>
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#F59E0B] rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Live Handshake Active</span>
                 </div>
              </div>
              <div className="max-w-4xl">
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
    </Layout>
  );
}
