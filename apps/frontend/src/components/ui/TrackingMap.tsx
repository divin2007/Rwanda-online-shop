'use client';
import React from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const riderIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: 'hue-rotate-[200deg]', // Blue-ish
});

interface TrackingMapProps {
  lat: number;
  lng: number;
}

export const TrackingMap = ({ lat, lng }: TrackingMapProps) => {
  return (
    <MapContainer center={[lat, lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[lat, lng]} icon={riderIcon} />
    </MapContainer>
  );
};
