'use client';
import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { OrderStatusTimeline } from '@/components/ui/OrderStatusTimeline';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useSocket } from '@/hooks/useSocket';
import { useApi } from '@/hooks/useApi';
import { orderApi } from '@/lib/api';

const riderIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: 'hue-rotate-[200deg]', // Blue-ish
});

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
  const showMap = currentStatus === 'in_transit' || currentStatus === 'picked_up';

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
            {showMap ? (
              <Card noPadding className="overflow-hidden">
                <div className="h-80 relative">
                  {riderGps ? (
                    <MapContainer center={[riderGps.lat, riderGps.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={[riderGps.lat, riderGps.lng]} icon={riderIcon} />
                    </MapContainer>
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
                      : 'The seller is currently packing your items. A rider will be assigned soon.'}
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
