'use client';
import React, { useEffect, useState, useRef } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/hooks/useSocket';
import { riderApi, deliveryApi, walletApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { QrReader } from 'react-qr-reader';

export default function RiderDashboardPage() {
  const { user } = useAuth();
  const { data: profile, execute: fetchProfile } = useApi(riderApi, 'get', '/riders/me');
  const { data: activeDelivery, execute: fetchActiveDelivery } = useApi(deliveryApi, 'get', '/deliveries/active');
  const { data: wallet } = useApi(walletApi, 'get', '/wallets/me');

  const [isActive, setIsActive] = useState(false);
  const [incomingDelivery, setIncomingDelivery] = useState<any>(null);
  const [timer, setTimer] = useState(60);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket for incoming assignments
  const { data: assignmentData } = useSocket(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008', 'delivery:assigned', localStorage.getItem('accessToken') || undefined);

  useEffect(() => {
    fetchProfile();
    fetchActiveDelivery();
  }, [fetchProfile, fetchActiveDelivery]);

  // Handle Incoming WebSockets
  useEffect(() => {
    if (assignmentData) {
      setIncomingDelivery(assignmentData);
      setTimer(60);
      
      const i = setInterval(() => {
        setTimer(t => {
          if (t <= 1) {
            clearInterval(i);
            setIncomingDelivery(null); // Auto-reject
            deliveryApi.patch(`/deliveries/${assignmentData._id}/reject`);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => clearInterval(i);
    }
  }, [assignmentData]);

  // GPS Tracking logic
  useEffect(() => {
    if (isActive) {
      const watchId = navigator.geolocation.watchPosition(
        pos => {
          riderApi.patch('/riders/me/location', { lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        err => console.error(err),
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isActive]);

  const toggleActive = () => {
    if (!isActive) {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          await riderApi.patch('/riders/me/status', { isActive: true, location: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
          setIsActive(true);
          toast.success("You are now active and visible to the market.");
        },
        () => toast.error("Location access is required to go active.")
      );
    } else {
      riderApi.patch('/riders/me/status', { isActive: false }).then(() => setIsActive(false));
    }
  };

  const acceptDelivery = async () => {
    try {
      await deliveryApi.patch(`/deliveries/${incomingDelivery._id}/accept`);
      setIncomingDelivery(null);
      fetchActiveDelivery();
      toast.success('Delivery accepted!');
    } catch (e) {
      toast.error('Failed to accept delivery');
    }
  };

  // Delivery Execution States
  const [photoUrl, setPhotoUrl] = useState('');
  const [showQrScanner, setShowQrScanner] = useState(false);

  const completePickup = async (stallId: string) => {
    try {
      await deliveryApi.post(`/deliveries/${activeDelivery._id}/scan-qr`, { stallId });
      setShowQrScanner(false);
      fetchActiveDelivery();
      toast.success('Package picked up!');
    } catch (e) {
      toast.error('Invalid QR code for this stall');
    }
  };

  const completeDelivery = async () => {
    try {
      await deliveryApi.patch(`/deliveries/${activeDelivery._id}/complete`);
      fetchActiveDelivery();
      toast.success('Delivery completed successfully! Earnings added.');
    } catch (e) {
      toast.error('Failed to complete delivery');
    }
  };

  if (profile && !profile.isApproved) {
    return <Layout><div className="p-20 text-center"><h1 className="text-2xl font-bold">Profile Pending Approval</h1></div></Layout>;
  }

  return (
    <Layout>
      {/* Incoming Delivery Modal */}
      {incomingDelivery && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm border-2 border-primary animate-pulse">
            <h2 className="text-xl font-bold mb-2">New Delivery Request!</h2>
            <div className="space-y-2 mb-6">
              <p className="text-sm"><strong>From:</strong> {incomingDelivery.pickup.marketName}</p>
              <p className="text-sm"><strong>To:</strong> Customer Location</p>
              <p className="text-lg font-bold text-primary">Fee: {incomingDelivery.fee} RWF</p>
            </div>
            
            <div className="w-full bg-border h-2 rounded mb-4 overflow-hidden">
              <div className="bg-primary h-full transition-all duration-1000 linear" style={{ width: `${(timer/60)*100}%` }}></div>
            </div>
            
            <div className="flex gap-4">
              <Button variant="outline" fullWidth onClick={() => { setIncomingDelivery(null); deliveryApi.patch(`/deliveries/${incomingDelivery._id}/reject`); }}>Reject</Button>
              <Button fullWidth onClick={acceptDelivery}>Accept ({timer}s)</Button>
            </div>
          </Card>
        </div>
      )}

      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold text-text-primary">Rider Terminal</h1>
            <p className="text-text-secondary">{profile?.plateNumber} • ⭐ {profile?.rating || 'New'}</p>
          </div>
          <button 
            className={`px-6 py-3 rounded-full font-bold text-white transition-colors ${isActive ? 'bg-status-success' : 'bg-text-secondary'}`}
            onClick={toggleActive}
          >
            {isActive ? '● ONLINE' : '○ OFFLINE'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="md:col-span-1 bg-background-surface">
            <p className="text-sm text-text-secondary mb-1">Today's Earnings</p>
            <p className="text-3xl font-bold text-primary">{wallet?.balance?.toLocaleString() || 0} RWF</p>
          </Card>
        </div>

        {/* Active Delivery UI */}
        {activeDelivery ? (
          <Card className="border-2 border-primary">
            <h2 className="text-xl font-bold mb-4">Current Mission: {activeDelivery.status.replace('_', ' ').toUpperCase()}</h2>
            
            {activeDelivery.status === 'assigned' && (
              <div className="space-y-4">
                <p><strong>Pickup at:</strong> {activeDelivery.market.name} (Stall: {activeDelivery.stallId})</p>
                <div className="p-4 border border-border rounded-lg">
                  <h3 className="font-bold mb-2">Step 1: Take Photo of Package</h3>
                  <ImageUpload 
                    label="Capture package condition" 
                    service="delivery" 
                    capture="environment"
                    endpoint={`/deliveries/${activeDelivery._id}/pickup-photo`} 
                    onUploadSuccess={url => setPhotoUrl(url)} 
                  />
                  <div className="mt-4">
                    <Button 
                      fullWidth 
                      disabled={!photoUrl} 
                      onClick={() => setShowQrScanner(true)}
                    >
                      Step 2: Scan Seller QR Code
                    </Button>
                    {!photoUrl && <p className="text-xs text-status-error text-center mt-2">You must photograph the package first</p>}
                  </div>
                </div>

                {showQrScanner && (
                  <div className="mt-4 border-2 border-primary rounded overflow-hidden">
                    <QrReader
                      onResult={(result, error) => {
                        if (result) {
                          const text = result.getText();
                          // Expected format: marketrwanda:stall:ST-123
                          if (text.startsWith('marketrwanda:stall:')) {
                            const stallId = text.split(':')[2];
                            completePickup(stallId);
                          }
                        }
                      }}
                      constraints={{ facingMode: 'environment' }}
                    />
                  </div>
                )}
              </div>
            )}

            {activeDelivery.status === 'in_transit' && (
              <div className="space-y-4 text-center py-6">
                <span className="text-6xl block mb-4">📍</span>
                <p className="text-lg">Proceed to Customer Location</p>
                <p className="text-text-secondary mb-6">GPS Tracking is active and transmitting.</p>
                <Button size="lg" fullWidth onClick={completeDelivery}>Confirm Delivery Completed</Button>
              </div>
            )}
          </Card>
        ) : (
          <Card className="text-center py-20">
            <span className="text-6xl block mb-4 opacity-50">🛵</span>
            <p className="text-text-secondary">
              {isActive ? 'Waiting for delivery requests in your area...' : 'Go ONLINE to start receiving delivery requests.'}
            </p>
          </Card>
        )}
      </div>
    </Layout>
  );
}
