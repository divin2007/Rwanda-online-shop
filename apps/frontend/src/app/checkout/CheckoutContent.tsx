'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import dynamic from 'next/dynamic';
const MapPinPicker = dynamic(() => import('@/components/ui/MapPinPicker').then(mod => mod.MapPinPicker), { ssr: false });
import { useCart } from '@/components/cart/CartContext';
import { useAuth } from '@/context/AuthContext';
import { orderApi } from '@/lib/api';
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

  // Calculate delivery fee whenever coordinates change
  useEffect(() => {
    if (coords) {
      setIsCalculatingFee(true);
      // Example call to order-service or delivery-service to calculate fee based on coords
      // Since it's dynamic based on distance from market, we assume the backend handles it.
      // E.g., orderApi.get(`/delivery-fee?lat=${coords.lat}&lng=${coords.lng}`)
      setTimeout(() => {
        setDeliveryFee(Math.floor(Math.random() * 1000) + 1000); // Simulated real calculation for now
        setIsCalculatingFee(false);
      }, 500);
    }
  }, [coords]);
  
  const subtotal = cartTotal;
  const gatewayFee = Math.ceil((subtotal + deliveryFee) * 0.02); // 2% standard
  const total = subtotal + deliveryFee + gatewayFee;

  const handleCheckout = async () => {
    if (items.length === 0) return toast.error('Your cart is empty!');
    if (!coords) return toast.error('Please drop a pin for your delivery location.');
    if (!phone) return toast.error('Please enter your mobile money number.');

    setIsPlacingOrder(true);
    try {
      const orderPromises = items.map(item => {
        const itemSubtotal = item.price * item.quantity;
        // 1.5% commission, min 100 RWF (per OrderService logic)
        const platformCommission = Math.max(itemSubtotal * 0.015, 100);
        const itemDeliveryFee = 1000; // Fixed for now, or use state value
        const gatewayFee = Math.ceil((itemSubtotal + itemDeliveryFee) * 0.02);
        const totalAmount = itemSubtotal + itemDeliveryFee + gatewayFee;
        
        // Document 7 logic: Seller payout is subtotal - commission
        const sellerPayout = itemSubtotal - platformCommission;
        // Rider payout is the delivery fee
        const riderPayout = itemDeliveryFee;

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
            deliveryFee: itemDeliveryFee,
            platformCommission,
            gatewayFee,
            totalAmount,
            sellerPayout,
            riderPayout
          },
          payment: {
            method: paymentMethod,
            status: 'PENDING'
          }
        });
      });

      const results = await Promise.all(orderPromises);
      
      clearCart();
      toast.success('Order placed successfully!');
      
      const firstOrderId = results[0].data?.data?._id || 'temp-id'; 
      router.push(`/orders/${firstOrderId}/tracking`);
      
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to place order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
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
              disabled={!coords || !phone || items.length === 0 || isPlacingOrder || isCalculatingFee}
              onClick={handleCheckout}
            >
              {isPlacingOrder ? 'Processing...' : 'Pay & Place Order'}
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
