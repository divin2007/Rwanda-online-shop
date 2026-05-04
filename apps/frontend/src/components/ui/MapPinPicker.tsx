'use client';
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Next.js
// Fix for default marker icons in Next.js using a Data URI to bypass Tracking Prevention
const markerSvg = `PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIuNSAwQzUuNTk2NDUgMCAwIDUuNTk2NDUgMCAxMi41QzAgMjEuODc1IDEyLjUgNDEgMTIuNSA0MUMxMi41IDQxIDI1IDIxLjg3NSAyNSAxMi41QzI1IDUuNTk2NDUgMTkuNDAzNiAwIDEyLjUgMFpNMTIuNSAxNy4xODc1QzkuOTExMTcgMTcuMTg3NSA3LjgxMjUgMTUuMDg4OCA3LjgxMjUgMTIuNUM3LjgxMjUgOS45MTExNyA5LjkxMTE3IDcuODEyNSAxMi41IDcuODEyNUMxNS4wODg4IDcuODEyNSAxNy4xODc1IDkuOTExMTcgMTcuMTg3NSAxMi41QzE3LjE4NzUgMTUuMDg4OCAxNS4wODg4IDE3LjE4NzUgMTIuNSAxNy4xODc1WiIgZmlsbD0iIzNCODJFNiIvPjwvc3ZnPg==`;

const customIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${markerSvg}`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapPinPickerProps {
  onLocationSelected: (coords: { lat: number; lng: number }) => void;
  centerLat?: number;
  centerLng?: number;
}

const LocationMarker = ({ position, setPosition, onLocationSelected }: any) => {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onLocationSelected({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={customIcon}></Marker>
  );
};

export const MapPinPicker = ({ 
  onLocationSelected, 
  centerLat = -1.9441, // Default Kigali
  centerLng = 30.0619 
}: MapPinPickerProps) => {
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return <div className="w-full h-full bg-background-surface animate-pulse flex items-center justify-center">Loading Map...</div>;

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={[centerLat, centerLng]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker 
          position={position} 
          setPosition={setPosition} 
          onLocationSelected={onLocationSelected} 
        />
      </MapContainer>
      <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-background-card/90 backdrop-blur px-4 py-2 rounded-full shadow-md z-[400] text-sm font-medium text-text-primary">
        Drop a pin to set your delivery location
      </div>
    </div>
  );
};
