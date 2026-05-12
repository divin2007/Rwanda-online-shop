'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { orderApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { Button } from './Button';
import { ImageUpload } from './ImageUpload';
import { toast } from 'react-hot-toast';

const MapPinPicker = dynamic(() => import('./MapPinPicker').then(mod => mod.MapPinPicker), { ssr: false });

interface Message {
  senderId: string;
  senderRole: 'BUYER' | 'SELLER';
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
  deliveryAddress?: { address?: string; coordinates?: { lat: number; lng: number } };
  deliveryFee?: number;
  onOrderUpdated?: () => void;
}

const NEGOTIATION_STATUSES = ['awaiting_quote', 'quote_sent'];

import { useLanguage } from '@/context/LanguageContext';

export const OrderChat: React.FC<OrderChatProps> = ({
  orderId, initialMessages, recipientName, userRole, orderStatus,
  paymentStatus, marketId, deliveryAddress, deliveryFee: initialDeliveryFee,
  onOrderUpdated
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const [quotePrice, setQuotePrice] = useState<string>('');
  const [counterPrice, setCounterPrice] = useState<string>('');
  const [counterNote, setCounterNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isCountering, setIsCountering] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(
    deliveryAddress?.coordinates?.lat ? deliveryAddress.coordinates : null
  );
  const [currentDeliveryFee, setCurrentDeliveryFee] = useState(initialDeliveryFee || 0);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Determine if we're in a negotiation phase
  const isNegotiationPhase = NEGOTIATION_STATUSES.includes(orderStatus || '') ||
    (orderStatus === 'placed' && paymentStatus !== 'paid');
  const canSendQuote = userRole === 'SELLER' && isNegotiationPhase;
  const canPickLocation = userRole === 'BUYER' && isNegotiationPhase;
  const hasValidLocation = selectedCoords && selectedCoords.lat !== 0 && selectedCoords.lng !== 0;

  // Subscribe to real-time updates
  const { data: socketData } = useSocket(
    process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006',
    `order:${orderId}:status`
  );

  useEffect(() => {
    if (socketData?.type === 'NEW_MESSAGE' && socketData.message) {
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
  }, [socketData]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (content: string, imageUrl?: string) => {
    if ((!content.trim() && !imageUrl) || !user) return;

    setIsSending(true);
    try {
      const response = await orderApi.post(`/orders/${orderId}/messages`, {
        senderId: user.id,
        senderRole: userRole,
        content: content.trim() || (imageUrl ? 'Sent an image' : ''),
        imageUrl,
        type: 'TEXT'
      });

      if (response.data.success) {
        const lastMsg = response.data.data.messages[response.data.data.messages.length - 1];
        setMessages(prev => [...prev, lastMsg]);
        setNewMessage('');
      }
    } catch (error) {
      toast.error('Failed to send message');
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
    setError(null);
    setIsSending(true);
    try {
      // First transition to PLACED, then initiate payment
      await orderApi.put(`/orders/${orderId}/status`, { status: 'placed' });
      toast.success('Quote accepted! Processing payment...');
      // Then trigger payment
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
        setMessages(updatedOrder.messages || messages);
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
    <div className="flex flex-col h-[600px] bg-white border-2 border-[#121212] overflow-hidden shadow-2xl">
      {/* Tactical Header */}
      <div className="px-8 py-5 bg-[#121212] flex items-center justify-between border-b border-[#F59E0B]/20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white border border-[#F59E0B]/50 text-[#121212] flex items-center justify-center font-serif italic text-lg shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            {recipientName[0]}
          </div>
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white leading-none mb-1.5">{recipientName}</h3>
            <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 bg-[#F59E0B] rounded-full animate-pulse"></div>
               <span className="text-[9px] font-bold uppercase tracking-widest text-[#F59E0B]/80 italic">
                 {isNegotiationPhase ? 'Negotiation in Progress' : 'Chat Connected'}
               </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canPickLocation && (
            <button
              onClick={() => { setShowLocationPicker(!showLocationPicker); setIsQuoting(false); setIsCountering(false); }}
              className={`px-6 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all border ${
                showLocationPicker 
                  ? 'bg-transparent border-[#F59E0B] text-[#F59E0B]' 
                  : !hasValidLocation 
                    ? 'bg-[#F59E0B] border-[#F59E0B] text-[#121212] animate-pulse' 
                    : 'bg-white border-white text-[#121212] hover:bg-[#F59E0B] hover:border-[#F59E0B]'
              }`}
            >
              {showLocationPicker ? 'Close' : hasValidLocation ? 'Change Location' : 'Set Delivery Location'}
            </button>
          )}
          {canSendQuote && (
            <button 
              onClick={() => { setIsQuoting(!isQuoting); setShowLocationPicker(false); setIsCountering(false); }}
              className={`px-6 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all border ${
                isQuoting 
                  ? 'bg-transparent border-[#F59E0B] text-[#F59E0B]' 
                  : 'bg-[#F59E0B] border-[#F59E0B] text-[#121212] hover:bg-white hover:text-[#121212]'
              }`}
            >
              {isQuoting ? 'Cancel Quote' : 'Send Quote'}
            </button>
          )}
        </div>
      </div>

      {/* Location Picker Matrix */}
      {showLocationPicker && (
        <div className="flex-1 flex flex-col bg-[#F8F6F1]">
          <div className="px-8 py-4 bg-white border-b border-[#E5E1D8] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-[#121212] uppercase tracking-[0.3em]">Set Delivery Location</p>
              <p className="text-[8px] font-bold text-[#6B665E] uppercase tracking-widest italic opacity-60">Drop a pin on the map for your delivery address</p>
            </div>
            {currentDeliveryFee > 0 && (
              <div className="bg-[#121212] text-white px-4 py-2 border border-[#F59E0B]/30">
                <p className="text-[8px] text-[#F59E0B] font-black uppercase tracking-widest mb-0.5">Calculated Fee</p>
                <p className="text-sm font-serif italic text-white">{currentDeliveryFee.toLocaleString()} RWF</p>
              </div>
            )}
          </div>
          <div className="flex-1 relative min-h-[300px]">
            <MapPinPicker
              onLocationSelected={(coords: any) => setSelectedCoords(coords)}
              centerLat={selectedCoords?.lat || -1.9441}
              centerLng={selectedCoords?.lng || 30.0619}
            />
          </div>
          <div className="p-6 bg-[#121212] border-t border-[#F59E0B]/20 flex items-center gap-6">
            {selectedCoords && (
              <p className="flex-1 text-[10px] font-mono text-[#F59E0B] tracking-wider opacity-80 uppercase">
                LAT:{selectedCoords.lat.toFixed(6)} / LNG:{selectedCoords.lng.toFixed(6)}
              </p>
            )}
            <button
              onClick={handleSaveLocation}
              disabled={!selectedCoords || isSavingLocation}
              className="rmf-btn-primary bg-[#F59E0B] text-[#121212] border-none py-3 px-8 text-[9px] hover:bg-white transition-all disabled:opacity-30"
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
            <div className="px-8 py-3 bg-[#F59E0B]/10 border-b border-[#F59E0B]/30 flex items-center gap-4">
              <svg className="w-4 h-4 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p className="text-[10px] text-[#121212] font-black uppercase tracking-widest flex-1">
                Please set your delivery location before the seller can quote you.
              </p>
              <button 
                onClick={() => setShowLocationPicker(true)}
                className="text-[9px] font-black text-[#F59E0B] uppercase tracking-widest border-b-2 border-[#F59E0B] pb-0.5 hover:text-[#121212] transition-colors"
              >
                Set Location Now
              </button>
            </div>
          )}

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-10 space-y-6 scroll-smooth bg-[#F8F6F1]"
          >
            {messages.map((msg, idx) => {
              const isMe = msg.senderRole === userRole;
              const isFirst = idx === 0;
              const isQuote = msg.type === 'QUOTE';

              return (
                <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isFirst ? 'mb-12' : ''}`}>
                  {isFirst && (
                    <div className="w-full flex items-center gap-6 mb-8 opacity-40">
                      <div className="h-px flex-1 bg-[#121212]"></div>
                      <span className="text-[10px] font-black text-[#121212] uppercase tracking-[0.5em]">Order Request</span>
                      <div className="h-px flex-1 bg-[#121212]"></div>
                    </div>
                  )}

                  <div className={`max-w-[80%] border-2 ${
                    isQuote
                      ? 'border-[#121212] bg-white shadow-[10px_10px_0_0_#121212]'
                      : msg.type === 'COUNTER_QUOTE'
                        ? 'border-[#F59E0B] bg-white shadow-[10px_10px_0_0_#F59E0B]'
                        : isMe
                          ? 'bg-[#121212] text-white border-[#121212]'
                          : 'bg-white text-[#121212] border-[#E5E1D8]'
                  }`}>
                    {msg.imageUrl && (
                      <div className="relative group border-b border-inherit">
                        <img src={msg.imageUrl} alt="Attachment" className="w-full max-h-80 object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                      </div>
                    )}

                    <div className="p-6">
                      {isQuote && (
                        <div className="mb-6 pb-6 border-b border-[#E5E1D8]">
                          <p className="text-[9px] font-black text-[#A34D15] uppercase tracking-[0.4em] mb-3">Seller Quote</p>
                          <p className="text-4xl font-serif italic tracking-tighter text-[#121212]">{msg.quoteAmount?.toLocaleString()} RWF</p>
                        </div>
                      )}

                      {msg.type === 'COUNTER_QUOTE' && (
                        <div className="mb-6 pb-6 border-b border-[#F59E0B]/30">
                          <p className="text-[9px] font-black text-[#F59E0B] uppercase tracking-[0.4em] mb-3">Buyer Counter-Offer</p>
                          <p className="text-4xl font-serif italic tracking-tighter text-[#121212]">{msg.quoteAmount?.toLocaleString()} RWF</p>
                        </div>
                      )}
                      
                      <p className={`text-[13px] leading-relaxed tracking-tight ${isQuote || msg.type === 'COUNTER_QUOTE' ? 'italic font-light' : ''}`}>
                        {msg.content}
                      </p>
                      
                      {isQuote && !isMe && (
                        <div className="mt-8 space-y-3">
                          <button
                            onClick={handleAcceptQuote}
                            disabled={isSending || orderStatus === 'paid' || orderStatus === 'placed' || !['awaiting_quote', 'quote_sent', 'placed'].includes(orderStatus || '')}
                            className="w-full bg-[#121212] text-white py-4 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-[#F59E0B] transition-all disabled:opacity-20"
                          >
                            {(orderStatus === 'paid' || orderStatus === 'placed') ? 'Quote Accepted' : 'Accept Quote & Pay'}
                          </button>
                          {['awaiting_quote', 'quote_sent'].includes(orderStatus || '') && (
                            <div className="flex gap-4">
                              <button
                                onClick={() => setIsCountering(!isCountering)}
                                className="flex-1 border-2 border-[#121212] py-3 text-[9px] font-black uppercase tracking-widest hover:bg-[#121212] hover:text-white transition-all"
                              >
                                Counter Offer
                              </button>
                              <button
                                onClick={handleDeclineQuote}
                                className="flex-1 border-2 border-red-600 text-red-600 py-3 text-[9px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all"
                              >
                                Decline Quote
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <p className={`text-[8px] font-bold mt-4 uppercase tracking-widest opacity-40 ${isMe ? 'text-right' : 'text-left'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tactical Control Matrix */}
          <div className="p-8 bg-white border-t-2 border-[#121212] space-y-6 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.1)]">
            {isQuoting ? (
              <div className="space-y-6 animate-reveal">
                 <div className="flex items-center gap-6">
                    <div className="flex-1 relative">
                       <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#6B665E] uppercase tracking-widest opacity-40">RWF</span>
                       <input
                         type="number"
                         value={quotePrice}
                         onChange={(e) => setQuotePrice(e.target.value)}
                         placeholder="Enter your price in RWF..."
                         className="w-full bg-[#F8F6F1] border-2 border-dashed border-[#121212]/20 rounded-none pl-20 pr-8 py-5 text-xl font-serif italic outline-none focus:border-[#121212] transition-colors"
                       />
                    </div>
                    <button 
                      onClick={handleSendQuote} 
                      disabled={!quotePrice || isSending} 
                      className="bg-[#121212] text-white px-12 py-5 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-[#F59E0B] transition-all disabled:opacity-30"
                    >
                      Send Quote
                    </button>
                 </div>
                 <div className="flex justify-between items-center px-4">
                    <p className="text-[9px] font-bold text-[#6B665E] uppercase tracking-widest italic">
                       {currentDeliveryFee > 0 ? `Delivery fee: ${currentDeliveryFee.toLocaleString()} RWF will be added` : 'Delivery fee calculated after buyer sets location'}
                    </p>
                    <button onClick={() => setIsQuoting(false)} className="text-[9px] font-black text-[#121212] uppercase tracking-widest border-b border-[#121212]">Dismiss</button>
                 </div>
              </div>
            ) : isCountering ? (
              <div className="space-y-6 animate-reveal">
                 <div className="flex items-center gap-6">
                    <div className="flex-1 relative">
                       <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#6B665E] uppercase tracking-widest opacity-40">RWF</span>
                       <input
                         type="number"
                         value={counterPrice}
                         onChange={(e) => setCounterPrice(e.target.value)}
                         placeholder="Your counter offer price..."
                         className="w-full bg-[#F8F6F1] border-2 border-dashed border-[#F59E0B]/40 rounded-none pl-20 pr-8 py-5 text-xl font-serif italic outline-none focus:border-[#F59E0B] transition-colors"
                       />
                    </div>
                    <button 
                      onClick={handleCounterOffer} 
                      disabled={!counterPrice || isSending} 
                      className="bg-[#121212] text-white px-12 py-5 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-[#F59E0B] transition-all"
                    >
                      Send Offer
                    </button>
                 </div>
                 <button onClick={() => setIsCountering(false)} className="text-[9px] font-black text-[#121212] uppercase tracking-widest border-b border-[#121212] ml-4">Cancel</button>
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
                      className="flex-1 bg-[#F8F6F1] border-2 border-transparent border-b-[#E5E1D8] px-6 py-4 text-[13px] outline-none focus:border-b-[#121212] transition-all"
                    />
                    <button 
                      type="submit" 
                      disabled={isSending || !newMessage.trim()}
                      className="bg-[#121212] text-white px-10 py-4 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-[#F59E0B] transition-all disabled:opacity-20"
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
                    <p className="text-[9px] font-bold text-[#6B665E] uppercase tracking-[0.4em] italic opacity-40">End-to-end secure</p>
                 </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
