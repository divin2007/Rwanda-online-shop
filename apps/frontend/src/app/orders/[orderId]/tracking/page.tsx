'use client';
import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { OrderStatusTimeline } from '@/components/ui/OrderStatusTimeline';
import dynamic from 'next/dynamic';
import { useSocket } from '@/hooks/useSocket';
import { useApi } from '@/hooks/useApi';
import { orderApi } from '@/lib/api';

// Dynamically import Leaflet components to avoid SSR issues
const MapWrapper = dynamic(
  () => import('@/components/ui/TrackingMap').then((mod) => mod.TrackingMap),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center bg-background-surface"><p className="animate-pulse">Loading map...</p></div> }
);

const RiderMap = dynamic(
  () => import('@/components/ui/RiderMap').then((mod) => mod.RiderMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-background-surface animate-pulse"></div> }
);

export default function OrderTrackingPage({ params }: { params: { orderId: string } }) {
  const [isClient, setIsClient] = useState(false);
  
  const { data: order, loading, execute: fetchOrder } = useApi(orderApi, 'get', `/orders/${params.orderId}`);
  
  // WebSockets for status and tracking
  const { data: statusUpdate } = useSocket(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008', `order:${params.orderId}:status`);
  const { data: riderGps } = useSocket(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008', `delivery:${order?.deliveryId}:tracking`);

  useEffect(() => {
    setIsClient(true);
    fetchOrder();
  }, [params.orderId, fetchOrder]);

  const currentStatus = statusUpdate?.status || order?.status || 'placed';
  const showTrackingMap = currentStatus === 'in_transit' || currentStatus === 'picked_up';
  const showBroadcastMap = currentStatus === 'placed' || currentStatus === 'confirmed';

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            {showTrackingMap ? (
              <Card noPadding className="overflow-hidden">
                <div className="h-80 relative">
                  {riderGps ? (
                    <MapWrapper lat={riderGps.lat} lng={riderGps.lng} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-background-surface">
                      <p className="text-text-secondary animate-pulse">Waiting for rider GPS signal...</p>
                    </div>
                  )}
                </div>
                {order.rider && (
                  <div className="p-4 border-t border-border flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-xl">🛵</div>
                    <div>
                      <p className="font-bold text-text-primary">{order.rider.name}</p>
                      <p className="text-sm text-text-secondary">{order.rider.plateNumber}</p>
                    </div>
                  </div>
                )}
              </Card>
            ) : showBroadcastMap ? (
              <Card noPadding className="overflow-hidden">
                <div className="p-4 border-b border-border bg-background-surface">
                  <h3 className="font-bold text-primary flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                    Broadcasting to nearby riders
                  </h3>
                  <p className="text-sm text-text-secondary mt-1">Sending delivery request to riders within 500m of the shop...</p>
                </div>
                <div className="h-64 relative border-b border-border">
                  <RiderMap marketId={order.seller?.marketId || 'default'} />
                </div>
                <div className="p-4 text-center">
                  <p className="text-sm text-text-secondary">Waiting for a rider to accept the delivery.</p>
                </div>
              </Card>
            ) : (
              <Card>
                <div className="text-center py-10">
                  <span className="text-6xl block mb-4">
                    {currentStatus === 'delivered' ? '🎉' : '🕒'}
                  </span>
                  <h3 className="text-xl font-bold mb-2">
                    {currentStatus === 'delivered' ? 'Order Delivered!' : 'Preparing your order...'}
                  </h3>
                  <p className="text-text-secondary">
                    {currentStatus === 'delivered' 
                      ? 'Enjoy your fresh products from the market.' 
                      : 'The seller is currently packing your items.'}
                  </p>
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <h3 className="font-bold mb-4">Order Summary</h3>
              <div className="space-y-4">
                {order.items?.map((item: any) => (
                  <div key={item.productId} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.productName || 'Product'}</span>
                    <span className="font-medium">{(item.price * item.quantity).toLocaleString()} RWF</span>
                  </div>
                ))}
                <div className="pt-4 border-t border-border flex justify-between font-bold text-lg">
                  <span>Total Paid</span>
                  <span className="text-primary">{order.total?.toLocaleString()} RWF</span>
                </div>
              </div>
            </Card>
            
            {currentStatus === 'delivered' && (
               <div className="bg-background-surface p-4 rounded-xl text-center">
                 <p className="text-sm text-text-secondary mb-3">Issue with your order?</p>
                 <Button variant="outline" size="sm">Raise Dispute</Button>
               </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
