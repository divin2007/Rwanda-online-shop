'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { useApi } from '@/hooks/useApi';
import { deliveryApi, orderApi } from '@/lib/api';
import { resolveUploadUrl } from '@/lib/uploadUrls';
import toast from 'react-hot-toast';

type ReviewMessage = {
  senderRole?: 'BUYER' | 'SELLER' | 'RIDER' | 'ADMIN';
  recipientRole?: 'BUYER' | 'SELLER' | 'RIDER' | 'ADMIN';
  channel?: 'ORDER' | 'DELIVERY' | 'DISPUTE';
  content?: string;
  imageUrl?: string;
  type?: string;
  quoteAmount?: number;
  timestamp?: string;
};

type ReviewOrder = {
  _id: string;
  orderNumber?: string;
  status?: string;
  createdAt?: string;
  buyer?: any;
  seller?: any;
  products?: any[];
  product?: any;
  financials?: any;
  payment?: any;
  deliveryId?: string;
  dispute?: { isDisputed?: boolean; reason?: string; raisedAt?: string; resolvedAt?: string; resolution?: string };
  messages?: ReviewMessage[];
  statusHistory?: Array<{ status?: string; changedAt?: string; note?: string; changedBy?: string }>;
};

const ORDER_AUTO_REFRESH_MS = 5000;
const DELIVERY_AUTO_REFRESH_MS = 5000;

const money = (value?: number) => `${Number(value || 0).toLocaleString()} RWF`;
const formatDate = (value?: string) => value ? new Date(value).toLocaleString() : 'Not recorded';
const normalizedStatus = (status?: string) => String(status || 'unknown').replace(/_/g, ' ');

function ReviewPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-[#dfe7e2] bg-white shadow-sm">
      <header className="border-b border-[#dfe7e2] bg-[#fcf9f8] p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">{eyebrow}</p>
        <h2 className="mt-2 text-xl font-black tracking-normal text-[#1b1c1c]">{title}</h2>
      </header>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}

function ProcessSteps({ steps }: { steps: Array<{ label: string; done: boolean; detail?: string }> }) {
  return (
    <div className="space-y-3">
      {steps.map(step => (
        <div key={step.label} className="flex gap-3">
          <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${step.done ? 'bg-[#ff6b00]' : 'bg-[#c7d1cb]'}`} />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-[#1b1c1c]">{step.label}</p>
            {step.detail && <p className="mt-1 text-xs font-semibold leading-relaxed text-[#5f7569]">{step.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageList({ messages, empty }: { messages: ReviewMessage[]; empty: string }) {
  if (!messages.length) {
    return <div className="rounded-md border border-dashed border-[#dfe7e2] bg-[#f7faf8] p-5 text-center text-xs font-bold text-[#809087]">{empty}</div>;
  }

  return (
    <div className="max-h-96 space-y-3 overflow-y-auto rounded-md border border-[#dfe7e2] bg-[#f7faf8] p-3">
      {messages.map((message, index) => (
        <article key={`${message.timestamp || 'message'}-${index}`} className="rounded-md border border-[#dfe7e2] bg-white p-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">
              {message.senderRole || 'UNKNOWN'}{message.recipientRole ? ` to ${message.recipientRole}` : ''}
            </p>
            <p className="text-right text-[10px] font-bold text-[#809087]">{formatDate(message.timestamp)}</p>
          </div>
          {message.quoteAmount ? (
            <div className="mb-2 rounded-md border border-[#ffedd5] bg-[#fff7ed] p-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#b54708]">{message.type === 'COUNTER_QUOTE' ? 'Counter offer' : 'Quote'}</p>
              <p className="mt-1 text-lg font-black text-[#1b1c1c]">{money(message.quoteAmount)}</p>
            </div>
          ) : null}
          {message.imageUrl && <img src={resolveUploadUrl(message.imageUrl, 'order')} alt="Message attachment" className="mb-2 max-h-48 w-full rounded-md object-cover" />}
          <p className="text-sm font-semibold leading-relaxed text-[#1b1c1c]">{message.content || 'Message has no text content.'}</p>
        </article>
      ))}
    </div>
  );
}

export default function AdminDisputePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = React.use(params);
  const { data: order, loading, execute: fetchOrder } = useApi<ReviewOrder>(orderApi, 'get', `/orders/${orderId}`, { refreshInterval: ORDER_AUTO_REFRESH_MS });
  const [delivery, setDelivery] = useState<any>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchDelivery = React.useCallback(async (deliveryId?: string) => {
    if (!deliveryId) {
      setDelivery(null);
      return;
    }

    try {
      const response = await deliveryApi.get(`/deliveries/${deliveryId}`);
      setDelivery(response.data?.data || null);
    } catch {
      setDelivery(null);
    }
  }, []);

  useEffect(() => {
    if (!order?.deliveryId) {
      setDelivery(null);
      return;
    }

    fetchDelivery(order.deliveryId);
    const timer = window.setInterval(() => fetchDelivery(order.deliveryId), DELIVERY_AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [fetchDelivery, order?.deliveryId]);

  const products = useMemo(() => {
    if (order?.products?.length) return order.products;
    return order?.product ? [order.product] : [];
  }, [order]);

  const messages = order?.messages || [];
  const orderMessages = messages.filter(message => (message.channel || 'ORDER') === 'ORDER');
  const deliveryMessages = messages.filter(message => (message.channel || 'ORDER') === 'DELIVERY');
  const buyerMessages = messages.filter(message => message.senderRole === 'BUYER' || message.recipientRole === 'BUYER');
  const sellerMessages = orderMessages.filter(message => message.senderRole === 'SELLER' || message.senderRole === 'BUYER' || message.recipientRole === 'SELLER');
  const riderMessages = deliveryMessages.filter(message => message.senderRole === 'RIDER' || message.senderRole === 'BUYER' || message.recipientRole === 'RIDER');
  const statusHistory = order?.statusHistory || [];
  const hasStatus = (...statuses: string[]) => statuses.includes(order?.status || '') || statusHistory.some(item => statuses.includes(item.status || ''));

  const evidence = useMemo(() => {
    const items: Array<{ title: string; url: string; service: 'product' | 'order' | 'delivery'; meta?: string }> = [];
    products.forEach((product, index) => {
      const productImages = [product.imageUrl, ...(product.images || []), product.prototypeImage].filter(Boolean);
      productImages.forEach((url: string, imageIndex: number) => {
        items.push({
          title: product.name || `Product ${index + 1}`,
          url,
          service: 'product',
          meta: `Product image ${imageIndex + 1}`,
        });
      });
    });
    messages.forEach((message, index) => {
      if (message.imageUrl) {
        items.push({
          title: `${message.senderRole || 'User'} message`,
          url: message.imageUrl,
          service: 'order',
          meta: formatDate(message.timestamp) || `Message ${index + 1}`,
        });
      }
    });
    if (delivery?.pickup?.pickupPhotoUrl) {
      items.push({
        title: 'Pickup proof',
        url: delivery.pickup.pickupPhotoUrl,
        service: 'delivery',
        meta: delivery.pickup?.qrScannedAt ? `QR scanned ${formatDate(delivery.pickup.qrScannedAt)}` : 'Rider uploaded pickup photo',
      });
    }
    return items;
  }, [delivery, messages, products]);

  const resolveDispute = async (resolution: 'refund' | 'redeliver' | 'reject') => {
    setResolving(resolution);
    try {
      await orderApi.post(`/orders/${orderId}/dispute/resolve`, { resolution });
      toast.success(resolution === 'refund' ? 'Refund resolution saved' : resolution === 'redeliver' ? 'Redelivery resolution saved' : 'Dispute rejection saved');
      await fetchOrder();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not resolve dispute');
    } finally {
      setResolving(null);
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
          <h1 className="text-2xl font-black text-[#1b1c1c]">Dispute not found</h1>
          <Link href="/admin?tab=disputes" className="mt-6 inline-flex rounded-md border border-[#dfe7e2] px-5 py-3 text-xs font-black uppercase tracking-widest text-[#405046]">
            Back to disputes
          </Link>
        </div>
      </Layout>
    );
  }

  const total = order.financials?.totalAmount || 0;
  const disputeResolved = Boolean(order.dispute?.resolvedAt);

  return (
    <Layout>
      <div className="space-y-6 pb-20">
        <section className="rounded-lg border border-[#dfe7e2] bg-white shadow-sm">
          <div className="flex flex-col gap-6 border-b border-[#dfe7e2] bg-[#fcf9f8] p-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <Link href="/admin?tab=disputes" className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">
                Admin disputes
              </Link>
              <h1 className="mt-3 text-3xl font-black tracking-normal text-[#1b1c1c]">
                Dispute review {order.orderNumber || `#${order._id.slice(0, 8).toUpperCase()}`}
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-[#5f7569]">
                {order.dispute?.reason || 'No dispute reason was recorded.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                <span className="rounded-full border border-[#dfe7e2] bg-white px-3 py-1 text-[#405046]">{normalizedStatus(order.status)}</span>
                <span className="rounded-full border border-[#dfe7e2] bg-white px-3 py-1 text-[#405046]">Payment {order.payment?.status || 'pending'}</span>
                <span className="rounded-full border border-[#ffedd5] bg-[#fff7ed] px-3 py-1 text-[#b54708]">{money(total)}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/admin/orders/${orderId}`} className="rounded-md border border-[#dfe7e2] bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#405046] hover:border-[#ff6b00] hover:text-[#ff6b00]">
                Open order
              </Link>
              <Link href={`/orders/${orderId}/tracking`} className="rounded-md border border-[#dfe7e2] bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#405046] hover:border-[#ff6b00] hover:text-[#ff6b00]">
                Tracking page
              </Link>
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-4">
            {[
              ['Raised', formatDate(order.dispute?.raisedAt)],
              ['Resolved', order.dispute?.resolvedAt ? formatDate(order.dispute.resolvedAt) : 'Open'],
              ['Resolution', order.dispute?.resolution || 'Pending'],
              ['Messages', String(messages.length)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-[#dfe7e2] bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">{label}</p>
                <p className="mt-2 text-sm font-black text-[#1b1c1c]">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-3">
          <ReviewPanel eyebrow="Client order view" title={order.buyer?.fullName || 'Buyer'}>
            <div className="rounded-md border border-[#dfe7e2] bg-[#f7faf8] p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Delivery address</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-[#1b1c1c]">{order.buyer?.deliveryAddress?.address || 'No address saved'}</p>
              <p className="mt-2 text-xs font-bold text-[#5f7569]">{order.buyer?.phone || 'Phone hidden'}</p>
            </div>
            <ProcessSteps
              steps={[
                { label: 'Order created', done: Boolean(order.createdAt), detail: formatDate(order.createdAt) },
                { label: 'Payment secured', done: order.payment?.status === 'paid' || hasStatus('confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 'disputed', 'resolved'), detail: order.payment?.status || 'pending' },
                { label: 'Delivery received', done: hasStatus('delivered', 'disputed', 'resolved'), detail: normalizedStatus(order.status) },
                { label: 'Dispute raised', done: Boolean(order.dispute?.raisedAt), detail: order.dispute?.reason || 'No reason recorded' },
              ]}
            />
            <MessageList messages={buyerMessages} empty="No client-side messages are saved for this dispute." />
          </ReviewPanel>

          <ReviewPanel eyebrow="Seller order view" title={order.seller?.fullName || 'Seller'}>
            <div className="rounded-md border border-[#dfe7e2] bg-[#f7faf8] p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Stall</p>
              <p className="mt-2 text-sm font-black text-[#1b1c1c]">{order.seller?.stallId || 'N/A'}</p>
              <p className="mt-2 text-xs font-bold text-[#5f7569]">Seller payout {money(order.financials?.sellerPayout)}</p>
            </div>
            <ProcessSteps
              steps={[
                { label: 'Quote or order accepted', done: hasStatus('placed', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 'disputed', 'resolved'), detail: money(order.financials?.subtotal) },
                { label: 'Preparing goods', done: hasStatus('preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 'disputed', 'resolved'), detail: normalizedStatus(order.status) },
                { label: 'Ready for rider', done: hasStatus('ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 'disputed', 'resolved'), detail: order.deliveryId ? `Delivery ${String(order.deliveryId).slice(0, 8).toUpperCase()}` : 'No delivery attached' },
                { label: 'Seller evidence', done: products.some(product => product.imageUrl || product.images?.length || product.prototypeImage), detail: `${products.length} item snapshots` },
              ]}
            />
            <MessageList messages={sellerMessages} empty="No seller negotiation messages are saved for this dispute." />
          </ReviewPanel>

          <ReviewPanel eyebrow="Rider order view" title={delivery?.rider?.fullName || 'Rider'}>
            <div className="rounded-md border border-[#dfe7e2] bg-[#f7faf8] p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Delivery status</p>
              <p className="mt-2 text-sm font-black text-[#1b1c1c]">{normalizedStatus(delivery?.status || 'not assigned')}</p>
              <p className="mt-2 text-xs font-bold text-[#5f7569]">{delivery?.rider?.plateNumber || 'No plate recorded'}</p>
            </div>
            <ProcessSteps
              steps={[
                { label: 'Broadcast accepted', done: Boolean(delivery?.riderId || delivery?.rider), detail: delivery?.rider?.fullName || 'No rider assigned' },
                { label: 'Arrived at pickup', done: ['en_route_to_pickup', 'pending_handover', 'picked_up', 'delivered'].includes(String(delivery?.status || '')), detail: delivery?.pickup?.address || order.seller?.stallId || 'Pickup not recorded' },
                { label: 'Photo and QR proof', done: Boolean(delivery?.pickup?.pickupPhotoUrl || delivery?.pickup?.qrScannedAt), detail: delivery?.pickup?.qrScannedAt ? formatDate(delivery.pickup.qrScannedAt) : 'No QR scan recorded' },
                { label: 'Delivered to client', done: delivery?.status === 'delivered' || hasStatus('delivered', 'disputed', 'resolved'), detail: delivery?.dropoff?.address || order.buyer?.deliveryAddress?.address || 'Dropoff not recorded' },
              ]}
            />
            {delivery?.pickup?.pickupPhotoUrl && (
              <div className="overflow-hidden rounded-md border border-[#dfe7e2] bg-white">
                <img src={resolveUploadUrl(delivery.pickup.pickupPhotoUrl, 'delivery')} alt="Pickup proof" className="max-h-56 w-full object-cover" />
                <div className="border-t border-[#dfe7e2] p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Pickup proof</p>
                </div>
              </div>
            )}
            <MessageList messages={riderMessages} empty="No rider delivery messages are saved for this dispute." />
          </ReviewPanel>
        </section>

        <section className="rounded-lg border border-[#dfe7e2] bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">Evidence gallery</p>
              <h2 className="mt-2 text-xl font-black tracking-normal text-[#1b1c1c]">Uploaded images across the order process</h2>
            </div>
            <span className="rounded-full border border-[#dfe7e2] bg-[#f7faf8] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#405046]">
              {evidence.length} files
            </span>
          </div>
          {evidence.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {evidence.map((item, index) => (
                <figure key={`${item.url}-${index}`} className="overflow-hidden rounded-lg border border-[#dfe7e2] bg-[#f7faf8]">
                  <img src={resolveUploadUrl(item.url, item.service)} alt={item.title} className="h-44 w-full object-cover" />
                  <figcaption className="border-t border-[#dfe7e2] bg-white p-3">
                    <p className="text-sm font-black text-[#1b1c1c]">{item.title}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#809087]">{item.meta || item.service}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-[#dfe7e2] bg-[#f7faf8] p-8 text-center text-sm font-bold text-[#809087]">
              No uploaded images were found on this order, messages, or delivery record.
            </div>
          )}
        </section>

        <section className="rounded-lg border border-[#dfe7e2] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">Resolution console</p>
              <h2 className="mt-2 text-xl font-black tracking-normal text-[#1b1c1c]">Close the dispute after review</h2>
              <p className="mt-2 text-sm font-semibold text-[#5f7569]">
                Current resolution: {order.dispute?.resolution || 'pending'}{order.dispute?.resolvedAt ? ` at ${formatDate(order.dispute.resolvedAt)}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button disabled={Boolean(resolving) || disputeResolved} onClick={() => resolveDispute('refund')} className="rounded-md bg-[#e05300] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-40">
                {resolving === 'refund' ? 'Saving...' : 'Refund'}
              </button>
              <button disabled={Boolean(resolving) || disputeResolved} onClick={() => resolveDispute('redeliver')} className="rounded-md border border-[#dfe7e2] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[#1b1c1c] disabled:cursor-not-allowed disabled:opacity-40">
                {resolving === 'redeliver' ? 'Saving...' : 'Redeliver'}
              </button>
              <button disabled={Boolean(resolving) || disputeResolved} onClick={() => resolveDispute('reject')} className="rounded-md border border-[#f1c6bc] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[#7b3f3f] disabled:cursor-not-allowed disabled:opacity-40">
                {resolving === 'reject' ? 'Saving...' : 'Reject'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
