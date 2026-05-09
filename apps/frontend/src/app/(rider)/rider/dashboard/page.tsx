'use client';
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/hooks/useSocket';
import { riderApi, deliveryApi, walletApi, orderApi } from '@/lib/api';
import { ReceiptView, type ReceiptOrder } from '@/components/ui/ReceiptView';
import toast from 'react-hot-toast';
import { QrReader } from 'react-qr-reader';
import dynamic from 'next/dynamic';

const DeliveryMap = dynamic(
  () => import('@/components/ui/DeliveryMap').then((mod) => mod.DeliveryMap),
  { ssr: false, loading: () => <div className="w-full h-64 bg-background-surface animate-pulse rounded-xl mb-6"></div> }
);

const StableScanner = ({ onResult, stallId }: { onResult: (stallId: string) => void, stallId: string }) => {
  return (
    <div className="mt-4 border-2 border-primary rounded overflow-hidden relative min-h-[300px] bg-black">
      <QrReader
        onResult={(result, error) => {
          if (result) {
            const text = result.getText();
            if (text.startsWith('marketrwanda:stall:')) {
              const scannedStallId = text.split(':')[2];
              onResult(scannedStallId);
            }
          }
        }}
        constraints={{ facingMode: 'environment' }}
        containerStyle={{ width: '100%' }}
      />
      <div className="absolute bottom-4 left-0 right-0 px-4">
        <Button fullWidth onClick={() => onResult(stallId)} variant="primary">
          Bypass QR Scan (Dev Mode)
        </Button>
      </div>
    </div>
  );
};

const ChatCard = ({ deliveryId, userName }: { deliveryId: string, userName: string }) => {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const { data: socketMsg } = useSocket(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008', `delivery:${deliveryId}:chat`);
  const { emit } = useSocket(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008', `__dummy__`);

  useEffect(() => {
    if (socketMsg) {
      setChatHistory((prev) => [...prev, socketMsg]);
    }
  }, [socketMsg]);

  const sendMessage = () => {
    if (!message.trim() || !deliveryId) return;
    emit('chat:message', {
      deliveryId,
      senderId: 'rider',
      senderName: userName,
      text: message
    });
    setMessage('');
  };

  return (
    <Card className="flex flex-col h-[300px] mt-6 border-t-4 border-primary">
      <h3 className="font-bold mb-2 flex items-center gap-2">
        <span className="w-2 h-2 bg-status-success rounded-full animate-pulse"></span>
        Customer Messages
      </h3>
      <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-2 scrollbar-thin text-sm">
        {chatHistory.length === 0 ? (
          <div className="text-center py-6 text-text-secondary italic">No messages yet.</div>
        ) : (
          chatHistory.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.senderId === 'rider' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] p-2 rounded-lg ${msg.senderId === 'rider' ? 'bg-primary text-white rounded-br-none' : 'bg-background-surface text-text-primary rounded-bl-none border border-border'}`}>
                {msg.text || msg.message}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input 
          type="text" 
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Reply to customer..." 
          className="flex-1 bg-background-surface border border-border rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        />
        <Button size="sm" onClick={sendMessage} disabled={!deliveryId}>Send</Button>
      </div>
    </Card>
  );
};

export default function RiderDashboardPage() {
  const { user } = useAuth();
  const { data: profile, execute: fetchProfile } = useApi(riderApi, 'get', `/riders/me?userId=${user?.id}`);
  const { data: activeDelivery, execute: fetchActiveDelivery } = useApi(deliveryApi, 'get', `/deliveries/active?userId=${user?.id}`);
  const { data: availableDeliveriesData, execute: fetchAvailable } = useApi(deliveryApi, 'get', '/deliveries/available');
  const { data: history, execute: fetchHistory } = useApi(deliveryApi, 'get', `/deliveries/history?userId=${user?.id}`);
  const { data: wallet } = useApi(walletApi, 'get', `/wallets/me?userId=${user?.id}`);

  const [view, setView] = useState<'live' | 'available' | 'history'>('live');
  const [receiptOrder, setReceiptOrder] = useState<{ order: ReceiptOrder; delivery?: any } | null>(null);
  const [orderCache, setOrderCache] = useState<Record<string, any>>({});

  const [isActive, setIsActive] = useState(false);
  const [incomingDelivery, setIncomingDelivery] = useState<any>(null);
  const [timer, setTimer] = useState(60);
  const [photoUrl, setPhotoUrl] = useState('');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [riderLocation, setRiderLocation] = useState<{ lat: number, lng: number } | null>(null);

  // WebSockets for assignment and location broadcasting
  const { data: assignmentData, emit: emitSocket } = useSocket(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008', 'delivery:assigned', localStorage.getItem('accessToken') || undefined);

  const hasFetched = useRef(false);
  useEffect(() => {
    if (user?.id && !hasFetched.current) {
      fetchProfile();
      fetchActiveDelivery();
      fetchAvailable();
      fetchHistory();
      hasFetched.current = true;
    }
  }, [user?.id, fetchProfile, fetchActiveDelivery, fetchAvailable, fetchHistory]);

  // Fetch order data for receipt views
  useEffect(() => {
    if (!history || !Array.isArray(history)) return;
    
    history.forEach((h: any) => {
      if (h.orderId && !orderCache[h.orderId]) {
        orderApi.get(`/orders/${h.orderId}`)
          .then(res => {
            if (res.data?.data) {
              setOrderCache(prev => ({ ...prev, [h.orderId]: res.data.data }));
            }
          })
          .catch(() => {});
      }
    });
  }, [history]); // Only depend on history

  const openReceiptFromDelivery = async (delivery: any) => {
    try {
      let orderData = delivery.orderId ? orderCache[delivery.orderId] : null;
      if (!orderData && delivery.orderId) {
        const res = await orderApi.get(`/orders/${delivery.orderId}`);
        orderData = res.data?.data;
        if (orderData) setOrderCache(prev => ({ ...prev, [delivery.orderId]: orderData }));
      }
      if (orderData) {
        setReceiptOrder({
          order: { ...orderData, delivery: { rider: delivery.rider, status: delivery.status, route: delivery.route } },
          delivery,
        });
      } else {
        // Minimal receipt from delivery data alone
        setReceiptOrder({
          order: {
            _id: delivery.orderId || delivery._id,
            orderNumber: delivery.orderNumber,
            status: delivery.status,
            buyer: { fullName: 'N/A', phone: '' },
            seller: { fullName: delivery.pickup?.stallId || 'Market', stallId: delivery.pickup?.stallId || '' },
            financials: { subtotal: 0, deliveryFee: 0, platformCommission: 0, gatewayFee: 0, totalAmount: 0, sellerPayout: 0, riderPayout: 0 },
            delivery: { rider: delivery.rider, status: delivery.status, route: delivery.route },
          },
          delivery,
        });
      }
    } catch {
      // continue
    }
  };

  // Handle Incoming WebSockets
  useEffect(() => {
    if (assignmentData) {
      fetchAvailable();
      toast('New delivery request available!', { icon: '📦' });
    }
  }, [assignmentData, fetchAvailable]);

  // GPS Tracking logic
  useEffect(() => {
    if (isActive) {
      const watchId = navigator.geolocation.watchPosition(
        pos => {
          const locationData = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setRiderLocation(locationData);
          riderApi.patch('/riders/me/location', { ...locationData, userId: user?.id });
          emitSocket('rider:location:update', {
            riderId: user?.id,
            ...locationData,
            marketId: profile?.marketId || 'default'
          });

          // Also emit to private delivery tracking channel if on a task
          if (activeDelivery?._id) {
            emitSocket('delivery:tracking:update', {
              deliveryId: activeDelivery._id,
              ...locationData
            });
          }
        },
        err => console.error(err),
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isActive, user?.id, emitSocket, profile?.marketId]);

  const toggleActive = () => {
    if (!isActive) {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const locationData = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setRiderLocation(locationData);
          await riderApi.patch('/riders/me/status', { isActive: true, location: locationData, userId: user?.id });
          setIsActive(true);
          emitSocket('rider:location:update', {
            riderId: user?.id,
            ...locationData,
            marketId: profile?.marketId || 'default'
          });
          toast.success("You are now active!");
        },
        () => toast.error("Location access is required.")
      );
    } else {
      riderApi.patch('/riders/me/status', { isActive: false, userId: user?.id }).then(() => setIsActive(false));
    }
  };

  const acceptDelivery = async (deliveryId: string) => {
    try {
      await deliveryApi.patch(`/deliveries/${deliveryId}/accept`, { riderId: user?.id });
      fetchActiveDelivery();
      fetchAvailable();
      setView('live');
      toast.success('Delivery accepted! Head to the store.');
    } catch (e) {
      toast.error('Failed to accept delivery (maybe taken by someone else)');
      fetchAvailable();
    }
  };

  const cancelDelivery = async () => {
    try {
      await deliveryApi.patch(`/deliveries/${activeDelivery._id}/reject`);
      fetchActiveDelivery();
      fetchAvailable();
      toast.success('Delivery cancelled and re-broadcasted.');
    } catch (e) {
      toast.error('Failed to cancel delivery');
    }
  };

  const confirmHandover = async (deliveryId: string) => {
    try {
      await deliveryApi.post(`/deliveries/${deliveryId}/handover`, { role: 'rider' });
      toast.success('Receipt confirmed! Waiting for seller to confirm handover.');
      fetchActiveDelivery();
    } catch (e) {
      toast.error('Failed to confirm handover');
    }
  };

  const completeDelivery = async () => {
    try {
      await deliveryApi.patch(`/deliveries/${activeDelivery._id}/complete`);
      fetchActiveDelivery();
      toast.success('Delivery completed! Earnings added.');
    } catch (e) {
      toast.error('Failed to complete delivery');
    }
  };

  if (!profile) {
    return (
      <Layout>
        <div className="p-20 text-center">
          <span className="text-6xl mb-4 block">🛵</span>
          <h1 className="text-2xl font-bold mb-4">Welcome to Rwanda Market Delivery</h1>
          <p className="text-text-secondary mb-6">Register to start earning.</p>
          <Link href="/rider/register">
            <Button size="lg">Start Registration</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  if (profile && !profile.isApproved) {
    return (
      <Layout>
        <div className="p-20 text-center">
          <h1 className="text-2xl font-bold">Profile Pending Approval</h1>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col md:flex-row min-h-screen bg-background-main">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-background-card border-r border-border p-6 hidden md:block">
          <div className="mb-8">
            <h2 className="font-heading font-bold text-xl">{profile?.fullName || 'Rider'}</h2>
            <p className="text-sm text-text-secondary">{profile?.plateNumber || 'No Vehicle'}</p>
          </div>
          <nav className="space-y-2">
            <button 
              onClick={() => setView('live')}
              className={`w-full text-left px-4 py-2 rounded-lg font-medium ${view === 'live' ? 'bg-primary/10 text-primary font-bold' : 'text-text-secondary hover:bg-background-surface'}`}
            >
              Active Task
            </button>
            <button 
              onClick={() => { fetchAvailable(); setView('available'); }}
              className={`w-full text-left flex justify-between items-center px-4 py-2 rounded-lg font-medium ${view === 'available' ? 'bg-primary/10 text-primary font-bold' : 'text-text-secondary hover:bg-background-surface'}`}
            >
              <span>Available Tasks</span>
              {availableDeliveriesData?.length > 0 && (
                <span className="bg-status-error text-white text-xs px-2 py-0.5 rounded-full">{availableDeliveriesData.length}</span>
              )}
            </button>
            <button 
              onClick={() => setView('history')}
              className={`w-full text-left px-4 py-2 rounded-lg font-medium ${view === 'history' ? 'bg-primary/10 text-primary font-bold' : 'text-text-secondary hover:bg-background-surface'}`}
            >
              Task History
            </button>
            <Link href="/rider/earnings" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Financial Overview</Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8">

          {receiptOrder && (
            <ReceiptView order={receiptOrder.order} role="rider" onClose={() => setReceiptOrder(null)} />
          )}

          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-heading font-bold text-text-primary">Rider Terminal</h1>
            <button 
              className={`px-6 py-2 rounded-full font-bold text-white transition-colors ${isActive ? 'bg-status-success' : 'bg-text-secondary'}`}
              onClick={toggleActive}
            >
              {isActive ? '● ONLINE' : '○ OFFLINE'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-background-surface">
              <p className="text-sm text-text-secondary mb-1">Current Balance</p>
              <p className="text-2xl font-bold text-primary">{wallet?.balance?.toLocaleString() || 0} RWF</p>
            </Card>
          </div>

          {view === 'live' ? (
            activeDelivery ? (
              <Card className="border-2 border-primary">
                {/* ... existing header ... */}
                <div className="flex justify-between items-start mb-6 pb-6 border-b border-border">
                  <div>
                    <span className="text-xs font-bold uppercase text-primary tracking-wider mb-1 block">Active Delivery</span>
                    <h2 className="text-xl font-bold">#{activeDelivery._id.substring(0,8).toUpperCase()}</h2>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-text-secondary">Status: {activeDelivery.status.replace(/_/g, ' ').toUpperCase()}</p>
                      {(activeDelivery.status === 'assigned' || activeDelivery.status === 'en_route_to_pickup') && (
                        <button onClick={cancelDelivery} className="text-xs text-status-error underline ml-2 hover:text-status-error/80">Cancel Request</button>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-text-secondary">Your Earnings</p>
                    <p className="text-lg font-bold text-primary">{(activeDelivery.financials?.riderPayout || 0).toLocaleString()} RWF</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => openReceiptFromDelivery(activeDelivery)}>🧾 Receipt</Button>
                  </div>
                </div>

                {riderLocation && (
                  <div className="h-72 w-full mb-6 relative">
                    <DeliveryMap 
                      riderLocation={riderLocation}
                      pickupLocation={activeDelivery.pickup?.coordinates}
                      dropoffLocation={activeDelivery.dropoff?.coordinates}
                      status={activeDelivery.status}
                      routeGeometry={activeDelivery.route?.geometry}
                    />
                    <button 
                      onClick={() => {
                        navigator.geolocation.getCurrentPosition(
                          pos => setRiderLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                          err => toast.error("GPS Signal Weak"),
                          { enableHighAccuracy: true }
                        );
                      }}
                      className="absolute bottom-4 right-4 z-[400] bg-white p-2 rounded-full shadow-lg border border-border hover:bg-background-surface active:scale-95 transition-all"
                      title="Recenter on My Location"
                    >
                      🎯
                    </button>
                    <div className="absolute top-4 left-4 z-[400] bg-status-success/90 backdrop-blur text-white text-[10px] px-2 py-1 rounded shadow-md font-bold animate-pulse">
                      LIVE GPS ACTIVE
                    </div>
                  </div>
                )}

                {(activeDelivery.status === 'assigned' || activeDelivery.status === 'en_route_to_pickup') && (
                  <div className="space-y-6">
                    <div className="bg-background-surface p-4 rounded-lg border border-border">
                    <h3 className="font-bold mb-1">Pickup at {activeDelivery.pickup?.stallId || 'Stall'}</h3>
                    <p className="text-sm text-text-secondary">{activeDelivery.pickup?.address || 'Market Location'}</p>
                    {activeDelivery.notes && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Customer Notes</p>
                        <p className="text-sm italic text-gray-700">"{activeDelivery.notes}"</p>
                      </div>
                    )}
                  </div>

                    <div className="space-y-4">
                      <h3 className="font-bold">Handover Steps:</h3>
                      <ImageUpload 
                        onUploadSuccess={(url) => setPhotoUrl(url)} 
                        service="delivery"
                        endpoint={`/deliveries/${activeDelivery._id}/pickup-photo`}
                        label="1. Photo of goods"
                        capture="environment"
                      />
                      
                      <Button 
                        size="lg" 
                        fullWidth 
                        disabled={!photoUrl} 
                        onClick={() => setShowQrScanner(true)}
                      >
                        2. Scan Seller QR
                      </Button>
                    </div>

                    {showQrScanner && (
                      <StableScanner 
                        onResult={async (stallId) => {
                          try {
                            await deliveryApi.post(`/deliveries/${activeDelivery._id}/scan-qr`, { stallId, photoUrl });
                            toast.success('QR Scanned! Now confirm the condition.');
                            setShowQrScanner(false);
                            fetchActiveDelivery();
                          } catch (e) {
                            toast.error('Invalid QR code');
                          }
                        }} 
                        stallId={activeDelivery.pickup?.stallId} 
                      />
                    )}
                  </div>
                )}

                {activeDelivery.status === 'pending_handover' && (
                  <div className="space-y-6 py-4">
                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 text-center">
                      <p className="font-bold text-primary mb-2">Awaiting Handover Confirmation</p>
                      <p className="text-sm text-text-secondary">Please inspect the items carefully. Once satisfied, click below to confirm receipt.</p>
                      {activeDelivery.pickup?.sellerConfirmed && (
                        <p className="text-xs text-status-success font-bold mt-2">✅ Seller has already confirmed handover</p>
                      )}
                    </div>
                    <Button size="lg" fullWidth onClick={() => confirmHandover(activeDelivery._id)}>
                      {activeDelivery.pickup?.riderConfirmed ? 'Waiting for Seller...' : 'Confirm Receipt & Start Trip'}
                    </Button>
                  </div>
                )}

                {(activeDelivery.status === 'picked_up' || activeDelivery.status === 'en_route_to_dropoff') && (
                  <div className="space-y-4 text-center py-6">
                    <span className="text-6xl block mb-4">📍</span>
                    <p className="text-lg font-bold">En Route to Drop-off</p>
                    <p className="text-text-secondary mb-2">{activeDelivery.dropoff?.address || 'Customer Address'}</p>
                    {activeDelivery.notes && (
                      <div className="max-w-md mx-auto mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-left">
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Customer Notes</p>
                        <p className="text-sm italic text-gray-700">"{activeDelivery.notes}"</p>
                      </div>
                    )}
                    <Button size="lg" fullWidth onClick={completeDelivery}>Arrived & Handed Over</Button>
                  </div>
                )}

                <ChatCard deliveryId={activeDelivery._id} userName={profile?.fullName || 'Rider'} />
              </Card>
            ) : (
              <Card className="text-center py-20">
                <span className="text-6xl block mb-4 opacity-50">🛵</span>
                <p className="text-text-secondary mb-4">
                  {isActive ? 'You have no active tasks right now.' : 'Go ONLINE to start receiving requests.'}
                </p>
                {isActive && (
                  <Button variant="outline" onClick={() => { fetchAvailable(); setView('available'); }}>View Available Tasks</Button>
                )}
              </Card>
            )
          ) : view === 'available' ? (
            <Card noPadding>
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h2 className="text-lg font-bold">Available Tasks</h2>
                <Button size="sm" variant="outline" onClick={() => fetchAvailable()}>Refresh</Button>
              </div>
              <div className="divide-y divide-border">
                {!availableDeliveriesData || availableDeliveriesData.length === 0 ? (
                  <div className="p-8 text-center text-text-secondary">No available tasks right now. Check back soon.</div>
                ) : (
                  availableDeliveriesData.map((d: any) => (
                    <div key={d._id} className="p-4 hover:bg-background-surface transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <p className="font-bold">From: {d.pickup?.marketName || 'Market'} <span className="text-text-secondary text-sm font-normal">({d.pickup?.address})</span></p>
                        <p className="text-sm text-text-secondary mt-1">To: {d.dropoff?.address}</p>
                        <p className="text-xs text-text-secondary mt-1">Est. Distance: {d.route?.distanceKm?.toFixed(1) || '?'} km</p>
                      </div>
                      <div className="text-left md:text-right w-full md:w-auto flex flex-col items-start md:items-end gap-2">
                        <p className="font-bold text-primary text-xl">{d.fee} RWF</p>
                        <Button size="sm" onClick={() => acceptDelivery(d._id)} disabled={!!activeDelivery}>
                          {activeDelivery ? 'Finish active task first' : 'Accept Request'}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          ) : (
            <Card noPadding>
              <div className="p-6 border-b border-border">
                <h2 className="text-lg font-bold">Delivery History</h2>
              </div>
              <div className="divide-y divide-border">
                {!history || history.length === 0 ? (
                  <div className="p-8 text-center text-text-secondary">No completed deliveries found.</div>
                ) : (
                  history.map((h: any) => (
                    <div key={h._id} className="p-4 hover:bg-background-surface transition-colors flex justify-between items-center">
                      <div>
                        <p className="font-bold">#{h._id.substring(0,8).toUpperCase()}</p>
                        <p className="text-xs text-text-secondary">{new Date(h.createdAt).toLocaleDateString()} • {h.dropoff?.address}</p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="font-bold text-primary">+{h.financials?.riderPayout?.toLocaleString()} RWF</p>
                          <p className="text-[10px] uppercase text-status-success font-bold">Completed</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openReceiptFromDelivery(h)}>🧾</Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}
        </main>
      </div>
    </Layout>
  );
}
