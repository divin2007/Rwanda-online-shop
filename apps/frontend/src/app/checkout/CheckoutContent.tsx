'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import dynamic from 'next/dynamic';
const MapPinPicker = dynamic(() => import('@/components/ui/MapPinPicker').then(mod => mod.MapPinPicker), { ssr: false });
import { useCart } from '@/components/cart/CartContext';
import { useAuth } from '@/context/AuthContext';
import { orderApi, marketApi, deliveryApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import toast from 'react-hot-toast';

export const CheckoutContent = () => {
  const { cartTotal, items, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'MTN_MOMO' | 'AIRTEL_MONEY'>('MTN_MOMO');
  const [phone, setPhone] = useState('');
  
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isWaitingPayment, setIsWaitingPayment] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [marketCoords, setMarketCoords] = useState<{lat: number, lng: number} | null>(null);
  const { data: statusUpdate } = useSocket(
    process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006', 
    orderId ? `order:${orderId}:status` : ''
  );

  // Resolve first item's market coordinates for delivery fee calculation
  useEffect(() => {
    if (items.length > 0 && items[0].marketId && !marketCoords) {
      marketApi.get(`/markets/${items[0].marketId}`).then(res => {
        const market = res.data?.data;
        if (market?.location?.coordinates) {
          // GeoJSON stores [lng, lat]
          setMarketCoords({ lat: market.location.coordinates[1], lng: market.location.coordinates[0] });
        }
      }).catch(() => {});
    }
  }, [items, marketCoords]);

  // Calculate delivery fee via the real delivery service endpoint
  useEffect(() => {
    if (coords && marketCoords) {
      setIsCalculatingFee(true);
      deliveryApi.post('/deliveries/fee', {
        from: marketCoords,
        to: coords
      }).then(res => {
        if (res.data?.success) {
          setDeliveryFee(res.data.data.fee);
        }
      }).catch(() => {
        // Fallback: estimate based on distance
        const R = 6371;
        const dLat = (coords.lat - marketCoords.lat) * Math.PI / 180;
        const dLng = (coords.lng - marketCoords.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(marketCoords.lat * Math.PI / 180) * Math.cos(coords.lat * Math.PI / 180) * Math.sin(dLng/2)**2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        setDeliveryFee(Math.ceil(dist * 80 / 100) * 100); // 80 RWF/km, round to 100
      }).finally(() => setIsCalculatingFee(false));
    }
  }, [coords, marketCoords]);
  
  const subtotal = cartTotal;
  const gatewayFee = Math.ceil((subtotal + deliveryFee) * 0.02); // 2% standard
  const total = subtotal + deliveryFee + gatewayFee;

  // Listen for payment confirmation via socket
  useEffect(() => {
    if (statusUpdate && (statusUpdate.status === 'confirmed' || statusUpdate.status === 'paid')) {
      toast.success('Payment received! Order confirmed.');
      router.push(`/orders/${orderId}/tracking`);
    }
  }, [statusUpdate, orderId, router]);

  const handleCheckout = async () => {
    if (items.length === 0) return toast.error('Your cart is empty!');
    if (!coords) return toast.error('Please drop a pin for your delivery location.');
    if (!phone) return toast.error('Please enter your mobile money number.');

    setIsPlacingOrder(true);
    try {
      // Split delivery fee equally across items (each item is its own order)
      const splitDeliveryFee = Math.max(Math.ceil(deliveryFee / items.length), 500);

      const orderPromises = items.map(item => {
        const itemSubtotal = item.price * item.quantity;
        const platformCommission = Math.max(itemSubtotal * 0.015, 100);
        const gatewayFee = Math.ceil((itemSubtotal + splitDeliveryFee) * 0.02);
        const totalAmount = itemSubtotal + splitDeliveryFee + gatewayFee;
        const sellerPayout = itemSubtotal - platformCommission;
        const riderPayout = splitDeliveryFee;

        return orderApi.post('/orders', {
          buyer: {
            userId: user?.id,
            fullName: user?.fullName || 'Anonymous Buyer',
            phone: phone,
            deliveryAddress: {
              address: "Pin location",
              coordinates: coords
            }
          },
          seller: {
            sellerId: item.sellerId,
            userId: item.sellerUserId,
            fullName: item.sellerName,
            stallId: item.stallId,
            marketId: item.marketId
          },
          product: {
            productId: item.id,
            name: item.name,
            unitPrice: item.price,
            quantity: item.quantity
          },
          financials: {
            subtotal: itemSubtotal,
            deliveryFee: splitDeliveryFee,
            platformCommission,
            gatewayFee,
            totalAmount,
            sellerPayout,
            riderPayout
          },
          payment: {
            method: paymentMethod,
            status: 'pending'
          }
        }).then(res => ({ success: true, item, data: res.data }))
          .catch(err => ({ success: false, item, error: err.response?.data?.error || err.message }));
      });

      const results = await Promise.all(orderPromises);
      const succeeded = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      // Remove only successfully ordered items from cart
      const succeededIds = new Set(succeeded.map(r => r.item.id));
      const remainingItems = items.filter(i => !succeededIds.has(i.id));

      if (remainingItems.length === 0) {
        clearCart();
      } else {
        // Update cart to only keep failed items
        localStorage.setItem('rwshop_cart', JSON.stringify(remainingItems));
      }

      if (succeeded.length > 0) {
        // Use type assertion as we know succeeded[0] is from the .then() block
        const firstSuccess = succeeded[0] as { success: true; item: any; data: any };
        const newOrderId = firstSuccess.data?.data?._id;
        setOrderId(newOrderId);
        setIsWaitingPayment(true);
        toast.success('Please check your phone to approve the payment prompt.');
      }

      if (failed.length > 0) {
        toast.error(`${failed.length} item(s) failed to order: ${failed.map(f => f.item.name).join(', ')}`);
        // Only reset placement if all failed
        if (succeeded.length === 0) {
          setIsPlacingOrder(false);
          setIsWaitingPayment(false);
        }
      }
    } catch (error: any) {
      toast.error('Failed to place order. Please try again.');
      setIsPlacingOrder(false);
      setIsWaitingPayment(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-heading font-bold text-text-primary mb-6">Checkout</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="text-xl font-heading font-bold mb-4">1. Delivery Location</h2>
            <div className="h-80 rounded bg-background-surface overflow-hidden border border-border">
              <MapPinPicker onLocationSelected={setCoords} />
            </div>
            {coords && (
              <p className="mt-4 text-sm bg-status-success/10 text-status-success font-bold px-3 py-2 rounded">
                ✓ Pinned: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </p>
            )}
          </Card>

          <Card>
            <h2 className="text-xl font-heading font-bold mb-4">2. Payment Method</h2>
            <div className="grid grid-cols-2 gap-4">
              <button 
                className={`p-4 border-2 rounded-lg text-center transition-colors ${paymentMethod === 'MTN_MOMO' ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-300'}`}
                onClick={() => setPaymentMethod('MTN_MOMO')}
              >
                <p className="font-bold">MTN MoMo</p>
              </button>
              <button 
                className={`p-4 border-2 rounded-lg text-center transition-colors ${paymentMethod === 'AIRTEL_MONEY' ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-300'}`}
                onClick={() => setPaymentMethod('AIRTEL_MONEY')}
              >
                <p className="font-bold">Airtel Money</p>
              </button>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Mobile Money Number</label>
              <input 
                type="tel" 
                placeholder="078..." 
                className="w-full border border-border rounded px-3 py-2 focus:ring-primary outline-none"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-24">
            <h2 className="text-xl font-heading font-bold mb-4">Order Summary</h2>
            <div className="space-y-3 text-sm pb-4 border-b border-border">
              <div className="flex justify-between">
                <span className="text-text-secondary">Subtotal ({items.reduce((sum, i) => sum + i.quantity, 0)} items)</span>
                <span className="font-medium">{subtotal.toLocaleString()} RWF</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Delivery Fee</span>
                {isCalculatingFee ? (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span className="font-medium">{coords ? `${deliveryFee.toLocaleString()} RWF` : 'Select location'}</span>
                )}
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Gateway Fee (2%)</span>
                <span>{gatewayFee.toLocaleString()} RWF</span>
              </div>
            </div>
            <div className="flex justify-between font-bold text-xl pt-4 mb-6">
              <span>Total</span>
              <span className="text-primary">{total.toLocaleString()} RWF</span>
            </div>
            
            <Button 
              fullWidth 
              size="lg"
              disabled={!coords || !phone || items.length === 0 || isPlacingOrder || isCalculatingFee || isWaitingPayment}
              onClick={handleCheckout}
            >
              {isWaitingPayment ? 'Awaiting Payment Approval...' : isPlacingOrder ? 'Processing...' : 'Pay & Place Order'}
            </Button>
            
            <div className="mt-6 bg-status-info/10 border border-status-info/20 rounded p-3">
              <p className="text-xs text-status-info font-medium text-center">
                No internet? Dial <strong>*182#</strong> to complete your order via USSD.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
