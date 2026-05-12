'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import dynamic from 'next/dynamic';
const MapPinPicker = dynamic(() => import('@/components/ui/MapPinPicker').then(mod => mod.MapPinPicker), { ssr: false });
import { useCart } from '@/components/cart/CartContext';
import { useAuth } from '@/context/AuthContext';
import { orderApi, marketApi, deliveryApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { useLanguage } from '@/context/LanguageContext';
import toast from 'react-hot-toast';

export const CheckoutContent = () => {
  const { cartTotal, items, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'MTN_MOMO' | 'AIRTEL_MONEY'>('MTN_MOMO');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [nid, setNid] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [frequency, setFrequency] = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [scheduledDay, setScheduledDay] = useState('Monday');
  
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

  useEffect(() => {
    if (items.length > 0 && items[0].marketId && !marketCoords) {
      const mId = typeof items[0].marketId === 'object' ? (items[0].marketId as any)._id : items[0].marketId;
      marketApi.get(`/markets/${mId}`).then(res => {
        const market = res.data?.data;
        if (market?.location?.coordinates) {
          setMarketCoords({ lat: market.location.coordinates[1], lng: market.location.coordinates[0] });
        }
      }).catch(() => {});
    }
  }, [items, marketCoords]);

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
        const calculatedFee = 1500;
        setDeliveryFee(calculatedFee);
      }).finally(() => setIsCalculatingFee(false));
    }
  }, [coords, marketCoords]);
  
  const subtotal = cartTotal;
  const gatewayFee = Math.ceil((subtotal + deliveryFee) * 0.02);
  const total = subtotal + Math.max(0, deliveryFee) + gatewayFee;

  useEffect(() => {
    const successStatuses = ['confirmed', 'paid', 'PAID', 'picked_up', 'in_transit', 'delivered'];
    if (statusUpdate && successStatuses.includes(statusUpdate.status?.toLowerCase() || statusUpdate.status)) {
      toast.success('Payment confirmed! Your order is placed.');
      if (items.length > 1) {
        router.push('/orders');
      } else {
        router.push(`/orders/${orderId}/tracking`);
      }
    }
  }, [statusUpdate, orderId, router, items.length]);

  const handleCheckout = async () => {
    if (items.length === 0) return toast.error('Your cart is empty.');
    if (!coords) return toast.error('Please drop a pin for your delivery location.');
    if (!phone) return toast.error('Please enter your mobile money number.');
    if (total > 50000 && !nid) return toast.error('National ID is required for large orders.');

    setIsPlacingOrder(true);
    try {
      const ordersBySeller: Record<string, typeof items> = {};
      items.forEach(item => {
        const sId = item.sellerId || 'unknown';
        if (!ordersBySeller[sId]) ordersBySeller[sId] = [];
        ordersBySeller[sId].push(item);
      });

      const uniqueSellers = Object.keys(ordersBySeller).filter(id => id !== 'unknown');
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
            fullName: user?.fullName || 'Guest Buyer',
            phone: phone,
            nationalId: nid || undefined,
            deliveryAddress: {
              address: "Pinned Location",
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
          schedule: isScheduled ? {
            frequency,
            day: scheduledDay,
            nextRun: new Date()
          } : undefined,
          notes: notes
        }).then(res => ({ success: true, sellerName: firstItem.sellerName, data: res.data }))
          .catch(err => ({ success: false, sellerName: firstItem.sellerName, error: err.response?.data?.error || err.message }));
      });

      const results = await Promise.all(orderPromises);
      const succeeded = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (succeeded.length > 0) {
        clearCart();
        const firstSuccess = succeeded[0] as any;
        const newOrderId = firstSuccess.data?.data?._id;
        setOrderId(newOrderId);
        setIsWaitingPayment(true);
        toast.success('Check your phone to approve the payment prompt.');
      }

      if (failed.length > 0) {
        toast.error(`Order failed for: ${failed.map(f => f.sellerName).join(', ')}`);
        if (succeeded.length === 0) setIsPlacingOrder(false);
      }
    } catch (error: any) {
      toast.error('An error occurred during checkout.');
      setIsPlacingOrder(false);
    }
  };

  const days = [
    { value: 'Monday', label: 'Monday' }, { value: 'Tuesday', label: 'Tuesday' },
    { value: 'Wednesday', label: 'Wednesday' }, { value: 'Thursday', label: 'Thursday' },
    { value: 'Friday', label: 'Friday' }, { value: 'Saturday', label: 'Saturday' },
    { value: 'Sunday', label: 'Sunday' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-24 pb-40 px-6 pt-10 animate-reveal">
      {/* ── Header ── */}
      <div className="border-b border-[#121212] pb-12">
        <div className="flex items-center gap-4 mb-6">
           <div className="w-12 h-px bg-[#F59E0B]" />
           <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.5em]">Secure Checkout</p>
        </div>
        <h1 className="text-7xl font-serif text-[#121212] leading-[0.85] tracking-tighter italic">Checkout</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 xl:gap-24 items-start">
        <div className="lg:col-span-8 space-y-24">
          
          {/* ── Delivery Location ── */}
          <section className="space-y-8">
            <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-6">
              <h2 className="text-3xl font-serif text-[#121212] italic tracking-tighter">1. Delivery Location</h2>
              <div className="flex items-center gap-3">
                 <div className={`w-2 h-2 rounded-full ${coords ? 'bg-green-500 animate-pulse' : 'bg-[#E5E1D8]'}`} />
                 <span className="text-[9px] font-black uppercase tracking-widest text-[#121212]">{coords ? 'Location Pinned' : 'Drop Pin on Map'}</span>
              </div>
            </div>
            
            <div className="h-[450px] border border-[#E5E1D8] relative overflow-hidden group">
               <MapPinPicker onLocationSelected={setCoords} marketLocation={marketCoords} />
               
               {!coords && (
                 <div className="absolute top-6 left-6 z-10 pointer-events-none">
                    <div className="bg-[#121212] text-white text-[9px] font-black uppercase tracking-[0.4em] py-3 px-6 shadow-md">
                        Drop Pin To Set Location
                    </div>
                 </div>
               )}
            </div>
            
            {coords && (
              <div className="p-6 bg-[#F8F6F1] border border-[#E5E1D8] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-reveal">
                 <div className="space-y-1">
                     <p className="text-[10px] font-black text-[#121212] uppercase tracking-[0.3em]">✓ Location Set</p>
                     <p className="text-[9px] text-[#6B665E] font-medium tracking-widest">Delivery fee calculated based on distance.</p>
                 </div>
                 <p className="text-sm font-serif italic text-[#121212] bg-white px-4 py-2 border border-[#E5E1D8]">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
              </div>
            )}
          </section>

          {/* ── Payment Method ── */}
          <section className="space-y-8">
            <h2 className="text-3xl font-serif text-[#121212] italic tracking-tighter border-b border-[#E5E1D8] pb-6">2. Payment & Details</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { id: 'MTN_MOMO', label: 'MTN MoMo', color: 'bg-[#FFCC00]', desc: 'Pay via MTN Mobile Money' },
                { id: 'AIRTEL_MONEY', label: 'Airtel Money', color: 'bg-[#ED1C24]', desc: 'Pay via Airtel Money' }
              ].map(method => (
                <button 
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as any)}
                  className={`p-8 border transition-all flex flex-col items-center gap-4 relative group ${
                    paymentMethod === method.id 
                      ? 'border-[#121212] bg-[#F8F6F1] shadow-md' 
                      : 'border-[#E5E1D8] bg-white hover:border-[#121212]'
                  }`}
                >
                  {paymentMethod === method.id && (
                    <div className="absolute top-4 right-4">
                      <div className="w-2 h-2 bg-[#F59E0B] rounded-full animate-ping" />
                    </div>
                  )}
                  <div className={`w-12 h-12 ${method.color} border border-[#121212] flex items-center justify-center text-lg font-black`}>
                    {method.id === 'MTN_MOMO' ? 'M' : 'A'}
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#121212] block mb-1">{method.label}</span>
                    <span className="text-[8px] font-bold text-[#6B665E]">{method.desc}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-8 bg-white border border-[#E5E1D8] p-8 md:p-12">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#121212] uppercase tracking-[0.4em] block">
                  Mobile Money Number <span className="text-red-500">*</span>
                </label>
                <input 
                  type="tel" 
                  placeholder="07XXXXXXXX" 
                  className="w-full bg-[#F8F6F1] border border-[#E5E1D8] focus:border-[#121212] px-5 py-4 text-sm outline-none transition-colors"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              {total > 50000 && (
                <div className="space-y-6 pt-8 border-t border-[#E5E1D8] animate-reveal">
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-[#A34D15] uppercase tracking-[0.4em] block">National ID Required</label>
                     <p className="text-[9px] text-[#6B665E] font-medium leading-relaxed">By law, orders over 50,000 RWF require a valid Rwandan National ID for verification.</p>
                  </div>
                  <input 
                    type="text" 
                    placeholder="1 19XX 8 XXXX XXX X XX" 
                    maxLength={16}
                    className="w-full bg-[#F8F6F1] border border-[#A34D15]/30 focus:border-[#A34D15] px-5 py-4 text-center tracking-[0.3em] font-black outline-none transition-colors"
                    value={nid}
                    onChange={(e) => setNid(e.target.value.replace(/\s/g, ''))}
                  />
                </div>
              )}

              <div className="space-y-2 pt-8 border-t border-[#E5E1D8]">
                <label className="text-[10px] font-black text-[#121212] uppercase tracking-[0.4em] block">
                  Delivery Notes <span className="opacity-40 font-normal">(Optional)</span>
                </label>
                <textarea 
                  placeholder="Any special instructions for the rider?" 
                  className="w-full bg-[#F8F6F1] border border-[#E5E1D8] focus:border-[#121212] px-5 py-4 text-sm outline-none transition-colors min-h-[120px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* ── Delivery Schedule ── */}
          <section className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E1D8] pb-6">
               <h2 className="text-3xl font-serif text-[#121212] italic tracking-tighter">3. Schedule Delivery</h2>
               
               <label className="relative inline-flex items-center cursor-pointer">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] mr-4 text-[#6B665E]">Recurring Order</span>
                  <input type="checkbox" className="sr-only peer" checked={isScheduled} onChange={() => setIsScheduled(!isScheduled)} />
                  <div className="w-11 h-6 bg-[#E5E1D8] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#121212]"></div>
               </label>
            </div>
            
            {isScheduled ? (
              <div className="p-8 bg-[#F8F6F1] border border-[#E5E1D8] grid grid-cols-1 sm:grid-cols-2 gap-8 animate-reveal">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[#121212] uppercase tracking-[0.3em] block">Frequency</label>
                  <select 
                    className="w-full bg-white border border-[#E5E1D8] focus:border-[#121212] px-5 py-3 text-sm outline-none transition-colors cursor-pointer"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                  >
                    <option value="WEEKLY">Every Week</option>
                    <option value="MONTHLY">Every Month</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[#121212] uppercase tracking-[0.3em] block">Delivery Day</label>
                  <select 
                    className="w-full bg-white border border-[#E5E1D8] focus:border-[#121212] px-5 py-3 text-sm outline-none transition-colors cursor-pointer"
                    value={scheduledDay}
                    onChange={(e) => setScheduledDay(e.target.value)}
                  >
                    {days.map(day => (
                      <option key={day.value} value={day.value}>{day.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-[#E5E1D8] text-center bg-white">
                 <p className="text-sm font-medium text-[#6B665E]">This is a one-time order.</p>
                 <p className="text-[9px] mt-2 text-[#6B665E]/60 uppercase tracking-widest">Toggle 'Recurring Order' to schedule regular deliveries.</p>
              </div>
            )}
          </section>
        </div>

        {/* ── Order Summary ── */}
        <div className="lg:col-span-4">
          <div className="bg-[#121212] text-white p-10 lg:p-12 sticky top-32 shadow-2xl">
            <div className="flex items-center gap-4 mb-10">
               <div className="w-8 h-px bg-[#F59E0B]" />
               <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.5em]">Order Summary</p>
            </div>
            
            <div className="space-y-6 mb-10 pb-8 border-b border-white/10">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Subtotal</span>
                <span className="text-lg font-serif italic">{subtotal.toLocaleString()} RWF</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Delivery Fee</span>
                {isCalculatingFee ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="text-lg font-serif italic text-white">
                    {coords ? `${deliveryFee.toLocaleString()} RWF` : '—'}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Service Fee</span>
                <span className="text-sm font-serif italic opacity-70">{gatewayFee.toLocaleString()} RWF</span>
              </div>
            </div>

            <div className="flex flex-col mb-12 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.5em] opacity-50">Total</span>
              <div className="text-right">
                <span className="text-6xl font-serif italic tracking-tighter text-white leading-none">
                  {(total || 0).toLocaleString()}
                </span>
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-[#F59E0B] ml-2">RWF</span>
              </div>
            </div>

            <button 
              disabled={!coords || !phone || items.length === 0 || isPlacingOrder || isCalculatingFee || isWaitingPayment}
              onClick={handleCheckout}
              className="w-full py-6 text-[10px] font-black uppercase tracking-[0.3em] bg-[#F59E0B] text-[#121212] hover:bg-white transition-all disabled:opacity-40 disabled:grayscale flex items-center justify-center gap-3"
            >
              {isWaitingPayment ? (
                <>
                   <div className="w-3 h-3 border-2 border-[#121212]/30 border-t-[#121212] rounded-full animate-spin" />
                   Awaiting Payment...
                </>
              ) : isPlacingOrder ? (
                <>
                   <div className="w-3 h-3 border-2 border-[#121212]/30 border-t-[#121212] rounded-full animate-spin" />
                   Processing...
                </>
              ) : 'Confirm & Pay →'}
            </button>
            
            <div className="mt-8 text-center px-4">
               <p className="text-[8px] text-white/40 leading-relaxed uppercase tracking-widest">
                 A payment prompt will be sent to your mobile phone.
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
