'use client';
import React, { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MapPinPicker } from '@/components/ui/MapPinPicker';

export default function CheckoutPage() {
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mtn' | 'airtel'>('mtn');
  const [phone, setPhone] = useState('');
  
  const subtotal = 9200; // Mock subtotal
  const deliveryFee = coords ? 1500 : 0;
  const gatewayFee = Math.ceil((subtotal + deliveryFee) * 0.02); // 2% standard
  const total = subtotal + deliveryFee + gatewayFee;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-heading font-bold text-text-primary mb-6">Checkout</h1>
        
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-grow space-y-6">
            
            {/* Delivery Location Section */}
            <Card>
              <h2 className="text-lg font-heading font-bold mb-4">1. Delivery Location</h2>
              <MapPinPicker onLocationSelected={(c) => setCoords(c)} />
            </Card>
            
            {/* Payment Section */}
            <Card>
              <h2 className="text-lg font-heading font-bold mb-4">2. Payment Method</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div 
                  className={`border rounded-lg p-4 cursor-pointer flex flex-col items-center justify-center gap-2 transition-colors ${paymentMethod === 'mtn' ? 'border-[#F8C811] bg-[#F8C811]/10 ring-2 ring-[#F8C811]/50' : 'border-border hover:border-gray-300'}`}
                  onClick={() => setPaymentMethod('mtn')}
                >
                  <div className="w-12 h-12 bg-[#F8C811] rounded-full flex items-center justify-center font-bold text-black text-xs">MTN</div>
                  <span className="font-medium text-sm">MTN MoMo</span>
                </div>
                
                <div 
                  className={`border rounded-lg p-4 cursor-pointer flex flex-col items-center justify-center gap-2 transition-colors ${paymentMethod === 'airtel' ? 'border-[#E31837] bg-[#E31837]/10 ring-2 ring-[#E31837]/50' : 'border-border hover:border-gray-300'}`}
                  onClick={() => setPaymentMethod('airtel')}
                >
                  <div className="w-12 h-12 bg-[#E31837] rounded-full flex items-center justify-center font-bold text-white text-xs">Airtel</div>
                  <span className="font-medium text-sm">Airtel Money</span>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Mobile Money Phone Number
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-background-surface text-text-secondary sm:text-sm">
                    +250
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="7X XXX XXXX"
                    className="flex-1 block w-full rounded-none rounded-r-md border border-border px-3 py-2 focus:ring-primary focus:border-primary sm:text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-text-muted">You will receive a push notification to authorize the payment.</p>
              </div>
            </Card>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
              <h3 className="text-sm font-bold text-blue-800 mb-1">No Internet? Use USSD Fallback</h3>
              <p className="text-sm text-blue-600">Dial <strong className="font-mono text-black">*123*456#</strong> to complete your pending order offline via Africa's Talking.</p>
            </div>
            
          </div>
          
          <div className="w-full md:w-80 flex-shrink-0">
            <Card className="sticky top-24">
              <h2 className="text-lg font-heading font-bold mb-4">Order Summary</h2>
              
              <div className="space-y-3 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Subtotal (2 items)</span>
                  <span className="font-medium">{subtotal} RWF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Delivery Fee</span>
                  <span className="font-medium">{coords ? `${deliveryFee} RWF` : 'Select location'}</span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>Gateway Fee (2%)</span>
                  <span>{gatewayFee} RWF</span>
                </div>
              </div>
              
              <div className="border-t border-border pt-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-text-primary">Total</span>
                  <span className="font-bold text-xl text-primary drop-shadow-sm">{total} RWF</span>
                </div>
              </div>
              
              <Button 
                fullWidth 
                size="lg" 
                disabled={!coords || phone.length < 8}
                onClick={() => alert('Processing payment...')}
              >
                Pay & Place Order
              </Button>
              
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-status-success">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Protected by RMF Buyer Guarantee
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
