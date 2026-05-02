'use client';
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

interface Coordinates {
  lat: number;
  lng: number;
}

interface MapPinPickerProps {
  onLocationSelected: (coords: Coordinates) => void;
  initialLocation?: Coordinates;
}

// MapContainer requires window object, so we must load it dynamically
const Map = dynamic(
  () => import('./LeafletMap').then((mod) => mod.LeafletMap),
  { 
    ssr: false, 
    loading: () => <div className="w-full h-64 bg-gray-100 flex items-center justify-center animate-pulse rounded border border-border">Loading Map SDK...</div> 
  }
);

export const MapPinPicker = ({ onLocationSelected, initialLocation }: MapPinPickerProps) => {
  const [coords, setCoords] = useState<Coordinates | null>(initialLocation || null);

  const handleLocationUpdate = (newCoords: Coordinates) => {
    setCoords(newCoords);
    onLocationSelected(newCoords);
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-text-primary mb-2">
        Delivery Location
      </label>
      <p className="text-xs text-status-warning mb-2 font-medium">
        Text addresses are not accepted. Please drop a pin on the map.
      </p>
      
      <div className="w-full h-64 rounded border-2 border-border relative overflow-hidden z-0">
        <Map onLocationChange={handleLocationUpdate} initialLocation={initialLocation} />
      </div>
      
      {coords && (
        <div className="mt-2 text-sm text-status-success font-medium flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Location pinned: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </div>
      )}
    </div>
  );
};
