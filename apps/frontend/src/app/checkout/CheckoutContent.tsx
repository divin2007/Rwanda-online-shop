'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities */
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
const MapPinPicker = dynamic(() => import('@/components/ui/MapPinPicker').then(mod => mod.MapPinPicker), { ssr: false });
import { useCart } from '@/components/cart/CartContext';
import { useAuth } from '@/context/AuthContext';
import { orderApi, marketApi, deliveryApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import toast from 'react-hot-toast';

const normalizeRwandaPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('2507') && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.startsWith('7') && digits.length === 9) return `0${digits}`;
  return digits;
};

export const CheckoutContent = () => {
  const { cartTotal, items, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'MTN_MOMO' | 'AIRTEL_MONEY' | 'TIGO_CASH'>('MTN_MOMO');
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
  const [waitElapsed, setWaitElapsed] = useState(0);
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

  // Count up elapsed seconds while waiting for the mobile money prompt to be approved.
  // Purely presentational — payment success is decided only by the backend/socket event above.
  useEffect(() => {
    if (!isWaitingPayment) {
      setWaitElapsed(0);
      return;
    }
    const interval = setInterval(() => setWaitElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isWaitingPayment]);

  // Derived checkout progress for the step indicator: Cart → Delivery → Payment → Confirm.
  // Step 1 (Cart) is complete once there are items; 2 (Delivery) once a pin is set;
  // 3 (Payment) once a valid-looking phone is entered; 4 (Confirm) while awaiting approval.
  const paymentReady = /^07\d{8}$/.test(normalizeRwandaPhone(phone));
  const currentStep = isWaitingPayment ? 4 : paymentReady ? 3 : coords ? 2 : 1;
  const steps = [
    { id: 1, label: 'Cart' },
    { id: 2, label: 'Delivery' },
    { id: 3, label: 'Payment' },
    { id: 4, label: 'Confirm' },
  ];

  const handleCheckout = async () => {
    if (items.length === 0) return toast.error('Your cart is empty.');
    if (!user) return toast.error('Please log in as a buyer before checkout.');
    if (user.role !== 'BUYER') return toast.error('Checkout is only available from buyer accounts. Please switch accounts before placing an order.');
    if (!coords) return toast.error('Please drop a pin for your delivery location.');
    const paymentPhone = normalizeRwandaPhone(phone);
    if (!/^07\d{8}$/.test(paymentPhone)) return toast.error('Enter a valid Rwanda mobile money number, for example 078xxxxxxx.');
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
        const totalAmount = subtotal + sellerDeliveryFee;
        
        const firstItem = sellerItems[0];

        return orderApi.post('/orders', {
          buyer: {
            userId: user?.id,
            fullName: user?.fullName || 'Guest Buyer',
            phone: paymentPhone,
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
            quantity: i.quantity,
            unit: i.unit,
            category: i.category,
            categoryId: i.categoryId,
            imageUrl: i.image,
            images: i.image ? [i.image] : [],
            attributes: i.attributes,
            variantId: i.variantId,
            variantTitle: i.variantTitle,
            sellerSku: i.sellerSku,
            customization: i.customization,
            priceSnapshotAt: new Date(),
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
        }).then(res => {
          const order = res.data?.data || res.data;
          if (order?.payment?.status === 'failed') {
            return {
              success: false,
              sellerName: firstItem.sellerName,
              error: order.payment?.errorMessage || 'Payment prompt could not be sent. Confirm the MoMo number and retry.',
            };
          }
          return { success: true, sellerName: firstItem.sellerName, data: res.data };
        })
          .catch(err => {
            const msg = err.response?.data?.message || err.response?.data?.error || err.message;
            return { 
              success: false, 
              sellerName: firstItem.sellerName, 
              error: Array.isArray(msg) ? msg.join(', ') : msg 
            };
          });
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
        const errorDetails = failed.map(f => `${f.sellerName}: ${(f as any).error}`).join(' | ');
        toast.error(`Order failed: ${errorDetails}`);
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
    <div className="rmf-container space-y-16 pb-40 px-4 md:px-8 pt-10 animate-reveal">
      {/* ── Header ── */}
      <div className="border-b border-border-light pb-10">
        <div className="flex items-center gap-4 mb-4">
           <div className="w-10 h-1 bg-accent-premium rounded-full" />
           <p className="text-[11px] font-bold text-primary uppercase tracking-widest">Secure Checkout</p>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-text-primary tracking-tight">Checkout</h1>
      </div>

      {/* ── Step Indicator: Cart → Delivery → Payment → Confirm (mobile-visible) ── */}
      <nav aria-label="Checkout progress" className="-mt-8">
        <ol className="flex items-center justify-between gap-1 sm:gap-3">
          {steps.map((step, idx) => {
            const isDone = step.id < currentStep;
            const isCurrent = step.id === currentStep;
            return (
              <React.Fragment key={step.id}>
                <li className="flex items-center gap-2 min-w-0" aria-current={isCurrent ? 'step' : undefined}>
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isCurrent
                        ? 'bg-primary text-white'
                        : isDone
                          ? 'bg-primary/10 text-primary'
                          : 'bg-background-surface text-text-muted'
                    }`}
                  >
                    {isDone ? '✓' : step.id}
                  </span>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-widest truncate ${
                      isCurrent ? 'text-text-primary' : 'text-text-muted'
                    } ${isCurrent ? '' : 'hidden sm:inline'}`}
                  >
                    {step.label}
                  </span>
                </li>
                {idx < steps.length - 1 && (
                  <li aria-hidden className={`h-px flex-1 ${step.id < currentStep ? 'bg-primary/40' : 'bg-border-light'}`} />
                )}
              </React.Fragment>
            );
          })}
        </ol>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 xl:gap-24 items-start">
        <div className="lg:col-span-8 space-y-20">

          {/* ── Mobile fee/total summary: keeps delivery fee visible BEFORE the payment step on small screens ── */}
          <div className="lg:hidden bg-white border border-border-light rounded-2xl p-5 shadow-sm space-y-3 !mt-0">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Subtotal</span>
              <span className="text-sm font-bold text-text-primary">{subtotal.toLocaleString()} RWF</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Delivery Fee</span>
              {isCalculatingFee ? (
                <span className="flex items-center gap-2 text-xs font-bold text-text-muted">
                  <span className="w-3.5 h-3.5 border-2 border-border-light border-t-primary rounded-full animate-spin" />
                  Calculating
                </span>
              ) : coords ? (
                <span className="text-sm font-bold text-text-primary">{deliveryFee.toLocaleString()} RWF</span>
              ) : (
                <span className="text-[11px] font-bold text-primary">Set location to see fee</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Service Fee</span>
              <span className="text-sm font-bold text-text-primary">{gatewayFee.toLocaleString()} RWF</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-border-light">
              <span className="text-xs font-bold uppercase tracking-widest text-text-primary">Total</span>
              <span className="text-lg font-bold text-text-primary">{(total || 0).toLocaleString()} RWF</span>
            </div>
          </div>

          {/* ── Delivery Location ── */}
          <section className="space-y-8">
            <div className="flex items-center justify-between border-b border-border-light pb-6">
              <h2 className="text-2xl font-bold text-text-primary tracking-tight">1. Delivery Location</h2>
              <div className="flex items-center gap-2">
                 <div className={`w-2.5 h-2.5 rounded-full ${coords ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse' : 'bg-border-light'}`} />
                 <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{coords ? 'Location Pinned' : 'Drop Pin on Map'}</span>
              </div>
            </div>
            
            <div className="h-[450px] border border-border-light rounded-2xl relative overflow-hidden group shadow-sm">
               <MapPinPicker onLocationSelected={setCoords} marketLocation={marketCoords} />
               
               {!coords && (
                 <div className="absolute top-6 left-6 z-10 pointer-events-none">
                    <div className="bg-primary/90 backdrop-blur-md rounded-xl text-white text-[10px] font-bold uppercase tracking-widest py-3 px-6 shadow-md border border-white/20">
                        Drop Pin To Set Location
                    </div>
                 </div>
               )}
            </div>
            
            {coords && (
              <div className="p-6 bg-background-surface border border-border-light rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-reveal shadow-sm">
                 <div className="space-y-1.5">
                     <p className="text-[11px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                       <span className="text-green-500 text-lg leading-none">✓</span> Location Set
                     </p>
                     <p className="text-xs text-text-muted font-medium">Delivery fee calculated based on distance.</p>
                 </div>
                 <p className="text-sm font-bold text-text-primary bg-white px-5 py-2.5 rounded-xl border border-border-light shadow-sm">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
              </div>
            )}
          </section>

          {/* ── Payment Method ── */}
          <section className="space-y-8">
            <h2 className="text-2xl font-bold text-text-primary tracking-tight border-b border-border-light pb-6">2. Payment & Details</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { id: 'MTN_MOMO', label: 'MTN MoMo', color: 'bg-[#FFCC00] text-black border-[#FFCC00]', desc: 'Pay via MTN Mobile Money' },
                { id: 'AIRTEL_MONEY', label: 'Airtel Money', color: 'bg-[#ED1C24] text-white border-[#ED1C24]', desc: 'Pay via Airtel Money' },
                { id: 'TIGO_CASH', label: 'Tigo Cash', color: 'bg-[#0066B3] text-white border-[#0066B3]', desc: 'Pay via Tigo Cash' }
              ].map(method => (
                <button 
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as any)}
                  className={`p-6 border rounded-2xl transition-all flex flex-col items-center gap-4 relative group ${
                    paymentMethod === method.id 
                      ? 'border-primary bg-primary/5 shadow-md' 
                      : 'border-border-light bg-white hover:border-primary/50'
                  }`}
                >
                  {paymentMethod === method.id && (
                    <div className="absolute top-4 right-4">
                      <div className="w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_8px_rgba(1,45,29,0.5)]" />
                    </div>
                  )}
                  <div className={`w-14 h-14 ${method.color} border rounded-full flex items-center justify-center text-xl font-black shadow-sm`}>
                    {method.id === 'MTN_MOMO' ? 'M' : method.id === 'AIRTEL_MONEY' ? 'A' : 'T'}
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-bold uppercase tracking-widest text-text-primary block mb-1">{method.label}</span>
                    <span className="text-[10px] font-bold text-text-muted">{method.desc}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-8 bg-white border border-border-light rounded-2xl p-6 md:p-10 shadow-sm">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block">
                  Mobile Money Number <span className="text-red-500">*</span>
                </label>
                <input 
                  type="tel" 
                  placeholder="07XXXXXXXX" 
                  className="rmf-input w-full"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              {total > 50000 && (
                <div className="space-y-6 pt-8 border-t border-border-light animate-reveal">
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-accent-premium uppercase tracking-widest block">National ID Required</label>
                     <p className="text-xs text-text-muted font-medium leading-relaxed">By law, orders over 50,000 RWF require a valid Rwandan National ID for verification.</p>
                  </div>
                  <input 
                    type="text" 
                    placeholder="1 19XX 8 XXXX XXX X XX" 
                    maxLength={16}
                    className="rmf-input w-full text-center tracking-[0.2em] font-bold text-lg"
                    value={nid}
                    onChange={(e) => setNid(e.target.value.replace(/\s/g, ''))}
                  />
                </div>
              )}

              <div className="space-y-2 pt-8 border-t border-border-light">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block">
                  Delivery Notes <span className="opacity-60 font-medium">(Optional)</span>
                </label>
                <textarea 
                  placeholder="Any special instructions for the rider?" 
                  className="rmf-input w-full min-h-[120px] resize-y"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* ── Delivery Schedule ── */}
          <section className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-light pb-6">
               <h2 className="text-2xl font-bold text-text-primary tracking-tight">3. Schedule Delivery</h2>
               
               <label className="relative inline-flex items-center cursor-pointer">
                  <span className="text-[10px] font-bold uppercase tracking-widest mr-4 text-text-muted">Recurring Order</span>
                  <input type="checkbox" className="sr-only peer" checked={isScheduled} onChange={() => setIsScheduled(!isScheduled)} />
                  <div className="w-11 h-6 bg-border-light rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
               </label>
            </div>
            
            {isScheduled ? (
              <div className="p-8 bg-background-surface border border-border-light rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-8 animate-reveal shadow-sm">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block">Frequency</label>
                  <select 
                    className="rmf-select w-full"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                  >
                    <option value="WEEKLY">Every Week</option>
                    <option value="MONTHLY">Every Month</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block">Delivery Day</label>
                  <select 
                    className="rmf-select w-full"
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
              <div className="p-8 border border-dashed border-border-light rounded-2xl text-center bg-white shadow-sm">
                 <p className="text-sm font-bold text-text-primary">This is a one-time order.</p>
                 <p className="text-[10px] mt-2 text-text-muted uppercase tracking-widest">Toggle 'Recurring Order' to schedule regular deliveries.</p>
              </div>
            )}
          </section>
        </div>

        {/* ── Order Summary ── */}
        <div className="lg:col-span-4">
          <div className="bg-primary-cinematic text-white p-8 lg:p-10 sticky top-32 rounded-2xl shadow-xl cinematic-shadow border border-white/5">
            <div className="flex items-center gap-3 mb-8">
               <div className="w-8 h-1 bg-accent-premium rounded-full" />
               <p className="text-[11px] font-bold text-accent-premium uppercase tracking-widest">Order Summary</p>
            </div>
            
            <div className="space-y-5 mb-8 pb-8 border-b border-white/10">
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold uppercase tracking-widest text-white/60">Subtotal</span>
                <span className="text-lg font-bold tracking-tight">{subtotal.toLocaleString()} RWF</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold uppercase tracking-widest text-white/60">Delivery Fee</span>
                {isCalculatingFee ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className={`font-bold tracking-tight text-white ${coords ? 'text-lg' : 'text-[11px] uppercase tracking-widest text-accent-premium'}`}>
                    {coords ? `${deliveryFee.toLocaleString()} RWF` : 'Set location to see fee'}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold uppercase tracking-widest text-white/60">Service Fee</span>
                <span className="text-sm font-bold tracking-tight text-white/80">{gatewayFee.toLocaleString()} RWF</span>
              </div>
            </div>

            <div className="flex flex-col mb-10 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Total</span>
              <div className="text-right flex items-end justify-end">
                <span className="text-5xl font-bold tracking-tight text-white leading-none drop-shadow-md">
                  {(total || 0).toLocaleString()}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-accent-premium ml-2 mb-1">RWF</span>
              </div>
            </div>

            <button 
              disabled={!coords || !phone || items.length === 0 || isPlacingOrder || isCalculatingFee || isWaitingPayment}
              onClick={handleCheckout}
              className="flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-xl bg-accent-premium px-6 text-xs font-bold uppercase tracking-widest text-primary shadow-md shadow-accent-premium/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-accent-premium/30 disabled:opacity-50 disabled:hover:translate-y-0 disabled:grayscale"
            >
              {isWaitingPayment ? (
                <>
                   <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                   Awaiting Payment...
                </>
              ) : isPlacingOrder ? (
                <>
                   <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                   Processing...
                </>
              ) : 'Confirm & Pay →'}
            </button>
            
            <div className="mt-8 text-center px-4">
               <p className="text-[10px] text-white/60 leading-relaxed uppercase tracking-widest">
                 A payment prompt will be sent to your mobile phone.
               </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile Money Processing Wait-State (presentational only; success comes from socket status) ── */}
      {isWaitingPayment && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-text-primary/70 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-label="Processing your payment"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-border-light p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full border-4 border-border-light border-t-primary animate-spin" aria-hidden />
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-text-primary tracking-tight">Check your phone</h2>
              <p className="text-sm text-text-muted leading-relaxed">
                We sent a payment prompt to <span className="font-bold text-text-primary">{normalizeRwandaPhone(phone)}</span>.
                Enter your mobile money PIN on your phone to approve and confirm your order.
              </p>
            </div>

            <div className="bg-background-surface rounded-xl py-4 px-5 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Usually takes 15–30 seconds</p>
              <p className="text-2xl font-bold text-text-primary tabular-nums">
                {Math.floor(waitElapsed / 60)}:{(waitElapsed % 60).toString().padStart(2, '0')}
              </p>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              {waitElapsed < 45
                ? 'Keep this page open — your order confirms automatically once you approve the prompt.'
                : "Haven't received a prompt? Make sure your number is correct and has enough balance. Do not close this page; if it doesn't arrive, dial your mobile money menu or contact support."}
            </p>

            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Do not refresh or close this page</p>
          </div>
        </div>
      )}
    </div>
  );
};
