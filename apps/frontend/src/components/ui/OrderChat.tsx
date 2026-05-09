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

export const OrderChat: React.FC<OrderChatProps> = ({
  orderId, initialMessages, recipientName, userRole, orderStatus,
  paymentStatus, marketId, deliveryAddress, deliveryFee: initialDeliveryFee,
  onOrderUpdated
}) => {
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
    <div className="flex flex-col h-[500px] bg-bg-secondary rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-sm">
            {recipientName[0]}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{recipientName}</h3>
            <p className="text-[10px] text-status-success flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-status-success rounded-full"></span>
              {isNegotiationPhase ? 'Active Negotiation' : 'Order in Progress'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canPickLocation && (
            <Button
              size="sm"
              variant={showLocationPicker ? 'outline' : 'primary'}
              onClick={() => { setShowLocationPicker(!showLocationPicker); setIsQuoting(false); setIsCountering(false); }}
              className={!hasValidLocation ? '!bg-amber-500 !border-amber-500 hover:!bg-amber-600 animate-pulse' : ''}
            >
              {showLocationPicker ? '✕ Close Map' : hasValidLocation ? '📍 Update Location' : '📍 Set Location'}
            </Button>
          )}
          {canSendQuote && (
            <Button 
              size="sm" 
              variant={isQuoting ? 'outline' : 'primary'}
              onClick={() => { setIsQuoting(!isQuoting); setShowLocationPicker(false); setIsCountering(false); }}
            >
              {isQuoting ? 'Cancel' : 'Send Quote'}
            </Button>
          )}
        </div>
      </div>

      {/* Location Picker (inline, replaces messages temporarily) */}
      {showLocationPicker && (
        <div className="flex-1 flex flex-col animate-in slide-in-from-top duration-300">
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-700 uppercase">📍 Set Your Delivery Location</p>
              <p className="text-[10px] text-amber-600">Search or tap the map to drop your pin</p>
            </div>
            {currentDeliveryFee > 0 && (
              <div className="bg-white rounded-lg px-3 py-1.5 border border-amber-200">
                <p className="text-[10px] text-text-secondary">Delivery Fee</p>
                <p className="text-sm font-bold text-brand-primary">{currentDeliveryFee.toLocaleString()} RWF</p>
              </div>
            )}
          </div>
          <div className="flex-1 relative min-h-[280px]">
            <MapPinPicker
              onLocationSelected={(coords) => setSelectedCoords(coords)}
              centerLat={selectedCoords?.lat || -1.9441}
              centerLng={selectedCoords?.lng || 30.0619}
            />
          </div>
          <div className="p-3 bg-white border-t border-gray-100 flex items-center gap-3">
            {selectedCoords && (
              <p className="flex-1 text-xs text-text-secondary">
                📍 {selectedCoords.lat.toFixed(4)}, {selectedCoords.lng.toFixed(4)}
              </p>
            )}
            <Button
              size="sm"
              onClick={handleSaveLocation}
              disabled={!selectedCoords || isSavingLocation}
            >
              {isSavingLocation ? 'Saving...' : '✓ Confirm Location'}
            </Button>
          </div>
        </div>
      )}

      {/* Messages Area (hidden when location picker is open) */}
      {!showLocationPicker && (
        <>
          {/* Location badge */}
          {canPickLocation && !hasValidLocation && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
              <span className="text-amber-500 text-lg">⚠️</span>
              <p className="text-xs text-amber-700 font-medium flex-1">
                Please set your delivery location before the seller sends a quote
              </p>
              <Button size="sm" variant="outline" className="!text-xs !py-1"
                onClick={() => setShowLocationPicker(true)}
              >
                Set Now
              </Button>
            </div>
          )}

          {hasValidLocation && isNegotiationPhase && (
            <div className="px-4 py-1.5 bg-status-success/5 border-b border-status-success/20 flex items-center gap-2">
              <span className="text-xs">📍</span>
              <p className="text-[10px] text-status-success font-medium flex-1">
                Location set • Delivery fee: {currentDeliveryFee.toLocaleString()} RWF
              </p>
            </div>
          )}

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth"
          >
            {messages.map((msg, idx) => {
              const isMe = msg.senderRole === userRole;
              const isFirst = idx === 0;
              const isQuote = msg.type === 'QUOTE';

              return (
                <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isFirst ? 'mb-8' : ''}`}>
                  {isFirst && (
                    <div className="w-full flex items-center gap-2 mb-4">
                      <div className="h-px flex-1 bg-gray-100"></div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Project Brief</span>
                      <div className="h-px flex-1 bg-gray-100"></div>
                    </div>
                  )}

                  <div className={`max-w-[85%] rounded-2xl shadow-sm overflow-hidden ${
                    isQuote
                      ? 'border-2 border-brand-primary bg-white'
                      : msg.type === 'COUNTER_QUOTE'
                        ? 'border-2 border-amber-400 bg-amber-50'
                        : isMe
                          ? 'bg-brand-primary text-white rounded-tr-none'
                          : 'bg-white text-text-primary rounded-tl-none border border-gray-50'
                  }`}>
                    {msg.imageUrl && (
                      <div className="relative group">
                        <img src={msg.imageUrl} alt="Attachment" className="w-full max-h-64 object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none"></div>
                      </div>
                    )}

                    <div className="p-4">
                      {isQuote && (
                        <div className="mb-3 pb-3 border-b border-gray-100">
                          <p className="text-[10px] font-bold text-brand-primary uppercase mb-1">Official Quote</p>
                          <p className="text-2xl font-bold text-brand-primary">{msg.quoteAmount?.toLocaleString()} RWF</p>
                        </div>
                      )}

                      {msg.type === 'COUNTER_QUOTE' && (
                        <div className="mb-3 pb-3 border-b border-amber-200">
                          <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Counter Offer</p>
                          <p className="text-2xl font-bold text-amber-600">{msg.quoteAmount?.toLocaleString()} RWF</p>
                        </div>
                      )}
                      
                      <p className={`text-sm leading-relaxed ${isQuote ? 'text-text-primary italic' : ''}`}>
                        {msg.content}
                      </p>
                      
                      {isQuote && !isMe && (
                        <div className="mt-4 space-y-2">
                          <Button
                            fullWidth
                            onClick={handleAcceptQuote}
                            loading={isSending}
                            disabled={orderStatus === 'paid' || orderStatus === 'placed' || !['awaiting_quote', 'quote_sent', 'placed'].includes(orderStatus)}
                          >
                            {(orderStatus === 'paid' || orderStatus === 'placed') ? 'Quote Accepted' : 
                             (!['awaiting_quote', 'quote_sent', 'placed'].includes(orderStatus)) ? 'Negotiation Closed' : 'Accept Quote & Pay'}
                          </Button>
                          {['awaiting_quote', 'quote_sent'].includes(orderStatus) && (
                            <div className="flex gap-2">
                              <Button
                                fullWidth
                                variant="outline"
                                size="sm"
                                onClick={() => setIsCountering(!isCountering)}
                              >
                                Counter Offer
                              </Button>
                              <Button
                                fullWidth
                                variant="outline"
                                size="sm"
                                className="!border-status-error !text-status-error hover:!bg-status-error/5"
                                onClick={handleDeclineQuote}
                                loading={isSending}
                              >
                                Decline
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      <p className={`text-[10px] mt-2 opacity-60 ${isMe ? 'text-right' : 'text-left'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-3">
            {isQuoting ? (
              <div className="space-y-3 p-3 bg-brand-primary/5 rounded-xl border border-brand-primary/20 animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-primary font-bold">RWF</span>
                    <input
                      type="number"
                      value={quotePrice}
                      onChange={(e) => setQuotePrice(e.target.value)}
                      placeholder="Enter total price..."
                      className="w-full bg-white border-brand-primary/30 rounded-lg pl-12 pr-4 py-2 text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                    />
                  </div>
                  <Button onClick={handleSendQuote} disabled={!quotePrice || isSending} loading={isSending}>
                    Send Official Quote
                  </Button>
                </div>
                {currentDeliveryFee > 0 && (
                  <p className="text-[10px] text-brand-primary/70">
                    + {currentDeliveryFee.toLocaleString()} RWF delivery fee will be added
                  </p>
                )}
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Add a note to your quote (optional)..."
                  className="w-full bg-transparent border-none p-0 text-xs text-text-secondary outline-none italic"
                />
              </div>
            ) : isCountering ? (
              <div className="space-y-3 p-3 bg-amber-50 rounded-xl border border-amber-200 animate-in slide-in-from-bottom-2 duration-300">
                <p className="text-xs font-bold text-amber-700 uppercase">Propose Your Price</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold">RWF</span>
                    <input
                      type="number"
                      value={counterPrice}
                      onChange={(e) => setCounterPrice(e.target.value)}
                      placeholder="Your proposed price..."
                      className="w-full bg-white border-amber-300 rounded-lg pl-12 pr-4 py-2 text-sm focus:ring-2 focus:ring-amber-300/20 outline-none"
                    />
                  </div>
                  <Button onClick={handleCounterOffer} disabled={!counterPrice || isSending} loading={isSending}>
                    Send Counter
                  </Button>
                </div>
                <input
                  type="text"
                  value={counterNote}
                  onChange={(e) => setCounterNote(e.target.value)}
                  placeholder="Explain your counter-offer (optional)..."
                  className="w-full bg-transparent border-none p-0 text-xs text-text-secondary outline-none italic"
                />
              </div>
            ) : (
              <>
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleSendMessage(newMessage); }} 
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand-primary/20 transition-all outline-none"
                  />
                  <Button 
                    type="submit" 
                    disabled={isSending || !newMessage.trim()}
                    loading={isSending}
                    size="sm"
                  >
                    Send
                  </Button>
                </form>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageUpload 
                      onUploadSuccess={(url) => handleSendMessage('', url)}
                      service="order"
                      endpoint={`/orders/upload-image`}
                      label="Attach Photo"
                      compact
                    />
                  </div>
                  <p className="text-[10px] text-text-secondary italic">Ask for clarifications or send updates</p>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
