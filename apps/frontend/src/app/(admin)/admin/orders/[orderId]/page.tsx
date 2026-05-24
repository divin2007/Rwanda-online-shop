'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { ReceiptView, type ReceiptOrder } from '@/components/ui/ReceiptView';
import { useApi } from '@/hooks/useApi';
import { deliveryApi, orderApi } from '@/lib/api';
import { resolveUploadUrl } from '@/lib/uploadUrls';
import toast from 'react-hot-toast';

type AdminOrderLine = { productId?: string; name?: string; unitPrice?: number; quantity?: number; images?: string[]; weight?: number };

type AdminOrder = Omit<ReceiptOrder, 'products' | 'product'> & {
  products?: AdminOrderLine[];
  product?: AdminOrderLine;
  statusHistory?: Array<{ status: string; changedAt?: string; note?: string; changedBy?: string }>;
  dispute?: { isDisputed?: boolean; reason?: string; resolution?: string; resolvedAt?: string };
};

const money = (value?: number) => `${Number(value || 0).toLocaleString()} RWF`;
const negotiationStatuses = ['awaiting_quote', 'quote_sent'];
const ORDER_AUTO_REFRESH_MS = 5000;
const DELIVERY_AUTO_REFRESH_MS = 5000;

const statusTone = (status?: string) => {
  if (status === 'delivered' || status === 'resolved') return 'border-green-200 bg-green-50 text-green-700';
  if (status === 'cancelled' || status === 'disputed') return 'border-red-200 bg-red-50 text-red-700';
  if (negotiationStatuses.includes(status || '')) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-[#dfe7e2] bg-white text-[#405046]';
};

export default function AdminOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = React.use(params);
  const { data: order, loading, execute: fetchOrder } = useApi<AdminOrder>(orderApi, 'get', `/orders/${orderId}`, { refreshInterval: ORDER_AUTO_REFRESH_MS });
  const [delivery, setDelivery] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteNote, setQuoteNote] = useState('');
  const [isSendingQuote, setIsSendingQuote] = useState(false);
  const [activeMessageChannel, setActiveMessageChannel] = useState<'ORDER' | 'DELIVERY'>('ORDER');

  const fetchDelivery = React.useCallback(async (deliveryId?: string) => {
    if (!deliveryId) {
      setDelivery(null);
      return null;
    }

    try {
      const res = await deliveryApi.get(`/deliveries/${deliveryId}`);
      const deliveryData = res.data?.data || null;
      setDelivery(deliveryData);
      return deliveryData;
    } catch {
      setDelivery(null);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder, orderId]);

  useEffect(() => {
    if (!order?.deliveryId) {
      setDelivery(null);
      return;
    }
    fetchDelivery(order.deliveryId);
    const timer = window.setInterval(() => {
      fetchDelivery(order.deliveryId);
    }, DELIVERY_AUTO_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [order?.deliveryId, fetchDelivery]);

  const products = useMemo<AdminOrderLine[]>(() => {
    if (order?.products?.length) return order.products;
    return order?.product ? [order.product] : [];
  }, [order]);
  const orderMessages = useMemo(() => (order?.messages || []).filter(message => (message.channel || 'ORDER') === 'ORDER'), [order]);
  const deliveryMessages = useMemo(() => (order?.messages || []).filter(message => (message.channel || 'ORDER') === 'DELIVERY'), [order]);
  const visibleMessages = activeMessageChannel === 'ORDER' ? orderMessages : deliveryMessages;

  const financials = {
    subtotal: 0,
    deliveryFee: 0,
    platformCommission: 0,
    gatewayFee: 0,
    totalAmount: 0,
    sellerPayout: 0,
    riderPayout: 0,
    ...(order?.financials || {}),
  };
  const status = order?.status || 'placed';
  const isNegotiation = negotiationStatuses.includes(status) || order?.attributes?.isQuoteRequest === 'true';
  const receiptOrder = order ? {
    ...order,
    financials,
    products: products.map(item => ({
      productId: item.productId || '',
      name: item.name || 'Product',
      unitPrice: item.unitPrice || 0,
      quantity: item.quantity || 1,
      weight: item.weight,
    })),
    delivery: delivery ? { rider: delivery.rider, status: delivery.status, route: delivery.route } : order.delivery,
  } as ReceiptOrder : null;

  const sendAdminQuote = async () => {
    const subtotal = Number(quoteAmount);
    if (!subtotal || subtotal < 100) {
      toast.error('Enter a valid quote amount');
      return;
    }
    setIsSendingQuote(true);
    try {
      await orderApi.post(`/orders/${orderId}/admin/quote`, {
        financials: {
          subtotal,
          deliveryFee: financials.deliveryFee || 1000,
          note: quoteNote.trim() || `Admin reviewed and sent a seller-side quote for ${subtotal.toLocaleString()} RWF`,
        },
      });
      setQuoteAmount('');
      setQuoteNote('');
      toast.success('Quote sent to buyer');
      fetchOrder();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to send quote');
    } finally {
      setIsSendingQuote(false);
    }
  };

  const updateStatus = async (nextStatus: string) => {
    try {
      await orderApi.put(`/orders/${orderId}/status`, { status: nextStatus });
      toast.success(`Order moved to ${nextStatus.replace(/_/g, ' ')}`);
      fetchOrder();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not update status');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ff6b00] border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl py-24 text-center">
          <h1 className="text-2xl font-black text-[#1b1c1c]">Order not found</h1>
          <Link href="/admin?tab=analytics" className="mt-6 inline-flex rounded-md border border-[#dfe7e2] px-5 py-3 text-xs font-black uppercase tracking-widest text-[#405046]">
            Back to admin
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {showReceipt && receiptOrder && (
        <ReceiptView order={receiptOrder} role="admin" onClose={() => setShowReceipt(false)} onOrderUpdated={async () => { await fetchOrder(); }} />
      )}

      <div className="space-y-6 pb-20">
        <section className="rounded-lg border border-[#dfe7e2] bg-white shadow-sm">
          <div className="flex flex-col gap-6 border-b border-[#dfe7e2] bg-[#fcf9f8] p-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/admin?tab=analytics" className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">
                Admin dashboard
              </Link>
              <h1 className="mt-3 text-3xl font-black tracking-normal text-[#1b1c1c]">
                Order {order.orderNumber || `#${order._id.slice(0, 8).toUpperCase()}`}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-[#5f7569]">
                <span>{order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Date unavailable'}</span>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone(status)}`}>
                  {status.replace(/_/g, ' ')}
                </span>
                <span className="rounded-full border border-[#dfe7e2] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                  Payment {order.payment?.status || 'pending'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setShowReceipt(true)} className="rounded-md border border-[#dfe7e2] bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#405046] hover:border-[#ff6b00] hover:text-[#ff6b00]">
                View Receipt
              </button>
              {status === 'confirmed' && <button onClick={() => updateStatus('preparing')} className="rounded-md bg-[#ff6b00] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white">Start Preparing</button>}
              {status === 'preparing' && <button onClick={() => updateStatus('ready_for_pickup')} className="rounded-md bg-[#ff6b00] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white">Ready For Pickup</button>}
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[1.5fr_0.9fr]">
            <div className="border-b border-[#dfe7e2] p-6 lg:border-b-0 lg:border-r">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#1b1c1c]">Conversation Review</h2>
                  <p className="mt-1 text-xs font-bold text-[#5f7569]">
                    {activeMessageChannel === 'ORDER' ? 'Buyer and seller negotiation thread' : 'Buyer and rider delivery thread'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveMessageChannel('ORDER')}
                    className={`rounded-md border px-3 py-2 text-[9px] font-black uppercase tracking-widest ${activeMessageChannel === 'ORDER' ? 'border-[#ff6b00] bg-[#ff6b00] text-white' : 'border-[#dfe7e2] bg-white text-[#405046]'}`}
                  >
                    Seller chat ({orderMessages.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMessageChannel('DELIVERY')}
                    className={`rounded-md border px-3 py-2 text-[9px] font-black uppercase tracking-widest ${activeMessageChannel === 'DELIVERY' ? 'border-[#ff6b00] bg-[#ff6b00] text-white' : 'border-[#dfe7e2] bg-white text-[#405046]'}`}
                  >
                    Rider chat ({deliveryMessages.length})
                  </button>
                </div>
              </div>
              <div className="max-h-[560px] space-y-4 overflow-y-auto rounded-lg border border-[#dfe7e2] bg-[#f7faf8] p-4">
                {visibleMessages.length ? visibleMessages.map((message, index) => (
                  <div key={`${message.timestamp}-${index}`} className={`max-w-[86%] rounded-lg border bg-white p-4 shadow-sm ${message.senderRole === 'SELLER' || message.senderRole === 'RIDER' ? 'ml-auto border-[#ffd8bf]' : 'border-[#dfe7e2]'}`}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">
                        {message.senderRole}{message.recipientRole ? ` to ${message.recipientRole}` : ''}
                      </span>
                      <span className="text-[10px] font-bold text-[#809087]">{new Date(message.timestamp).toLocaleString()}</span>
                    </div>
                    {message.quoteAmount ? (
                      <div className="mb-3 rounded-md border border-[#ffedd5] bg-[#fff7ed] p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#b54708]">{message.type === 'COUNTER_QUOTE' ? 'Counter offer' : 'Quote'}</p>
                        <p className="mt-1 text-2xl font-black text-[#1b1c1c]">{money(message.quoteAmount)}</p>
                      </div>
                    ) : null}
                    {message.imageUrl && <img src={resolveUploadUrl(message.imageUrl, 'order')} alt="Message attachment" className="mb-3 max-h-60 w-full rounded-md object-cover" />}
                    <p className="text-sm font-semibold leading-relaxed text-[#1b1c1c]">{message.content}</p>
                  </div>
                )) : (
                  <div className="py-16 text-center text-sm font-bold text-[#809087]">
                    No {activeMessageChannel === 'ORDER' ? 'seller' : 'rider'} messages yet.
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-5 p-6">
              <section className="rounded-lg border border-[#dfe7e2] bg-white p-5">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#1b1c1c]">Admin Quote Console</h2>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#5f7569]">
                  Send a seller-side quote without opening the receipt. The buyer sees it in the negotiation thread.
                </p>
                <div className="mt-5 space-y-3">
                  <input type="number" value={quoteAmount} onChange={event => setQuoteAmount(event.target.value)} placeholder="Quote subtotal in RWF" className="h-12 w-full rounded-md border border-[#dfe7e2] px-4 text-sm font-bold outline-none focus:border-[#ff6b00]" />
                  <textarea value={quoteNote} onChange={event => setQuoteNote(event.target.value)} placeholder="Optional quote note" className="min-h-24 w-full rounded-md border border-[#dfe7e2] p-4 text-sm font-semibold outline-none focus:border-[#ff6b00]" />
                  <button disabled={isSendingQuote || !isNegotiation} onClick={sendAdminQuote} className="w-full rounded-md bg-[#ff6b00] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-40">
                    {isSendingQuote ? 'Sending...' : 'Send Quote'}
                  </button>
                </div>
                {!isNegotiation && <p className="mt-3 text-xs font-bold text-[#9a6b5d]">Quote controls are active only during negotiation.</p>}
              </section>

              <section className="rounded-lg border border-[#dfe7e2] bg-[#fcf9f8] p-5">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#1b1c1c]">Financials</h2>
                <div className="mt-4 space-y-3 text-sm">
                  {[
                    ['Subtotal', financials.subtotal],
                    ['Delivery', financials.deliveryFee],
                    ['Gateway', financials.gatewayFee],
                    ['Commission', financials.platformCommission],
                    ['Seller payout', financials.sellerPayout],
                    ['Rider payout', financials.riderPayout],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <span className="font-bold text-[#5f7569]">{label}</span>
                      <span className="font-black text-[#1b1c1c]">{money(value as number)}</span>
                    </div>
                  ))}
                  <div className="border-t border-[#dfe7e2] pt-3">
                    <div className="flex justify-between">
                      <span className="text-xs font-black uppercase tracking-widest text-[#1b1c1c]">Total</span>
                      <span className="text-xl font-black text-[#1b1c1c]">{money(financials.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-[#dfe7e2] bg-white p-5">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#1b1c1c]">Parties</h2>
                <div className="mt-4 space-y-4 text-sm">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Buyer</p>
                    <p className="mt-1 font-black text-[#1b1c1c]">{order.buyer?.fullName || 'Anonymous buyer'}</p>
                    <p className="text-xs font-semibold text-[#5f7569]">{order.buyer?.phone || 'Phone hidden'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Seller</p>
                    <p className="mt-1 font-black text-[#1b1c1c]">{order.seller?.fullName || 'Verified seller'}</p>
                    <p className="text-xs font-semibold text-[#5f7569]">Stall {order.seller?.stallId || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Delivery</p>
                    <p className="mt-1 font-semibold text-[#1b1c1c]">{order.buyer?.deliveryAddress?.address || 'No delivery address set'}</p>
                    <p className="text-xs font-semibold text-[#5f7569]">{delivery?.status ? `Delivery ${delivery.status}` : 'No delivery record yet'}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-[#dfe7e2] bg-white p-5">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#1b1c1c]">Process Evidence</h2>
                <div className="mt-4 space-y-4">
                  {delivery?.pickup?.pickupPhotoUrl ? (
                    <div className="overflow-hidden rounded-md border border-[#dfe7e2] bg-[#f7faf8]">
                      <img src={resolveUploadUrl(delivery.pickup.pickupPhotoUrl, 'delivery')} alt="Pickup proof" className="max-h-56 w-full object-cover" />
                      <div className="border-t border-[#dfe7e2] p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Rider pickup photo</p>
                        <p className="mt-1 text-xs font-semibold text-[#5f7569]">
                          {delivery.pickup?.qrScannedAt ? `QR scanned ${new Date(delivery.pickup.qrScannedAt).toLocaleString()}` : 'QR scan not recorded'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed border-[#dfe7e2] bg-[#f7faf8] p-4 text-xs font-bold text-[#809087]">
                      No rider pickup image is attached to this order yet.
                    </p>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-[#dfe7e2] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-[#1b1c1c]">Items</h2>
            <div className="divide-y divide-[#edf1ee]">
              {products.length ? products.map((product, index) => (
                <div key={`${product.productId}-${index}`} className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-4">
                    {product.images?.[0] && <img src={resolveUploadUrl(product.images[0], 'product')} alt={product.name || 'Product'} className="h-14 w-14 rounded-md object-cover" />}
                    <div>
                      <p className="font-black text-[#1b1c1c]">{product.name || 'Product'}</p>
                      <p className="text-xs font-bold text-[#5f7569]">Qty {product.quantity || 1}</p>
                    </div>
                  </div>
                  <p className="text-sm font-black text-[#1b1c1c]">{money((product.unitPrice || 0) * (product.quantity || 1))}</p>
                </div>
              )) : <p className="py-8 text-sm font-bold text-[#809087]">No item data attached.</p>}
            </div>
          </div>

          <div className="rounded-lg border border-[#dfe7e2] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-[#1b1c1c]">Status History</h2>
            <div className="space-y-4">
              {(order.statusHistory || []).map((item, index) => (
                <div key={`${item.status}-${index}`} className="border-l-2 border-[#ffedd5] pl-4">
                  <p className="text-xs font-black uppercase tracking-widest text-[#1b1c1c]">{item.status.replace(/_/g, ' ')}</p>
                  <p className="mt-1 text-xs font-semibold text-[#809087]">{item.changedAt ? new Date(item.changedAt).toLocaleString() : 'Time unknown'}</p>
                  {item.note && <p className="mt-2 text-sm font-semibold text-[#405046]">{item.note}</p>}
                </div>
              ))}
              {!order.statusHistory?.length && <p className="py-8 text-sm font-bold text-[#809087]">No status history recorded.</p>}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
