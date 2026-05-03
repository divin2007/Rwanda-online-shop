'use client';
import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MapPinPicker } from '@/components/ui/MapPinPicker';
import { useCart } from '@/components/cart/CartContext';
import { useRouter } from 'next/navigation';

export const CheckoutContent = () => {
  const { cartTotal, items, clearCart } = useCart();
  const router = useRouter();
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mtn' | 'airtel'>('mtn');
  const [phone, setPhone] = useState('');
  
  const subtotal = cartTotal;
  const deliveryFee = coords ? 1500 : 0;
  const gatewayFee = Math.ceil((subtotal + deliveryFee) * 0.02); // 2% standard
  const total = subtotal + deliveryFee + gatewayFee;

  const handleCheckout = () => {
    if (items.length === 0) {
      alert('Your cart is empty!');
      return;
    }
    // Simulate payment processing
    setTimeout(() => {
      clearCart();
      alert(`Payment of ${total} RWF successful via ${paymentMethod.toUpperCase()}! Your order is now being processed.`);
      router.push('/');
    }, 1500);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-heading font-bold text-text-primary mb-6">Checkout</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card>
            <h2 className="text-xl font-heading font-bold mb-4">1. Delivery Location</h2>
            <div className="h-64 rounded bg-background-surface overflow-hidden border border-border">
              <MapPinPicker onLocationSelected={setCoords} />
            </div>
            {coords && (
              <p className="mt-2 text-sm text-status-success font-medium">
                Location set: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </p>
            )}
          </Card>

          <Card>
            <h2 className="text-xl font-heading font-bold mb-4">2. Payment Method</h2>
            <div className="grid grid-cols-2 gap-4">
              <button 
                className={`p-4 border-2 rounded-lg text-center transition-colors ${paymentMethod === 'mtn' ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-300'}`}
                onClick={() => setPaymentMethod('mtn')}
              >
                <p className="font-bold">MTN MoMo</p>
                <p className="text-xs text-text-secondary">Instant</p>
              </button>
              <button 
                className={`p-4 border-2 rounded-lg text-center transition-colors ${paymentMethod === 'airtel' ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-300'}`}
                onClick={() => setPaymentMethod('airtel')}
              >
                <p className="font-bold">Airtel Money</p>
                <p className="text-xs text-text-secondary">Instant</p>
              </button>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Mobile Money Number</label>
              <input 
                type="tel" 
                placeholder="078..." 
                className="w-full border border-border rounded px-3 py-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-24">
            <h2 className="text-xl font-heading font-bold mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm pb-4 border-b border-border">
              <div className="flex justify-between">
                <span>Subtotal ({items.reduce((sum, i) => sum + i.quantity, 0)} items)</span>
                <span>{subtotal.toLocaleString()} RWF</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Fee</span>
                <span>{deliveryFee.toLocaleString()} RWF</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Gateway Fee (2%)</span>
                <span>{gatewayFee.toLocaleString()} RWF</span>
              </div>
            </div>
            <div className="flex justify-between font-bold text-lg pt-4 mb-6">
              <span>Total</span>
              <span className="text-primary">{total.toLocaleString()} RWF</span>
            </div>
            <Button 
              fullWidth 
              disabled={!coords || !phone || items.length === 0}
              onClick={handleCheckout}
            >
              Pay Now
            </Button>
            <p className="text-center text-[10px] text-text-muted mt-4 uppercase tracking-widest">
              Secure Rwandan Payment Gateway
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};
