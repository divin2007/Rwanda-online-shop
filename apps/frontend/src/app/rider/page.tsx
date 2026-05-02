'use client';
import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Mock data
const MOCK_METRICS = {
  rating: 4.9,
  deliveriesToday: 14,
  earningsToday: 12500, // Post 10% commission
  rejectionRate: '2%'
};

export default function RiderDashboard() {
  const [isActive, setIsActive] = useState(false);
  const [activeDelivery, setActiveDelivery] = useState<any>(null);
  const [photoVerified, setPhotoVerified] = useState(false);
  
  // Simulated incoming order
  useEffect(() => {
    if (isActive && !activeDelivery) {
      const timer = setTimeout(() => {
        setActiveDelivery({
          id: 'DEL-8899',
          orderId: 'ORD-1235',
          status: 'assigned',
          fee: 1500,
          pickup: 'Kimironko Market, Stall KIM-047',
          dropoff: 'Kigali Heights, Floor 2',
          distance: '4.2 km',
          timeRemaining: 60 // 60s to accept
        });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isActive, activeDelivery]);

  const toggleActive = () => {
    if (!isActive) {
      // Stub: Real app would request navigator.geolocation.getCurrentPosition()
      if (confirm('RMF needs your GPS location to match you with orders. Allow?')) {
        setIsActive(true);
      }
    } else {
      setIsActive(false);
      setActiveDelivery(null);
    }
  };

  const handleAccept = () => {
    setActiveDelivery({ ...activeDelivery, status: 'en_route_to_pickup' });
  };

  const simulatePhotoUpload = () => {
    setPhotoVerified(true);
    alert('Photo uploaded successfully. You may now scan the stall QR code.');
  };

  const simulateQRScan = () => {
    if (!photoVerified) {
      alert('ERROR: You must take a photo of the packaged goods before scanning the QR code.');
      return;
    }
    setActiveDelivery({ ...activeDelivery, status: 'in_transit' });
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-heading font-bold text-text-primary">Rider App</h1>
          
          <button 
            onClick={toggleActive}
            className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${isActive ? 'bg-status-success' : 'bg-gray-300'}`}
            role="switch"
            aria-checked={isActive}
          >
            <span className="sr-only">Toggle Active Status</span>
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isActive ? 'translate-x-6' : 'translate-x-0'}`}
            />
          </button>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card className="text-center">
            <p className="text-xs text-text-secondary uppercase tracking-wider font-bold mb-1">Today's Earnings</p>
            <p className="text-xl font-bold text-text-primary">{MOCK_METRICS.earningsToday} RWF</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-text-secondary uppercase tracking-wider font-bold mb-1">Deliveries</p>
            <p className="text-xl font-bold text-text-primary">{MOCK_METRICS.deliveriesToday}</p>
          </Card>
        </div>

        {/* Insurance Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm text-blue-800 flex justify-between items-center">
          <span>Weekly Insurance (500 RWF)</span>
          <span className="font-bold text-status-success">Paid</span>
        </div>

        {!isActive ? (
          <div className="text-center py-12 px-4 border-2 border-dashed border-border rounded-lg bg-background-surface">
            <div className="text-4xl mb-4">😴</div>
            <h3 className="text-lg font-bold text-text-primary mb-2">You are offline</h3>
            <p className="text-sm text-text-secondary">Toggle your status to Active to start receiving delivery requests.</p>
          </div>
        ) : !activeDelivery ? (
          <div className="text-center py-12 px-4 border border-status-info/30 rounded-lg bg-status-info/5 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <div className="w-32 h-32 rounded-full border-4 border-status-info animate-ping"></div>
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-full bg-status-info text-white flex items-center justify-center mx-auto mb-4 animate-bounce">
                📡
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Looking for orders</h3>
              <p className="text-sm text-text-secondary">Your location is visible to buyers.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* New Order Request */}
            {activeDelivery.status === 'assigned' && (
              <Card className="border-primary ring-2 ring-primary/50 animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gray-200">
                  <div className="h-full bg-status-error" style={{ width: '100%', transition: 'width 60s linear' }}></div>
                </div>
                <div className="flex justify-between items-start mb-4 mt-2">
                  <h3 className="font-bold text-lg">New Request!</h3>
                  <span className="text-xl font-bold text-status-success">+{activeDelivery.fee} RWF</span>
                </div>
                <div className="space-y-2 text-sm mb-6">
                  <div className="flex gap-2">
                    <span className="font-bold">From:</span>
                    <span>{activeDelivery.pickup}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-bold">To:</span>
                    <span>{activeDelivery.dropoff}</span>
                  </div>
                  <div className="flex gap-2 text-text-secondary">
                    <span>Est. Distance: {activeDelivery.distance}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setActiveDelivery(null)}>Reject</Button>
                  <Button variant="primary" className="flex-1" onClick={handleAccept}>Accept</Button>
                </div>
              </Card>
            )}

            {/* Active Delivery Flow */}
            {['en_route_to_pickup', 'picked_up', 'in_transit'].includes(activeDelivery.status) && (
              <Card>
                <div className="flex items-center justify-between mb-4 border-b border-border pb-4">
                  <h3 className="font-bold text-lg text-primary">{activeDelivery.id}</h3>
                  <span className="text-sm font-bold text-status-info bg-status-info/10 px-2 py-1 rounded">
                    {activeDelivery.status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>

                {activeDelivery.status === 'en_route_to_pickup' && (
                  <div className="space-y-4">
                    <p className="text-sm">Head to <strong className="text-text-primary">{activeDelivery.pickup}</strong></p>
                    
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm text-yellow-800">
                      <strong>Required:</strong> You must take a photo of the packaged goods before scanning the stall QR code.
                    </div>
                    
                    <Button 
                      fullWidth 
                      variant={photoVerified ? 'outline' : 'primary'} 
                      onClick={simulatePhotoUpload}
                      disabled={photoVerified}
                    >
                      {photoVerified ? '✓ Photo Captured' : '1. Take Photo of Package'}
                    </Button>
                    
                    <Button 
                      fullWidth 
                      variant={photoVerified ? 'primary' : 'outline'}
                      onClick={simulateQRScan}
                    >
                      2. Scan Stall QR Code
                    </Button>
                  </div>
                )}

                {activeDelivery.status === 'in_transit' && (
                  <div className="space-y-4">
                    <div className="h-40 bg-gray-200 rounded flex items-center justify-center border border-border">
                      <span className="text-text-secondary font-medium">[Live Navigation Map]</span>
                    </div>
                    <p className="text-sm">Deliver to <strong className="text-text-primary">{activeDelivery.dropoff}</strong></p>
                    <Button 
                      fullWidth 
                      onClick={() => {
                        setActiveDelivery(null);
                        alert(`Delivery Complete! You earned ${activeDelivery.fee} RWF.`);
                      }}
                    >
                      Confirm Drop-off
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
