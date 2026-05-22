'use client';
import React from 'react';
import { OrderChat } from './OrderChat';
import { orderApi } from '@/lib/api';
import { toast } from 'react-hot-toast';

export interface ReceiptOrder {
  _id: string;
  orderNumber?: string;
  status: string;
  createdAt?: string;
  buyer: {
    userId?: string;
    fullName: string;
    phone: string;
    deliveryAddress?: { address?: string; coordinates?: { lat: number; lng: number } };
  };
  seller: { sellerId?: string; userId?: string; fullName: string; stallId: string; marketId?: string };
  products?: Array<{ productId: string; name: string; unitPrice: number; quantity: number; weight?: number }>;
  attributes?: { isQuoteRequest?: string; prototypeImage?: string; isCustomizable?: string };
  product?: { productId: string; name: string; unitPrice: number; quantity: number; weight?: number };
  financials: { subtotal: number; deliveryFee: number; platformCommission: number; gatewayFee: number; totalAmount: number; sellerPayout: number; riderPayout: number };
  payment?: { method?: string; status?: string; transactionRef?: string; paidAt?: string };
  deliveryId?: string;
  delivery?: { rider?: { fullName?: string; phone?: string; plateNumber?: string }; status?: string; route?: { distanceKm?: number; estimatedMinutes?: number } };
  notes?: string;
  messages?: Array<{
    senderId: string;
    senderRole: 'BUYER' | 'SELLER';
    content: string;
    imageUrl?: string;
    type?: 'TEXT' | 'QUOTE' | 'COUNTER_QUOTE';
    quoteAmount?: number;
    timestamp: string;
  }>;
}

interface ReceiptViewProps {
  order: ReceiptOrder;
  role: 'buyer' | 'seller' | 'rider' | 'admin';
  onClose?: () => void;
  onOrderUpdated?: () => void | Promise<void>;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  awaiting_quote:       { label: 'AWAITING QUOTE',    color: '#ffd700' },
  quote_sent:           { label: 'QUOTE SENT',         color: '#ffd700' },
  placed:               { label: 'PLACED',             color: '#6B7280' },
  confirmed:            { label: 'CONFIRMED',          color: '#3B82F6' },
  preparing:            { label: 'PREPARING',          color: '#3B82F6' },
  ready_for_pickup:     { label: 'READY',              color: '#10B981' },
  picked_up:            { label: 'PICKED UP',          color: '#10B981' },
  in_transit:           { label: 'IN TRANSIT',         color: '#10B981' },
  awaiting_confirmation:{ label: 'AWAITING CONFIRM',  color: '#ffd700' },
  delivered:            { label: 'DELIVERED',          color: '#10B981' },
  cancelled:            { label: 'CANCELLED',          color: '#EF4444' },
  disputed:             { label: 'DISPUTED',           color: '#EF4444' },
  resolved:             { label: 'RESOLVED',           color: '#10B981' },
};

export function ReceiptView({ order, role, onClose, onOrderUpdated }: ReceiptViewProps) {
  const buyer = order.buyer || { fullName: 'Anonymous Buyer', phone: 'Hidden' };
  const seller = order.seller || { fullName: 'Verified Seller', stallId: 'N/A' };
  const sourceFinancials = order.financials || {};
  const financials = {
    subtotal: sourceFinancials.subtotal || 0,
    deliveryFee: sourceFinancials.deliveryFee || 0,
    platformCommission: sourceFinancials.platformCommission || 0,
    gatewayFee: sourceFinancials.gatewayFee || 0,
    totalAmount: sourceFinancials.totalAmount || 0,
    sellerPayout: sourceFinancials.sellerPayout || 0,
    riderPayout: sourceFinancials.riderPayout || 0,
  };
  const orderId = order._id || 'unknown-order';
  const orderStatus = order.status || 'placed';
  const [buyerName, setBuyerName] = React.useState(buyer.fullName || 'Anonymous Buyer');

  React.useEffect(() => {
    if ((buyerName === 'Anonymous Buyer' || !buyerName) && buyer.userId) {
      import('@/lib/api').then(({ userApi }) => {
        userApi.get(`/users/${buyer.userId}`)
          .then(res => { if (res.data?.data?.fullName) setBuyerName(res.data.data.fullName); })
          .catch(() => {});
      });
    }
  }, [buyer.userId, buyerName]);

  const productsList = order.products?.length ? order.products : order.product ? [order.product] : [];
  const receiptNumber = order.orderNumber || `ORD-${orderId.slice(0, 8).toUpperCase()}`;
  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-RW', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
  const statusInfo = STATUS_LABELS[orderStatus] || { label: orderStatus.toUpperCase(), color: '#6B7280' };
  const isNegotiation = orderStatus === 'awaiting_quote' || orderStatus === 'quote_sent' || order.attributes?.isQuoteRequest === 'true';
  const isPaid = order.payment?.status === 'paid';
  const chatRole = role === 'seller' ? 'SELLER' : role === 'buyer' ? 'BUYER' : null;

  const isPayout = order.products?.[0]?.productId === 'withdrawal';

  if (isPayout) {
    const isCompleted = order.status === 'delivered';
    const isCancelled = order.status === 'cancelled';
    const displayStatus = isCompleted ? 'SUCCESSFUL' : isCancelled ? 'FAILED' : 'PENDING';
    const statusColor = isCompleted ? '#10B981' : isCancelled ? '#EF4444' : '#F59E0B';
    const amount = financials.totalAmount || financials.subtotal || 0;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 overflow-hidden" style={{ backdropFilter: 'blur(4px)' }}>
        <div className="w-full max-w-md bg-[#fcf9f8] border border-[#e0e0e0] shadow-2xl rounded-2xl overflow-hidden flex flex-col animate-reveal">
          
          {/* Slip Header */}
          <div className="bg-[#e05300] text-white p-8 text-center relative border-b-2 border-[#ffd700]/20">
            <p className="text-[10px] font-black text-[#ff6b00] uppercase tracking-[0.4em] mb-2">Liquidation Slip</p>
            <h2 className="text-2xl font-sans tracking-normal text-white">{receiptNumber}</h2>
            <p className="text-xs text-white/50 mt-1 uppercase tracking-widest">{orderDate}</p>
            
            {onClose && (
              <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white transition-all text-xl font-light">
                &times;
              </button>
            )}
          </div>

          {/* Slip Body */}
          <div className="p-8 flex-grow overflow-y-auto space-y-8">
            
            {/* Massive Amount Display */}
            <div className="text-center bg-[#e05300]/5 p-6 border border-[#e0e0e0] rounded-xl space-y-2">
              <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-widest">Disbursed Amount</p>
              <h1 className="text-4xl font-sans text-[#1b1c1c] tracking-tight font-black">
                {amount.toLocaleString()} <span className="text-lg font-sans font-light text-[#414844]">RWF</span>
              </h1>
              
              {/* Custom Bank-style Status Pill */}
              <div className="pt-2 flex justify-center">
                <span 
                  className="px-4 py-1.5 text-[9px] font-black uppercase tracking-widest text-white rounded-full flex items-center gap-2"
                  style={{ backgroundColor: statusColor }}
                >
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                  {displayStatus}
                </span>
              </div>
            </div>

            {/* Audit Details */}
            <div className="space-y-4">
              <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-widest border-b border-[#e0e0e0] pb-2">Transaction Details</p>
              
              <div className="space-y-3">
                {[
                  { label: 'Beneficiary Name', value: seller.fullName || 'Verified Member' },
                  { label: 'Beneficiary Phone', value: buyer.phone || 'N/A' },
                  { label: 'Network Provider', value: order.payment?.method || 'MTN Mobile Money Gateway' },
                  { label: 'Transaction Type', value: 'Mobile Money Cash Out' },
                  { label: 'System Reference', value: order.payment?.transactionRef || orderId },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-start text-xs">
                    <span className="text-[#414844] font-medium uppercase text-[9px] tracking-wider">{label}</span>
                    <span className="text-[#1b1c1c] font-black text-right max-w-[200px] break-all">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Ledger Notes */}
            {order.notes && (
              <div className="p-4 bg-[#f0eded]/40 border border-[#e0e0e0] text-[10px] leading-relaxed text-[#414844] rounded-lg">
                <p className="font-black uppercase tracking-widest text-[#ff6b00] mb-1">Ledger Memo</p>
                {order.notes}
              </div>
            )}

            {/* Safety Disclaimer */}
            <div className="text-[9px] text-[#414844] text-center opacity-60 leading-relaxed border-t border-[#e0e0e0] pt-6">
              This payout request is processed securely via the RMF Wallet Gateway. Please check your Mobile Money wallet for network validation SMS.
            </div>
          </div>

          {/* Close Action */}
          {onClose && (
            <div className="border-t border-[#e0e0e0] bg-[#fcf9f8]">
              <button
                onClick={onClose}
                className="w-full py-4 text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c] bg-white hover:bg-[#e05300] hover:text-white transition-all"
              >
                Dismiss Voucher
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 overflow-hidden" style={{ backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-6xl max-h-[95vh] flex flex-col md:flex-row shadow-2xl border border-[#e0e0e0] rounded-lg bg-[#fcf9f8] overflow-hidden">

        {/* ── Left: Negotiation Panel ── */}
        {isNegotiation && chatRole && (
          <div className="w-full md:w-[420px] bg-[#e05300] flex flex-col border-r-0 md:border-r-2 border-b-2 md:border-b-0 border-[#ffd700]/20 overflow-y-auto">
            {/* Panel Header */}
            <div className="px-8 py-6 border-b border-[#ffd700]/20">
              <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-[0.5em] mb-1">Negotiation Hub</p>
              <h3 className="text-xl font-sans text-white leading-none">{receiptNumber}</h3>
            </div>

            {/* OrderChat */}
            <div className="flex-1 min-h-[300px]">
              <OrderChat
                orderId={orderId}
                initialMessages={order.messages || []}
                recipientName={role === 'buyer' ? seller.fullName : buyerName}
                userRole={chatRole}
                orderStatus={orderStatus}
                paymentStatus={order.payment?.status}
                marketId={seller.marketId}
                deliveryAddress={buyer.deliveryAddress}
                deliveryFee={financials.deliveryFee}
                onOrderUpdated={onOrderUpdated}
              />
            </div>

            {/* Quick Actions */}
            <div className="px-8 py-6 border-t border-[#ffd700]/20">
              <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-[0.4em] mb-4">Quick Actions</p>

              {role === 'seller' && orderStatus === 'awaiting_quote' && (
                <button
                  onClick={() => {
                    const priceStr = prompt('Enter your final quote price (RWF):');
                    if (!priceStr) return;
                    const price = Number(priceStr);
                    if (isNaN(price) || price < 100) return toast.error('Invalid price');
                    toast.promise(
                      orderApi.post(`/orders/${orderId}/quote`, { financials: { subtotal: price, deliveryFee: 1000 } }),
                      { loading: 'Sending quote...', success: 'Quote sent!', error: 'Failed to send quote' }
                    ).then(() => { if (onClose) onClose(); });
                  }}
                  className="w-full py-4 bg-[#ffd700] text-[#1b1c1c] text-[10px] font-black uppercase tracking-[0.4em] hover:bg-white transition-all"
                >
                  Propose Final Price
                </button>
              )}

              {role === 'buyer' && orderStatus === 'quote_sent' && (
                <div className="space-y-3">
                  <p className="text-[10px] text-white/60 leading-relaxed">
                    Seller proposed <span className="text-[#ff6b00] font-black">{financials.subtotal.toLocaleString()} RWF</span>
                  </p>
                  <button
                    onClick={() => {
                      toast.promise(
                        orderApi.put(`/orders/${orderId}/status`, { status: 'placed', userId: buyer.userId })
                          .then(() => orderApi.post(`/orders/${orderId}/retry-payment`)),
                        { loading: 'Accepting...', success: 'Quote accepted! Processing payment...', error: 'Failed to accept quote' }
                      ).then(() => { if (onClose) onClose(); });
                    }}
                    className="w-full py-4 bg-[#ffd700] text-[#1b1c1c] text-[10px] font-black uppercase tracking-[0.4em] hover:bg-white transition-all"
                  >
                    Accept Quote & Pay
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        const priceStr = prompt('Your counter-offer price (RWF):');
                        if (!priceStr) return;
                        const price = Number(priceStr);
                        if (isNaN(price) || price < 100) return toast.error('Invalid price');
                        toast.promise(
                          orderApi.post(`/orders/${orderId}/counter-offer`, { subtotal: price }),
                          { loading: 'Sending...', success: 'Counter-offer sent!', error: 'Failed' }
                        ).then(() => { if (onClose) onClose(); });
                      }}
                      className="py-3 border border-white/30 text-white text-[9px] font-black uppercase tracking-widest hover:border-white transition-all"
                    >Counter Offer</button>
                    <button
                      onClick={() => {
                        const reason = prompt('Reason for declining (optional):');
                        toast.promise(
                          orderApi.post(`/orders/${orderId}/reject-quote`, { reason: reason || undefined }),
                          { loading: 'Declining...', success: 'Quote declined', error: 'Failed' }
                        ).then(() => { if (onClose) onClose(); });
                      }}
                      className="py-3 border border-red-500/50 text-red-400 text-[9px] font-black uppercase tracking-widest hover:border-red-400 transition-all"
                    >Decline</button>
                  </div>
                </div>
              )}

              {orderStatus === 'cancelled' && (
                <p className="text-[10px] text-red-400 font-black uppercase tracking-widest">This negotiation has ended.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Right: Receipt Panel ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Receipt Header */}
          <div className="bg-[#e05300] px-8 py-6 flex items-start justify-between border-b-2 border-[#ffd700]/20">
            <div>
              <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-[0.5em] mb-1">Official Receipt</p>
              <h2 className="text-3xl font-sans text-white leading-none tracking-normal">{receiptNumber}</h2>
              <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-2">{orderDate}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[8px] font-black uppercase tracking-[0.4em] mb-1" style={{ color: statusInfo.color }}>Status</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-white">{statusInfo.label}</p>
                <div className="w-2 h-2 rounded-full mt-1 ml-auto animate-pulse" style={{ backgroundColor: statusInfo.color }} />
              </div>
              {onClose && (
                <button onClick={onClose} className="w-10 h-10 border border-white/20 text-white/60 hover:border-white hover:text-white transition-all text-lg flex items-center justify-center font-light">
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Receipt Body */}
          <div className="flex-1 overflow-y-auto">

            {/* Parties */}
            <div className="grid grid-cols-1 sm:grid-cols-2 border-b-2 border-[#e0e0e0]">
              <div className="p-8 border-b sm:border-b-0 sm:border-r border-[#e0e0e0]">
                <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-[0.4em] mb-4">Buyer</p>
                <p className="text-xl font-sans text-[#1b1c1c] leading-none mb-2">{buyerName}</p>
                <p className="text-[11px] text-[#414844] font-bold uppercase tracking-widest">{buyer.phone || 'Hidden'}</p>
                {buyer.deliveryAddress?.address && (
                  <p className="text-[10px] text-[#414844] mt-2 leading-relaxed">Address: {buyer.deliveryAddress.address}</p>
                )}
              </div>
              <div className="p-8">
                <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-[0.4em] mb-4">Seller</p>
                <p className="text-xl font-sans text-[#1b1c1c] leading-none mb-2">{seller.fullName || 'Verified Seller'}</p>
                <p className="text-[11px] text-[#414844] font-bold uppercase tracking-widest">Stall: {seller.stallId || 'N/A'}</p>
                {order.delivery?.rider && (
                  <div className="mt-4 pt-4 border-t border-[#e0e0e0]">
                    <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-[0.4em] mb-1">Rider</p>
                    <p className="text-[12px] font-bold text-[#1b1c1c]">{order.delivery.rider.fullName || 'Assigned'}</p>
                    {order.delivery.rider.plateNumber && <p className="text-[10px] text-[#414844]">Plate: {order.delivery.rider.plateNumber}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Project Brief */}
            {(isNegotiation || order.notes) && (
              <div className="px-8 py-6 border-b-2 border-[#e0e0e0] bg-[#e05300]/5">
                <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-[0.4em] mb-3">
                  {isNegotiation ? 'Project Brief' : 'Order Notes'}
                </p>
                <p className="text-sm text-[#1b1c1c]/80 leading-relaxed">{order.notes || 'No brief provided.'}</p>
                {orderStatus === 'quote_sent' && (
                  <div className="mt-3 inline-flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-[#ffd700] rounded-full animate-pulse" />
                    <span className="text-[9px] font-black text-[#ff6b00] uppercase tracking-widest">Quote Received: {financials.subtotal.toLocaleString()} RWF</span>
                  </div>
                )}
              </div>
            )}

            {/* Products Table */}
            <div className="border-b-2 border-[#e0e0e0]">
              <div className="px-8 py-4 bg-[#e05300]">
                <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-[0.4em]">Items Ordered</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e0e0e0]">
                    {['#', 'Item', 'Unit Price', 'Qty', 'Total'].map((h, i) => (
                      <th key={h} className={`py-3 px-4 text-[8px] font-black uppercase tracking-[0.3em] text-[#414844] ${i > 1 ? 'text-right' : i === 0 ? 'text-center' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-[11px] font-bold text-[#414844] uppercase tracking-widest">No product details</td>
                    </tr>
                  ) : (
                    productsList.map((item, idx) => (
                      <tr key={item.productId || idx} className="border-b border-[#e0e0e0] hover:bg-[#e05300]/3 transition-colors">
                        <td className="py-4 px-4 text-center text-[10px] font-black text-[#414844]">{idx + 1}</td>
                        <td className="py-4 px-4">
                          <p className="text-[13px] font-bold text-[#1b1c1c]">{item.name}</p>
                          {item.weight && <p className="text-[9px] text-[#414844] uppercase tracking-widest">{item.weight} kg</p>}
                        </td>
                        <td className="py-4 px-4 text-right text-[12px] text-[#414844] font-bold">{item.unitPrice.toLocaleString()} RWF</td>
                        <td className="py-4 px-4 text-right">
                          <span className="inline-block bg-[#e05300] text-white text-[9px] font-black px-3 py-1">{item.quantity}</span>
                        </td>
                        <td className="py-4 px-4 text-right text-[13px] font-black text-[#1b1c1c]">{(item.unitPrice * (item.quantity || 0)).toLocaleString()} <span className="text-[9px] text-[#414844]">RWF</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Financials */}
            <div className="grid grid-cols-1 sm:grid-cols-2 border-b-2 border-[#e0e0e0]">
              {/* Payment Summary */}
              <div className="p-8 border-b sm:border-b-0 sm:border-r border-[#e0e0e0]">
                <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-[0.4em] mb-6">Payment Summary</p>
                <div className="space-y-3">
                  {[
                    { label: 'Subtotal',       val: financials.subtotal,          dim: false },
                    { label: 'Delivery Fee',   val: financials.deliveryFee,        dim: false },
                    { label: 'Service Fee',    val: financials.gatewayFee,         dim: true  },
                    { label: 'Commission',     val: financials.platformCommission, dim: true  },
                  ].map(({ label, val, dim }) => (
                    <div key={label} className="flex justify-between items-end">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#414844]">{label}</span>
                      <span className={`text-[12px] font-bold ${dim ? 'text-[#414844]' : 'text-[#1b1c1c]'}`}>{(val || 0).toLocaleString()} RWF</span>
                    </div>
                  ))}
                  <div className="border-t-2 border-[#e0e0e0] pt-4 flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]">Total Paid</span>
                    <div className="text-right">
                      <span className="text-3xl font-sans tracking-normal text-[#1b1c1c]">{(financials.totalAmount || 0).toLocaleString()}</span>
                      <span className="text-[9px] font-black text-[#ff6b00] ml-1 uppercase">RWF</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment & Payout Info */}
              <div className="p-8 space-y-6">
                {/* Payment Method */}
                <div>
                  <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-[0.4em] mb-4">Payment</p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-bold text-[#1b1c1c]">{order.payment?.method || 'N/A'}</span>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 ${
                      isPaid ? 'bg-[#e05300] text-white' :
                      order.payment?.status === 'pending' ? 'bg-[#ffd700] text-[#1b1c1c]' :
                      'bg-red-500 text-white'
                    }`}>
                      {order.payment?.status?.toUpperCase() || 'N/A'}
                    </span>
                  </div>
                  {order.payment?.transactionRef && (
                    <p className="text-[9px] font-mono text-[#414844] break-all">{order.payment.transactionRef}</p>
                  )}
                  {order.payment?.paidAt && (
                    <p className="text-[9px] text-[#414844] mt-1">{new Date(order.payment.paidAt).toLocaleString()}</p>
                  )}
                </div>

                {/* Payout (seller/admin only) */}
                {(role === 'seller' || role === 'admin') && (
                  <div>
                    <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-[0.4em] mb-4">Payout Breakdown</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-[10px] font-bold text-[#414844] uppercase tracking-widest">Seller</span>
                        <span className="text-[12px] font-black text-[#1b1c1c]">+{(financials.sellerPayout || 0).toLocaleString()} RWF</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] font-bold text-[#414844] uppercase tracking-widest">Rider</span>
                        <span className="text-[12px] font-black text-[#1b1c1c]">+{(financials.riderPayout || 0).toLocaleString()} RWF</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Delivery */}
                {order.delivery && (
                  <div>
                    <p className="text-[9px] font-black text-[#ff6b00] uppercase tracking-[0.4em] mb-3">Delivery</p>
                    <div className="space-y-1">
                      {order.delivery.route?.distanceKm && (
                        <div className="flex justify-between">
                          <span className="text-[10px] text-[#414844] font-bold uppercase tracking-widest">Distance</span>
                          <span className="text-[11px] font-black text-[#1b1c1c]">{order.delivery.route.distanceKm.toFixed(1)} km</span>
                        </div>
                      )}
                      {order.delivery.route?.estimatedMinutes && (
                        <div className="flex justify-between">
                          <span className="text-[10px] text-[#414844] font-bold uppercase tracking-widest">ETA</span>
                          <span className="text-[11px] font-black text-[#1b1c1c]">{order.delivery.route.estimatedMinutes} min</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 bg-[#e05300] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="border border-[#ffd700]/40 px-4 py-2">
                  <p className="text-[8px] font-black text-[#ff6b00] uppercase tracking-[0.4em] mb-0.5">Payment Status</p>
                  <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: isPaid || orderStatus === 'delivered' ? '#10B981' : orderStatus === 'cancelled' ? '#9A6B5D' : '#ffedd5' }}>
                    {isPaid || orderStatus === 'delivered' ? 'SETTLED' : orderStatus === 'cancelled' ? 'CANCELLED' : 'PENDING'}
                  </p>
                </div>
                <div className="border border-white/10 px-4 py-2">
                  <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.4em] mb-0.5">Verified</p>
                  <p className="text-[11px] font-black text-white uppercase tracking-widest">{new Date().toLocaleDateString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-mono text-white/30 uppercase tracking-widest">Rwanda Marketplace</p>
                <p className="text-[8px] font-mono text-white/20">{receiptNumber} - Secure & Verified</p>
              </div>
            </div>
          </div>

          {/* Close */}
          {onClose && (
            <div className="border-t-2 border-[#e0e0e0] bg-[#fcf9f8]">
              <button
                onClick={onClose}
                className="w-full py-4 text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c] hover:bg-[#e05300] hover:text-white transition-all"
              >
                Close Receipt
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
