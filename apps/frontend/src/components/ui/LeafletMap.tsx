'use client';
import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet marker icon issue in Next.js
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface Coordinates {
  lat: number;
  lng: number;
}

// Default to Kigali city center
const DEFAULT_CENTER: [number, number] = [-1.9441, 30.0619];

const LocationMarker = ({ position, setPosition }: any) => {
  useMapEvents({
    click(e) {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={customIcon} />
  );
};

export const LeafletMap = ({ 
  onLocationChange, 
  initialLocation 
}: { 
  onLocationChange: (coords: Coordinates) => void,
  initialLocation?: Coordinates
}) => {
  const [position, setPosition] = useState<Coordinates | null>(initialLocation || null);

  const handlePositionChange = (coords: Coordinates) => {
    setPosition(coords);
    onLocationChange(coords);
  };

  const center = initialLocation ? [initialLocation.lat, initialLocation.lng] as [number, number] : DEFAULT_CENTER;

  return (
    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LocationMarker position={position} setPosition={handlePositionChange} />
    </MapContainer>
  );
};
