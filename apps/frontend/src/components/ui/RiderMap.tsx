'use client';
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useSocket } from '@/hooks/useSocket';

const riderIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: 'hue-rotate-[120deg]', 
});

const shopIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
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

export const RiderMap = ({ marketId, centerLat = -1.9441, centerLng = 30.0619, marketName }: { marketId: string, centerLat?: number, centerLng?: number, marketName?: string }) => {
  const { data } = useSocket<RiderLocation>(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008', 'rider:public:locations');
  const [riders, setRiders] = useState<Record<string, RiderLocation>>({});
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (data && data.marketId === marketId) {
      setRiders((prev) => ({
        ...prev,
        [data.riderId]: data,
      }));
    }
  }, [data, marketId]);

  if (!isClient) return <div className="w-full h-full bg-background-surface animate-pulse"></div>;

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer center={[centerLat, centerLng]} zoom={15} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        {/* Shop Location */}
        <Marker position={[centerLat, centerLng]} icon={shopIcon}>
           {marketName && <div className="p-2 bg-white rounded shadow-md font-bold">{marketName}</div>}
        </Marker>

        {/* Live Riders */}
        {Object.values(riders).map((rider) => (
          <Marker key={rider.riderId} position={[rider.lat, rider.lng]} icon={riderIcon} />
        ))}
      </MapContainer>
    </div>
  );
};
