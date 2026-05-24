'use client';
import React from 'react';
import { OrderChat } from './OrderChat';

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
    senderRole: 'BUYER' | 'SELLER' | 'RIDER' | 'ADMIN';
    channel?: 'ORDER' | 'DELIVERY' | 'DISPUTE';
    recipientRole?: 'BUYER' | 'SELLER' | 'RIDER' | 'ADMIN';
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

const STATUS_LABELS: Record<string, { label: string; color: string; tone: string }> = {
  awaiting_quote: { label: 'Awaiting Quote', color: '#b45309', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  quote_sent: { label: 'Quote Sent', color: '#b45309', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  placed: { label: 'Placed', color: '#405046', tone: 'bg-white text-[#405046] border-[#dfe7e2]' },
  confirmed: { label: 'Confirmed', color: '#2563eb', tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  preparing: { label: 'Preparing', color: '#2563eb', tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  ready_for_pickup: { label: 'Ready', color: '#15803d', tone: 'bg-green-50 text-green-700 border-green-200' },
  picked_up: { label: 'Picked Up', color: '#15803d', tone: 'bg-green-50 text-green-700 border-green-200' },
  in_transit: { label: 'In Transit', color: '#15803d', tone: 'bg-green-50 text-green-700 border-green-200' },
  awaiting_confirmation: { label: 'Awaiting Confirm', color: '#b45309', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  delivered: { label: 'Delivered', color: '#15803d', tone: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', color: '#b91c1c', tone: 'bg-red-50 text-red-700 border-red-200' },
  disputed: { label: 'Disputed', color: '#b91c1c', tone: 'bg-red-50 text-red-700 border-red-200' },
  resolved: { label: 'Resolved', color: '#15803d', tone: 'bg-green-50 text-green-700 border-green-200' },
};

const money = (value?: number) => `${Number(value || 0).toLocaleString()} RWF`;

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
  const productsList = order.products?.length ? order.products : order.product ? [order.product] : [];
  const receiptNumber = order.orderNumber || `ORD-${orderId.slice(0, 8).toUpperCase()}`;
  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-RW', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Date unavailable';
  const statusInfo = STATUS_LABELS[orderStatus] || { label: orderStatus.replace(/_/g, ' '), color: '#405046', tone: 'bg-white text-[#405046] border-[#dfe7e2]' };
  const isNegotiation = orderStatus === 'awaiting_quote' || orderStatus === 'quote_sent' || order.attributes?.isQuoteRequest === 'true';
  const chatRole = role === 'seller' ? 'SELLER' : role === 'buyer' ? 'BUYER' : null;
  const isPaid = order.payment?.status === 'paid' || orderStatus === 'delivered';
  const isPayout = order.products?.[0]?.productId === 'withdrawal';

  if (isPayout) {
    const amount = financials.totalAmount || financials.subtotal || 0;
    const displayStatus = order.status === 'delivered' ? 'Successful' : order.status === 'cancelled' ? 'Failed' : 'Pending';
    return (
      <div className="rmf-modal-overlay">
        <div className="rmf-modal-panel max-w-2xl animate-reveal bg-white">
          <header className="flex items-start justify-between border-b border-[#dfe7e2] bg-[#fcf9f8] p-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">Liquidation Slip</p>
              <h2 className="mt-2 text-2xl font-black text-[#1b1c1c]">{receiptNumber}</h2>
              <p className="mt-1 text-xs font-bold text-[#6f7f76]">{orderDate}</p>
            </div>
            {onClose && <button onClick={onClose} className="rmf-modal-close" aria-label="Close receipt">x</button>}
          </header>
          <div className="space-y-6 p-6">
            <div className="rounded-lg border border-[#dfe7e2] bg-[#f7faf8] p-6 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Disbursed Amount</p>
              <p className="mt-3 text-4xl font-black text-[#1b1c1c]">{money(amount)}</p>
              <span className="mt-4 inline-flex rounded-full border border-[#dfe7e2] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#405046]">{displayStatus}</span>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ['Beneficiary', seller.fullName || 'Verified Member'],
                ['Phone', buyer.phone || 'N/A'],
                ['Method', order.payment?.method || 'Mobile Money'],
                ['Reference', order.payment?.transactionRef || orderId],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-[#edf1ee] pb-3">
                  <span className="font-bold text-[#5f7569]">{label}</span>
                  <span className="text-right font-black text-[#1b1c1c]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rmf-modal-overlay">
      <div className="rmf-modal-panel max-w-6xl animate-reveal bg-[#f7faf8]">
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex flex-col gap-5 border-b border-[#dfe7e2] bg-white px-6 py-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">Official Receipt</p>
              <h2 className="mt-2 text-3xl font-black tracking-normal text-[#1b1c1c]">{receiptNumber}</h2>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-[#6f7f76]">{orderDate}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className={`rounded-lg border px-4 py-3 text-right ${statusInfo.tone}`}>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Status</p>
                <p className="mt-1 text-xs font-black uppercase tracking-widest">{statusInfo.label}</p>
              </div>
              {onClose && <button onClick={onClose} className="rmf-modal-close" aria-label="Close receipt">x</button>}
            </div>
          </header>

          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.15fr_0.85fr]">
            <main className="space-y-5 p-6">
              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[#dfe7e2] bg-white p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Buyer</p>
                  <p className="mt-3 text-lg font-black text-[#1b1c1c]">{buyer.fullName || 'Anonymous Buyer'}</p>
                  <p className="text-sm font-semibold text-[#5f7569]">{buyer.phone || 'Hidden'}</p>
                  {buyer.deliveryAddress?.address && <p className="mt-3 text-sm font-semibold leading-relaxed text-[#405046]">{buyer.deliveryAddress.address}</p>}
                </div>
                <div className="rounded-lg border border-[#dfe7e2] bg-white p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Seller</p>
                  <p className="mt-3 text-lg font-black text-[#1b1c1c]">{seller.fullName || 'Verified Seller'}</p>
                  <p className="text-sm font-semibold text-[#5f7569]">Stall {seller.stallId || 'N/A'}</p>
                  {order.delivery?.rider && <p className="mt-3 text-sm font-semibold text-[#405046]">Rider: {order.delivery.rider.fullName || 'Assigned'} {order.delivery.rider.plateNumber ? `(${order.delivery.rider.plateNumber})` : ''}</p>}
                </div>
              </section>

              {(isNegotiation || order.notes) && (
                <section className="rounded-lg border border-[#dfe7e2] bg-white p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">{isNegotiation ? 'Negotiation Brief' : 'Order Notes'}</p>
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-[#405046]">{order.notes || 'No brief provided.'}</p>
                  {orderStatus === 'quote_sent' && <p className="mt-3 text-xs font-black uppercase tracking-widest text-[#b54708]">Current quote: {money(financials.subtotal)}</p>}
                </section>
              )}

              <section className="overflow-hidden rounded-lg border border-[#dfe7e2] bg-white">
                <div className="border-b border-[#dfe7e2] bg-[#fcf9f8] px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#1b1c1c]">Items Ordered</p>
                </div>
                <div className="divide-y divide-[#edf1ee]">
                  {productsList.length === 0 ? (
                    <p className="py-10 text-center text-sm font-bold text-[#809087]">No product details</p>
                  ) : productsList.map((item, idx) => (
                    <div key={`${item.productId || item.name || 'item'}-${idx}`} className="grid grid-cols-[1fr_auto] gap-4 px-5 py-4">
                      <div>
                        <p className="font-black text-[#1b1c1c]">{item.name}</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-[#6f7f76]">Qty {item.quantity} {item.weight ? `- ${item.weight} kg` : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-[#1b1c1c]">{money(item.unitPrice * (item.quantity || 0))}</p>
                        <p className="text-xs font-semibold text-[#6f7f76]">{money(item.unitPrice)} each</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {isNegotiation && chatRole && (
                <section className="rounded-lg border border-[#dfe7e2] bg-white p-4">
                  <OrderChat
                    orderId={orderId}
                    initialMessages={order.messages || []}
                    recipientName={role === 'buyer' ? seller.fullName : buyer.fullName}
                    userRole={chatRole}
                    orderStatus={orderStatus}
                    paymentStatus={order.payment?.status}
                    marketId={seller.marketId}
                    deliveryAddress={buyer.deliveryAddress}
                    deliveryFee={financials.deliveryFee}
                    onOrderUpdated={onOrderUpdated}
                  />
                </section>
              )}
            </main>

            <aside className="space-y-5 border-t border-[#dfe7e2] bg-white p-6 lg:border-l lg:border-t-0">
              <section className="rounded-lg border border-[#dfe7e2] bg-[#fcf9f8] p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Amount Due</p>
                <p className="mt-3 text-4xl font-black tracking-normal text-[#1b1c1c]">{financials.totalAmount.toLocaleString()} <span className="text-sm font-black uppercase text-[#6f7f76]">RWF</span></p>
                <div className="mt-5 space-y-3 border-t border-[#dfe7e2] pt-5">
                  {[
                    ['Subtotal', financials.subtotal],
                    ['Delivery', financials.deliveryFee],
                    ['Gateway fee', financials.gatewayFee],
                    ['Platform commission', financials.platformCommission],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 text-sm">
                      <span className="font-bold text-[#5f7569]">{label}</span>
                      <span className="font-black text-[#1b1c1c]">{money(value as number)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-[#dfe7e2] bg-white p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Payment</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-black text-[#1b1c1c]">{order.payment?.method || 'Not selected'}</span>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${isPaid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {order.payment?.status || 'pending'}
                  </span>
                </div>
                {order.payment?.transactionRef && <p className="mt-3 break-all font-mono text-xs text-[#5f7569]">{order.payment.transactionRef}</p>}
                {order.payment?.paidAt && <p className="mt-2 text-xs font-semibold text-[#5f7569]">{new Date(order.payment.paidAt).toLocaleString()}</p>}
              </section>

              {(role === 'seller' || role === 'admin') && (
                <section className="rounded-lg border border-[#dfe7e2] bg-white p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Payouts</p>
                  <div className="mt-4 space-y-3">
                    <div className="flex justify-between text-sm"><span className="font-bold text-[#5f7569]">Seller</span><span className="font-black text-[#1b1c1c]">+{money(financials.sellerPayout)}</span></div>
                    <div className="flex justify-between text-sm"><span className="font-bold text-[#5f7569]">Rider</span><span className="font-black text-[#1b1c1c]">+{money(financials.riderPayout)}</span></div>
                  </div>
                </section>
              )}

              {order.delivery && (
                <section className="rounded-lg border border-[#dfe7e2] bg-white p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Delivery</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between"><span className="font-bold text-[#5f7569]">Status</span><span className="font-black text-[#1b1c1c]">{order.delivery.status || 'Pending'}</span></div>
                    {order.delivery.route?.distanceKm && <div className="flex justify-between"><span className="font-bold text-[#5f7569]">Distance</span><span className="font-black text-[#1b1c1c]">{order.delivery.route.distanceKm.toFixed(1)} km</span></div>}
                    {order.delivery.route?.estimatedMinutes && <div className="flex justify-between"><span className="font-bold text-[#5f7569]">ETA</span><span className="font-black text-[#1b1c1c]">{order.delivery.route.estimatedMinutes} min</span></div>}
                  </div>
                </section>
              )}
            </aside>
          </div>

          {onClose && (
            <footer className="border-t border-[#dfe7e2] bg-white px-6 py-4 text-right">
              <button onClick={onClose} className="rounded-md border border-[#dfe7e2] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[#405046] hover:border-[#ff6b00] hover:text-[#ff6b00]">
                Close Receipt
              </button>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}
