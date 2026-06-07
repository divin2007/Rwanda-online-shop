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
import Link from 'next/link';
import { ShieldAlert, MessageSquare, MapPin, Package, Bike, Sparkles, Clock, Star } from 'lucide-react';
import { resolveUploadUrl } from '@/lib/uploadUrls';
import { getOperationalHomeHref, OperationalSidebar } from '@/components/layout/OperationalSidebar';

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
  embedded = false,
}: {
  orderId: string;
  deliveryId?: string;
  userId?: string;
  userName: string;
  userRole: 'BUYER' | 'RIDER' | 'ADMIN';
  orderStatus?: string;
  initialMessages: any[];
  onOrderUpdated?: () => void;
  embedded?: boolean;
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
    <div className={embedded ? "flex h-full min-h-0 flex-col overflow-hidden bg-transparent" : "flex h-[520px] flex-col overflow-hidden rounded-lg border border-[#dfe7e2] bg-white shadow-sm"}>
      {!embedded && (
      <div className="border-b border-[#dfe7e2] bg-[#e05300] px-5 py-4">
        <h3 className="text-sm font-black text-white">Rider delivery chat</h3>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
          {deliveryId ? `Delivery ${deliveryId.slice(0, 8).toUpperCase()}` : 'Rider chat unlocks after dispatch'}
        </p>
      </div>
      )}
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
          placeholder={embedded ? 'Message Rider...' : t('chat_type_message')} 
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
  const { user, isLoading, logout } = useAuth();
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
  const [disputeType, setDisputeType] = useState('general');

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

  const orderReference = order.orderNumber || `ORD-${orderId.slice(-5).toUpperCase()}`;
  const statusLabel = currentStatus.replace(/_/g, ' ').toUpperCase();
  const statusFlow = ['placed', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'awaiting_confirmation', 'delivered', 'resolved'];
  const statusPosition = Math.max(statusFlow.indexOf(currentStatus), 0);
  const hasReached = (status: string) => statusPosition >= statusFlow.indexOf(status);
  const formatClock = (value?: string) => {
    if (!value) return '--:--';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const timelineSteps = [
    {
      key: 'placed',
      title: 'Order Placed',
      detail: order.payment?.status === 'paid' ? 'Payment held in secure MTN MoMo escrow.' : 'Order request recorded. Payment confirmation pending.',
      time: formatClock(order.createdAt),
    },
    {
      key: 'confirmed',
      title: 'Seller Accepted',
      detail: 'Items are being prepared for dispatch.',
      time: hasReached('confirmed') ? formatClock(order.updatedAt) : '--:--',
    },
    {
      key: 'in_transit',
      title: currentStatus === 'picked_up' ? 'Picked Up' : 'In Transit',
      detail: showTrackingMap ? 'Rider picked up the order. En route to destination.' : 'Rider dispatch is being coordinated.',
      time: hasReached('picked_up') || hasReached('in_transit') ? formatClock(deliveryData?.updatedAt || order.updatedAt) : '--:--',
    },
    {
      key: 'delivered',
      title: 'Delivered',
      detail: isFinalOrderStatus ? 'Receipt confirmed and order closed.' : 'Awaiting receipt confirmation.',
      time: isFinalOrderStatus ? formatClock(order.updatedAt) : '--:--',
    },
  ];
  const riderName = deliveryData?.rider?.fullName || deliveryData?.rider?.name || 'Rider pending';
  const riderPlate = deliveryData?.rider?.plateNumber || deliveryData?.rider?.vehiclePlate || 'Dispatch queue';
  const activeRiderDistance = riderGps?.distanceText || deliveryData?.route?.distanceText || '1.2 km';
  const activeRiderEta = riderGps?.etaText || deliveryData?.route?.durationText || '~4 mins';
  const roleHomeHref = getOperationalHomeHref(user?.role);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-surface">
      {showReceipt && (
        <ReceiptView
          order={receiptOrder}
          role="buyer"
          onClose={() => setShowReceipt(false)}
          onOrderUpdated={fetchOrder}
        />
      )}

      <OperationalSidebar role={user?.role} activeSection="orders" onLogout={logout} />

      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <header className="sticky top-0 z-50 flex h-16 w-full shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-gutter">
          <div className="flex min-w-0 items-center gap-sm">
            <Link href="/orders" className="flex items-center text-primary transition hover:text-primary-container">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_back</span>
            </Link>
            <h2 className="truncate font-headline-md text-headline-md font-bold text-primary">{orderReference}</h2>
            <span className="ml-sm flex items-center gap-xs rounded border border-outline-variant bg-surface-container-low px-sm py-xs font-label-caps text-label-caps text-on-surface">
              <span className="h-2 w-2 rounded-full bg-primary-container" />
              {statusLabel}
            </span>
          </div>

          <div className="hidden items-center gap-md md:flex">
            <button className="p-xs text-primary transition hover:text-primary-container" title="Location">
              <span className="material-symbols-outlined">location_on</span>
            </button>
            <button className="p-xs text-primary transition hover:text-primary-container" title="Language">
              <span className="material-symbols-outlined">language</span>
            </button>
            <Link className="ml-sm font-label-caps text-label-caps font-bold text-primary transition hover:text-primary-container" href={roleHomeHref}>Switch Role</Link>
            <Link className="rounded bg-primary-container px-sm py-xs font-label-caps text-label-caps text-on-primary transition hover:opacity-90" href="/cart">Basket</Link>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-inverse-surface text-[10px] font-bold text-inverse-on-surface">
              {(user?.fullName || 'RMF').slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-md overflow-hidden p-md lg:flex-row lg:gap-lg lg:p-lg">
          <section className="flex min-w-0 flex-1 flex-col gap-md overflow-y-auto pr-0 lg:gap-lg lg:pr-xs">
            <div className="relative h-64 shrink-0 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-[0_8px_30px_rgba(27,28,28,0.03)] lg:h-[400px]">
              <div className="absolute left-md top-md z-[500] flex items-center gap-sm rounded-lg border border-outline-variant bg-surface-container-lowest p-sm shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-outline bg-surface-container">
                  <span className="material-symbols-outlined text-primary">directions_bike</span>
                </div>
                <div>
                  <p className="font-label-caps text-label-caps text-on-surface-variant">Rider Live Status</p>
                  <p className="font-data-mono text-data-mono text-on-surface">{activeRiderDistance} / {activeRiderEta}</p>
                </div>
              </div>
              {showBroadcastMap ? (
                <RiderMap marketId={order.seller?.marketId || 'default'} />
              ) : (
                <TrackingMap
                  key={`tracking-${orderId}-${currentStatus}`}
                  lat={riderGps?.lat || -1.9441}
                  lng={riderGps?.lng || 30.0619}
                  pickup={deliveryData?.pickup?.coordinates}
                  dropoff={deliveryData?.dropoff?.coordinates}
                  routeGeometry={deliveryData?.route?.geometry}
                />
              )}
            </div>

            <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-[0_8px_30px_rgba(27,28,28,0.03)] lg:p-lg">
              <h3 className="mb-md border border-outline-variant px-xs py-xs font-headline-md text-headline-md font-bold text-on-surface">Order Timeline</h3>
              <div className="relative flex flex-col gap-0 pl-md">
                <div className="absolute bottom-8 left-[27px] top-4 z-0 w-px bg-surface-variant" />
                {timelineSteps.map((step) => {
                  const reached = hasReached(step.key);
                  const current = step.key === 'in_transit'
                    ? ['picked_up', 'in_transit', 'awaiting_confirmation'].includes(currentStatus)
                    : step.key === currentStatus;
                  return (
                    <div key={step.key} className={`relative z-10 flex gap-md py-sm ${!reached && !current ? 'opacity-45' : ''}`}>
                      <div className={`mt-unit flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-surface-container-lowest shadow-sm ${current ? 'bg-white border-primary-container' : reached ? 'bg-primary-container text-white' : 'bg-surface-variant'}`}>
                        {current ? <span className="h-2 w-2 animate-pulse rounded-full bg-primary-container" /> : reached ? <span className="material-symbols-outlined text-[14px] text-white">check</span> : null}
                      </div>
                      <div className="flex-1 border-b border-outline-variant pb-sm">
                        <div className="flex items-start justify-between gap-sm">
                          <p className={`font-body-md text-body-md font-bold ${current ? 'text-primary' : 'text-on-surface'}`}>{step.title}</p>
                          <p className={`font-data-mono-sm text-data-mono-sm ${current ? 'text-primary' : 'text-on-surface-variant'}`}>{step.time}</p>
                        </div>
                        <p className="mt-xs text-sm font-body-md text-on-surface-variant">{step.detail}</p>
                        {step.key === 'in_transit' && (deliveryData?.rider || showTrackingMap) && (
                          <div className="mt-sm flex items-center gap-sm rounded border border-surface-variant bg-surface-container-low p-sm">
                            <div className="flex h-8 w-8 items-center justify-center rounded border border-outline-variant bg-surface-container-lowest">
                              <span className="material-symbols-outlined text-[18px] text-primary">two_wheeler</span>
                            </div>
                            <div>
                              <p className="font-label-caps text-label-caps text-on-surface">{riderName}</p>
                              <p className="font-data-mono-sm text-data-mono-sm text-secondary">{riderPlate}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-[0_8px_30px_rgba(27,28,28,0.03)]">
              <div className="mb-sm flex items-center justify-between border-b border-outline-variant pb-sm">
                <div>
                  <p className="font-label-caps text-label-caps text-primary">Security Verification</p>
                  <h3 className="font-headline-md text-headline-md text-on-surface">Escrow, QR and handover controls</h3>
                </div>
                <span className="rounded border border-outline-variant bg-surface-container-low px-sm py-xs font-data-mono-sm text-data-mono-sm text-on-surface-variant">
                  {trackingConnected ? 'LIVE' : 'SYNC'}
                </span>
              </div>

              {showEscrowAction ? (
                <div className="rounded border border-primary-container bg-primary/5 p-md text-center">
                  <Package size={42} className="mx-auto mb-sm text-primary-container" />
                  <p className="font-headline-md text-headline-md text-on-surface">Package Handover Ready</p>
                  <p className="mx-auto mt-xs max-w-xl text-sm font-semibold text-on-surface-variant">Inspect your parcel before releasing MTN MoMo escrow payouts.</p>
                  <Button
                    size="lg"
                    fullWidth
                    disabled={currentStatus === 'delivered'}
                    className="mt-md bg-primary-container text-white hover:bg-primary"
                    onClick={async () => {
                      try {
                        await orderApi.put(`/orders/${orderId}/status`, { status: 'delivered', userId: order.buyer.userId });
                        toast.success('Payout complete. Enjoy!');
                        fetchOrder();
                      } catch {
                        toast.error('Could not verify handover release.');
                      }
                    }}
                  >
                    Accept Goods & Release Payout
                  </Button>
                </div>
              ) : user?.role === 'RIDER' && deliveryData?.status === 'en_route_to_pickup' ? (
                <div className="grid gap-md md:grid-cols-2">
                  <ImageUpload
                    service="delivery"
                    endpoint={`/deliveries/${deliveryData._id}/pickup-photo`}
                    label="Upload packaged goods photo"
                    capture="environment"
                    value={pickupPhotoUrl}
                    onChange={setPickupPhotoUrl}
                  />
                  <div className="rounded border border-outline-variant bg-surface-container-low p-sm">
                    <div className="mb-sm flex items-center justify-between gap-sm">
                      <div>
                        <p className="font-label-caps text-label-caps text-primary">Stall QR scan</p>
                        <p className="text-xs font-semibold text-on-surface-variant">Scan the seller credential at pickup.</p>
                      </div>
                      <button type="button" onClick={() => setShowQrScanner((current) => !current)} className="rounded border border-outline-variant bg-white px-sm py-xs font-label-caps text-label-caps text-on-surface hover:border-primary">
                        {showQrScanner ? 'Close' : 'Scan'}
                      </button>
                    </div>
                    {showQrScanner && (
                      <div className="mb-sm overflow-hidden rounded border border-outline-variant bg-black">
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
                    <input value={pickupQrData} onChange={(event) => setPickupQrData(event.target.value)} placeholder="QR payload appears here" className="premium-input w-full text-xs" />
                    <Button
                      fullWidth
                      disabled={!pickupPhotoUrl || !pickupQrData}
                      className="mt-sm bg-primary-container hover:bg-primary"
                      onClick={async () => {
                        try {
                          await deliveryApi.post(`/deliveries/${deliveryData._id}/scan-qr`, { qrData: pickupQrData, photoUrl: pickupPhotoUrl });
                          toast.success('Pickup verified with photo and QR');
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
                </div>
              ) : user?.role === 'RIDER' && deliveryData?.status === 'pending_handover' ? (
                <Button fullWidth className="bg-primary-container hover:bg-primary" onClick={async () => {
                  try {
                    await deliveryApi.post(`/deliveries/${deliveryData._id}/handover`, { role: 'rider' });
                    toast.success('Handover Confirmed');
                    fetchOrder();
                    fetchDelivery(deliveryData._id || order.deliveryId);
                  } catch {
                    toast.error('Handover Failed');
                  }
                }}>
                  Confirm Item Handover
                </Button>
              ) : user?.role === 'RIDER' && deliveryData?.status === 'picked_up' ? (
                <Button fullWidth className="bg-green-600 hover:bg-green-700" onClick={async () => {
                  try {
                    await deliveryApi.patch(`/deliveries/${deliveryData._id}/complete`);
                    toast.success('Delivery Completed!');
                    fetchOrder();
                    fetchDelivery(deliveryData._id || order.deliveryId);
                  } catch {
                    toast.error('Failed to complete delivery');
                  }
                }}>
                  Mark as Delivered
                </Button>
              ) : (
                <p className="rounded border border-outline-variant bg-surface-container-low p-sm text-sm font-semibold text-on-surface-variant">
                  Security controls unlock as the order reaches pickup, handover, and final confirmation.
                </p>
              )}
            </section>

            <OrderReviewPanel order={order} deliveryData={deliveryData} />
          </section>

          <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-[0_8px_30px_rgba(27,28,28,0.03)] lg:w-[400px]">
            <div className="border-b border-outline bg-surface-container-lowest p-sm">
              <div className="mb-sm flex items-center justify-between px-sm">
                <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Communications</h3>
                <button onClick={() => setShowReceipt(true)} className="flex items-center gap-xs font-label-caps text-label-caps text-primary hover:text-primary-container">
                  <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                  Receipt Board
                </button>
              </div>
              <div className="flex rounded-lg border border-outline-variant bg-surface-container p-xs">
                <button
                  type="button"
                  onClick={() => setActiveChatTarget('seller')}
                  className={`flex-1 rounded py-xs text-center font-label-caps text-label-caps transition-all ${activeChatTarget === 'seller' ? 'border border-outline-variant bg-white font-bold text-on-surface shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
                >
                  Seller (Order)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChatTarget('rider')}
                  disabled={!order.deliveryId}
                  className={`flex-1 rounded py-xs text-center font-label-caps text-label-caps transition-all disabled:opacity-40 ${activeChatTarget === 'rider' ? 'border border-outline-variant bg-white font-bold text-on-surface shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
                >
                  Rider (Delivery)
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {activeChatTarget === 'seller' ? (
                <OrderChat
                  orderId={orderId}
                  initialMessages={orderMessages}
                  recipientName={order.seller?.fullName || t('seller') || 'Seller'}
                  userRole="BUYER"
                  orderStatus={order.status}
                  paymentStatus={order.payment?.status}
                  marketId={order.seller?.marketId}
                  deliveryAddress={order.buyer?.deliveryAddress}
                  deliveryFee={order.financials?.deliveryFee}
                  channel="ORDER"
                  onOrderUpdated={fetchOrder}
                  embedded
                />
              ) : (
                <DeliveryChatCard
                  orderId={orderId}
                  deliveryId={order.deliveryId}
                  userId={user?.id}
                  userName={user?.fullName || t('buyer') || 'Buyer'}
                  userRole={String(user?.role || '').toUpperCase() === 'RIDER' ? 'RIDER' : String(user?.role || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'BUYER'}
                  orderStatus={order.status}
                  initialMessages={deliveryMessages}
                  onOrderUpdated={fetchOrder}
                  embedded
                />
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );

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

      <div className="w-full p-6 md:p-8 space-y-lg animate-reveal pb-24">
        <section className="relative overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-md md:p-lg custom-shadow">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary-container/10 blur-3xl" />

          <div className="relative flex flex-col md:flex-row justify-between items-start md:items-end gap-sm">
            <div className="space-y-xs">
              <p className="flex items-center gap-xs font-label-caps text-[10px] text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span> Buyer Order Station
              </p>
              <h1 className="max-w-xl font-display-lg text-headline-lg text-on-surface leading-tight">
                {t('order') || 'Order'} #{orderId.substring(0, 8).toUpperCase()}
              </h1>
              <p className="max-w-xl text-xs text-on-surface-variant leading-relaxed font-body-md">
                {t('track_title') || 'Escrow protection and real-time courier dispatch status details.'}
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => setShowReceipt(true)}
              className="rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-xs font-black uppercase tracking-wider text-on-surface transition-all duration-300 hover:border-primary hover:text-primary"
            >
              Open Invoice Receipt
            </button>
          </div>
        </section>

        {/* Timeline banner */}
        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow">
          <OrderStatusTimeline currentStatus={currentStatus} />
        </div>

        {/* Escrow procedure status shelf */}
        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow">
          <div className="mb-md flex flex-col justify-between gap-sm border-b border-outline-variant/60 pb-sm md:flex-row md:items-end">
            <div>
              <p className="font-label-caps text-[10px] text-primary uppercase tracking-wider">MTN MoMo Escrow Rules</p>
              <h2 className="font-headline-md text-headline-md text-on-surface mt-0.5">Funds Held Under Secure Escrow</h2>
            </div>
            <span className="rounded-full bg-primary/10 text-primary-container border border-primary/20 px-3 py-1 font-data-mono text-[9px] uppercase font-bold select-none">
              {order.payment?.status === 'paid' ? 'Secured Funded' : 'Awaiting Settlement'}
            </span>
          </div>
          
          <div className="grid gap-xs md:grid-cols-5">
            {[
              ['Quote accepted', ['placed', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'awaiting_confirmation', 'delivered'].includes(currentStatus)],
              ['Buyer payment secured', order.payment?.status === 'paid'],
              ['Seller prepares goods', ['preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'awaiting_confirmation', 'delivered'].includes(currentStatus)],
              ['Rider photo & QR validation', Boolean(deliveryData?.pickup?.pickupPhotoUrl || pickupPhotoUrl || deliveryData?.pickup?.qrScannedAt)],
              ['Escrow payout release', isFinalOrderStatus],
            ].map(([label, done]) => (
              <div key={label as string} className={`rounded border p-md flex flex-col justify-between min-h-[4.5rem] transition-colors ${done ? 'border-primary-container bg-primary/5' : 'border-outline-variant bg-surface-container-low/30'}`}>
                <div className={`h-2 w-2 rounded-full ${done ? 'bg-primary-container shadow-sm shadow-[#ff6b00]' : 'bg-outline-variant'}`} />
                <p className={`font-label-caps text-[9px] leading-tight text-on-surface ${done ? 'text-primary' : 'text-on-surface-variant'}`}>{label as string}</p>
              </div>
            ))}
          </div>

          {(deliveryData?.pickup?.pickupPhotoUrl || pickupPhotoUrl) && (
            <div className="mt-md overflow-hidden rounded border border-outline-variant bg-surface-container-low/40">
              <div className="border-b border-outline-variant/60 bg-surface-container-low px-md py-sm">
                <p className="font-label-caps text-[9px] text-primary">Rider Handover Evidence Photo</p>
              </div>
              <img src={resolveUploadUrl(deliveryData?.pickup?.pickupPhotoUrl || pickupPhotoUrl, 'delivery')} alt="Rider pickup proof" className="max-h-52 w-full object-cover" />
            </div>
          )}
        </section>

        <OrderReviewPanel order={order} deliveryData={deliveryData} />

        {/* Chat Negotiation and Live messaging console */}
        <div className="grid grid-cols-1 gap-lg lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow">
            <div className="mb-md flex flex-col justify-between gap-sm border-b border-outline-variant pb-sm md:flex-row md:items-center">
              <div>
                <p className="font-label-caps text-[10px] text-primary uppercase tracking-wider">
                  {activeChatTarget === 'seller' ? (isNegotiationPhase ? 'Negotiation Center' : 'Stall Dialog') : 'Logistics Dispatch Dialog'}
                </p>
                <h2 className="font-headline-md text-headline-md text-on-surface mt-0.5 flex items-center gap-xs">
                  <MessageSquare size={18} className="text-primary-container shrink-0" />
                  {activeChatTarget === 'seller' ? (isNegotiationPhase ? t('track_negotiation') || 'Escrow Negotiation' : 'Messages with Stall') : 'Messages with Rider'}
                </h2>
              </div>
              
              <div className="flex flex-wrap gap-xs">
                <button
                  type="button"
                  onClick={() => setActiveChatTarget('seller')}
                  className={`rounded border px-3 py-1.5 font-label-caps text-[9px] transition-colors ${activeChatTarget === 'seller' ? 'border-primary-container bg-primary-container text-white' : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant'}`}
                >
                  Seller
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChatTarget('rider')}
                  disabled={!order.deliveryId}
                  className={`rounded border px-3 py-1.5 font-label-caps text-[9px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${activeChatTarget === 'rider' ? 'border-primary-container bg-primary-container text-white' : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant'}`}
                >
                  Rider
                </button>
              </div>
            </div>

            {activeChatTarget === 'seller' ? (
              <OrderChat
                orderId={orderId}
                initialMessages={orderMessages}
                recipientName={order.seller?.fullName || t('seller') || 'Seller'}
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
                userName={user?.fullName || t('buyer') || 'Buyer'}
                userRole={String(user?.role || '').toUpperCase() === 'RIDER' ? 'RIDER' : String(user?.role || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'BUYER'}
                orderStatus={order.status}
                initialMessages={deliveryMessages}
                onOrderUpdated={fetchOrder}
              />
            )}
          </div>

          {/* Pricing Ledger Card & Locations Info */}
          <div className="space-y-md">
            <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow space-y-sm">
              <p className="font-label-caps text-[10px] text-on-surface-variant block uppercase tracking-wider">
                {isNegotiationPhase ? 'Current escrow quote' : 'Order ledger amount'}
              </p>
              <div className="flex items-baseline gap-xs">
                <span className="font-data-mono text-3xl font-bold text-on-surface">
                  {(order.financials?.totalAmount || order.financials?.subtotal || 0).toLocaleString()}
                </span>
                <span className="font-label-caps text-xs text-primary font-bold">RWF</span>
              </div>
              <p className="text-xs font-semibold leading-relaxed text-on-surface-variant font-sans">
                {isNegotiationPhase
                  ? 'Accept or submit a counter offer quote. Pinned delivery coordinates are factored dynamically.'
                  : 'Escrow payment secured inside MTN MoMo. The chat dialog remains active for fulfillment logistics details.'}
              </p>
            </div>
            
            {order.buyer?.deliveryAddress?.address && order.buyer.deliveryAddress.address !== 'TBD' && (
              <div className="bg-[#ff6b00]/5 rounded border border-outline-variant/60 p-md flex items-start gap-xs">
                <MapPin size={16} className="text-primary-container shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-xs">
                  <p className="font-label-caps text-[9px] text-primary">{t('chat_set_location') || 'Set Delivery Location'}</p>
                  <p className="text-xs font-bold text-on-surface font-sans leading-snug">{order.buyer.deliveryAddress.address}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Action Area: Map or Receipt Releases */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-lg pt-md">
          <div className="space-y-md">
            {showEscrowAction ? (
              <Card className="border-2 border-primary-container bg-primary/5 flex flex-col items-center text-center p-md">
                <Package size={52} className="text-primary-container mb-sm animate-bounce" />
                <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">{t('track_package_arrived') || 'Package Handover Ready'}</h3>
                <p className="text-xs text-on-surface-variant mb-md px-md leading-relaxed font-semibold">
                  {t('track_inspect_goods') || 'Please thoroughly inspect your parcel. By clicking Accept, you release MTN MoMo escrow payouts directly to the stall seller.'}
                </p>
                <Button 
                  size="lg" 
                  fullWidth 
                  disabled={currentStatus === 'delivered'}
                  className="bg-primary-container hover:bg-primary text-white font-label-caps text-xs py-3"
                  onClick={async (e) => {
                    const btn = e.currentTarget;
                    btn.disabled = true;
                    btn.innerHTML = t('loading') || 'Processing...';
                    try {
                      await orderApi.put(`/orders/${orderId}/status`, { status: 'delivered', userId: order.buyer.userId });
                      toast.success(t('payment_released_thanks') || 'Payout complete. Enjoy!');
                      fetchOrder();
                    } catch (err) {
                      toast.error(t('confirm_receipt_failed') || 'Could not verify handover release.');
                      btn.disabled = false;
                      btn.innerHTML = t('track_confirm_receipt') || 'Accept Goods & Release Payout';
                    }
                  }}
                >
                  {t('track_confirm_receipt') || 'Accept Goods & Release Payout'}
                </Button>
              </Card>
            ) : showTrackingMap ? (
              <div className="rounded-lg border border-outline-variant bg-surface-container-lowest overflow-hidden custom-shadow flex flex-col">
                <div className="p-md border-b border-outline-variant bg-surface-container-low/50">
                  <h3 className="font-bold text-primary flex items-center gap-xs">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary-container"></span>
                    </span>
                    {deliveryData?.status === 'assigned' || deliveryData?.status === 'en_route_to_pickup' ? t('track_rider_heading') || 'Courier Heading to Stall' : 
                     deliveryData?.status === 'pending_handover' ? t('track_rider_handover') || 'Rider Verifying Parcel' :
                     currentStatus === 'picked_up' ? t('track_rider_picked_up') || 'Courier En Route to You' : t('dashboard_live_tracking') || 'Live Courier Dispatch Tracking'}
                  </h3>
                  <p className="text-xs text-on-surface-variant font-medium mt-xs leading-relaxed">
                    {deliveryData?.status === 'assigned' || deliveryData?.status === 'en_route_to_pickup' ? t('track_rider_en_route') || 'Rider heading to pick up goods from market.' :
                     deliveryData?.status === 'pending_handover' ? t('track_rider_verifying') || 'Rider is verifying weight and packaging photo at stall.' :
                     t('track_realtime') || 'Courier locations synchronized in real-time.'}
                  </p>
                </div>
                <div className="h-72 relative border-b border-outline-variant bg-surface-container-low">
                  <TrackingMap 
                    lat={riderGps?.lat || -1.9441} 
                    lng={riderGps?.lng || 30.0619} 
                    pickup={deliveryData?.pickup?.coordinates}
                    dropoff={deliveryData?.dropoff?.coordinates}
                    routeGeometry={deliveryData?.route?.geometry}
                  />
                </div>
                {deliveryData?.rider && (
                  <div className="p-md flex items-center gap-md">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary-container shrink-0">
                      <Bike size={20} />
                    </div>
                    <div className="min-w-0 flex-grow">
                      <p className="font-bold text-xs text-on-surface truncate">{deliveryData.rider.fullName}</p>
                      <p className="font-data-mono-sm text-[9px] text-on-surface-variant uppercase">{deliveryData.rider.plateNumber}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : showBroadcastMap ? (
              <div className="rounded-lg border border-outline-variant bg-surface-container-lowest overflow-hidden custom-shadow flex flex-col">
                <div className="p-md border-b border-outline-variant bg-surface-container-low/50">
                  <h3 className="font-bold text-primary flex items-center gap-xs">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary-container"></span>
                    </span>
                    {currentStatus === 'ready_for_pickup' ? t('track_assigning_rider') || 'Assigning Rider Dispatch' : t('track_processing') || 'Order Packaging'}
                  </h3>
                  <p className="text-xs text-on-surface-variant font-medium mt-xs leading-relaxed">
                    {currentStatus === 'preparing' ? t('track_packing') || 'Merchant is wrapping items at stall.' : t('track_finding_rider') || 'Courier service broadcasting coordinate dispatch.'}
                  </p>
                </div>
                <div className="h-60 relative border-b border-outline-variant bg-surface-container-low">
                  <RiderMap marketId={order.seller?.marketId || 'default'} />
                </div>
                <div className="p-sm text-center">
                  <p className="font-data-mono-sm text-[9px] text-on-surface-variant uppercase">
                    {currentStatus === 'preparing' ? t('track_wait_packing') || 'Awaiting preparation completion' : t('track_wait_rider') || 'Waiting for closest rider acceptance'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow flex flex-col items-center justify-center text-center py-10">
                {isFinalOrderStatus ? (
                  <Sparkles size={52} className="text-primary-container mb-sm animate-pulse" />
                ) : (
                  <Clock size={52} className="text-on-surface-variant mb-sm" />
                )}
                <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">
                  {isFinalOrderStatus ? t('track_delivered') || 'Fulfillment Complete' : t('track_placed') || 'Order Placed'}
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed max-w-sm px-sm font-semibold">
                  {isFinalOrderStatus
                    ? t('track_enjoy') || 'We hope you are fully satisfied with your goods. Thank you for using RMF!'
                    : t('track_payment_success') || 'Your payment has been successfully secured in escrow. Seller preparation starting.'}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-md">
            {/* Order Ledger details list */}
            <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow space-y-md">
              <h3 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant/60 pb-sm flex items-center gap-xs">
                <span className="w-1.5 h-3 bg-primary-container rounded-full"></span>
                {t('order_summary') || 'Items Summary'}
              </h3>
              
              <div className="space-y-sm max-h-48 overflow-y-auto custom-scrollbar pr-xs">
                {productsList.map((item: any, idx: number) => (
                  <div key={`${item.productId || item.name || 'item'}-${idx}`} className="flex justify-between items-center text-xs">
                    <span className="font-bold text-on-surface truncate pr-md">{item.quantity}x {item.name || t('product') || 'Product'}</span>
                    <span className="font-data-mono font-bold text-on-surface-variant flex-shrink-0">{(item.unitPrice * item.quantity).toLocaleString()} RWF</span>
                  </div>
                ))}
              </div>
              
              <div className="pt-sm border-t border-outline-variant flex justify-between items-end">
                <span className="font-label-caps text-label-caps text-on-surface">Total Secured</span>
                <div className="text-right">
                  <span className="font-data-mono text-lg font-bold text-primary-container">{order.financials?.totalAmount?.toLocaleString() || 'N/A'}</span>
                  <span className="font-label-caps text-[9px] text-primary-container ml-1">RWF</span>
                </div>
              </div>
            </div>
            
            {/* Rider onboarding dashboard tools */}
            {user?.role === 'RIDER' && deliveryData?.status !== 'delivered' && (
              <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow space-y-md">
                <h3 className="font-label-caps text-[10px] text-primary font-black uppercase tracking-wider block border-b border-outline-variant/60 pb-sm">Rider Telemetry Escrow Release</h3>
                
                <div className="space-y-md">
                  {deliveryData?.status === 'en_route_to_pickup' && (
                    <div className="space-y-sm bg-surface-container-low p-md rounded border border-outline-variant">
                      <p className="text-xs text-on-surface-variant leading-relaxed font-semibold">
                        Photograph the packaged seller goods first, then verify the stall QR. This binds compliance records to the MTN MoMo ledger.
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
              </div>
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
                     <select
                       className="w-full bg-background-card border border-border rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                       value={disputeType}
                       onChange={(e) => setDisputeType(e.target.value)}
                     >
                       <option value="not_delivered">Order not delivered</option>
                       <option value="wrong_item">Wrong item received</option>
                       <option value="quality_mismatch">Quality does not match listing</option>
                       <option value="other">Other</option>
                       <option value="general">General complaint</option>
                     </select>
                     {disputeType === 'quality_mismatch' && (
                       <p className="text-xs text-text-secondary">
                         Tip: attach photos in your message thread as evidence so the seller and admin can review.
                       </p>
                     )}
                     <p className="text-[11px] text-text-secondary">
                       You can raise a dispute up to 7 days after delivery.
                     </p>
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
                           await orderApi.post(`/orders/${orderId}/dispute`, { reason: disputeReason, type: disputeType });
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
