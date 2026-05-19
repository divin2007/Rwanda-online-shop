'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useApi } from '@/hooks/useApi';
import { orderApi, deliveryApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { OrderStatusTimeline } from '@/components/ui/OrderStatusTimeline';
import { OrderChat } from '@/components/ui/OrderChat';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const TrackingMap = dynamic(() => import('@/components/ui/TrackingMap').then(mod => mod.TrackingMap), { ssr: false });
const RiderMap = dynamic(() => import('@/components/ui/RiderMap').then(mod => mod.RiderMap), { ssr: false });

const ChatCard = ({ deliveryId, userId, userName }: { deliveryId?: string, userId?: string, userName: string }) => {
  const { t } = useLanguage();
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const { data: socketMsg, isConnected, emit } = useSocket(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008', deliveryId ? `delivery:${deliveryId}:chat` : '');

  useEffect(() => {
    if (isConnected && deliveryId) {
      emit('join:delivery', deliveryId);
    }
  }, [deliveryId, emit, isConnected]);

  useEffect(() => {
    if (socketMsg) {
      setChatHistory((prev) => [...prev, socketMsg]);
    }
  }, [socketMsg]);

  const sendMessage = () => {
    if (!message.trim() || !deliveryId || !userId) return;
    emit('chat:message', {
      deliveryId,
      senderId: userId,
      senderName: userName,
      text: message
    });
    setMessage('');
  };

  return (
    <Card className="flex flex-col h-[400px]">
      <h3 className="font-bold mb-4 border-b border-border pb-2">{t('nav_my_orders')}</h3>
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2 scrollbar-thin">
        {chatHistory.length === 0 ? (
          <div className="text-center py-10 text-text-secondary text-sm">
            {t('track_no_messages')}
          </div>
        ) : (
          chatHistory.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.senderId === 'buyer' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.senderId === 'buyer' ? 'bg-primary text-white rounded-br-none' : 'bg-background-surface text-text-primary rounded-bl-none'}`}>
                {msg.text || msg.message}
              </div>
              <span className="text-[10px] text-text-secondary mt-1">{msg.senderName}</span>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input 
          type="text" 
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={t('chat_type_message')} 
          className="flex-1 bg-background-surface border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
        />
        <Button size="sm" onClick={sendMessage} disabled={!deliveryId || !userId}>{t('confirm')}</Button>
      </div>
    </Card>
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
  // MD9 fix: controlled textarea state instead of imperative document.getElementById
  const [disputeReason, setDisputeReason] = useState('');

  const { data: order, loading, execute: fetchOrder } = useApi(orderApi, 'get', `/orders/${orderId}`, { refreshInterval: 5000 });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (order?.deliveryId) {
      deliveryApi.get(`/deliveries/${order.deliveryId}`)
        .then(res => {
          const delivery = res.data?.data;
          setDeliveryData(delivery);
          setPickupPhotoUrl(delivery?.pickup?.pickupPhotoUrl || '');
        })
        .catch(() => {});
    }
  }, [order?.deliveryId]);

  const { data: statusUpdate } = useSocket(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008', `order:${orderId}:status`);
  const { data: riderGps, isConnected: trackingConnected, emit: emitTrackingSocket } = useSocket(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008', order?.deliveryId ? `delivery:${order.deliveryId}:tracking` : '');

  useEffect(() => {
    if (trackingConnected && order?.deliveryId) {
      emitTrackingSocket('join:delivery', order.deliveryId);
    }
  }, [emitTrackingSocket, order?.deliveryId, trackingConnected]);

  useEffect(() => {
    if (statusUpdate) {
      fetchOrder();
    }
  }, [statusUpdate, fetchOrder]);

  useEffect(() => {
    setIsClient(true);
    fetchOrder();
  }, [orderId, fetchOrder]);

  const currentStatus = order?.status === 'delivered' ? 'delivered' : (statusUpdate?.status || order?.status || 'placed');
  const showTrackingMap = currentStatus === 'in_transit' || currentStatus === 'picked_up' || 
    (deliveryData && ['assigned', 'en_route_to_pickup', 'pending_handover'].includes(deliveryData.status));
  const showBroadcastMap = !showTrackingMap && (currentStatus === 'placed' || currentStatus === 'confirmed' || currentStatus === 'preparing' || currentStatus === 'ready_for_pickup');
  const showEscrowAction = currentStatus === 'awaiting_confirmation' && user?.role === 'BUYER' && user?.id === order.buyer?.userId;
  const isNegotiationPhase = currentStatus === 'awaiting_quote' || currentStatus === 'quote_sent' || 
    (currentStatus === 'placed' && order?.payment?.status !== 'paid');

  if (isLoading || loading || !isClient) return <Layout><div className="flex justify-center p-20"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div></div></Layout>;
  if (!user) return null;
  if (!order) return <Layout><div className="p-20 text-center">{t('track_not_found')}</div></Layout>;

  // Security guard: Authorization check
  const isAuthorized = 
    user.role === 'ADMIN' || 
    user.id === order.buyerId || 
    user.id === order.buyer?.userId || 
    user.id === order.sellerId || 
    user.id === order.seller?.userId || 
    (user.role === 'RIDER' && (order.riderId === user.id || deliveryData?.riderId === user.id || deliveryData?.rider?.id === user.id));

  if (!isAuthorized) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto py-20 px-6 text-center animate-reveal">
          <div className="text-6xl mb-6 opacity-80">🛡️</div>
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-heading font-bold text-text-primary mb-2">{t('track_title')}</h1>
        <p className="text-text-secondary mb-8">{t('order')} #{orderId.substring(0, 8).toUpperCase()}</p>

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
              ['Buyer confirms receipt', currentStatus === 'delivered'],
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
              <img src={deliveryData?.pickup?.pickupPhotoUrl || pickupPhotoUrl} alt="Rider pickup proof" className="max-h-56 w-full object-cover" />
            </div>
          )}
        </section>

        {isNegotiationPhase && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-2">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="text-brand-primary">💬</span> {t('track_negotiation')}
              </h3>
              <OrderChat
                orderId={orderId}
                initialMessages={(order as any).messages || []}
                recipientName={order.seller?.fullName || t('seller')}
                userRole="BUYER"
                orderStatus={order.status}
                paymentStatus={order.payment?.status}
                marketId={order.seller?.marketId}
                deliveryAddress={order.buyer?.deliveryAddress}
                deliveryFee={order.financials?.deliveryFee}
                onOrderUpdated={fetchOrder}
              />
            </div>
            <div>
              <Card>
                <h3 className="font-bold mb-4">{t('order_summary')}</h3>
                <div className="space-y-3 text-sm">
                  {order.products && order.products.map((item: any) => (
                    <div key={item.productId} className="flex justify-between">
                      <span>{item.quantity}x {item.name || t('bespoke_item')}</span>
                      <span className="font-medium">{(item.unitPrice * item.quantity).toLocaleString()} RWF</span>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">{t('cart_subtotal')}</span>
                      <span>{(order.financials?.subtotal || 0).toLocaleString()} RWF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">{t('cart_delivery')}</span>
                      <span>{(order.financials?.deliveryFee || 0).toLocaleString()} RWF</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
                      <span>{t('cart_total')}</span>
                      <span className="text-primary">{(order.financials?.totalAmount || 0).toLocaleString()} RWF</span>
                    </div>
                  </div>
                </div>
              </Card>
              {order.buyer?.deliveryAddress?.address && order.buyer.deliveryAddress.address !== 'TBD' && (
                <div className="mt-4 bg-status-success/5 rounded-xl p-4 border border-status-success/20">
                  <p className="text-xs font-bold text-status-success uppercase mb-1">📍 {t('chat_set_location')}</p>
                  <p className="text-sm">{order.buyer.deliveryAddress.address}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            {showEscrowAction ? (
              <Card className="border-2 border-primary bg-primary/5">
                <div className="text-center py-10">
                  <span className="text-6xl block mb-4">📦</span>
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
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-xl">🛵</div>
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
                  <span className="text-6xl block mb-4">
                    {currentStatus === 'delivered' ? '🎉' : '🕒'}
                  </span>
                  <h3 className="text-xl font-bold mb-2">
                    {currentStatus === 'delivered' ? t('track_delivered') : t('track_placed')}
                  </h3>
                  <p className="text-text-secondary">
                    {currentStatus === 'delivered' 
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
                {order.products && order.products.map((item: any) => (
                  <div key={item.productId} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.name || t('product')}</span>
                    <span className="font-medium">{(item.unitPrice * item.quantity).toLocaleString()} RWF</span>
                  </div>
                ))}
                {!order.products && order.product && (
                  <div key={order.product.productId} className="flex justify-between text-sm">
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
            
            {currentStatus !== 'delivered' && (
              <ChatCard 
                deliveryId={order.deliveryId} 
                userId={user?.id}
                userName={user?.fullName || t('buyer')} 
              />
            )}
            
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
                      <Button
                        fullWidth
                        disabled={!pickupPhotoUrl}
                        className="bg-[#ff6b00] hover:bg-[#e05300] disabled:opacity-40"
                        onClick={async () => {
                          try {
                            await deliveryApi.post(`/deliveries/${deliveryData._id}/scan-qr`, {
                              stallId: deliveryData.pickup?.stallId || 'STALL-001',
                              photoUrl: pickupPhotoUrl,
                            });
                            toast.success('Pickup verified with photo and QR');
                            // MD8 fix: use fetchOrder() instead of window.location.reload()
                            // to avoid full-page jumps and state loss on mobile
                            fetchOrder();
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
