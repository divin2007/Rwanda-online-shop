'use client';
import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { OrderStatusTimeline } from '@/components/ui/OrderStatusTimeline';
import { OrderChat } from '@/components/ui/OrderChat';
import dynamic from 'next/dynamic';
import { useSocket } from '@/hooks/useSocket';
import { useApi } from '@/hooks/useApi';
import { orderApi, deliveryApi } from '@/lib/api';
import toast from 'react-hot-toast';

// Dynamically import Leaflet components to avoid SSR issues
const MapWrapper = dynamic(
  () => import('@/components/ui/TrackingMap').then((mod) => mod.TrackingMap),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center bg-background-surface"><p className="animate-pulse">Loading map...</p></div> }
);

const RiderMap = dynamic(
  () => import('@/components/ui/RiderMap').then((mod) => mod.RiderMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-background-surface animate-pulse"></div> }
);

const ChatCard = ({ orderId, deliveryId, userName }: { orderId: string, deliveryId?: string, userName: string }) => {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const { data: socketMsg, emit } = useSocket(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008', `delivery:${deliveryId}:chat`);

  useEffect(() => {
    if (socketMsg) {
      setChatHistory((prev) => [...prev, socketMsg]);
    }
  }, [socketMsg]);

  const sendMessage = () => {
    if (!message.trim() || !deliveryId) return;
    emit('chat:message', {
      deliveryId,
      senderId: 'buyer', // In real app, use user.id
      senderName: userName,
      text: message
    });
    setMessage('');
  };

  return (
    <Card className="flex flex-col h-[400px]">
      <h3 className="font-bold mb-4 border-b border-border pb-2">Messages</h3>
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2 scrollbar-thin">
        {chatHistory.length === 0 ? (
          <div className="text-center py-10 text-text-secondary text-sm italic">
            No messages yet. Contact the rider if needed.
          </div>
        ) : (
          chatHistory.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.senderId === 'buyer' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.senderId === 'buyer' ? 'bg-primary text-white rounded-br-none' : 'bg-background-surface text-text-primary rounded-bl-none'}`}>
                {msg.message}
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
          placeholder="Type a message..." 
          className="flex-1 bg-background-surface border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
        />
        <Button size="sm" onClick={sendMessage} disabled={!deliveryId}>Send</Button>
      </div>
    </Card>
  );
};

export default function OrderTrackingPage({ params }: { params: { orderId: string } }) {
  const [isClient, setIsClient] = useState(false);
  const [deliveryData, setDeliveryData] = useState<any>(null);

  const { data: order, loading, execute: fetchOrder } = useApi(orderApi, 'get', `/orders/${params.orderId}`, { refreshInterval: 5000 });

  // Fetch delivery data separately since rider info lives in the Delivery schema
  useEffect(() => {
    if (order?.deliveryId) {
      deliveryApi.get(`/deliveries/${order.deliveryId}`)
        .then(res => setDeliveryData(res.data?.data))
        .catch(() => {/* delivery may not exist yet */});
    }
  }, [order?.deliveryId]);

  // WebSockets for status and tracking
  const { data: statusUpdate } = useSocket(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008', `order:${params.orderId}:status`);
  const { data: riderGps } = useSocket(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008', `delivery:${order?.deliveryId}:tracking`);

  useEffect(() => {
    setIsClient(true);
    fetchOrder();
  }, [params.orderId, fetchOrder]);

  const currentStatus = order?.status === 'delivered' ? 'delivered' : (statusUpdate?.status || order?.status || 'placed');
  const showTrackingMap = currentStatus === 'in_transit' || currentStatus === 'picked_up' || 
    (deliveryData && ['assigned', 'en_route_to_pickup', 'pending_handover'].includes(deliveryData.status));
  const showBroadcastMap = !showTrackingMap && (currentStatus === 'placed' || currentStatus === 'confirmed' || currentStatus === 'preparing' || currentStatus === 'ready_for_pickup');
  const showEscrowAction = currentStatus === 'awaiting_confirmation';
  const isNegotiationPhase = currentStatus === 'awaiting_quote' || currentStatus === 'quote_sent' || 
    (currentStatus === 'placed' && order?.payment?.status !== 'paid');

  if (loading || !isClient) return <Layout><div className="flex justify-center p-20"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div></div></Layout>;
  if (!order) return <Layout><div className="p-20 text-center">Order not found</div></Layout>;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-heading font-bold text-text-primary mb-2">Track Order</h1>
        <p className="text-text-secondary mb-8">Order #{params.orderId.substring(0, 8).toUpperCase()}</p>

        <Card className="mb-8">
          <OrderStatusTimeline currentStatus={currentStatus} />
        </Card>

        {/* Negotiation Hub for bespoke orders */}
        {isNegotiationPhase && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-2">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="text-brand-primary">💬</span> Negotiation with Seller
              </h3>
              <OrderChat
                orderId={params.orderId}
                initialMessages={(order as any).messages || []}
                recipientName={order.seller?.fullName || 'Seller'}
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
                <h3 className="font-bold mb-4">Order Summary</h3>
                <div className="space-y-3 text-sm">
                  {order.products && order.products.map((item: any) => (
                    <div key={item.productId} className="flex justify-between">
                      <span>{item.quantity}x {item.name || 'Bespoke Item'}</span>
                      <span className="font-medium">{(item.unitPrice * item.quantity).toLocaleString()} RWF</span>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Subtotal</span>
                      <span>{(order.financials?.subtotal || 0).toLocaleString()} RWF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Delivery Fee</span>
                      <span>{(order.financials?.deliveryFee || 0).toLocaleString()} RWF</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
                      <span>Total</span>
                      <span className="text-primary">{(order.financials?.totalAmount || 0).toLocaleString()} RWF</span>
                    </div>
                  </div>
                </div>
              </Card>
              {order.buyer?.deliveryAddress?.address && order.buyer.deliveryAddress.address !== 'TBD' && (
                <div className="mt-4 bg-status-success/5 rounded-xl p-4 border border-status-success/20">
                  <p className="text-xs font-bold text-status-success uppercase mb-1">📍 Delivery Location</p>
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
                  <h3 className="text-xl font-bold mb-2">Package Arrived!</h3>
                  <p className="text-text-secondary mb-8 px-4">
                    The rider has arrived. Please inspect your goods and click the button below to confirm you have received everything in good condition.
                  </p>
                  <Button 
                    size="lg" 
                    fullWidth 
                    disabled={currentStatus === 'delivered'}
                    className="bg-primary hover:bg-primary-hover animate-bounce"
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.disabled = true;
                      btn.innerHTML = 'Processing Payout...';
                      try {
                        await orderApi.put(`/orders/${params.orderId}/status`, { status: 'delivered', userId: order.buyer.userId });
                        toast.success('Thank you! Payment has been released.');
                        fetchOrder();
                      } catch (err) {
                        toast.error('Failed to confirm receipt');
                        btn.disabled = false;
                        btn.innerHTML = 'Confirm Receipt (Release Payout)';
                      }
                    }}
                  >
                    Confirm Receipt (Release Payout)
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
                    {deliveryData?.status === 'assigned' || deliveryData?.status === 'en_route_to_pickup' ? 'Rider heading to store' : 
                     deliveryData?.status === 'pending_handover' ? 'Rider at store (Handover)' :
                     currentStatus === 'picked_up' ? 'Rider has picked up your order!' : 'Order is on the way!'}
                  </h3>
                  <p className="text-sm text-text-secondary mt-1">
                    {deliveryData?.status === 'assigned' || deliveryData?.status === 'en_route_to_pickup' ? 'The rider is on their way to pick up your items.' :
                     deliveryData?.status === 'pending_handover' ? 'The rider is currently verifying the items at the store.' :
                     'Track your rider in real-time.'}
                  </p>
                </div>
                <div className="h-80 relative">
                  <MapWrapper 
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
                    {currentStatus === 'ready_for_pickup' ? 'Assigning a rider...' : 'Processing Order'}
                  </h3>
                  <p className="text-sm text-text-secondary mt-1">
                    {currentStatus === 'preparing' ? 'The seller is currently packing your items.' : 'Finding the nearest available rider...'}
                  </p>
                </div>
                <div className="h-64 relative border-b border-border">
                  <RiderMap marketId={order.seller?.marketId || 'default'} />
                </div>
                <div className="p-4 text-center">
                  <p className="text-sm text-text-secondary">
                    {currentStatus === 'preparing' ? 'Wait while your items are being carefully packed.' : 'Waiting for a rider to accept the delivery.'}
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
                    {currentStatus === 'delivered' ? 'Order Delivered!' : 'Order Placed'}
                  </h3>
                  <p className="text-text-secondary">
                    {currentStatus === 'delivered' 
                      ? 'Enjoy your fresh products from the market.' 
                      : 'Payment successful. Waiting for seller confirmation.'}
                  </p>
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <h3 className="font-bold mb-4">Order Summary</h3>
              <div className="space-y-4">
                {order.products && order.products.map((item: any) => (
                  <div key={item.productId} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.name || 'Product'}</span>
                    <span className="font-medium">{(item.unitPrice * item.quantity).toLocaleString()} RWF</span>
                  </div>
                ))}
                {!order.products && order.product && (
                  <div key={order.product.productId} className="flex justify-between text-sm">
                    <span>{order.product.quantity}x {order.product.name || 'Product'}</span>
                    <span className="font-medium">{(order.product.unitPrice * order.product.quantity).toLocaleString()} RWF</span>
                  </div>
                )}
                <div className="pt-4 border-t border-border flex justify-between font-bold text-lg">
                  <span>Total Paid</span>
                  <span className="text-primary">{order.financials?.totalAmount?.toLocaleString() || 'N/A'} RWF</span>
                </div>
              </div>
            </Card>
            
            {currentStatus !== 'delivered' && (
              <ChatCard orderId={params.orderId} deliveryId={order.deliveryId} userName={order.buyer?.fullName || 'Buyer'} />
            )}
            
            {currentStatus === 'delivered' && (
               <div className="bg-background-surface p-6 rounded-xl border border-border">
                 <p className="font-bold mb-2">Issue with your order?</p>
                 <p className="text-sm text-text-secondary mb-4">If items are missing or damaged, you can raise a dispute within 24 hours.</p>
                 
                 {order.status === 'disputed' ? (
                   <div className="bg-status-warning/10 text-status-warning p-4 rounded-lg text-sm font-medium">
                     Dispute raised. Our team is investigating.
                   </div>
                 ) : (
                   <div className="space-y-4">
                     <textarea 
                       className="w-full bg-background-card border border-border rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                       placeholder="Please describe the issue (e.g. Missing 2kg of tomatoes)"
                       rows={3}
                       id="dispute-reason"
                     ></textarea>
                     <Button 
                       variant="outline" 
                       size="sm" 
                       fullWidth
                       onClick={async () => {
                         const reason = (document.getElementById('dispute-reason') as HTMLTextAreaElement).value;
                         if (!reason) return toast.error('Please provide a reason for the dispute');
                         try {
                           await orderApi.post(`/orders/${params.orderId}/dispute`, { reason });
                           toast.success('Dispute raised successfully');
                           fetchOrder();
                         } catch (e) {
                           toast.error('Failed to raise dispute');
                         }
                       }}
                     >
                       Submit Dispute
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
