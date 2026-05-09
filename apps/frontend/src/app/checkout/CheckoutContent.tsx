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
  const [notes, setNotes] = useState('');
  
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
      const mId = typeof items[0].marketId === 'object' ? (items[0].marketId as any)._id : items[0].marketId;
      marketApi.get(`/markets/${mId}`).then(res => {
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
        // Tiered pricing: 500 RWF per 5km block (Matching Rwanda Moto Standards)
        const R = 6371;
        const dLat = (coords.lat - marketCoords.lat) * Math.PI / 180;
        const dLng = (coords.lng - marketCoords.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(marketCoords.lat * Math.PI / 180) * Math.cos(coords.lat * Math.PI / 180) * Math.sin(dLng/2)**2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        // Match the 500 per 5km math
        const calculatedFee = Math.ceil(dist / 5) * 500;
        setDeliveryFee(Math.max(calculatedFee, 500));
        setIsCalculatingFee(false);
      }).catch(() => {
        // Fallback: estimate based on distance
        const R = 6371;
        const dLat = (coords.lat - marketCoords.lat) * Math.PI / 180;
        const dLng = (coords.lng - marketCoords.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(marketCoords.lat * Math.PI / 180) * Math.cos(coords.lat * Math.PI / 180) * Math.sin(dLng/2)**2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        const calculatedFee = Math.ceil(dist / 5) * 500;
        setDeliveryFee(Math.max(calculatedFee, 500));
      }).finally(() => setIsCalculatingFee(false));
    }
  }, [coords, marketCoords]);
  
  const subtotal = cartTotal;
  const gatewayFee = Math.ceil((subtotal + deliveryFee) * 0.02); // 2% standard
  const total = subtotal + deliveryFee + gatewayFee;

  // Listen for payment confirmation via socket
  useEffect(() => {
    const successStatuses = ['confirmed', 'paid', 'PAID', 'picked_up', 'in_transit', 'delivered'];
    if (statusUpdate && successStatuses.includes(statusUpdate.status?.toLowerCase() || statusUpdate.status)) {
      toast.success('Order moving forward!');
      if (items.length > 1) {
        router.push('/orders');
      } else {
        router.push(`/orders/${orderId}/tracking`);
      }
    }
  }, [statusUpdate, orderId, router, items.length]);

  const handleCheckout = async () => {
    if (items.length === 0) return toast.error('Your cart is empty!');
    if (!coords) return toast.error('Please drop a pin for your delivery location.');
    if (!phone) return toast.error('Please enter your mobile money number.');

    setIsPlacingOrder(true);
    try {
      // 1. Group items by Seller ID to avoid multiple prompts for the same store
      const ordersBySeller: Record<string, typeof items> = {};
      items.forEach(item => {
        const sId = item.sellerId || 'unknown';
        if (!ordersBySeller[sId]) ordersBySeller[sId] = [];
        ordersBySeller[sId].push(item);
      });

      const uniqueSellers = Object.keys(ordersBySeller).filter(id => id !== 'unknown');
      
      if (uniqueSellers.length === 0) return toast.error('Invalid cart: missing seller information.');
      
      // Calculate split delivery fee (if multiple sellers, user pays delivery fee once, but it's shared/multiplied?)
      // For now, let's charge full delivery fee PER SELLER since they are different locations
      const sellerDeliveryFee = Math.max(deliveryFee, 500);

      const orderPromises = uniqueSellers.map(sellerId => {
        const sellerItems = ordersBySeller[sellerId];
        const subtotal = sellerItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        const platformCommission = Math.max(subtotal * 0.015, 100);
        const gatewayFee = Math.ceil((subtotal + sellerDeliveryFee) * 0.02);
        const totalAmount = subtotal + sellerDeliveryFee + gatewayFee;
        
        const firstItem = sellerItems[0];

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
            sellerId: firstItem.sellerId,
            userId: firstItem.sellerUserId,
            fullName: firstItem.sellerName,
            stallId: firstItem.stallId,
            marketId: typeof firstItem.marketId === 'object' ? (firstItem.marketId as any)._id : firstItem.marketId
          },
          products: sellerItems.map(i => ({
            productId: i.id,
            name: i.name,
            unitPrice: i.price,
            quantity: i.quantity
          })),
          financials: {
            subtotal,
            deliveryFee: sellerDeliveryFee,
            platformCommission,
            gatewayFee,
            totalAmount,
            sellerPayout: subtotal - platformCommission,
            riderPayout: sellerDeliveryFee
          },
          payment: {
            method: paymentMethod,
            status: 'pending'
          },
          notes: notes
        }).then(res => ({ success: true, sellerName: firstItem.sellerName, data: res.data }))
          .catch(err => ({ success: false, sellerName: firstItem.sellerName, error: err.response?.data?.error || err.message }));
      });

      const results = await Promise.all(orderPromises);
      const succeeded = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (succeeded.length > 0) {
        clearCart(); // Clear whole cart if at least one order succeeded (simpler for now)
        
        const firstSuccess = succeeded[0] as any;
        const newOrderId = firstSuccess.data?.data?._id;
        const paymentStatus = firstSuccess.data?.data?.payment?.status;
        
        if (paymentStatus === 'PAID' || paymentStatus === 'paid') {
          toast.success('Payment received! Order confirmed.');
          if (uniqueSellers.length > 1) {
            router.push('/orders');
          } else {
            router.push(`/orders/${newOrderId}/tracking`);
          }
        } else {
          setOrderId(newOrderId);
          setIsWaitingPayment(true);
          toast.success('Please check your phone to approve the payment prompt.');
        }
      }

      if (failed.length > 0) {
        toast.error(`Order(s) failed for: ${failed.map(f => f.sellerName).join(', ')}`);
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
              <MapPinPicker onLocationSelected={setCoords} marketLocation={marketCoords} />
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
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1 text-text-secondary">Delivery Notes / Special Instructions</label>
              <textarea 
                placeholder="e.g. Please bring change for 5000, or call me at the blue gate..." 
                className="w-full border border-border rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary outline-none transition-all"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
