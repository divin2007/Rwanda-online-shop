'use client';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, Tooltip, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useSocket } from '@/hooks/useSocket';
import { patchLeafletSafeRemove } from '@/lib/leafletSafeRemove';
import { RmfTileLayer } from './RmfTileLayer';
interface RiderProfile {
  userId: string;
  fullName?: string;
  plateNumber?: string;
  vehicleType?: string;
  rating?: number;
  totalDeliveries?: number;
}

import { marketApi, riderApi } from '@/lib/api';

patchLeafletSafeRemove();

// Fix for default marker icons in Next.js using a Data URI to bypass Tracking Prevention
const markerSvg = `PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIuNSAwQzUuNTk2NDUgMCAwIDUuNTk2NDUgMCAxMi41QzAgMjEuODc1IDEyLjUgNDEgMTIuNSA0MUMxMi41IDQxIDI1IDIxLjg3NSAyNSAxMi41QzI1IDUuNTk2NDUgMTkuNDAzNiAwIDEyLjUgMFpNMTIuNSAxNy4xODc1QzkuOTExMTcgMTcuMTg3NSA3LjgxMjUgMTUuMDg4OCA3LjgxMjUgMTIuNUM3LjgxMjUgOS45MTExNyA5LjkxMTE3IDcuODEyNSAxMi41IDcuODEyNUMxNS4wODg4IDcuODEyNSAxNy4xODc1IDkuOTExMTcgMTcuMTg3NSAxMi41QzE3LjE4NzUgMTUuMDg4OCAxNS4wODg4IDE3LjE4NzUgMTIuNSAxNy4xODc1WiIgZmlsbD0iIzNCODJFNiIvPjwvc3ZnPg==`;

const riderIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${markerSvg}`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: 'hue-rotate-[120deg]', 
});

const shopIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${markerSvg}`,
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  className: 'drop-shadow-lg', 
});

interface RiderLocation {
  riderId: string;
  lat: number;
  lng: number;
  marketId: string;
}

interface MarketLocation {
  _id: string;
  name: string;
  location: {
    coordinates: [number, number]; // [lng, lat]
  };
}

const MapViewUpdater = ({ centerLat, centerLng }: { centerLat: number; centerLng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([centerLat, centerLng], map.getZoom());
  }, [centerLat, centerLng, map]);
  return null;
};

export const RiderMap = ({ marketId, centerLat = -1.9441, centerLng = 30.0619, marketName }: { marketId: string, centerLat?: number, centerLng?: number, marketName?: string }) => {
  const instanceId = React.useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { data } = useSocket<RiderLocation>(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008', 'rider:public:locations');
  const [riders, setRiders] = useState<Record<string, RiderLocation>>({});
  const [profiles, setProfiles] = useState<Record<string, RiderProfile>>({});
  const [tails, setTails] = useState<Record<string, [number, number][]>>({});
  const [markets, setMarkets] = useState<MarketLocation[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [mapInstanceKey, setMapInstanceKey] = useState('');
  const [mapMode, setMapMode] = useState<'standard' | 'satellite'>('standard');

  const isAdmin = marketId === 'all-admin';
  const mapShellKey = `${mapInstanceKey}-${marketId}`;

  const releaseLeafletContainer = () => {
    const leafletContainers = containerRef.current?.querySelectorAll('.leaflet-container') || [];
    leafletContainers.forEach((element) => {
      delete (element as HTMLElement & { _leaflet_id?: number })._leaflet_id;
    });
  };

  useLayoutEffect(() => {
    releaseLeafletContainer();
    return releaseLeafletContainer;
  }, [mapInstanceKey, marketId]);

  useEffect(() => {
    setIsClient(true);
    const randomKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setMapInstanceKey(`rider-map-${instanceId}-${randomKey}`);
    if (isAdmin) {
      marketApi.get('/markets').then(res => {
        if (res.data?.success) setMarkets(res.data.data);
      }).catch(err => console.error('Failed to fetch markets for map:', err));
    }
  }, [instanceId, isAdmin]);

  useEffect(() => {
    if (data) {
      // If not admin, only track riders belonging to this market
      if (!isAdmin && data.marketId !== marketId) return;

      setRiders((prev) => ({
        ...prev,
        [data.riderId]: data,
      }));
      
      setTails((prev) => {
        const currentTail = prev[data.riderId] || [];
        const newTail = [...currentTail, [data.lat, data.lng] as [number, number]].slice(-10); // Keep last 10 points
        return { ...prev, [data.riderId]: newTail };
      });

      // Fetch profile if not already cached
      if (!profiles[data.riderId]) {
        riderApi.get(`/riders/user/${data.riderId}`).then(res => {
          if (res.data?.success) {
            setProfiles(prev => ({ ...prev, [data.riderId]: res.data.data }));
          }
        }).catch(() => {
          // Fallback for simulated riders or errors
          if (!profiles[data.riderId]) {
            setProfiles(prev => ({ 
              ...prev, 
              [data.riderId]: { userId: data.riderId, fullName: `Rider ${data.riderId.substring(0, 4)}`, plateNumber: 'RAA 000X' } 
            }));
          }
        });
      }
    }
  }, [data, marketId, isAdmin, profiles]);

  if (!isClient || !mapInstanceKey) return <div className="w-full h-full bg-background-surface animate-pulse"></div>;

  return (
    <div key={mapShellKey} ref={containerRef} className="w-full h-full relative z-0">
      <MapContainer 
        key={mapShellKey}
        center={[centerLat, centerLng]} 
        zoom={isAdmin ? 12 : 15} 
        style={{ height: '100%', width: '100%' }}
      >
        <MapViewUpdater centerLat={centerLat} centerLng={centerLng} />
        <RmfTileLayer variant={mapMode === 'satellite' ? 'satellite' : 'standard'} />
        
        {/* Market Locations */}
        {isAdmin ? (
          markets
            .filter(m => m.location && Array.isArray(m.location.coordinates) && m.location.coordinates.length >= 2)
            .map(m => (
              <Marker key={m._id} position={[m.location.coordinates[1], m.location.coordinates[0]]} icon={shopIcon}>
                <Tooltip permanent direction="bottom">
                  <div className="font-bold text-xs">{m.name}</div>
                </Tooltip>
              </Marker>
            ))
        ) : (
          <Marker position={[centerLat, centerLng]} icon={shopIcon}>
            {marketName && (
              <Tooltip permanent direction="bottom">
                <div className="font-bold text-xs">{marketName}</div>
              </Tooltip>
            )}
          </Marker>
        )}

        {/* Movement Tails */}
        {Object.entries(tails).map(([id, path]) => (
          <Polyline 
            key={`tail-${id}`} 
            positions={path} 
            color="#3b82f6" 
            weight={3} 
            opacity={0.4} 
            dashArray="5, 10"
          />
        ))}

        {/* Live Riders */}
        {Object.values(riders).map((rider) => {
          const profile = profiles[rider.riderId];
          return (
            <Marker key={rider.riderId} position={[rider.lat, rider.lng]} icon={riderIcon}>
              <Tooltip permanent direction="top" offset={[0, -40]}>
                <div className="text-xs font-bold bg-white px-2 py-1 rounded shadow-sm border border-border">
                  {profile?.fullName || `Rider ${rider.riderId.substring(0, 4)}`}
                </div>
              </Tooltip>
              <Popup>
                <div className="p-2 min-w-[200px]">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-primary">{profile?.fullName || 'Active Rider'}</p>
                      <p className="text-[10px] text-text-secondary font-mono">{profile?.plateNumber || 'RAA 000X'}</p>
                    </div>
                    {profile?.rating && (
                      <div className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        ★ {profile.rating.toFixed(1)}
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-border">
                    <div>
                      <p className="text-[10px] text-text-secondary uppercase font-bold">Deliveries</p>
                      <p className="text-sm font-bold">{profile?.totalDeliveries || 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-secondary uppercase font-bold">Status</p>
                      <p className="text-sm font-bold text-status-success">Online</p>
                    </div>
                  </div>

                  <p className="text-[10px] text-text-secondary italic mt-3">Last updated: Just now</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      
      {/* Map Control Toggle */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <button 
          onClick={() => setMapMode(mapMode === 'standard' ? 'satellite' : 'standard')}
          className="bg-white p-2 rounded-lg shadow-lg border border-border hover:bg-background-surface transition-colors flex items-center gap-2 text-xs font-bold text-text-primary"
        >
          {mapMode === 'standard' ? 'Satellite View' : 'Standard View'}
        </button>
      </div>
    </div>
  );
};
