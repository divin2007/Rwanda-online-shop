'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities */
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/hooks/useSocket';
import { riderApi, deliveryApi, walletApi } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import Link from 'next/link';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { RiderErrandsPanel } from '@/components/rider/RiderErrandsPanel';

const RiderMap = dynamic(() => import('@/components/ui/RiderMap').then(mod => mod.RiderMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-container-low rounded-lg" />,
});

const RIDER_LOCATION_HEARTBEAT_MS = 20000;
const AVAILABLE_DELIVERIES_REFRESH_MS = 10000;
const ACTIVE_DELIVERIES_REFRESH_MS = 10000;

export default function RiderDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  
  // Real Data Hooks
  const { data: profile, loading: profileLoading } = useApi(riderApi, 'get', `/riders/me?userId=${user?.id}`);
  const { data: statsData } = useApi(riderApi, 'get', `/riders/stats/${user?.id}`);
  const { data: deliveriesData, execute: fetchDeliveries } = useApi(deliveryApi, 'get', user?.id ? `/deliveries/rider/${user.id}?status=assigned,en_route_to_pickup,pending_handover,picked_up,en_route_to_dropoff` : '', { refreshInterval: ACTIVE_DELIVERIES_REFRESH_MS });
  const { data: availableData, execute: fetchAvailable } = useApi(deliveryApi, 'get', '/deliveries/available', { refreshInterval: AVAILABLE_DELIVERIES_REFRESH_MS });
  const { data: walletData } = useApi(walletApi, 'get', `/wallets/me?userId=${user?.id}`);

  // Track HTML5 Geolocation coordinates
  const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);

  // Initialize socket for live streaming
  const { data: liveDelivery, emit: emitSocket, isConnected: socketConnected } = useSocket<any>(
    process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008',
    'delivery:assigned'
  );

  // Keep riders in the live broadcast pool even when they are standing still.
  useEffect(() => {
    if (!socketConnected || !user?.id || !coords || !isOnline) return;

    const emitLocation = () => {
      emitSocket('rider:location:update', {
        riderId: user.id,
        lat: coords.lat,
        lng: coords.lng,
      });
    };

    emitLocation();
    const timer = window.setInterval(emitLocation, RIDER_LOCATION_HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [socketConnected, user?.id, coords, emitSocket, isOnline]);

  useEffect(() => {
    if (!liveDelivery?._id) return;
    fetchAvailable();
    toast.success('New delivery available nearby');
  }, [liveDelivery, fetchAvailable]);

  useEffect(() => {
    if (!profile) return;
    const fallbackCoords = {
      lat: Number(profile.currentLocation?.lat) || -1.9441,
      lng: Number(profile.currentLocation?.lng) || 30.0619,
    };

    // Set initial coordinates from database if they exist
    if (profile.currentLocation?.lat && profile.currentLocation?.lng) {
      setCoords({ lat: profile.currentLocation.lat, lng: profile.currentLocation.lng });
    } else {
      setCoords(fallbackCoords);
    }

    if (typeof window !== 'undefined' && navigator.geolocation) {
      const handleLocationSuccess = async (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lng: longitude });
        try {
          await riderApi.patch('/riders/me/location', {
            lat: latitude,
            lng: longitude,
            userId: user?.id,
          });
          emitSocket('rider:location:update', {
            riderId: user?.id,
            lat: latitude,
            lng: longitude,
          });
        } catch (err) {
          console.error('Failed to update live location on server:', err);
        }
      };

      const handleLocationError = (error: GeolocationPositionError) => {
        console.warn('High accuracy geolocation failed, trying low accuracy...', error.message);
        setCoords((current) => current || fallbackCoords);
        navigator.geolocation.getCurrentPosition(
          handleLocationSuccess,
          (err) => {
            console.error('Low accuracy geolocation fallback failed:', err.message);
            setCoords((current) => current || fallbackCoords);
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
        );
      };

      const watchId = navigator.geolocation.watchPosition(
        handleLocationSuccess,
        handleLocationError,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }

    setCoords((current) => current || fallbackCoords);
  }, [profile, user?.id, emitSocket]);

  const stats = statsData || { earnings: 0, completion: 100, rating: 5, drops: 0 };
  const activeDeliveries = deliveriesData || [];
  const availableDeliveries = availableData || [];
  const wallet = walletData || { balance: 0 };
  const canSelfCancel = (status: string) => ['assigned', 'en_route_to_pickup'].includes(status);

  const handleAccept = async (id: string) => {
    try {
      await deliveryApi.patch(`/deliveries/${id}/accept`, { riderId: user?.id });
      toast.success('Delivery accepted! Check your active deliveries.');
      fetchDeliveries();
      fetchAvailable();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to accept delivery');
    }
  };

  const handleReleaseDelivery = async (deliveryId: string) => {
    const reason = window.prompt('Why are you dropping this delivery? This will reduce your reliability score slightly.');
    if (reason === null) return;

    try {
      await deliveryApi.post(`/deliveries/${deliveryId}/rider-cancel`, {
        reason: reason.trim() || 'Rider cancelled from logistics dashboard',
      });
      toast.success('Delivery released and rebroadcast to other riders.');
      fetchDeliveries();
      fetchAvailable();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Could not release this delivery');
    }
  };

  const handleStatusToggle = () => {
    setIsOnline(!isOnline);
    toast.success(isOnline ? 'You are now offline.' : 'You are now online and accepting orders!');
  };

  if (profileLoading) {
    return (
      <Layout>
        <div className="p-20 text-center flex flex-col items-center justify-center space-y-lg min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-outline-variant border-t-primary rounded-full animate-spin"></div>
          <p className="font-label-caps text-label-caps text-on-surface-variant">Loading your dashboard...</p>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto py-20 text-center space-y-lg bg-surface-container-lowest border border-outline-variant rounded-lg p-xl mt-xl shadow-[0_8px_30px_rgba(27,28,28,0.03)]">
          <div className="w-16 h-16 bg-surface-container-low border border-outline-variant rounded-full flex items-center justify-center mx-auto text-primary">
            <span className="material-symbols-outlined text-3xl">two_wheeler</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Rider Profile Not Found</h1>
          <p className="text-body-md text-on-surface-variant max-w-md mx-auto">
            Your logistics rider account has not been initialized. Please complete registration to view real-time delivery orders.
          </p>
          <button 
            onClick={() => router.push('/rider/register')}
            className="bg-primary-container text-on-primary px-8 py-2.5 rounded font-label-caps text-label-caps hover:bg-primary transition-colors inline-block"
          >
            Register as Rider →
          </button>
        </div>
      </Layout>
    );
  }

  const currentTask = activeDeliveries[0];

  return (
    <Layout>
      <div className="p-gutter md:p-lg lg:p-xl space-y-lg bg-background min-h-screen">
        
        {/* Rider Hub Title Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md mb-xl border-b border-outline-variant pb-md">
          <div>
            <div className="flex items-center gap-xs mb-xs">
              <span className="font-label-caps text-[10px] text-primary border border-outline-variant rounded-full px-2 py-0.5 bg-surface-container-lowest uppercase">
                Shift Status
              </span>
              <button 
                onClick={handleStatusToggle} 
                className={`flex items-center gap-xs px-2 py-0.5 rounded-full font-label-caps text-[9px] font-bold border transition-colors ${
                  isOnline 
                    ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46] hover:bg-[#d1fae5]' 
                    : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b] hover:bg-[#fee2e2]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
              </button>
            </div>
            <h1 className="font-display-lg text-headline-lg md:text-display-lg font-bold text-on-surface leading-none">Rider Logistics Portal</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-unit">Live Operations Control Console</p>
          </div>
          
          <div className="flex items-center gap-sm bg-surface-container-lowest border border-outline-variant rounded px-md py-sm shadow-sm">
            <span className="material-symbols-outlined text-primary text-[20px]">satellite_alt</span>
            <span className="font-label-caps text-label-caps text-on-surface font-semibold">GPS Tracking Enabled</span>
          </div>
        </div>

        {/* Nearby Errands (Feature 4) */}
        <RiderErrandsPanel />

        {/* Dashboard Grid columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter lg:gap-lg h-full">
          
          {/* Left Column: Live Map & Active Order Panel */}
          <div className="lg:col-span-8 flex flex-col gap-gutter lg:gap-lg">
            
            {/* Live Map Area Card */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl flex flex-col overflow-hidden relative h-[400px] lg:h-[500px] shadow-[0_8px_30px_rgba(27,28,28,0.03)]">
              {/* Map Floating UI Overlay */}
              <div className="absolute top-0 left-0 w-full p-md z-10 flex justify-between items-start pointer-events-none">
                <div className="bg-surface-container-lowest/95 backdrop-blur border border-outline-variant rounded p-sm flex items-center gap-sm pointer-events-auto shadow-sm">
                  <span className="material-symbols-outlined text-primary">my_location</span>
                  <span className="font-data-mono text-data-mono text-on-surface">Kigali City Center</span>
                </div>
                <div className="bg-surface-container-lowest/95 backdrop-blur border border-outline-variant rounded p-sm flex flex-col items-end pointer-events-auto shadow-sm">
                  <span className="font-label-caps text-[10px] text-on-surface-variant">Live Coordinates</span>
                  <span className="font-data-mono text-data-mono-sm text-on-surface">
                    {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : 'Scanning GPS...'}
                  </span>
                </div>
              </div>

              {/* Map Canvas */}
              <div className="w-full h-full relative">
                <RiderMap 
                  marketId="" 
                  centerLat={coords?.lat || -1.9441} 
                  centerLng={coords?.lng || 30.0619} 
                />
                
                {/* Simulated pulse marker on map center */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none z-10">
                  <div className="bg-primary text-on-primary rounded-full p-1 border-2 border-surface-container-lowest shadow-lg animate-bounce">
                    <span className="material-symbols-outlined text-[20px]">two_wheeler</span>
                  </div>
                  <div className="w-8 h-2 bg-black/10 rounded-full blur-[2px] mt-1"></div>
                </div>
              </div>
              
              {/* Active Delivery Floating Info Panel */}
              {currentTask && (
                <div className="absolute bottom-md left-md right-md bg-surface-container-lowest border border-outline-variant rounded-lg p-md shadow-lg z-10">
                  <div className="flex justify-between items-start border-b border-outline-variant/30 pb-sm mb-sm">
                    <div>
                      <span className="bg-primary/10 border border-primary/20 text-primary font-label-caps text-[10px] px-2 py-0.5 rounded inline-block animate-pulse">
                        Active Order
                      </span>
                      <h4 className="font-headline-md text-headline-md text-on-surface mt-unit">
                        #{currentTask.orderNumber?.substring(0, 8) || currentTask._id.substring(0, 8).toUpperCase()}
                      </h4>
                    </div>
                    <div className="text-right">
                      <p className="font-data-mono text-lg font-bold text-on-surface">Live Route</p>
                      <p className="font-label-caps text-label-caps text-on-surface-variant">Escrow Security Protected</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-md mb-md">
                    <div className="flex flex-col items-center gap-xs">
                      <span className="material-symbols-outlined text-primary text-[18px]">storefront</span>
                      <div className="w-0.5 h-6 bg-outline-variant"></div>
                      <span className="material-symbols-outlined text-primary text-[18px]">location_on</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-between h-[64px]">
                      <div>
                        <p className="font-label-caps text-[9px] text-on-surface-variant">Pickup Hub</p>
                        <p className="font-body-md text-sm text-on-surface truncate">{currentTask.pickup?.address || 'Verified Merchant Stall'}</p>
                      </div>
                      <div>
                        <p className="font-label-caps text-[9px] text-on-surface-variant">Drop-off Destination</p>
                        <p className="font-body-md text-sm text-on-surface truncate">{currentTask.dropoff?.address || 'Customer Handover Point'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-sm">
                    <a 
                      href={`tel:${currentTask.customerPhone || '0780000000'}`}
                      className="flex-1 bg-surface border border-outline-variant text-on-surface font-label-caps text-label-caps py-sm rounded-lg flex justify-center items-center gap-xs hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">call</span> CALL CUSTOMER
                    </a>
                    <Link 
                      href={`/orders/${currentTask.orderId}/tracking`}
                      className="flex-1 bg-primary text-on-primary font-label-caps text-label-caps py-sm rounded-lg flex justify-center items-center gap-xs hover:bg-surface-tint transition-colors shadow-sm text-center"
                    >
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> TRACK DELIVERY
                    </Link>
                    {canSelfCancel(currentTask.status) && (
                      <button
                        type="button"
                        onClick={() => handleReleaseDelivery(currentTask._id)}
                        className="flex-1 bg-error-container text-on-error font-label-caps text-label-caps py-sm rounded-lg flex justify-center items-center gap-xs hover:opacity-90 transition-colors shadow-sm text-center"
                      >
                        <span className="material-symbols-outlined text-[18px]">remove_circle</span> RELEASE
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Available Deliveries Queue Table/List */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0_8px_30px_rgba(27,28,28,0.03)] overflow-hidden">
              <div className="px-md py-md bg-surface border-b border-outline-variant flex justify-between items-center">
                <div className="flex items-center gap-md">
                  <h3 className="font-headline-md text-headline-md text-on-surface">Available Board</h3>
                  <span className="bg-primary/10 text-primary border border-primary/20 font-data-mono-sm text-data-mono-sm px-2 py-0.5 rounded-full">
                    {availableDeliveries.length} Available
                  </span>
                </div>
                <button onClick={fetchAvailable} className="font-label-caps text-label-caps text-primary hover:underline font-bold">
                  Refresh List
                </button>
              </div>
              
              <div className="divide-y divide-outline-variant/30">
                {availableDeliveries.length > 0 ? (
                  availableDeliveries.map((delivery: any) => (
                    <div key={delivery._id} className="p-md flex flex-col md:flex-row md:items-center justify-between gap-md hover:bg-surface-container-low transition-colors group">
                      <div className="space-y-sm">
                        <div className="flex items-center gap-sm">
                          <span className="font-data-mono text-lg font-bold text-on-surface">
                            #{delivery.orderNumber?.substring(0, 8) || delivery._id.substring(0, 8).toUpperCase()}
                          </span>
                          <span className="bg-surface-container border border-outline-variant font-label-caps text-[9px] px-2 py-0.5 rounded">
                            {delivery.pickup?.distance ? `${delivery.pickup.distance.toFixed(1)} km away` : '1.2 km away'}
                          </span>
                        </div>
                        <div className="space-y-unit">
                          <p className="text-body-md text-sm text-on-surface-variant flex items-center gap-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
                            Pickup: <span className="font-semibold text-on-surface ml-xs">{delivery.pickup?.address || 'Wholesale Hub'}</span>
                          </p>
                          <p className="text-body-md text-sm text-on-surface-variant flex items-center gap-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                            Drop: <span className="font-semibold text-on-surface ml-xs">{delivery.dropoff?.address || 'Customer Location'}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-md justify-between md:justify-end">
                        <div className="text-right">
                          <p className="font-label-caps text-[10px] text-on-surface-variant">Shift Fee</p>
                          <p className="font-data-mono text-lg font-bold text-primary">
                            RWF {(delivery.financials?.deliveryFee || 1500).toLocaleString()}
                          </p>
                        </div>
                        <button 
                          onClick={() => handleAccept(delivery._id)}
                          className="bg-primary-container text-on-primary font-label-caps text-label-caps px-4 py-2 rounded hover:bg-primary transition-colors flex items-center gap-xs"
                        >
                          Accept Order <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-xl text-center space-y-sm">
                    <span className="material-symbols-outlined text-outline/40 text-4xl">local_shipping</span>
                    <p className="font-label-caps text-label-caps text-on-surface-variant">No available deliveries in your GPS zone</p>
                    <p className="text-body-md text-xs text-on-surface-variant/70">Scanning live coordinates Nyarugenge and Gasabo...</p>
                  </div>
                )}
              </div>
            </div>
            
          </div>
          
          {/* Right Column: Earnings Summary & Active/Queued workload */}
          <div className="lg:col-span-4 flex flex-col gap-gutter lg:gap-lg">
            
            {/* Earnings Bento Box Summary */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-[0_8px_30px_rgba(27,28,28,0.03)] space-y-md">
              <div className="flex justify-between items-center">
                <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">Shift Earnings</span>
                <span className="material-symbols-outlined text-primary text-[20px]">account_balance_wallet</span>
              </div>
              <div className="font-data-mono text-[32px] font-bold text-on-surface leading-none">
                RWF {(wallet.balance || stats.earnings || 14500).toLocaleString()}
              </div>
              <div className="grid grid-cols-2 gap-md pt-sm border-t border-outline-variant/30">
                <div>
                  <p className="font-label-caps text-[9px] text-on-surface-variant">Shift Drops</p>
                  <p className="font-data-mono text-base font-bold text-on-surface">{stats.drops || 8} Deliveries</p>
                </div>
                <div>
                  <p className="font-label-caps text-[9px] text-on-surface-variant">Escrow Pending</p>
                  <p className="font-data-mono text-base font-bold text-on-surface">RWF 4,500</p>
                </div>
              </div>
              <button className="w-full mt-sm border border-outline text-on-surface-variant font-label-caps text-[11px] py-2 rounded hover:bg-surface-container-low transition-all duration-300 flex justify-center items-center gap-xs font-bold">
                <span className="material-symbols-outlined text-[16px]">sync_alt</span> MTN MoMo Instant Withdraw
              </button>
            </div>
            
            {/* Courier Metrics & Ratings */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-[0_8px_30px_rgba(27,28,28,0.03)] space-y-sm">
              <h3 className="font-label-caps text-label-caps font-bold text-on-surface border-b border-outline-variant/30 pb-xs">Courier Telemetry</h3>
              <div className="space-y-sm pt-xs">
                <div className="flex justify-between items-center">
                  <span className="font-body-md text-sm text-on-surface-variant">Completion Rate</span>
                  <span className="font-data-mono text-sm font-bold text-primary">{stats.completion || 100}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-body-md text-sm text-on-surface-variant">Courier Rating</span>
                  <span className="font-data-mono text-sm font-bold text-primary">{stats.rating?.toFixed(2) || '4.95'} ⭐</span>
                </div>
              </div>
            </div>

            {/* Active Task status & Queue */}
            <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md shadow-[0_8px_30px_rgba(27,28,28,0.03)] space-y-md">
              <h3 className="font-label-caps text-label-caps font-bold text-on-surface border-b border-outline-variant pb-xs">Shift Queue</h3>
              
              {activeDeliveries.slice(1).length > 0 ? (
                <div className="space-y-sm">
                  {activeDeliveries.slice(1).map((delivery: any, idx: number) => (
                    <div key={delivery._id} className="bg-surface-container-lowest border border-outline-variant rounded p-sm flex justify-between items-center hover:border-outline transition-colors">
                      <div className="space-y-xs min-w-0">
                        <div className="flex items-center gap-xs">
                          <span className="bg-surface-container border border-outline-variant font-label-caps text-[8px] px-2 py-0.5 rounded font-bold">
                            QUEUED
                          </span>
                          <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant font-semibold">
                            #{delivery.orderNumber?.substring(0, 8) || delivery._id.substring(0, 8).toUpperCase()}
                          </span>
                        </div>
                        <p className="font-body-md text-xs text-on-surface truncate">{delivery.dropoff?.address || 'Customer Handover'}</p>
                      </div>
                      <span className="material-symbols-outlined text-outline-variant text-[20px]">chevron_right</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-md text-center bg-surface-container-lowest border border-outline-variant border-dashed rounded">
                  <p className="font-label-caps text-[10px] text-on-surface-variant">No queued deliveries on your route</p>
                </div>
              )}
            </div>
            
          </div>
          
        </div>
      </div>
    </Layout>
  );
}
