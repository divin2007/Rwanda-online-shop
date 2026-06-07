'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities */
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
  const [paymentMethod] = useState<'MTN_MOMO'>('MTN_MOMO');
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
  const hasPerishableItems = items.some((it: any) => it?.perishable === true || it?.product?.perishable === true);

  // Affiliate attribution (Feature 3): read the rmf_ref cookie persisted after a referral click.
  const getReferralCode = (): string | null => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|;\s*)rmf_ref=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  };

  useEffect(() => {
    const successStatuses = ['confirmed', 'paid', 'PAID', 'picked_up', 'in_transit', 'delivered'];
    if (statusUpdate && successStatuses.includes(statusUpdate.status?.toLowerCase() || statusUpdate.status)) {
      toast.success('Payment confirmed! Your order is placed.');
      clearCart();
      if (items.length > 1) {
        router.push('/orders');
      } else {
        router.push(`/orders/${orderId}/tracking`);
      }
    }
  }, [statusUpdate, orderId, router, items.length, clearCart]);

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
          products: sellerItems.map(i => i.isMenuItem ? ({
            // Menu items are keyed by menuItemId (NOT productId) so the order-service
            // snapshots and re-prices them from the Menu collection server-side.
            menuItemId: i.menuItemId || i.id,
            isMenuItem: true,
            name: i.name,
            unitPrice: i.price,
            quantity: i.quantity,
            imageUrl: i.image,
            images: i.image ? [i.image] : [],
            preparationMinutes: i.preparationMinutes,
            selectedModifiers: i.selectedModifiers,
            priceSnapshotAt: new Date(),
          }) : ({
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
          notes: notes,
          // Affiliate attribution (Feature 3): read the rmf_ref cookie set after a referral click.
          affiliateCode: getReferralCode() || undefined,
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
    <>
      <header className="sticky top-0 z-40 h-16 border-b border-outline-variant bg-surface-container-lowest px-gutter">
        <div className="mx-auto flex h-full w-full max-w-container-max items-center justify-between">
          <Link href="/cart" className="inline-flex items-center gap-xs font-label-caps text-label-caps text-on-surface hover:text-primary">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Back to Cart
          </Link>
          <h1 className="font-headline-md text-headline-md font-bold text-on-surface">Secure Checkout</h1>
          <div className="inline-flex items-center gap-sm font-label-caps text-label-caps text-secondary">
            <span className="material-symbols-outlined text-[20px]">lock</span>
            <span className="hidden md:inline">Encrypted</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-container-max flex-col gap-lg px-gutter py-lg md:py-xl lg:flex-row">
      <div className="flex flex-grow flex-col gap-lg lg:w-2/3">
      {/* ── Header ── */}
      <section className="overflow-x-auto rounded border border-outline-variant bg-surface-container-lowest p-md custom-shadow">
        <div className="flex min-w-[500px] items-center justify-between">
        {[
          ['1', 'Delivery'],
          ['2', 'Payment'],
          ['3', 'Schedule'],
          ['4', 'Summary'],
        ].map(([number, label]) => (
          <div key={label} className="flex flex-1 items-center gap-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest font-label-caps text-label-caps text-on-surface">
              {number}
            </span>
            <span className="font-label-caps text-label-caps text-on-surface">{label}</span>
            {label !== 'Summary' && <span className="mx-sm h-px flex-grow bg-outline-variant" />}
          </div>
        ))}
        </div>
      </section>
      <div className="hidden border-b border-outline-variant pb-md">
        <div className="flex items-center gap-xs mb-xs">
          <span className="w-1.5 h-4 bg-primary-container rounded-full" />
          <p className="font-label-caps text-label-caps text-primary">Secure Checkout</p>
        </div>
        <h1 className="font-display-lg text-headline-lg text-on-surface">Checkout</h1>
      </div>

      {hasPerishableItems && (
        <div
          className="flex items-start gap-2 rounded border px-md py-sm text-[12px]"
          style={{ borderColor: '#FFD8B0', backgroundColor: '#FFF3E6', color: '#7A3E00' }}
        >
          <span className="material-symbols-outlined text-[18px]">ac_unit</span>
          <span>This order contains perishable items — prioritized delivery will be assigned to keep them fresh.</span>
        </div>
      )}

        <div className="space-y-lg">
          
          {/* ── Delivery Location ── */}
          <section className="space-y-md rounded border border-outline-variant bg-surface-container-lowest p-lg custom-shadow">
            <div className="flex items-center justify-between border-b border-outline-variant pb-sm">
              <h2 className="font-headline-md text-headline-md text-on-surface">1. Delivery Location</h2>
              <div className="flex items-center gap-xs">
                <div className={`w-2 h-2 rounded-full ${coords ? 'bg-[#ff6b00] shadow-[0_0_8px_rgba(255,107,0,0.4)] animate-pulse' : 'bg-outline-variant'}`} />
                <span className="font-label-caps text-[10px] text-on-surface-variant">{coords ? 'Location Pinned' : 'Drop Pin on Map'}</span>
              </div>
            </div>

            <div className="grid gap-md md:grid-cols-2">
              <div className="flex flex-col gap-sm">
                <label className="font-label-caps text-label-caps text-on-surface">Pin Drop Location (Kigali)</label>
                <div className="h-64 border border-outline-variant rounded relative overflow-hidden group shadow-sm">
                  <MapPinPicker onLocationSelected={setCoords} marketLocation={marketCoords} />
                  {!coords && (
                    <div className="absolute top-sm left-sm z-10 pointer-events-none">
                      <div className="bg-primary-container backdrop-blur-md rounded border border-outline-variant text-white font-label-caps text-[9px] py-2 px-4 shadow-md">
                        Drop Pin To Set Location
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-sm text-on-surface-variant font-medium flex items-center gap-xs">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  Drag map to refine delivery coordinates.
                </p>
              </div>

              <div className="flex flex-col gap-md">
                <div>
                  <label className="font-label-caps text-label-caps text-on-surface">Street Address / Building</label>
                  <input
                    readOnly
                    value={coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : ''}
                    placeholder="Drop a pin to populate coordinates"
                    className="premium-input w-full font-data-mono text-xs"
                  />
                </div>
                <div>
                  <label className="font-label-caps text-label-caps text-on-surface">Additional Details (Optional)</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Floor, unit, or specific instructions"
                    className="premium-input w-full text-xs font-semibold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-md">
                  <div>
                    <label className="font-label-caps text-label-caps text-on-surface">Receiver Name</label>
                    <input readOnly value={user?.fullName || ''} placeholder="Full Name" className="premium-input w-full text-xs font-semibold" />
                  </div>
                  <div>
                    <label className="font-label-caps text-label-caps text-on-surface">Receiver Phone</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+250" className="premium-input w-full font-data-mono text-xs" />
                  </div>
                </div>
              </div>
            </div>

            {coords && (
              <div className="p-md bg-surface-container-low border border-outline-variant rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md animate-reveal shadow-sm">
                <div className="space-y-xs">
                  <p className="font-label-caps text-label-caps text-primary flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[#ff6b00] text-sm leading-none">check</span> Location Set
                  </p>
                  <p className="text-xs text-on-surface-variant font-medium">Delivery fee calculated based on distance.</p>
                </div>
                <p className="font-data-mono text-data-mono text-on-surface bg-surface-container-lowest px-4 py-2 rounded border border-outline-variant shadow-sm">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </p>
              </div>
            )}
          </section>

          {/* ── Payment Method & Details ── */}
          <section className="space-y-md rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow">
            <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-md">2. Payment & Details</h2>
            
            <div className="grid grid-cols-1 gap-md">
              {[
                { id: 'MTN_MOMO', label: 'MTN MoMo', color: 'bg-[#FFCC00] text-black border-[#FFCC00]', desc: 'MTN Mobile Money' },
              ].map(method => (
                <button 
                  key={method.id}
                  type="button"
                  aria-pressed="true"
                  className={`p-md border rounded-lg transition-all flex flex-col items-center gap-sm relative group ${
                    paymentMethod === method.id 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-outline-variant bg-surface-container-lowest hover:border-primary/50'
                  }`}
                >
                  {paymentMethod === method.id && (
                    <div className="absolute top-3 right-3">
                      <div className="w-2 h-2 bg-[#ff6b00] rounded-full shadow-[0_0_6px_rgba(255,107,0,0.5)]" />
                    </div>
                  )}
                  <div className={`w-10 h-10 ${method.color} border rounded-full flex items-center justify-center text-sm font-bold shadow-sm`}>
                    M
                  </div>
                  <div className="text-center">
                    <span className="font-label-caps text-[9px] text-on-surface block mb-0.5">{method.label}</span>
                    <span className="font-data-mono-sm text-[9px] text-on-surface-variant">{method.desc}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-md bg-surface-container-low border border-outline-variant rounded-lg p-md shadow-sm">
              <div className="space-y-xs">
                <label className="font-label-caps text-[10px] text-on-surface-variant block">
                  Mobile Money Number <span className="text-primary">*</span>
                </label>
                <input 
                  type="tel" 
                  placeholder="07XXXXXXXX" 
                  className="premium-input w-full font-data-mono text-xs"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              {total > 50000 && (
                <div className="space-y-sm pt-md border-t border-outline-variant/60 animate-reveal">
                  <div className="space-y-xs">
                    <label className="font-label-caps text-[10px] text-primary block">National ID Required</label>
                    <p className="text-xs text-on-surface-variant font-medium">Orders over 50,000 RWF require a valid National ID under RMF compliance policy.</p>
                  </div>
                  <input 
                    type="text" 
                    placeholder="1 19XX 8 XXXX XXX X XX" 
                    maxLength={16}
                    className="premium-input w-full text-center tracking-[0.2em] font-bold text-sm font-data-mono"
                    value={nid}
                    onChange={(e) => setNid(e.target.value.replace(/\s/g, ''))}
                  />
                </div>
              )}

              <div className="space-y-xs pt-md border-t border-outline-variant/60">
                <label className="font-label-caps text-[10px] text-on-surface-variant block">
                  Delivery Notes <span className="opacity-60 font-medium">(Optional)</span>
                </label>
                <textarea 
                  placeholder="Any special instructions for the rider?" 
                  className="premium-input w-full min-h-[90px] resize-y text-xs font-semibold"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* ── Delivery Schedule ── */}
          <section className="space-y-md rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-sm border-b border-outline-variant pb-md">
              <h2 className="font-headline-md text-headline-md text-on-surface">3. Schedule Delivery</h2>
              
              <label className="relative inline-flex items-center cursor-pointer">
                <span className="font-label-caps text-[10px] mr-3 text-on-surface-variant">Recurring Order</span>
                <input type="checkbox" className="sr-only peer" checked={isScheduled} onChange={() => setIsScheduled(!isScheduled)} />
                <div className="w-9 h-5 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-outline-variant after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
              </label>
            </div>
            
            {isScheduled ? (
              <div className="p-md bg-surface-container-low border border-outline-variant rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-md animate-reveal shadow-sm">
                <div className="space-y-xs">
                  <label className="font-label-caps text-[9px] text-on-surface-variant block">Frequency</label>
                  <select 
                    className="premium-input w-full text-xs font-semibold"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                  >
                    <option value="WEEKLY">Every Week</option>
                    <option value="MONTHLY">Every Month</option>
                  </select>
                </div>
                <div className="space-y-xs">
                  <label className="font-label-caps text-[9px] text-on-surface-variant block">Delivery Day</label>
                  <select 
                    className="premium-input w-full text-xs font-semibold"
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
              <div className="p-md border border-dashed border-outline-variant rounded-lg text-center bg-surface-container-low/30 shadow-sm">
                <p className="text-xs font-bold text-on-surface">This is a one-time order.</p>
                <p className="font-data-mono-sm text-[9px] mt-1 text-on-surface-variant uppercase tracking-wider">Toggle 'Recurring Order' to schedule regular deliveries.</p>
              </div>
            )}
          </section>
        </div>
      </div>

        {/* ── Order Summary Sidebar (Right) ── */}
        <aside className="flex flex-col gap-md lg:w-1/3 lg:sticky lg:top-24 h-fit">
          <div className="bg-surface-container-lowest border border-outline-variant rounded p-md custom-shadow relative overflow-hidden flex flex-col gap-md">
            <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-primary to-primary-container" />
            
            <div className="flex items-center gap-xs">
              <span className="w-1.5 h-3 bg-[#ff6b00] rounded-full" />
              <p className="font-label-caps text-label-caps text-on-surface">Order Summary</p>
            </div>
            
            {(() => {
              const menuItems = items.filter((i: any) => i.isMenuItem);
              if (menuItems.length === 0) return null;
              const maxPrep = Math.max(...menuItems.map((i: any) => i.preparationMinutes || 15));
              return (
                <div className="flex items-center gap-xs rounded bg-primary-fixed/60 px-sm py-xs">
                  <span className="material-symbols-outlined text-[16px] text-primary">restaurant_menu</span>
                  <p className="font-label-caps text-[10px] text-on-primary-fixed-variant">
                    Freshly prepared · ready in ~{maxPrep} min after the kitchen confirms
                  </p>
                </div>
              );
            })()}

            <div className="space-y-sm mb-xs pb-sm border-b border-outline-variant/60">
              <div className="flex justify-between items-end">
                <span className="font-label-caps text-[10px] text-on-surface-variant">Bag Subtotal</span>
                <span className="font-data-mono text-data-mono text-on-surface">{subtotal.toLocaleString()} RWF</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="font-label-caps text-[10px] text-on-surface-variant">Delivery Fee</span>
                {isCalculatingFee ? (
                  <div className="w-3.5 h-3.5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                ) : (
                  <span className="font-data-mono text-data-mono text-on-surface">
                    {coords ? `${deliveryFee.toLocaleString()} RWF` : '--'}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-end">
                <span className="font-label-caps text-[10px] text-on-surface-variant">Service & Escrow</span>
                <span className="font-data-mono text-data-mono text-on-surface">{gatewayFee.toLocaleString()} RWF</span>
              </div>
            </div>

            <div className="flex justify-between items-end py-xs border-b border-outline-variant/60">
              <span className="font-label-caps text-[11px] font-black text-on-surface">Grand Total</span>
              <div className="text-right">
                <span className="font-data-mono text-xl font-bold text-primary-container">
                  {(total || 0).toLocaleString()}
                </span>
                <span className="font-label-caps text-[9px] text-primary-container ml-1">RWF</span>
              </div>
            </div>

            <button 
              type="button"
              disabled={!coords || !phone || items.length === 0 || isPlacingOrder || isCalculatingFee || isWaitingPayment}
              onClick={handleCheckout}
              className="flex min-h-[3.25rem] w-full items-center justify-center gap-xs rounded-lg bg-primary-container text-white px-4 text-xs font-black uppercase tracking-widest hover:bg-primary transition-all duration-300 shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none"
            >
              {isWaitingPayment ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Awaiting MoMo Prompt...
                </>
              ) : isPlacingOrder ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Initiating MoMo...
                </>
              ) : 'Confirm & Pay'}
            </button>
            
            <div className="text-center px-xs mt-xs">
              <p className="font-data-mono-sm text-[8px] text-on-surface-variant leading-normal uppercase tracking-wider">
                A secure payment prompt will be pushed to your MoMo terminal. Complete compliance verified.
              </p>
            </div>
          </div>
          <div className="bg-surface-container border border-outline-variant rounded p-sm flex items-start gap-sm">
            <span className="mt-1 h-3 w-3 rounded-full bg-primary-container" />
            <div>
              <h4 className="font-label-caps text-label-caps text-on-surface">Made in Rwanda Promise</h4>
              <p className="font-body-md text-sm text-on-surface-variant mt-unit leading-snug">
                By completing this purchase, you are supporting local vendors. Escrow services are applied automatically.
              </p>
            </div>
          </div>
        </aside>
      </main>
    </>
  );
};
