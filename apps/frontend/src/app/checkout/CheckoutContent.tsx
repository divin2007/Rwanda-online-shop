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
        const calculatedFee = 1500; // Refined fallback
        setDeliveryFee(calculatedFee);
        setIsCalculatingFee(false);
      }).finally(() => setIsCalculatingFee(false));
    }
  }, [coords, marketCoords]);
  
  const subtotal = cartTotal;
  const gatewayFee = Math.ceil((subtotal + deliveryFee) * 0.02);
  const total = subtotal + Math.max(0, deliveryFee) + gatewayFee;

  useEffect(() => {
    const successStatuses = ['confirmed', 'paid', 'PAID', 'picked_up', 'in_transit', 'delivered'];
    if (statusUpdate && successStatuses.includes(statusUpdate.status?.toLowerCase() || statusUpdate.status)) {
      toast.success(t('checkout_moving_forward'));
      if (items.length > 1) {
        router.push('/orders');
      } else {
        router.push(`/orders/${orderId}/tracking`);
      }
    }
  }, [statusUpdate, orderId, router, items.length, t]);

  const handleCheckout = async () => {
    if (items.length === 0) return toast.error(t('checkout_cart_empty'));
    if (!coords) return toast.error(t('checkout_drop_pin'));
    if (!phone) return toast.error(t('checkout_enter_phone'));
    if (total > 50000 && !nid) return toast.error(t('checkout_nid_required'));

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
            fullName: user?.fullName || 'Anonymous Buyer',
            phone: phone,
            nationalId: nid || undefined,
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
        toast.success(t('checkout_check_phone'));
      }

      if (failed.length > 0) {
        toast.error(`${t('checkout_failed_for')}: ${failed.map(f => f.sellerName).join(', ')}`);
        if (succeeded.length === 0) setIsPlacingOrder(false);
      }
    } catch (error: any) {
      toast.error(t('checkout_failed_general'));
      setIsPlacingOrder(false);
    }
  };

  const days = [
    { value: 'Monday', label: t('monday') }, { value: 'Tuesday', label: t('tuesday') },
    { value: 'Wednesday', label: t('wednesday') }, { value: 'Thursday', label: t('thursday') },
    { value: 'Friday', label: t('friday') }, { value: 'Saturday', label: t('saturday') },
    { value: 'Sunday', label: t('sunday') },
  ];

  return (
    <div className="space-y-32 pb-40 animate-reveal">
      {/* Checkout Header */}
      <div className="border-b-2 border-[#121212] pb-16">
        <div className="flex items-center gap-6 mb-8">
           <div className="w-12 h-px bg-[#A34D15]"></div>
           <p className="text-[11px] font-black text-[#A34D15] uppercase tracking-[0.5em]">{t('official_facilitator')}</p>
        </div>
        <h1 className="text-[100px] font-serif text-[#121212] leading-[0.85] tracking-tighter italic">{t('checkout_title')}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-32 items-start">
        <div className="lg:col-span-8 space-y-32">
          {/* Logistic Deployment Section */}
          <section className="space-y-12">
            <div className="flex items-center justify-between border-b border-[#121212]/10 pb-6">
              <h2 className="text-4xl font-serif text-[#121212] italic tracking-tighter">{t('checkout_delivery_location')}</h2>
              <div className="flex items-center gap-4">
                 <div className={`w-2 h-2 rounded-full ${coords ? 'bg-green-500 animate-pulse' : 'bg-[#E5E1D8]'}`}></div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-[#121212]">Deployment Ready</span>
              </div>
            </div>
            
            <div className="h-[550px] border-4 border-[#121212] relative overflow-hidden shadow-2xl grayscale hover:grayscale-0 transition-all duration-1000 group">
               <MapPinPicker onLocationSelected={setCoords} marketLocation={marketCoords} />
               <div className="absolute top-8 left-8 z-10">
                  <div className="bg-[#121212] text-white text-[9px] font-black uppercase tracking-[0.5em] py-4 px-8 border-l-4 border-[#A34D15]">
                     Logistics Deployment Matrix
                  </div>
               </div>
               {/* Context Overlay */}
               <div className="absolute bottom-8 right-8 z-10 bg-white/90 backdrop-blur-md p-6 border-2 border-[#121212] max-w-xs shadow-xl transition-all group-hover:bg-white">
                  <p className="text-[10px] font-black text-[#121212] uppercase tracking-[0.2em] mb-2">Protocol</p>
                  <p className="text-[9px] text-[#6B665E] italic leading-relaxed">
                    Precisely drop the mandate pin within the regional hub's authorized perimeter.
                  </p>
               </div>
            </div>
            
            {coords && (
              <div className="p-10 bg-white border-2 border-[#121212] border-l-8 border-l-[#A34D15] flex items-center justify-between animate-reveal shadow-xl">
                 <div className="space-y-2">
                    <p className="text-[12px] font-black text-[#121212] uppercase tracking-[0.3em]">✓ Destination Synchronized</p>
                    <p className="text-[9px] font-bold text-[#6B665E] uppercase tracking-widest">Authorized coordinates locked into RMF fleet network</p>
                 </div>
                 <p className="text-xl font-serif italic text-[#A34D15] tracking-tighter">{coords.lat.toFixed(6)} N, {coords.lng.toFixed(6)} E</p>
              </div>
            )}
          </section>

          {/* Authorization & Payment Section */}
          <section className="space-y-16">
            <h2 className="text-4xl font-serif text-[#121212] italic tracking-tighter border-b border-[#121212]/10 pb-6">{t('checkout_payment_method')}</h2>
            
            <div className="grid grid-cols-2 gap-12">
              {[
                { id: 'MTN_MOMO', label: 'MTN MoMo', color: 'bg-[#FFCC00]', desc: 'Direct Network Protocol' },
                { id: 'AIRTEL_MONEY', label: 'Airtel Money', color: 'bg-[#ED1C24]', desc: 'Cross-Network Authorization' }
              ].map(method => (
                <button 
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as any)}
                  className={`p-12 border-4 transition-all flex flex-col items-center gap-8 group relative overflow-hidden ${
                    paymentMethod === method.id 
                      ? 'border-[#121212] bg-white scale-[1.02] shadow-2xl' 
                      : 'border-[#F0EDE4] bg-transparent hover:border-[#121212]'
                  }`}
                >
                  {paymentMethod === method.id && (
                    <div className="absolute top-0 right-0 p-4">
                      <div className="w-2 h-2 bg-[#A34D15] rounded-full animate-ping"></div>
                    </div>
                  )}
                  <div className={`w-20 h-20 ${method.color} border-4 border-[#121212] shadow-lg flex items-center justify-center text-3xl`}>
                    {method.id === 'MTN_MOMO' ? '▣' : '◈'}
                  </div>
                  <div className="text-center">
                    <span className="text-[12px] font-black uppercase tracking-[0.4em] text-[#121212] block mb-2">{method.label}</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-[#6B665E] opacity-50">{method.desc}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-16 bg-white border-2 border-[#121212] p-16 shadow-2xl">
              <div className="rmf-form-group">
                <label className="rmf-label">
                  {t('checkout_momo_number')}
                  <span className="opacity-20 italic">AUTHORIZED HANDSET</span>
                </label>
                <input 
                  type="tel" 
                  placeholder="078 / 079 / 072 / 073" 
                  className="rmf-input text-2xl font-serif italic border-x-0 border-t-0 border-b-2 px-0 focus:ring-0"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              {total > 50000 && (
                <div className="space-y-10 pt-12 border-t-2 border-[#121212] border-dashed animate-reveal">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-[#A34D15] text-white flex items-center justify-center text-xl shadow-xl">🛡️</div>
                    <div>
                       <label className="text-[12px] font-black text-[#A34D15] uppercase tracking-[0.4em] italic block">{t('checkout_kyc_title')}</label>
                       <p className="text-[8px] text-[#6B665E] font-bold uppercase tracking-widest mt-1">Institutional requirement for high-valuation acquisitions</p>
                    </div>
                  </div>
                  <input 
                    type="text" 
                    placeholder="NATIONAL ID: 1 19XX 8 XXXX XXX X XX" 
                    maxLength={16}
                    className="rmf-input tracking-[0.5em] text-center bg-[#F8F6F1] border-none font-black text-xl"
                    value={nid}
                    onChange={(e) => setNid(e.target.value.replace(/\s/g, ''))}
                  />
                  <p className="text-[9px] text-[#6B665E] font-light italic leading-relaxed text-center px-12">{t('checkout_kyc_desc')}</p>
                </div>
              )}

              <div className="rmf-form-group pt-12 border-t border-[#F0EDE4]">
                <label className="rmf-label">
                  {t('checkout_notes')}
                  <span className="opacity-20 italic">SPECIAL INSTRUCTIONS</span>
                </label>
                <textarea 
                  placeholder={t('checkout_notes_placeholder')} 
                  className="rmf-input min-h-[150px] italic border-dashed py-8"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Facilitation Schedule */}
          <section className="space-y-16">
            <div className="flex items-center justify-between border-b-2 border-[#121212] pb-10">
               <h2 className="text-4xl font-serif text-[#121212] italic tracking-tighter">{t('checkout_schedule_title')}</h2>
               <label className="relative inline-flex items-center cursor-pointer group">
                  <input type="checkbox" className="sr-only peer" checked={isScheduled} onChange={() => setIsScheduled(!isScheduled)} />
                  <div className="w-20 h-10 bg-[#F0EDE4] border-2 border-[#121212] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-[#121212] after:border-[#121212] after:border after:rounded-full after:h-8 after:w-8 after:transition-all peer-checked:bg-[#A34D15]"></div>
               </label>
            </div>
            
            {isScheduled ? (
              <div className="p-16 bg-white border-2 border-[#121212] border-r-8 border-r-[#A34D15] grid grid-cols-1 md:grid-cols-2 gap-16 animate-reveal shadow-2xl">
                <div className="rmf-form-group">
                  <label className="rmf-label">{t('checkout_frequency')}</label>
                  <select 
                    className="rmf-select w-full"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                  >
                    <option value="WEEKLY">{t('checkout_every_week')}</option>
                    <option value="MONTHLY">{t('checkout_every_month')}</option>
                  </select>
                </div>
                <div className="rmf-form-group">
                  <label className="rmf-label">{t('checkout_delivery_day')}</label>
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
                <div className="md:col-span-2 pt-12 border-t border-[#121212]/10 flex gap-6 items-start">
                   <div className="w-8 h-8 bg-[#A34D15]/10 flex items-center justify-center text-[#A34D15]">ℹ</div>
                   <p className="text-[10px] text-[#6B665E] font-bold uppercase tracking-widest leading-relaxed">
                     {t('checkout_schedule_desc')}
                   </p>
                </div>
              </div>
            ) : (
              <div className="p-16 border-2 border-dashed border-[#F0EDE4] text-center">
                 <p className="text-2xl text-[#6B665E] italic font-light leading-relaxed">{t('checkout_onetime_selected')}</p>
                 <p className="text-[8px] font-black uppercase tracking-[0.4em] mt-4 opacity-20">SINGLE-USE AUTHORIZATION</p>
              </div>
            )}
          </section>
        </div>

        {/* Tactical Summary Block */}
        <div className="lg:col-span-4">
          <div className="bg-[#121212] text-white p-16 sticky top-32 shadow-[50px_50px_100px_-50px_rgba(0,0,0,0.5)] border-t-8 border-[#A34D15]">
            <div className="flex items-center gap-6 mb-16">
               <div className="w-16 h-px bg-[#A34D15]"></div>
               <p className="text-[12px] font-black text-[#A34D15] uppercase tracking-[0.5em] italic">{t('checkout_summary')}</p>
            </div>
            
            <div className="space-y-12 mb-20 pb-16 border-b-2 border-white/10">
              <div className="flex justify-between items-end group">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 group-hover:opacity-100 transition-opacity">{t('cart_subtotal')}</span>
                <span className="text-3xl font-serif italic tracking-tighter">{subtotal.toLocaleString()} RWF</span>
              </div>
              <div className="flex justify-between items-end group">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 group-hover:opacity-100 transition-opacity">{t('checkout_fee')}</span>
                {isCalculatingFee ? (
                  <div className="w-6 h-6 border-2 border-[#A34D15] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span className="text-2xl font-serif italic tracking-tighter text-[#A34D15]">
                    {coords ? `${deliveryFee.toLocaleString()} RWF` : 'Awaiting Pin'}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-end group">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 group-hover:opacity-100 transition-opacity">{t('checkout_gateway_fee')}</span>
                <span className="text-xl font-serif italic tracking-tighter opacity-40">{gatewayFee.toLocaleString()} RWF</span>
              </div>
            </div>

            <div className="flex flex-col mb-24 space-y-6">
              <div className="flex justify-between items-baseline">
                 <span className="text-[12px] font-black uppercase tracking-[0.6em] opacity-50 italic">Total Mandate</span>
                 <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#A34D15]">Authorized RWF</p>
              </div>
              <div className="flex justify-end">
                <span className="text-8xl font-serif italic tracking-tighter font-black text-white leading-none">
                  {(total || 0).toLocaleString()}
                </span>
              </div>
            </div>

            <button 
              disabled={!coords || !phone || items.length === 0 || isPlacingOrder || isCalculatingFee || isWaitingPayment}
              onClick={handleCheckout}
              className="rmf-btn-primary w-full py-10 text-[12px] bg-white text-[#121212] hover:bg-[#A34D15] hover:text-white border-none disabled:opacity-20 disabled:grayscale transition-all shadow-[0_30px_60px_-15px_rgba(163,77,21,0.5)] group"
            >
              <span className="relative z-10 font-black tracking-[0.5em]">
                 {isWaitingPayment ? 'Facilitation Pending...' : isPlacingOrder ? 'Processing...' : 'Authorize Mandate'}
              </span>
              <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all">→</div>
            </button>
            
            <div className="mt-16 p-10 border-2 border-[#A34D15]/20 bg-[#A34D15]/5 space-y-6">
               <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-[#A34D15] rounded-full animate-pulse"></div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#A34D15]">Authorization Notice</p>
               </div>
               <p className="text-[10px] text-white/60 text-center italic font-light leading-relaxed px-4">
                 {t('checkout_ussd_info')}
               </p>
            </div>
            
            {/* Visual Decoration */}
            <div className="absolute -bottom-24 -right-12 text-[280px] font-serif opacity-[0.03] italic select-none pointer-events-none">RMF</div>
          </div>
        </div>
      </div>
    </div>
  );
};
