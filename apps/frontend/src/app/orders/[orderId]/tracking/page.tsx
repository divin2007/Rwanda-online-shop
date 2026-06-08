'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useApi } from '@/hooks/useApi';
import { orderApi, deliveryApi, reviewApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { OrderStatusTimeline } from '@/components/ui/OrderStatusTimeline';
import { OrderChat } from '@/components/ui/OrderChat';
import { ReceiptView, type ReceiptOrder } from '@/components/ui/ReceiptView';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ShieldAlert, MessageSquare, MapPin, Package, Bike, Sparkles, Clock, Star } from 'lucide-react';
import { resolveUploadUrl } from '@/lib/uploadUrls';

const TrackingMap = dynamic(() => import('@/components/ui/TrackingMap').then(mod => mod.TrackingMap), { ssr: false });
const RiderMap = dynamic(() => import('@/components/ui/RiderMap').then(mod => mod.RiderMap), { ssr: false });
const QrReader = dynamic(() => import('react-qr-reader').then(mod => mod.QrReader as React.ComponentType<any>), { ssr: false });

const ORDER_AUTO_REFRESH_MS = 5000;
const DELIVERY_AUTO_REFRESH_MS = 5000;
const REVIEWABLE_ORDER_STATUSES = ['delivered', 'resolved'];

type ReviewTarget = {
  key: string;
  type: 'seller' | 'rider' | 'market' | 'product';
  id: string;
  title: string;
  subtitle: string;
};

const IndividualReviewCard = ({
  target,
  orderId,
  existingReview,
  onSubmitted,
}: {
  target: ReviewTarget;
  orderId: string;
  existingReview?: any;
  onSubmitted: () => void;
}) => {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRating(existingReview?.rating || 0);
    setComment(existingReview?.comment || '');
  }, [existingReview]);

  const submit = async () => {
    if (existingReview) return;
    if (!rating) {
      toast.error('Choose a star rating first');
      return;
    }
    setSaving(true);
    try {
      await reviewApi.post('/reviews', {
        orderId,
        targetType: target.type,
        targetId: target.id,
        rating,
        comment,
      });
      toast.success(`${target.title} reviewed`);
      onSubmitted();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not submit review');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-[#dfe7e2] bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff6b00]">{target.type}</p>
          <h3 className="mt-1 text-base font-black text-[#1b1c1c]">{target.title}</h3>
          <p className="mt-1 text-xs font-semibold text-[#5f7569]">{target.subtitle}</p>
        </div>
        {existingReview && (
          <span className="rounded-full bg-[#e8f5ed] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#12805c]">Done</span>
        )}
      </div>
      <div className="mb-3 flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            disabled={Boolean(existingReview)}
            onClick={() => setRating(star)}
            className="rounded-md p-1 text-[#ff6b00] disabled:cursor-default"
          >
            <Star size={20} className={star <= rating ? 'fill-[#ff6b00]' : ''} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        disabled={Boolean(existingReview)}
        rows={3}
        placeholder={`Review ${target.title}`}
        className="w-full rounded-md border border-[#dfe7e2] bg-[#fcf9f8] p-3 text-sm font-semibold text-[#1b1c1c] outline-none focus:border-[#ff6b00] disabled:opacity-70"
      />
      {!existingReview && (
        <button
          type="button"
          disabled={saving}
          onClick={submit}
          className="mt-3 w-full rounded-md bg-[#ff6b00] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-[#e05300] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Submit this review'}
        </button>
      )}
    </div>
  );
};

const OrderReviewPanel = ({
  order,
  deliveryData,
}: {
  order: any;
  deliveryData: any;
}) => {
  const [reviews, setReviews] = useState<any[]>([]);

  const fetchReviews = React.useCallback(async () => {
    try {
      const res = await reviewApi.get(`/reviews/order/${order._id}`);
      setReviews(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setReviews([]);
    }
  }, [order._id]);

  useEffect(() => {
    if (REVIEWABLE_ORDER_STATUSES.includes(order.status)) fetchReviews();
  }, [fetchReviews, order.status]);

  if (!REVIEWABLE_ORDER_STATUSES.includes(order.status)) return null;

  const targets: ReviewTarget[] = [
    order.seller?.sellerId && {
      key: `seller:${order.seller.sellerId}`,
      type: 'seller',
      id: String(order.seller.sellerId),
      title: order.seller?.fullName || 'Seller',
      subtitle: 'Packaging, communication, and preparation',
    },
    deliveryData?.rider?.riderId && {
      key: `rider:${deliveryData.rider.riderId}`,
      type: 'rider',
      id: String(deliveryData.rider.riderId),
      title: deliveryData.rider?.fullName || 'Rider',
      subtitle: `Delivery professionalism${deliveryData.rider?.plateNumber ? ` - ${deliveryData.rider.plateNumber}` : ''}`,
    },
    order.seller?.marketId && {
      key: `market:${order.seller.marketId}`,
      type: 'market',
      id: String(order.seller.marketId),
      title: 'Market experience',
      subtitle: 'Pickup environment, availability, and trust',
    },
    ...(order.products || []).map((item: any, index: number) => item.productId && ({
      key: `product:${item.productId}:${index}`,
      type: 'product' as const,
      id: String(item.productId),
      title: item.name || `Product ${index + 1}`,
      subtitle: 'Quality, accuracy, and value',
    })),
  ].filter(Boolean) as ReviewTarget[];

  return (
    <section className="mb-8 rounded-lg border border-[#dfe7e2] bg-[#fcf9f8] p-5 shadow-sm">
      <div className="mb-5">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">Order reviews</p>
        <h2 className="mt-1 text-2xl font-black text-[#1b1c1c]">Review each part separately</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-[#5f7569]">
          Rate the seller, rider, market, and products one at a time. You can submit only the parts you are ready to review.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {targets.map(target => (
          <IndividualReviewCard
            key={target.key}
            target={target}
            orderId={order._id}
            existingReview={reviews.find(review => review.targetType === target.type && String(review.targetId) === target.id)}
            onSubmitted={fetchReviews}
          />
        ))}
      </div>
    </section>
  );
};

const DeliveryChatCard = ({
  orderId,
  deliveryId,
  userId,
  userName,
  userRole,
  orderStatus,
  initialMessages,
  onOrderUpdated,
}: {
  orderId: string;
  deliveryId?: string;
  userId?: string;
  userName: string;
  userRole: 'BUYER' | 'RIDER' | 'ADMIN';
  orderStatus?: string;
  initialMessages: any[];
  onOrderUpdated?: () => void;
}) => {
  const { t } = useLanguage();
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>(initialMessages);
  const [isSending, setIsSending] = useState(false);
  const isClosed = ['delivered', 'resolved', 'completed', 'closed', 'cancelled'].includes(String(orderStatus || '').toLowerCase());
  const { data: socketMsg } = useSocket(process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006', `order:${orderId}:status`);

  useEffect(() => {
    setChatHistory(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (socketMsg?.type === 'NEW_MESSAGE' && socketMsg.message && (socketMsg.message.channel || 'ORDER') === 'DELIVERY') {
      setChatHistory((prev) => {
        const exists = prev.some(msg => msg.timestamp === socketMsg.message.timestamp);
        return exists ? prev : [...prev, socketMsg.message];
      });
    }
  }, [socketMsg]);

  const sendMessage = async (imageUrl?: string) => {
    if (isClosed) return toast.error('This order is closed. Messages are locked.');
    if ((!message.trim() && !imageUrl) || !deliveryId || !userId) return;
    setIsSending(true);
    try {
      const response = await orderApi.post(`/orders/${orderId}/messages`, {
        senderId: userId,
        senderRole: userRole,
        channel: 'DELIVERY',
        recipientRole: userRole === 'RIDER' ? 'BUYER' : 'RIDER',
        content: message.trim() || (imageUrl ? 'Sent an image' : ''),
        imageUrl,
        type: 'TEXT',
      });
      const saved = response.data?.data?.messages?.slice(-1)?.[0];
      if (saved) setChatHistory(prev => prev.some(msg => msg.timestamp === saved.timestamp) ? prev : [...prev, saved]);
      setMessage('');
      onOrderUpdated?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to send rider chat message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-[520px] flex-col overflow-hidden rounded-lg border border-[#dfe7e2] bg-white shadow-sm">
      <div className="border-b border-[#dfe7e2] bg-[#e05300] px-5 py-4">
        <h3 className="text-sm font-black text-white">Rider delivery chat</h3>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
          {deliveryId ? `Delivery ${deliveryId.slice(0, 8).toUpperCase()}` : 'Rider chat unlocks after dispatch'}
        </p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-[#f7faf8] p-5 scrollbar-thin">
        {chatHistory.length === 0 ? (
          <div className="text-center py-10 text-text-secondary text-sm">
            {t('track_no_messages')}
          </div>
        ) : (
          chatHistory.map((msg, i) => (
            <div key={`${msg.timestamp || 'message'}-${i}`} className={`flex flex-col ${msg.senderRole === userRole ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] overflow-hidden rounded-lg text-sm ${msg.senderRole === userRole ? 'bg-primary text-white rounded-br-none' : 'bg-background-surface text-text-primary rounded-bl-none'}`}>
                {msg.imageUrl && <img src={resolveUploadUrl(msg.imageUrl, 'order')} alt="Delivery chat attachment" className="max-h-64 w-full object-cover" />}
                <div className="p-3">{msg.content || msg.text || msg.message}</div>
              </div>
              <span className="text-[10px] text-text-secondary mt-1">{msg.senderName || msg.senderRole || userName}</span>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-[#dfe7e2] bg-white p-4">
        {isClosed && (
          <div className="mb-3 rounded-md border border-[#dfe7e2] bg-[#f5f7f6] px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-[#405046]">
            Order closed. Delivery messages are locked.
          </div>
        )}
        <div className="flex gap-2">
        <input 
          type="text" 
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={t('chat_type_message')} 
          disabled={isClosed}
          className="flex-1 bg-background-surface border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
        />
        <Button size="sm" onClick={() => sendMessage()} disabled={isClosed || !deliveryId || !userId || isSending || !message.trim()}>{t('confirm')}</Button>
        </div>
        <div className="mt-3">
          <ImageUpload
            onUploadSuccess={(url) => sendMessage(url)}
            service="order"
            endpoint="/orders/upload-image"
            label="Attach proof"
            compact
          />
        </div>
      </div>
    </div>
  );
};

export default function OrderTrackingPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = React.use(params);
  const { t } = useLanguage();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [deliveryData, setDeliveryData] = useState<any>(null);
  const [pickupPhotoUrl, setPickupPhotoUrl] = useState('');
  const [pickupQrData, setPickupQrData] = useState('');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [activeChatTarget, setActiveChatTarget] = useState<'seller' | 'rider'>('seller');
  // MD9 fix: controlled textarea state instead of imperative document.getElementById
  const [disputeReason, setDisputeReason] = useState('');

  const { data: order, loading, execute: fetchOrder } = useApi(orderApi, 'get', `/orders/${orderId}`, { refreshInterval: ORDER_AUTO_REFRESH_MS });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const fetchDelivery = React.useCallback(async (deliveryId?: string) => {
    if (!deliveryId) {
      setDeliveryData(null);
      setPickupPhotoUrl('');
      return null;
    }

    try {
      const res = await deliveryApi.get(`/deliveries/${deliveryId}`);
      const delivery = res.data?.data || null;
      setDeliveryData(delivery);
      setPickupPhotoUrl(delivery?.pickup?.pickupPhotoUrl || '');
      setPickupQrData(delivery?.pickup?.qrPayload || '');
      return delivery;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!order?.deliveryId) {
      setDeliveryData(null);
      setPickupPhotoUrl('');
      return;
    }

    fetchDelivery(order.deliveryId);
    const timer = window.setInterval(() => {
      fetchDelivery(order.deliveryId);
    }, DELIVERY_AUTO_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [order?.deliveryId, fetchDelivery]);

  const { data: statusUpdate } = useSocket(process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006', `order:${orderId}:status`);
  const { data: riderGps, isConnected: trackingConnected, emit: emitTrackingSocket } = useSocket(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008', order?.deliveryId ? `delivery:${order.deliveryId}:tracking` : '');

  useEffect(() => {
    if (trackingConnected && order?.deliveryId) {
      emitTrackingSocket('join:delivery', order.deliveryId);
    }
  }, [emitTrackingSocket, order?.deliveryId, trackingConnected]);

  useEffect(() => {
    if (statusUpdate) {
      fetchOrder();
      if (order?.deliveryId) fetchDelivery(order.deliveryId);
    }
  }, [statusUpdate, fetchOrder, fetchDelivery, order?.deliveryId]);

  useEffect(() => {
    setIsClient(true);
    fetchOrder();
  }, [orderId, fetchOrder]);

  const liveStatus = statusUpdate?.status || statusUpdate?.order?.status;
  const currentStatus = order?.status === 'delivered' ? 'delivered' : (liveStatus || order?.status || 'placed');
  const isFinalOrderStatus = ['delivered', 'resolved'].includes(currentStatus);
  const showTrackingMap = currentStatus === 'in_transit' || currentStatus === 'picked_up' || 
    (deliveryData && ['assigned', 'en_route_to_pickup', 'pending_handover'].includes(deliveryData.status));
  const showBroadcastMap = !showTrackingMap && (currentStatus === 'placed' || currentStatus === 'confirmed' || currentStatus === 'preparing' || currentStatus === 'ready_for_pickup');
  const showEscrowAction = currentStatus === 'awaiting_confirmation' && user?.role === 'BUYER' && user?.id === order.buyer?.userId;
  const isNegotiationPhase = currentStatus === 'awaiting_quote' || currentStatus === 'quote_sent' || 
    (currentStatus === 'placed' && order?.payment?.status !== 'paid');

  if (isLoading || loading || !isClient) return <Layout><div className="flex justify-center p-20"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div></div></Layout>;
  if (!user) return null;
  if (!order) return <Layout><div className="p-20 text-center">{t('track_not_found')}</div></Layout>;

  const normalizeId = (value: any) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') return String(value._id || value.id || '');
    return String(value);
  };
  const userId = normalizeId(user.id);
  const riderCanBeAssigned = String(user.role || '').toUpperCase() === 'RIDER' && Boolean(order.deliveryId);
  const isWaitingForDeliveryAuthorization = riderCanBeAssigned && !deliveryData;
  const isAssignedRider = riderCanBeAssigned && [
    order.riderId,
    deliveryData?.riderId,
    deliveryData?.rider?.id,
    deliveryData?.rider?.userId,
    deliveryData?.rider?.riderId,
  ].some(value => normalizeId(value) === userId);

  // Security guard: Authorization check
  const isAuthorized = 
    user.role === 'ADMIN' || 
    userId === normalizeId(order.buyerId) || 
    userId === normalizeId(order.buyer?.userId) || 
    userId === normalizeId(order.sellerId) || 
    userId === normalizeId(order.seller?.userId) || 
    isAssignedRider;

  if (isWaitingForDeliveryAuthorization) {
    return <Layout><div className="flex justify-center p-20"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div></div></Layout>;
  }

  if (!isAuthorized) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto py-20 px-6 text-center animate-reveal">
          <ShieldAlert size={64} className="mx-auto text-red-600 mb-6 opacity-80" />
          <h2 className="text-3xl font-sans text-red-600 mb-4">Access Denied</h2>
          <p className="text-base text-text-secondary max-w-md mx-auto mb-8">
            You are not authorized to view the tracking details of this order. If you believe this is an error, please contact support.
          </p>
          <button 
            onClick={() => router.push('/')} 
            className="rmf-btn-primary rounded-xl px-8 py-3.5 mx-auto"
          >
            Back to Home
          </button>
        </div>
      </Layout>
    );
  }

  const productsList = order.products?.length ? order.products : order.product ? [order.product] : [];
  const orderMessages = ((order as any).messages || []).filter((message: any) => (message.channel || 'ORDER') === 'ORDER');
  const deliveryMessages = ((order as any).messages || []).filter((message: any) => (message.channel || 'ORDER') === 'DELIVERY');
  const receiptOrder: ReceiptOrder = {
    _id: orderId,
    orderNumber: order.orderNumber,
    status: currentStatus,
    createdAt: order.createdAt,
    buyer: order.buyer || { fullName: user.fullName || 'Buyer', phone: 'Hidden' },
    seller: order.seller || { fullName: order.sellerName || 'Verified Seller', stallId: 'N/A' },
    products: productsList.map((item: any) => ({
      productId: item.productId || '',
      name: item.name || t('product'),
      unitPrice: item.unitPrice || 0,
      quantity: item.quantity || 1,
      weight: item.weight,
    })),
    financials: {
      subtotal: order.financials?.subtotal || 0,
      deliveryFee: order.financials?.deliveryFee || 0,
      platformCommission: order.financials?.platformCommission || 0,
      gatewayFee: order.financials?.gatewayFee || 0,
      totalAmount: order.financials?.totalAmount || 0,
      sellerPayout: order.financials?.sellerPayout || 0,
      riderPayout: order.financials?.riderPayout || 0,
    },
    payment: order.payment,
    deliveryId: order.deliveryId,
    delivery: deliveryData ? { rider: deliveryData.rider, status: deliveryData.status, route: deliveryData.route } : undefined,
    notes: order.notes,
    messages: orderMessages,
  };

  return (
    <Layout>
      {showReceipt && (
        <ReceiptView
          order={receiptOrder}
          role="buyer"
          onClose={() => setShowReceipt(false)}
          onOrderUpdated={fetchOrder}
        />
      )}

      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="mb-8 flex flex-col justify-between gap-4 border-b border-[#dfe7e2] pb-6 md:flex-row md:items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">Buyer Order Page</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal text-[#1b1c1c]">{t('order')} #{orderId.substring(0, 8).toUpperCase()}</h1>
            <p className="mt-2 text-sm font-semibold text-[#5f7569]">{t('track_title')}</p>
          </div>
          <button
            onClick={() => setShowReceipt(true)}
            className="rounded-md border border-[#dfe7e2] bg-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#1b1c1c] transition hover:border-[#ff6b00] hover:text-[#ff6b00]"
          >
            Open Receipt
          </button>
        </div>

        <Card className="mb-8">
          <OrderStatusTimeline currentStatus={currentStatus} />
        </Card>

        <section className="mb-8 rounded-lg border border-[#dfe7e2] bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">Escrow procedure</p>
              <h2 className="mt-1 text-2xl font-black text-[#1b1c1c]">Payment held until delivery is confirmed</h2>
            </div>
            <span className="rounded-full bg-[#e8f5ed] px-3 py-1 text-xs font-black text-[#ff6b00]">
              {order.payment?.status === 'paid' ? 'Escrow funded' : 'Awaiting payment'}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {[
              ['Quote accepted', ['placed', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'awaiting_confirmation', 'delivered'].includes(currentStatus)],
              ['Buyer payment secured', order.payment?.status === 'paid'],
              ['Seller prepares goods', ['preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'awaiting_confirmation', 'delivered'].includes(currentStatus)],
              ['Rider photo and QR proof', Boolean(deliveryData?.pickup?.pickupPhotoUrl || pickupPhotoUrl || deliveryData?.pickup?.qrScannedAt)],
              ['Buyer confirms receipt', isFinalOrderStatus],
            ].map(([label, done]) => (
              <div key={label as string} className={`rounded-md border p-3 ${done ? 'border-[#ffedd5] bg-[#e8f5ed]' : 'border-[#e0e0e0] bg-[#fcf9f8]'}`}>
                <div className={`mb-2 h-2 w-2 rounded-full ${done ? 'bg-[#ff6b00]' : 'bg-[#a7b0aa]'}`} />
                <p className="text-[11px] font-black leading-tight text-[#1b1c1c]">{label as string}</p>
              </div>
            ))}
          </div>
          {(deliveryData?.pickup?.pickupPhotoUrl || pickupPhotoUrl) && (
            <div className="mt-4 overflow-hidden rounded-md border border-[#e0e0e0] bg-[#fcf9f8]">
              <div className="border-b border-[#e0e0e0] px-4 py-2">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff6b00]">Pickup evidence</p>
              </div>
              <img src={resolveUploadUrl(deliveryData?.pickup?.pickupPhotoUrl || pickupPhotoUrl, 'delivery')} alt="Rider pickup proof" className="max-h-56 w-full object-cover" />
            </div>
          )}
        </section>

        <OrderReviewPanel order={order} deliveryData={deliveryData} />

        <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-lg border border-[#dfe7e2] bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-col justify-between gap-3 border-b border-[#edf1ee] pb-4 md:flex-row md:items-center">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">
                    {activeChatTarget === 'seller' ? (isNegotiationPhase ? 'Negotiation Workspace' : 'Seller Conversation') : 'Delivery Conversation'}
                  </p>
                  <h2 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-normal text-[#1b1c1c]">
                    <MessageSquare size={20} className="text-primary shrink-0" />
                    {activeChatTarget === 'seller' ? (isNegotiationPhase ? t('track_negotiation') : 'Messages with seller') : 'Messages with rider'}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveChatTarget('seller')}
                    className={`rounded-md border px-4 py-2 text-[10px] font-black uppercase tracking-widest ${activeChatTarget === 'seller' ? 'border-[#ff6b00] bg-[#ff6b00] text-white' : 'border-[#dfe7e2] bg-white text-[#405046]'}`}
                  >
                    Seller
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChatTarget('rider')}
                    disabled={!order.deliveryId}
                    className={`rounded-md border px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40 ${activeChatTarget === 'rider' ? 'border-[#ff6b00] bg-[#ff6b00] text-white' : 'border-[#dfe7e2] bg-white text-[#405046]'}`}
                  >
                    Rider
                  </button>
                </div>
              </div>
              {activeChatTarget === 'seller' ? (
                <OrderChat
                  orderId={orderId}
                  initialMessages={orderMessages}
                  recipientName={order.seller?.fullName || t('seller')}
                  userRole="BUYER"
                  orderStatus={order.status}
                  paymentStatus={order.payment?.status}
                  marketId={order.seller?.marketId}
                  deliveryAddress={order.buyer?.deliveryAddress}
                  deliveryFee={order.financials?.deliveryFee}
                  channel="ORDER"
                  onOrderUpdated={fetchOrder}
                />
              ) : (
                <DeliveryChatCard
                  orderId={orderId}
                  deliveryId={order.deliveryId}
                  userId={user?.id}
                  userName={user?.fullName || t('buyer')}
                  userRole={String(user?.role || '').toUpperCase() === 'RIDER' ? 'RIDER' : String(user?.role || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'BUYER'}
                  orderStatus={order.status}
                  initialMessages={deliveryMessages}
                  onOrderUpdated={fetchOrder}
                />
              )}
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-[#dfe7e2] bg-[#fcf9f8] p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">
                  {isNegotiationPhase ? 'Current quote' : 'Order total'}
                </p>
                <p className="mt-3 text-3xl font-black text-[#1b1c1c]">{(order.financials?.totalAmount || order.financials?.subtotal || 0).toLocaleString()} RWF</p>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#5f7569]">
                  {isNegotiationPhase
                    ? 'Accept, counter, decline, choose a delivery location, and keep the full negotiation with the seller here.'
                    : 'The seller conversation remains open for questions and fulfillment updates after negotiation.'}
                </p>
              </div>
              {order.buyer?.deliveryAddress?.address && order.buyer.deliveryAddress.address !== 'TBD' && (
                <div className="bg-status-success/5 rounded-xl p-4 border border-status-success/20">
                  <p className="text-xs font-bold text-status-success uppercase mb-1 flex items-center gap-1">
                    <MapPin size={12} className="shrink-0" /> {t('chat_set_location')}
                  </p>
                  <p className="text-sm">{order.buyer.deliveryAddress.address}</p>
                </div>
              )}
            </div>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            {showEscrowAction ? (
              <Card className="border-2 border-primary bg-primary/5">
                <div className="text-center py-10">
                  <Package size={64} className="mx-auto text-primary mb-4" />
                  <h3 className="text-xl font-bold mb-2">{t('track_package_arrived')}</h3>
                  <p className="text-text-secondary mb-8 px-4">
                    {t('track_inspect_goods')}
                  </p>
                  <Button 
                    size="lg" 
                    fullWidth 
                    disabled={currentStatus === 'delivered'}
                    className="bg-primary hover:bg-primary-hover animate-bounce"
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.disabled = true;
                      btn.innerHTML = t('loading');
                      try {
                        await orderApi.put(`/orders/${orderId}/status`, { status: 'delivered', userId: order.buyer.userId });
                        toast.success(t('payment_released_thanks'));
                        fetchOrder();
                      } catch (err) {
                        toast.error(t('confirm_receipt_failed'));
                        btn.disabled = false;
                        btn.innerHTML = t('track_confirm_receipt');
                      }
                    }}
                  >
                    {t('track_confirm_receipt')}
                  </Button>
                </div>
              </Card>
            ) : showTrackingMap ? (
              <Card key="tracking-map-card" noPadding className="overflow-hidden">
                <div className="p-4 border-b border-border bg-background-surface">
                  <h3 className="font-bold text-primary flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                    {deliveryData?.status === 'assigned' || deliveryData?.status === 'en_route_to_pickup' ? t('track_rider_heading') : 
                     deliveryData?.status === 'pending_handover' ? t('track_rider_handover') :
                     currentStatus === 'picked_up' ? t('track_rider_picked_up') : t('dashboard_live_tracking')}
                  </h3>
                  <p className="text-sm text-text-secondary mt-1">
                    {deliveryData?.status === 'assigned' || deliveryData?.status === 'en_route_to_pickup' ? t('track_rider_en_route') :
                     deliveryData?.status === 'pending_handover' ? t('track_rider_verifying') :
                     t('track_realtime')}
                  </p>
                </div>
                <div className="h-80 relative">
                  <TrackingMap 
                    lat={riderGps?.lat || -1.9441} 
                    lng={riderGps?.lng || 30.0619} 
                    pickup={deliveryData?.pickup?.coordinates}
                    dropoff={deliveryData?.dropoff?.coordinates}
                    routeGeometry={deliveryData?.route?.geometry}
                  />
                </div>
                {deliveryData?.rider && (
                  <div className="p-4 border-t border-border flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                      <Bike size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-text-primary">{deliveryData.rider.fullName}</p>
                      <p className="text-sm text-text-secondary">{deliveryData.rider.plateNumber}</p>
                    </div>
                  </div>
                )}
              </Card>
            ) : showBroadcastMap ? (
              <Card key="broadcast-map-card" noPadding className="overflow-hidden">
                <div className="p-4 border-b border-border bg-background-surface">
                  <h3 className="font-bold text-primary flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                    {currentStatus === 'ready_for_pickup' ? t('track_assigning_rider') : t('track_processing')}
                  </h3>
                  <p className="text-sm text-text-secondary mt-1">
                    {currentStatus === 'preparing' ? t('track_packing') : t('track_finding_rider')}
                  </p>
                </div>
                <div className="h-64 relative border-b border-border">
                  <RiderMap marketId={order.seller?.marketId || 'default'} />
                </div>
                <div className="p-4 text-center">
                  <p className="text-sm text-text-secondary">
                    {currentStatus === 'preparing' ? t('track_wait_packing') : t('track_wait_rider')}
                  </p>
                </div>
              </Card>
            ) : (
              <Card>
                <div className="text-center py-10">
                  {isFinalOrderStatus ? (
                    <Sparkles size={64} className="mx-auto text-primary mb-4" />
                  ) : (
                    <Clock size={64} className="mx-auto text-text-secondary mb-4" />
                  )}
                  <h3 className="text-xl font-bold mb-2">
                    {isFinalOrderStatus ? t('track_delivered') : t('track_placed')}
                  </h3>
                  <p className="text-text-secondary">
                    {isFinalOrderStatus
                      ? t('track_enjoy') 
                      : t('track_payment_success')}
                  </p>
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <h3 className="font-bold mb-4">{t('order_summary')}</h3>
              <div className="space-y-4">
                {order.products && order.products.map((item: any, idx: number) => (
                  <div key={`${item.productId || item.name || 'item'}-${idx}`} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.name || t('product')}</span>
                    <span className="font-medium">{(item.unitPrice * item.quantity).toLocaleString()} RWF</span>
                  </div>
                ))}
                {!order.products && order.product && (
                  <div key={`${order.product.productId || order.product.name || 'item'}-single`} className="flex justify-between text-sm">
                    <span>{order.product.quantity}x {order.product.name || t('product')}</span>
                    <span className="font-medium">{(order.product.unitPrice * order.product.quantity).toLocaleString()} RWF</span>
                  </div>
                )}
                <div className="pt-4 border-t border-border flex justify-between font-bold text-lg">
                  <span>{t('total_paid')}</span>
                  <span className="text-primary">{order.financials?.totalAmount?.toLocaleString() || 'N/A'} RWF</span>
                </div>
              </div>
            </Card>
            
            {user?.role === 'RIDER' && deliveryData?.status !== 'delivered' && (
              <Card className="border border-[#dfe7e2] bg-white">
                <h3 className="font-bold mb-4 uppercase text-xs tracking-widest text-[#ff6b00]">Rider escrow controls</h3>
                <div className="space-y-4">
                  {deliveryData?.status === 'en_route_to_pickup' && (
                    <div className="space-y-3">
                      <p className="text-sm text-text-secondary">
                        Photograph the packaged seller goods first, then verify the stall QR. This keeps escrow evidence attached to the delivery.
                      </p>
                      <ImageUpload
                        service="delivery"
                        endpoint={`/deliveries/${deliveryData._id}/pickup-photo`}
                        label="Upload packaged goods photo"
                        capture="environment"
                        value={pickupPhotoUrl}
                        onChange={setPickupPhotoUrl}
                      />
                      <div className="rounded-lg border border-[#dfe7e2] bg-[#fcf9f8] p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff6b00]">Stall QR scan</p>
                            <p className="mt-1 text-xs font-semibold text-[#5f7569]">
                              Scan the seller's printed stall credential at pickup.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowQrScanner((current) => !current)}
                            className="rounded-md border border-[#dfe7e2] bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#1b1c1c] hover:border-[#ff6b00]"
                          >
                            {showQrScanner ? 'Close' : 'Scan'}
                          </button>
                        </div>
                        {showQrScanner && (
                          <div className="overflow-hidden rounded-md border border-[#dfe7e2] bg-black">
                            <QrReader
                              constraints={{ facingMode: 'environment' }}
                              scanDelay={300}
                              onResult={(result: any) => {
                                const text = result?.getText?.() || result?.text || '';
                                if (!text) return;
                                setPickupQrData(text);
                                setShowQrScanner(false);
                                toast.success('Stall QR captured');
                              }}
                              videoStyle={{ width: '100%' }}
                            />
                          </div>
                        )}
                        <input
                          value={pickupQrData}
                          onChange={(event) => setPickupQrData(event.target.value)}
                          placeholder="QR payload appears here after scanning"
                          className="mt-3 w-full rounded-md border border-[#dfe7e2] bg-white px-3 py-2 text-xs font-semibold text-[#1b1c1c] outline-none focus:border-[#ff6b00]"
                        />
                      </div>
                      <Button
                        fullWidth
                        disabled={!pickupPhotoUrl || !pickupQrData}
                        className="bg-[#ff6b00] hover:bg-[#e05300] disabled:opacity-40"
                        onClick={async () => {
                          try {
                            await deliveryApi.post(`/deliveries/${deliveryData._id}/scan-qr`, {
                              qrData: pickupQrData,
                              photoUrl: pickupPhotoUrl,
                            });
                            toast.success('Pickup verified with photo and QR');
                            // MD8 fix: use fetchOrder() instead of window.location.reload()
                            // to avoid full-page jumps and state loss on mobile
                            fetchOrder();
                            fetchDelivery(deliveryData._id || order.deliveryId);
                          } catch (e: any) {
                            toast.error(e?.response?.data?.message || 'Pickup verification failed');
                          }
                        }}
                      >
                        Verify Pickup with QR
                      </Button>
                    </div>
                  )}
                  {deliveryData?.status === 'pending_handover' && (
                    <Button 
                      fullWidth 
                      className="bg-[#ff6b00] hover:bg-[#e05300]"
                      onClick={async () => {
                        try {
                          await deliveryApi.post(`/deliveries/${deliveryData._id}/handover`, { role: 'rider' });
                          toast.success('Handover Confirmed');
                          // MD8 fix: soft refresh via fetchOrder instead of hard page reload
                          fetchOrder();
                          fetchDelivery(deliveryData._id || order.deliveryId);
                        } catch (e) {
                          toast.error('Handover Failed');
                        }
                      }}
                    >
                      Confirm Item Handover
                    </Button>
                  )}
                  {deliveryData?.status === 'picked_up' && (
                    <Button 
                      fullWidth 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={async () => {
                        try {
                          await deliveryApi.patch(`/deliveries/${deliveryData._id}/complete`);
                          toast.success('Delivery Completed!');
                          // MD8 fix: soft refresh via fetchOrder instead of hard page reload
                          fetchOrder();
                          fetchDelivery(deliveryData._id || order.deliveryId);
                        } catch (e) {
                          toast.error('Failed to complete delivery');
                        }
                      }}
                    >
                      Mark as Delivered
                    </Button>
                  )}
                </div>
              </Card>
            )}
            
            {currentStatus === 'delivered' && (
               <div className="bg-background-surface p-6 rounded-xl border border-border">
                 <p className="font-bold mb-2">{t('track_issue')}</p>
                 <p className="text-sm text-text-secondary mb-4">{t('track_dispute_desc')}</p>
                 
                 {order.status === 'disputed' ? (
                   <div className="bg-status-warning/10 text-status-warning p-4 rounded-lg text-sm font-medium">
                     {t('track_dispute_raised')}
                   </div>
                 ) : (
                   <div className="space-y-4">
                     {/* MD9 fix: controlled textarea — no more document.getElementById */}
                     <textarea
                       className="w-full bg-background-card border border-border rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                       placeholder={t('track_dispute_placeholder')}
                       rows={3}
                       value={disputeReason}
                       onChange={(e) => setDisputeReason(e.target.value)}
                     ></textarea>
                     <Button
                       variant="outline"
                       size="sm"
                       fullWidth
                       onClick={async () => {
                         if (!disputeReason.trim()) return toast.error(t('track_dispute_error'));
                         try {
                           await orderApi.post(`/orders/${orderId}/dispute`, { reason: disputeReason });
                           toast.success(t('track_dispute_success'));
                           setDisputeReason('');
                           fetchOrder();
                         } catch (e) {
                           toast.error(t('track_dispute_failed'));
                         }
                       }}
                     >
                       {t('track_submit_dispute')}
                     </Button>
                   </div>
                 )}
               </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
