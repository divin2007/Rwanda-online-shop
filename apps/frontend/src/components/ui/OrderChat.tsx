'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { orderApi, marketApi, deliveryApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { ImageUpload } from './ImageUpload';
import { toast } from 'react-hot-toast';
import { resolveUploadUrl } from '@/lib/uploadUrls';
import { sanitizeText } from '@/lib/sanitize';

const MapPinPicker = dynamic(() => import('./MapPinPicker').then(mod => mod.MapPinPicker), { ssr: false });

interface Message {
  senderId: string;
  senderRole: 'BUYER' | 'SELLER' | 'RIDER' | 'ADMIN';
  channel?: 'ORDER' | 'DELIVERY' | 'DISPUTE';
  recipientRole?: 'BUYER' | 'SELLER' | 'RIDER' | 'ADMIN';
  content: string;
  imageUrl?: string;
  type?: 'TEXT' | 'QUOTE' | 'COUNTER_QUOTE';
  quoteAmount?: number;
  timestamp: string;
}

interface OrderChatProps {
  orderId: string;
  initialMessages: Message[];
  recipientName: string;
  userRole: 'BUYER' | 'SELLER';
  orderStatus?: string;
  paymentStatus?: string;
  marketId?: string;
  deliveryAddress?: { address?: string; coordinates?: { lat?: number | string; lng?: number | string } };
  deliveryFee?: number;
  channel?: 'ORDER' | 'DELIVERY' | 'DISPUTE';
  onOrderUpdated?: () => void;
}

const NEGOTIATION_STATUSES = ['awaiting_quote', 'quote_sent'];
const CLOSED_STATUSES = ['delivered', 'resolved', 'completed', 'closed', 'cancelled'];
const normalizeCoordinates = (coords?: { lat?: number | string; lng?: number | string } | null) => {
  const lat = Number(coords?.lat);
  const lng = Number(coords?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 ? { lat, lng } : null;
};

export const OrderChat: React.FC<OrderChatProps> = ({ 
  marketId,
  orderId, 
  initialMessages, 
  recipientName, 
  userRole, 
  orderStatus,
  paymentStatus, 
  deliveryAddress, 
  deliveryFee: initialDeliveryFee,
  channel = 'ORDER',
  onOrderUpdated
}) => {
  const { user } = useAuth();
  const filterMessages = React.useCallback(
    (items: Message[] = []) => items.filter(message => (message.channel || 'ORDER') === channel),
    [channel]
  );
  const [messages, setMessages] = useState<Message[]>(() => filterMessages(initialMessages));
  const [newMessage, setNewMessage] = useState('');
  const [quotePrice, setQuotePrice] = useState<string>('');
  const [counterPrice, setCounterPrice] = useState<string>('');
  const [counterNote, setCounterNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isCountering, setIsCountering] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(
    normalizeCoordinates(deliveryAddress?.coordinates)
  );
  const [currentDeliveryFee, setCurrentDeliveryFee] = useState(initialDeliveryFee || 0);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [marketCoords, setMarketCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (marketId) {
      const mId = typeof marketId === 'object' ? (marketId as any)._id : marketId;
      marketApi.get(`/markets/${mId}`).then((res: any) => {
        const market = res.data?.data;
        if (market?.location?.coordinates) {
          setMarketCoords({ 
            lat: Number(market.location.coordinates[1]), 
            lng: Number(market.location.coordinates[0]) 
          });
        }
      }).catch((e: any) => console.error('Failed to load market coordinates:', e));
    }
  }, [marketId]);

  // Dynamically calculate delivery fee in real-time as pin is dropped/moved
  useEffect(() => {
    if (selectedCoords && marketCoords) {
      deliveryApi.post('/deliveries/fee', {
        from: marketCoords,
        to: selectedCoords
      }).then((res: any) => {
        const fee = res.data?.data?.fee ?? res.data?.fee;
        if (typeof fee === 'number') {
          setCurrentDeliveryFee(fee);
        }
      }).catch((e: any) => console.error('Failed to calculate dynamic fee:', e));
    }
  }, [selectedCoords, marketCoords]);

  // Determine if we're in a negotiation phase
  const isClosed = CLOSED_STATUSES.includes(String(orderStatus || '').toLowerCase());
  const isNegotiationPhase = NEGOTIATION_STATUSES.includes(orderStatus || '') ||
    (orderStatus === 'placed' && paymentStatus !== 'paid');
  const canSendQuote = !isClosed && userRole === 'SELLER' && isNegotiationPhase;
  const canPickLocation = !isClosed && userRole === 'BUYER' && isNegotiationPhase;
  const hasValidLocation = selectedCoords && selectedCoords.lat !== 0 && selectedCoords.lng !== 0;

  // Subscribe to real-time updates
  const { data: socketData } = useSocket(
    process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006',
    `order:${orderId}:status`
  );

  useEffect(() => {
    if (socketData?.type === 'NEW_MESSAGE' && socketData.message) {
      if ((socketData.message.channel || 'ORDER') !== channel) return;
      setMessages(prev => {
        const exists = prev.some(m => m.timestamp === socketData.message.timestamp);
        if (exists) return prev;
        return [...prev, socketData.message];
      });
    }
    if (socketData?.type === 'LOCATION_UPDATE') {
      setCurrentDeliveryFee(socketData.deliveryFee);
      setSelectedCoords(socketData.coordinates);
    }
  }, [channel, socketData]);

  useEffect(() => {
    setMessages(filterMessages(initialMessages));
  }, [filterMessages, initialMessages]);

  useEffect(() => {
    setSelectedCoords(normalizeCoordinates(deliveryAddress?.coordinates));
    setCurrentDeliveryFee(initialDeliveryFee || 0);
  }, [deliveryAddress?.coordinates?.lat, deliveryAddress?.coordinates?.lng, initialDeliveryFee]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (content: string, imageUrl?: string) => {
    if (isClosed) return toast.error('This order is closed. Messages are locked.');
    const safeContent = sanitizeText(content, 1000);
    if ((!safeContent.trim() && !imageUrl) || !user) return;

    setIsSending(true);
    try {
      const response = await orderApi.post(`/orders/${orderId}/messages`, {
        senderId: user.id,
        senderRole: userRole,
        content: safeContent.trim() || (imageUrl ? 'Sent an image' : ''),
        imageUrl,
        channel,
        recipientRole: userRole === 'BUYER' ? 'SELLER' : 'BUYER',
        type: 'TEXT'
      });

      if (response.data.success) {
        const lastMsg = response.data.data.messages[response.data.data.messages.length - 1];
        setMessages(prev => prev.some(message => message.timestamp === lastMsg.timestamp) ? prev : [...prev, lastMsg]);
        setNewMessage('');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendQuote = async () => {
    const price = parseInt(quotePrice);
    if (!price || isNaN(price) || !user) return;

    setError(null);
    setIsSending(true);
    try {
      await orderApi.post(`/orders/${orderId}/quote`, {
        financials: {
          subtotal: price,
          deliveryFee: currentDeliveryFee || 1000,
          note: newMessage.trim() || `I'm offering this project for ${price.toLocaleString()} RWF`
        }
      });
      setQuotePrice('');
      setNewMessage('');
      setIsQuoting(false);
      toast.success('Quote sent successfully!');
      onOrderUpdated?.();
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 409) {
        toast.error('The order status has changed. Please refresh the page.');
      } else if (status === 400) {
        toast.error(error?.response?.data?.message || 'Cannot send quote at this stage.');
      } else {
        toast.error('Failed to send quote');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleAcceptQuote = async () => {
    if (!user) {
      toast.error('Please sign in to accept this quote');
      return;
    }

    setError(null);
    setIsSending(true);
    try {
      await orderApi.put(`/orders/${orderId}/status`, { status: 'placed', userId: user.id });
      toast.success('Quote accepted! Processing payment...');
      try {
        await orderApi.post(`/orders/${orderId}/retry-payment`);
        toast.success('Payment initiated!');
      } catch (paymentError: any) {
        toast.error(paymentError?.response?.data?.message || 'Payment initiation failed. You can retry from your dashboard.');
      }
      onOrderUpdated?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to accept quote');
    } finally {
      setIsSending(false);
    }
  };

  const handleCounterOffer = async () => {
    const price = parseInt(counterPrice);
    if (!price || isNaN(price) || !user) return;

    setError(null);
    setIsSending(true);
    try {
      await orderApi.post(`/orders/${orderId}/counter-offer`, {
        subtotal: price,
        note: counterNote.trim() || undefined
      });
      setCounterPrice('');
      setCounterNote('');
      setIsCountering(false);
      toast.success('Counter-offer sent!');
      onOrderUpdated?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to send counter-offer');
    } finally {
      setIsSending(false);
    }
  };

  const handleDeclineQuote = async () => {
    if (!user) return;
    const reason = window.prompt('Reason for declining (optional):');
    setError(null);
    setIsSending(true);
    try {
      await orderApi.post(`/orders/${orderId}/reject-quote`, { reason: reason || undefined });
      toast.success('Quote declined');
      onOrderUpdated?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to decline quote');
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!selectedCoords || !user) return;

    setIsSavingLocation(true);
    try {
      const response = await orderApi.put(`/orders/${orderId}/delivery-address`, {
        address: `Pin: ${selectedCoords.lat.toFixed(4)}, ${selectedCoords.lng.toFixed(4)}`,
        coordinates: selectedCoords
      });
      if (response.data.success) {
        const updatedOrder = response.data.data;
        setCurrentDeliveryFee(updatedOrder.financials?.deliveryFee || currentDeliveryFee);
        setMessages(filterMessages(updatedOrder.messages || messages));
        setShowLocationPicker(false);
        toast.success(`Location set! Delivery fee: ${(updatedOrder.financials?.deliveryFee || 500).toLocaleString()} RWF`);
        onOrderUpdated?.();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to set location');
    } finally {
      setIsSavingLocation(false);
    }
  };

  return (
    <div className="flex h-[640px] flex-col overflow-hidden rounded-lg border border-[#dfe7e2] bg-white shadow-sm">
      {/* Tactical Header */}
      <div className="flex items-center justify-between gap-4 border-b border-[#dfe7e2] bg-[#e05300] px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white text-lg font-black text-[#e05300]">
            {recipientName[0] || 'U'}
          </div>
          <div>
            <h3 className="mb-1 text-sm font-black text-white">{recipientName}</h3>
            <div className="flex items-center gap-2">
               <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ffedd5]"></div>
               <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">
                 {isNegotiationPhase ? 'Negotiation in Progress' : 'Chat Connected'}
               </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canPickLocation && (
            <button
              onClick={() => { setShowLocationPicker(!showLocationPicker); setIsQuoting(false); setIsCountering(false); }}
              className={`rounded-md border px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] transition-all ${
                showLocationPicker 
                  ? 'bg-transparent border-[#ffedd5] text-[#ffedd5]' 
                  : !hasValidLocation 
                    ? 'bg-[#ffedd5] border-[#ffedd5] text-[#e05300] animate-pulse' 
                    : 'bg-white border-white text-[#1b1c1c] hover:bg-[#e05300] hover:border-[#ffedd5] hover:text-white'
              }`}
            >
              {showLocationPicker ? 'Close' : hasValidLocation ? 'Change Location' : 'Set Delivery Location'}
            </button>
          )}
          {canSendQuote && (
            <button 
              onClick={() => { setIsQuoting(!isQuoting); setShowLocationPicker(false); setIsCountering(false); }}
              className={`rounded-md border px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] transition-all ${
                isQuoting 
                  ? 'bg-transparent border-[#ffedd5] text-[#ffedd5]' 
                  : 'bg-[#ffedd5] border-[#ffedd5] text-[#e05300] hover:bg-white hover:text-[#1b1c1c]'
              }`}
            >
              {isQuoting ? 'Cancel Quote' : 'Send Quote'}
            </button>
          )}
        </div>
      </div>

      {/* Location Picker Matrix */}
      {showLocationPicker && (
        <div className="flex-1 flex flex-col bg-[#fcf9f8]">
          <div className="px-8 py-4 bg-white border-b border-[#e0e0e0] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-[#1b1c1c] uppercase tracking-[0.3em]">Set Delivery Location</p>
              <p className="text-[8px] font-bold text-[#414844] uppercase tracking-widest opacity-60">Drop a pin on the map for your delivery address</p>
            </div>
            {currentDeliveryFee > 0 && (
              <div className="bg-[#e05300] text-white px-4 py-2 border border-[#ffd700]/30">
                <p className="text-[8px] text-[#ff6b00] font-black uppercase tracking-widest mb-0.5">Calculated Fee</p>
                <p className="text-sm font-sans text-white">{currentDeliveryFee.toLocaleString()} RWF</p>
              </div>
            )}
          </div>
          <div className="flex-1 relative min-h-[300px]">
            <MapPinPicker
              onLocationSelected={(coords: any) => setSelectedCoords(coords)}
              centerLat={selectedCoords?.lat || marketCoords?.lat || -1.9441}
              centerLng={selectedCoords?.lng || marketCoords?.lng || 30.0619}
              selectedLocation={selectedCoords}
              marketLocation={marketCoords}
            />
          </div>
          <div className="p-6 bg-[#e05300] border-t border-[#ffd700]/20 flex items-center gap-6">
            {selectedCoords && (
              <p className="flex-1 text-[10px] font-mono text-[#ff6b00] tracking-wider opacity-80 uppercase">
                LAT:{selectedCoords.lat.toFixed(6)} / LNG:{selectedCoords.lng.toFixed(6)}
              </p>
            )}
            <button
              onClick={handleSaveLocation}
              disabled={!selectedCoords || isSavingLocation}
              className="rmf-btn-primary bg-[#ffd700] text-[#1b1c1c] border-none py-3 px-8 text-[9px] hover:bg-white transition-all disabled:opacity-30"
            >
              {isSavingLocation ? 'Saving...' : 'Confirm Location'}
            </button>
          </div>
        </div>
      )}

      {/* Message Feed Matrix */}
      {!showLocationPicker && (
        <>
          {canPickLocation && !hasValidLocation && (
            <div className="px-8 py-3 bg-[#ffd700]/10 border-b border-[#ffd700]/30 flex items-center gap-4">
              <svg className="w-4 h-4 text-[#ff6b00]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p className="text-[10px] text-[#1b1c1c] font-black uppercase tracking-widest flex-1">
                Please set your delivery location before the seller can quote you.
              </p>
              <button 
                onClick={() => setShowLocationPicker(true)}
                className="text-[9px] font-black text-[#ff6b00] uppercase tracking-widest border-b-2 border-[#ffd700] pb-0.5 hover:text-[#1b1c1c] transition-colors"
              >
                Set Location Now
              </button>
            </div>
          )}

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto bg-[#f7faf8] p-5 scroll-smooth"
          >
            <div className="space-y-5">
            {messages.map((msg, idx) => {
              const isMe = msg.senderRole === userRole;
              const isFirst = idx === 0;
              const isQuote = msg.type === 'QUOTE';

              return (
                <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isFirst ? 'mb-12' : ''}`}>
                  {isFirst && (
                    <div className="w-full flex items-center gap-6 mb-8 opacity-40">
                      <div className="h-px flex-1 bg-[#e05300]"></div>
                      <span className="text-[10px] font-black text-[#1b1c1c] uppercase tracking-[0.5em]">Order Request</span>
                      <div className="h-px flex-1 bg-[#e05300]"></div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedMessage(msg)}
                    className={`max-w-[84%] overflow-hidden rounded-lg border text-left shadow-sm transition hover:-translate-y-0.5 ${
                      isQuote
                        ? 'border-[#ffedd5] bg-white'
                        : msg.type === 'COUNTER_QUOTE'
                          ? 'border-[#b9d7c5] bg-white'
                          : isMe
                            ? 'bg-[#e05300] text-white border-[#e05300]'
                            : 'bg-white text-[#1b1c1c] border-[#e0e0e0]'
                    }`}
                  >
                    {msg.imageUrl && (
                      <div className="relative group border-b border-inherit">
                        <img src={resolveUploadUrl(msg.imageUrl, 'order')} alt="Attachment" className="w-full max-h-80 object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                      </div>
                    )}

                    <div className="p-4">
                      {isQuote && (
                        <div className="mb-6 pb-6 border-b border-[#e0e0e0]">
                          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">Seller Quote</p>
                          <p className="text-3xl font-sans tracking-normal text-[#1b1c1c]">{msg.quoteAmount?.toLocaleString()} RWF</p>
                        </div>
                      )}

                      {msg.type === 'COUNTER_QUOTE' && (
                        <div className="mb-6 border-b border-[#ffedd5] pb-6">
                          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">Buyer Counter-Offer</p>
                          <p className="text-3xl font-sans tracking-normal text-[#1b1c1c]">{msg.quoteAmount?.toLocaleString()} RWF</p>
                        </div>
                      )}
                      
                      <p className={`text-[13px] leading-relaxed tracking-tight ${isQuote || msg.type === 'COUNTER_QUOTE' ? 'italic font-light' : ''}`}>
                        {msg.content}
                      </p>
                      
                      {isQuote && !isMe && (
                        <div className="mt-8 space-y-3">
                          <span
                            onClick={(e) => { e.stopPropagation(); handleAcceptQuote(); }}
                            className="block w-full rounded-md bg-[#e05300] py-3 text-center text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-[#ff6b00] cursor-pointer"
                          >
                            {(orderStatus === 'paid' || orderStatus === 'placed') ? 'Quote Accepted' : 'Accept Quote & Pay'}
                          </span>
                          {['awaiting_quote', 'quote_sent'].includes(orderStatus || '') && (
                            <div className="flex gap-4">
                              <span
                                onClick={(e) => { e.stopPropagation(); setIsCountering(!isCountering); }}
                                className="flex-1 rounded-md border border-[#e0e0e0] py-3 text-center text-[9px] font-black uppercase tracking-widest transition-all hover:bg-[#e05300] hover:text-white cursor-pointer"
                              >
                                Counter Offer
                              </span>
                              <span
                                onClick={(e) => { e.stopPropagation(); handleDeclineQuote(); }}
                                className="flex-1 rounded-md border border-[#d9b8b3] py-3 text-center text-[9px] font-black uppercase tracking-widest text-[#7b3f3f] transition-all hover:bg-[#7b3f3f] hover:text-white cursor-pointer"
                              >
                                Decline Quote
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <p className={`text-[8px] font-bold mt-4 uppercase tracking-widest opacity-40 ${isMe ? 'text-right' : 'text-left'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </button>
                </div>
              );
            })}
            </div>
          </div>

          {selectedMessage && (
            <div className="border-t border-[#dfe7e2] bg-white px-5 py-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff6b00]">Selected message</p>
                  <p className="mt-1 text-sm font-semibold text-[#1b1c1c]">
                    {selectedMessage.type === 'QUOTE'
                      ? `Quote action: ${selectedMessage.quoteAmount?.toLocaleString()} RWF`
                      : selectedMessage.type === 'COUNTER_QUOTE'
                        ? `Counter-offer: ${selectedMessage.quoteAmount?.toLocaleString()} RWF`
                        : selectedMessage.content}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#5f7569]">
                    {new Date(selectedMessage.timestamp).toLocaleString()} by {selectedMessage.senderRole.toLowerCase()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setNewMessage(`Regarding: ${selectedMessage.content}`)} className="rounded-md border border-[#d9e0db] px-3 py-2 text-xs font-black text-[#405046] hover:border-[#ff6b00] hover:text-[#ff6b00]">
                    Reply
                  </button>
                  {canSendQuote && (
                    <button type="button" onClick={() => { setIsQuoting(true); setIsCountering(false); }} className="rounded-md bg-[#ff6b00] px-3 py-2 text-xs font-black text-white">
                      Continue quote
                    </button>
                  )}
                  <button type="button" onClick={() => setSelectedMessage(null)} className="rounded-md border border-[#d9e0db] px-3 py-2 text-xs font-black text-[#405046]">
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tactical Control Matrix */}
          <div className="space-y-5 border-t border-[#e0e0e0] bg-white p-5">
            {isClosed ? (
              <div className="rounded-md border border-[#dfe7e2] bg-[#f5f7f6] px-5 py-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#405046]">Order closed</p>
                <p className="mt-1 text-xs font-semibold text-[#5f7569]">All order steps are complete. Messaging is locked for security.</p>
              </div>
            ) : isQuoting ? (
              <div className="space-y-6 animate-reveal">
                 <div className="flex items-center gap-6">
                    <div className="flex-1 relative">
                       <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#414844] uppercase tracking-widest opacity-40">RWF</span>
                       <input
                         type="number"
                         value={quotePrice}
                         onChange={(e) => setQuotePrice(e.target.value)}
                         placeholder="Enter your price in RWF..."
                         className="w-full bg-[#fcf9f8] border-2 border-dashed border-[#e0e0e0]/20 rounded-md pl-20 pr-8 py-5 text-xl font-sans outline-none focus:border-[#ff6b00] transition-colors"
                       />
                    </div>
                    <button 
                      onClick={handleSendQuote} 
                      disabled={!quotePrice || isSending} 
                      className="bg-[#e05300] text-white px-12 py-5 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-[#e05300] transition-all disabled:opacity-30"
                    >
                      Send Quote
                    </button>
                 </div>
                  <div className="flex justify-between items-center px-4">
                    <p className="text-[9px] font-bold text-[#414844] uppercase tracking-widest">
                       {currentDeliveryFee > 0 ? `Delivery fee: ${currentDeliveryFee.toLocaleString()} RWF will be added` : 'Delivery fee calculated after buyer sets location'}
                    </p>
                    <button onClick={() => setIsQuoting(false)} className="text-[9px] font-black text-[#1b1c1c] uppercase tracking-widest border-b border-[#e0e0e0]">Dismiss</button>
                  </div>
              </div>
            ) : isCountering ? (
              <div className="space-y-6 animate-reveal">
                 <div className="flex items-center gap-6">
                    <div className="flex-1 relative">
                       <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#414844] uppercase tracking-widest opacity-40">RWF</span>
                       <input
                         type="number"
                         value={counterPrice}
                         onChange={(e) => setCounterPrice(e.target.value)}
                         placeholder="Your counter offer price..."
                         className="w-full bg-[#fcf9f8] border-2 border-dashed border-[#ffd700]/40 rounded-md pl-20 pr-8 py-5 text-xl font-sans outline-none focus:border-[#ffd700] transition-colors"
                       />
                    </div>
                    <button 
                      onClick={handleCounterOffer} 
                      disabled={!counterPrice || isSending} 
                      className="bg-[#e05300] text-white px-12 py-5 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-[#e05300] transition-all"
                    >
                      Send Offer
                    </button>
                 </div>
                 <button onClick={() => setIsCountering(false)} className="text-[9px] font-black text-[#1b1c1c] uppercase tracking-widest border-b border-[#e0e0e0] ml-4">Cancel</button>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                 <form 
                   onSubmit={(e) => { e.preventDefault(); handleSendMessage(newMessage); }} 
                   className="flex gap-4"
                 >
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-[#fcf9f8] border-2 border-transparent border-b-[#e0e0e0] px-6 py-4 text-[13px] outline-none focus:border-b-[#1b1c1c] transition-all"
                    />
                    <button 
                      type="submit" 
                      disabled={isSending || !newMessage.trim()}
                      className="bg-[#e05300] text-white px-10 py-4 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-[#e05300] transition-all disabled:opacity-20"
                    >
                      Send
                    </button>
                 </form>
                 
                 <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-6">
                       <ImageUpload 
                         onUploadSuccess={(url) => handleSendMessage('', url)}
                         service="order"
                         endpoint={`/orders/upload-image`}
                         label="Send Image"
                         compact
                       />
                    </div>
                    <p className="text-[9px] font-bold text-[#414844] uppercase tracking-[0.4em] opacity-40">End-to-end secure</p>
                 </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
