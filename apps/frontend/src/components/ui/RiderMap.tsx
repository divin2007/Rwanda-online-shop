'use client';
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useSocket } from '@/hooks/useSocket';

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

export const RiderMap = ({ marketId, centerLat = -1.9441, centerLng = 30.0619, marketName }: { marketId: string, centerLat?: number, centerLng?: number, marketName?: string }) => {
  const { data } = useSocket<RiderLocation>(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008', 'rider:public:locations');
  const [riders, setRiders] = useState<Record<string, RiderLocation>>({});
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (data) {
      setRiders((prev) => ({
        ...prev,
        [data.riderId]: data,
      }));
    }
  }, [data]);

  if (!isClient) return <div className="w-full h-full bg-background-surface animate-pulse"></div>;

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        key={`rider-map-${marketId}-${centerLat}-${centerLng}`}
        center={[centerLat, centerLng]} 
        zoom={15} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        {/* Shop Location */}
        <Marker position={[centerLat, centerLng]} icon={shopIcon}>
           {marketName && <div className="p-2 bg-white rounded shadow-md font-bold">{marketName}</div>}
        </Marker>

        {/* Live Riders */}
        {Object.values(riders).map((rider) => (
          <Marker key={rider.riderId} position={[rider.lat, rider.lng]} icon={riderIcon}>
            <Tooltip permanent direction="top" offset={[0, -40]}>
              <div className="text-xs font-bold bg-white px-2 py-1 rounded shadow-sm border border-border">Rider {rider.riderId.substring(0, 4)}</div>
            </Tooltip>
            <Popup>
              <div className="p-1">
                <p className="font-bold">Active Rider</p>
                <p className="text-xs text-text-secondary italic">Live Location Update</p>
                <p className="text-xs text-primary mt-1">Ready for assignment</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
