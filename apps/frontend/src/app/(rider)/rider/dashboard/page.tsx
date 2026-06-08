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
const RiderMap = dynamic(() => import('@/components/ui/RiderMap').then(mod => mod.RiderMap), { ssr: false });
const RIDER_LOCATION_HEARTBEAT_MS = 20000;
const AVAILABLE_DELIVERIES_REFRESH_MS = 10000;
const ACTIVE_DELIVERIES_REFRESH_MS = 10000;

export default function RiderDashboardPage() {
  const { user } = useAuth();
  
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
    if (!socketConnected || !user?.id || !coords) return;

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
  }, [socketConnected, user?.id, coords, emitSocket]);

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
        console.warn('High accuracy geolocation failed or denied, trying low accuracy...', error.message);
        setCoords((current) => current || fallbackCoords);
        // Fallback or retry with low accuracy option
        navigator.geolocation.getCurrentPosition(
          handleLocationSuccess,
          (err) => {
            console.error('Low accuracy geolocation fallback failed:', err.message);
            setCoords((current) => current || fallbackCoords);
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
        );
      };

      // Watch position with high accuracy (enableHighAccuracy true utilizes GPS for true location like Kitabi)
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

  // Availability (online/offline) toggle with optimistic UI + rollback.
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const availability = isActive === null ? Boolean(profile?.isActive) : isActive;

  const toggleAvailability = async () => {
    const next = !availability;
    setIsActive(next);
    setStatusSaving(true);
    try {
      await riderApi.patch('/riders/me/status', {
        isActive: next,
        ...(coords ? { location: coords } : {}),
      });
      toast.success(next ? 'You are now online' : 'You are now offline');
    } catch (e: any) {
      setIsActive(!next); // rollback
      toast.error(e?.response?.data?.message || 'Could not update availability');
    } finally {
      setStatusSaving(false);
    }
  };

  if (profileLoading) {
    return <Layout><div className="p-20 text-center font-sans text-2xl animate-pulse text-[#1b1c1c]">Loading your dashboard...</div></Layout>;
  }

  if (!profile) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto py-20 text-center space-y-12 animate-reveal">
          <div className="w-24 h-24 bg-[#e8f5ed] border-2 border-[#ffedd5]/60 flex items-center justify-center mx-auto mb-8 shadow-sm">
            <svg className="w-12 h-12 text-[#ff6b00]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </div>
          <h1 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">Profile Not Found</h1>
          <p className="text-[#414844] uppercase tracking-[0.14em] text-[10px] font-black max-w-md mx-auto leading-relaxed">
            Your rider profile hasn't been set up yet. 
            Complete your registration to start accepting deliveries.
          </p>
          <button 
            onClick={() => window.location.href = '/rider/register'}
            className="rmf-btn-primary bg-[#e05300] border-none text-white px-12 py-3 text-[11px] font-black uppercase tracking-[0.18em] hover:bg-[#e05300] transition-all"
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
      <div className="animate-reveal space-y-10 pb-20">
        {/* RMF Logistics Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-[#e0e0e0] pb-8">
          <div>
            <p className="text-[10px] font-black text-[#ff6b00] uppercase tracking-[0.22em] mb-4">Rider Dashboard</p>
            <h1 className="text-3xl font-sans tracking-normal text-[#1b1c1c] leading-none">My Dashboard</h1>
          </div>
          <div className="flex items-center gap-4 rounded-lg border border-[#e0e0e0] bg-white px-6 py-3 shadow-sm">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#414844]/60">Availability</p>
              <p className={`text-[11px] font-black uppercase tracking-widest ${availability ? 'text-green-600' : 'text-[#7b3f3f]'}`}>
                {availability ? 'Online · accepting jobs' : 'Offline'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={availability}
              aria-label="Toggle availability"
              onClick={toggleAvailability}
              disabled={statusSaving}
              className={`relative h-7 w-14 shrink-0 rounded-full transition disabled:opacity-60 ${availability ? 'bg-green-500' : 'bg-[#d2bca8]'}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${availability ? 'left-8' : 'left-1'}`} />
            </button>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Earnings', value: `${wallet.balance?.toLocaleString() || 0} RWF`, icon: 'W' },
            { label: 'Completion Rate', value: `${stats.completion}%`, sub: 'Target: 95%+', icon: 'R' },
            { label: 'Your Rating', value: stats.rating?.toFixed(2) || '5.0', sub: 'Customer reviews', icon: 'S' },
            { label: 'Total Deliveries', value: `${stats.drops}`, sub: 'Lifetime total', icon: 'D' },
          ].map((stat, i) => (
            <div key={i} className="bg-white border border-[#e0e0e0] p-6 flex flex-col justify-between group hover:border-[#ff6b00] transition-all shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#414844] opacity-60">{stat.label}</p>
                <span className="text-[10px] font-sans text-[#ff6b00] font-bold">{stat.icon}</span>
              </div>
              <h2 className="text-2xl font-sans text-[#1b1c1c] tracking-normal">{stat.value}</h2>
              {stat.sub && <p className="text-[8px] text-[#ff6b00] mt-3 font-black uppercase tracking-widest opacity-50">{stat.sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-10">
            {/* Map Matrix */}
            <div className="bg-white border border-[#e0e0e0] overflow-hidden shadow-sm relative group">
               <div className="px-8 py-3 bg-[#fcf9f8] border-b border-[#e0e0e0] flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[#1b1c1c]">Delivery Map</h3>
                  <span className="text-[8px] font-bold text-[#414844] uppercase tracking-widest opacity-40">Kigali Area</span>
               </div>
               <div className="h-[500px] relative">
                  <RiderMap 
                    marketId="" 
                    centerLat={coords?.lat || profile.currentLocation?.lat || -1.9441} 
                    centerLng={coords?.lng || profile.currentLocation?.lng || 30.0619} 
                  />
               </div>
               <div className="absolute top-20 right-8 z-10 space-y-2">
                  <div className="bg-[#e05300] text-white px-4 py-2 text-[9px] font-black uppercase tracking-widest border border-[#ffedd5]/60 shadow-2xl">
                    Live Tracking Active
                  </div>
               </div>
            </div>

            {/* Available Mandates Matrix */}
            <div className="bg-white border border-[#e0e0e0] rounded-lg shadow-lg">
               <div className="px-8 py-6 bg-[#e05300] flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-white">Available Deliveries</h3>
                    <div className="w-2 h-2 bg-[#ffedd5] rounded-full animate-pulse"></div>
                  </div>
                  <button onClick={fetchAvailable} className="text-[8px] font-black text-[#ff6b00] uppercase tracking-widest border-b border-[#ffedd5]/60">Refresh</button>
               </div>
               <div className="divide-y divide-[#f0eded]">
                 {availableDeliveries.length > 0 ? availableDeliveries.map((delivery: any) => (
                   <div key={delivery._id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-[#fcf9f8] transition-colors group">
                      <div className="space-y-4">
                         <div className="flex items-center gap-4">
                            <span className="text-xl font-sans text-[#1b1c1c]">#{delivery.orderNumber?.substring(0,8) || delivery._id.substring(0,8).toUpperCase()}</span>
                            <span className="text-[8px] font-black text-[#ff6b00] border border-[#ff6b00]/20 px-3 py-1 uppercase tracking-normal">UNASSIGNED</span>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[11px] text-[#1b1c1c] font-medium leading-relaxed opacity-80">
                               Pickup: {delivery.pickup?.address || 'Market'}
                            </p>
                            <p className="text-[11px] text-[#1b1c1c] font-medium leading-relaxed opacity-80">
                               Drop-off: {delivery.dropoff?.address || 'Customer address'}
                            </p>
                         </div>
                      </div>
                      <div className="flex items-center gap-5">
                         <div className="text-right">
                            <p className="text-[9px] font-black text-[#414844] uppercase tracking-widest mb-1 opacity-40">Delivery Fee</p>
                            <p className="text-xl font-sans text-[#1b1c1c] tracking-normal">{(delivery.financials?.deliveryFee || 0).toLocaleString()} RWF</p>
                         </div>
                         <button 
                           onClick={() => handleAccept(delivery._id)}
                           className="bg-[#e05300] text-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] hover:bg-[#e05300] transition-all"
                         >
                           Accept Delivery
                         </button>
                      </div>
                   </div>
                 )) : (
                   <div className="p-20 text-center space-y-4">
                      <p className="text-[10px] font-black text-[#414844] uppercase tracking-[0.22em] opacity-30">No deliveries available right now</p>
                      <div className="w-10 h-1 bg-[#e05300]/10 mx-auto"></div>
                   </div>
                 )}
               </div>
            </div>
          </div>

          {/* Active Workload Sidebar */}
          <div className="space-y-10">
            {currentTask ? (
              <div className="bg-[#e05300] text-white p-6 relative overflow-hidden group shadow-2xl border-t-4 border-[#ffedd5]">
                <div className="absolute top-0 right-0 p-5 opacity-5 group-hover:opacity-10 transition-opacity">
                   <svg className="w-32 h-32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] mb-8 text-[#ff6b00]">Current Delivery</p>
                <h2 className="text-4xl font-sans mb-10 leading-tight tracking-normal">Order #{currentTask.orderNumber?.substring(0,8) || currentTask._id.substring(0,8).toUpperCase()}</h2>
                
                <div className="space-y-8 mb-12">
                   <div className="flex items-start gap-4">
                      <div className="w-1.5 h-1.5 bg-[#ffedd5] rounded-full mt-1.5"></div>
                      <div>
                        <p className="text-[8px] font-black text-[#ff6b00] uppercase tracking-widest mb-1 opacity-60">Drop-off Address</p>
                        <p className="text-xs font-medium leading-relaxed opacity-80">{currentTask.dropoff?.address || 'Customer address'}</p>
                      </div>
                   </div>
                   <div className="flex items-start gap-4">
                      <div className="w-1.5 h-1.5 bg-[#ffedd5] rounded-full mt-1.5 opacity-30"></div>
                      <div>
                        <p className="text-[8px] font-black text-[#ff6b00] uppercase tracking-widest mb-1 opacity-60">Delivery Fee</p>
                        <p className="text-xl font-sans">{(currentTask.financials?.deliveryFee || 0).toLocaleString()} RWF</p>
                      </div>
                   </div>
                </div>

                <Link href={`/orders/${currentTask.orderId}/tracking`} className="block w-full bg-[#ffedd5] text-[#1b1c1c] py-3 text-[11px] font-black uppercase tracking-[0.18em] hover:bg-white transition-all shadow-sm">
                  Track Delivery →
                </Link>
              </div>
            ) : (
              <div className="bg-[#fcf9f8] border-2 border-dashed border-[#e0e0e0]/20 p-12 text-center space-y-6">
                 <div className="w-12 h-12 border border-[#e0e0e0]/10 flex items-center justify-center mx-auto opacity-30">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 </div>
                 <p className="text-[10px] font-black text-[#414844] uppercase tracking-[0.18em] opacity-40">No active delivery — check available orders</p>
              </div>
            )}

            <div className="space-y-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1b1c1c] border-b border-[#f0eded] pb-4">Queued Deliveries</h3>
              {activeDeliveries.slice(1).length > 0 ? activeDeliveries.slice(1).map((delivery: any, i: number) => (
                <div key={i} className="bg-white border border-[#e0e0e0] p-5 flex justify-between items-center group cursor-pointer hover:border-[#ff6b00] transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[8px] font-black text-[#ff6b00] border border-[#ffedd5]/60 px-3 py-1 uppercase tracking-normal">QUEUED</span>
                      <span className="text-[8px] font-bold text-[#414844] uppercase tracking-widest opacity-40">#{delivery.orderNumber?.substring(0,8) || delivery._id.substring(0,8).toUpperCase()}</span>
                    </div>
                    <h4 className="text-sm font-sans text-[#1b1c1c] line-clamp-1">{delivery.dropoff?.address || 'Customer address'}</h4>
                  </div>
                  <span className="text-xl opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all">→</span>
                </div>
              )) : (
                <div className="px-2">
                   <p className="text-[9px] font-black text-[#414844] uppercase tracking-widest opacity-20">No queued deliveries</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
