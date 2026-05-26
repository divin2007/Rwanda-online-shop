'use client';
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { MapContainer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { patchLeafletSafeRemove } from '@/lib/leafletSafeRemove';
import { RmfTileLayer } from './RmfTileLayer';
import { LocationSearchResult, searchRwandaLocation } from '@/lib/geocoding';

patchLeafletSafeRemove();

// Fix Leaflet marker icon issue in Next.js using a Data URI to bypass Tracking Prevention
const markerSvg = `PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIuNSAwQzUuNTk2NDUgMCAwIDUuNTk2NDUgMCAxMi41QzAgMjEuODc1IDEyLjUgNDEgMTIuNSA0MUMxMi41IDQxIDI1IDIxLjg3NSAyNSAxMi41QzI1IDUuNTk2NDUgMTkuNDAzNiAwIDEyLjUgMFpNMTIuNSAxNy4xODc1QzkuOTExMTcgMTcuMTg3NSA3LjgxMjUgMTUuMDg4OCA3LjgxMjUgMTIuNUM3LjgxMjUgOS45MTExNyA5LjkxMTE3IDcuODEyNSAxMi41IDcuODEyNUMxNS4wODg4IDcuODEyNSAxNy4xODc1IDkuOTExMTcgMTcuMTg3NSAxMi41QzE3LjE4NzUgMTUuMDg4OCAxNS4wODg4IDE3LjE4NzUgMTIuNSAxNy4xODc1WiIgZmlsbD0iIzNCODJFNiIvPjwvc3ZnPg==`;

const customIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${markerSvg}`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
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

// Internal component to handle map movement
const MapController = ({ flyToLocation }: { flyToLocation: { lat: number, lon: number } | null }) => {
  const map = useMap();
  useEffect(() => {
    if (flyToLocation) {
      map.flyTo([flyToLocation.lat, flyToLocation.lon], 16);
    }
  }, [flyToLocation, map]);
  return null;
};

export const LeafletMap = ({ 
  onLocationChange, 
  initialLocation 
}: { 
  onLocationChange: (coords: Coordinates) => void,
  initialLocation?: Coordinates
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<Coordinates | null>(initialLocation || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [flyToLocation, setFlyToLocation] = useState<{ lat: number, lon: number } | null>(null);
  const [mapInstanceKey, setMapInstanceKey] = useState('');
  const mapShellKey = `${mapInstanceKey}-${initialLocation?.lat || DEFAULT_CENTER[0]}-${initialLocation?.lng || DEFAULT_CENTER[1]}`;

  const releaseLeafletContainer = () => {
    const leafletContainers = containerRef.current?.querySelectorAll('.leaflet-container') || [];
    leafletContainers.forEach((element) => {
      delete (element as HTMLElement & { _leaflet_id?: number })._leaflet_id;
    });
  };

  useLayoutEffect(() => {
    releaseLeafletContainer();
    return releaseLeafletContainer;
  }, [mapInstanceKey, initialLocation?.lat, initialLocation?.lng]);

  useEffect(() => {
    setMapInstanceKey(`leaflet-map-${Date.now()}`);
  }, []);

  const handlePositionChange = (coords: Coordinates) => {
    setPosition(coords);
    onLocationChange(coords);
  };

  const doSearch = async (val: string) => {
    if (!val || val.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      setSearchResults(await searchRwandaLocation(val));
    } catch (e) {
      console.error('Search failed', e);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) doSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectResult = (result: LocationSearchResult) => {
    const coords = { lat: result.lat, lng: result.lng };
    setFlyToLocation({ lat: result.lat, lon: result.lng });
    handlePositionChange(coords);
    setSearchResults([]);
    setSearchQuery(result.label);
  };

  const center = initialLocation ? [initialLocation.lat, initialLocation.lng] as [number, number] : DEFAULT_CENTER;

  if (!mapInstanceKey) {
    return <div className="w-full h-full bg-background-surface animate-pulse" />;
  }

  return (
    <div key={mapShellKey} ref={containerRef} className="w-full h-full relative z-0">
      {/* Search Input Container */}
      <div className="absolute top-4 left-4 right-4 z-[500] max-w-md">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search for your shop location..." 
            className="w-full bg-background-card border border-border rounded-lg px-4 py-3 shadow-lg outline-none focus:ring-2 focus:ring-primary pr-12"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary">
            {isSearching ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> : '🔍'}
          </div>

          {/* Dropdown Results */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-background-card border border-border rounded-lg shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={`${result.provider || 'geo'}-${result.lat}-${result.lng}-${result.label}`}
                  onClick={() => handleSelectResult(result)}
                  className="w-full text-left px-4 py-2 hover:bg-background-surface border-b border-border/50 last:border-0 transition-colors flex items-start gap-2"
                >
                  <span className="mt-1 text-xs">📍</span>
                  <div>
                    <div className="font-medium text-xs line-clamp-1">{result.label.split(',')[0]}</div>
                    <div className="text-[10px] text-text-secondary line-clamp-1">
                      {result.label}
                      {result.provider ? ` · ${result.provider}` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <MapContainer key={mapShellKey} center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <RmfTileLayer />
        <MapController flyToLocation={flyToLocation} />
        <LocationMarker position={position} setPosition={handlePositionChange} />
      </MapContainer>
    </div>
  );
};
