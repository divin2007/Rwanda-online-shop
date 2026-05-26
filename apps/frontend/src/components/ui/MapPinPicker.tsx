'use client';
import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { MapContainer, Marker, useMapEvents, useMap, Polyline, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { patchLeafletSafeRemove } from '@/lib/leafletSafeRemove';
import { LocationSearchResult, searchRwandaLocation } from '@/lib/geocoding';
import { RmfTileLayer } from './RmfTileLayer';

patchLeafletSafeRemove();

// Fix for default marker icons in Next.js using a Data URI to bypass Tracking Prevention
const markerSvg = `PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIuNSAwQzUuNTk2NDUgMCAwIDUuNTk2NDUgMCAxMi41QzAgMjEuODc1IDEyLjUgNDEgMTIuNSA0MUMxMi41IDQxIDI1IDIxLjg3NSAyNSAxMi41QzI1IDUuNTk2NDUgMTkuNDAzNiAwIDEyLjUgMFpNMTIuNSAxNy4xODc1QzkuOTExMTcgMTcuMTg3NSA3LjgxMjUgMTUuMDg4OCA3LjgxMjUgMTIuNUM3LjgxMjUgOS45MTExNyA5LjkxMTE3IDcuODEyNSAxMi41IDcuODEyNUMxNS4wODg4IDcuODEyNSAxNy4xODc1IDkuOTExMTcgMTcuMTg3NSAxMi41QzE3LjE4NzUgMTUuMDg4OCAxNS4wODg4IDE3LjE4NzUgMTIuNSAxNy4xODc1WiIgZmlsbD0iIzNCODJFNiIvPjwvc3ZnPg==`;

const customIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${markerSvg}`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const marketIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa('<svg width="25" height="41" viewBox="0 0 25 41" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0C5.59645 0 0 5.59645 0 12.5C0 21.875 12.5 41 12.5 41C12.5 41 25 21.875 25 12.5C25 5.59645 19.4036 0 12.5 0ZM12.5 17.1875C9.91117 17.1875 7.8125 15.0888 7.8125 12.5C7.8125 9.91117 9.91117 7.8125 12.5 7.8125C15.0888 7.8125 17.1875 9.91117 17.1875 12.5C17.1875 15.0888 15.0888 17.1875 12.5 17.1875Z" fill="#EF4444"/></svg>')}`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapPinPickerProps {
  onLocationSelected: (coords: { lat: number; lng: number }) => void;
  centerLat?: number;
  centerLng?: number;
  selectedLocation?: { lat: number; lng: number } | null;
  marketLocation?: { lat: number; lng: number } | null;
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

export const MapPinPicker = ({ 
  onLocationSelected, 
  centerLat = -1.9441, // Default Kigali
  centerLng = 30.0619,
  selectedLocation,
  marketLocation
}: MapPinPickerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<L.LatLng | null>(
    selectedLocation ? new L.LatLng(selectedLocation.lat, selectedLocation.lng) : null
  );

  useEffect(() => {
    if (selectedLocation) {
      setPosition(new L.LatLng(selectedLocation.lat, selectedLocation.lng));
    }
  }, [selectedLocation]);

  const [roadGeometry, setRoadGeometry] = useState<[number, number][]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [flyToLocation, setFlyToLocation] = useState<{ lat: number, lon: number } | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [mapInstanceKey, setMapInstanceKey] = useState('');
  const mapShellKey = `${mapInstanceKey}-${centerLat}-${centerLng}`;

  const releaseLeafletContainer = () => {
    const leafletContainers = containerRef.current?.querySelectorAll('.leaflet-container') || [];
    leafletContainers.forEach((element) => {
      delete (element as HTMLElement & { _leaflet_id?: number })._leaflet_id;
    });
  };

  useLayoutEffect(() => {
    releaseLeafletContainer();
    return releaseLeafletContainer;
  }, [mapInstanceKey, centerLat, centerLng]);

  useEffect(() => {
    setIsClient(true);
    setMapInstanceKey(`pin-picker-map-${Date.now()}`);
  }, []);

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

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) doSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch road geometry when location is picked
  useEffect(() => {
    if (marketLocation && position) {
      const fetchRoute = async () => {
        try {
          const url = `http://router.project-osrm.org/route/v1/driving/${marketLocation.lng},${marketLocation.lat};${position.lng},${position.lat}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.code === 'Ok' && data.routes?.[0]) {
            const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
            setRoadGeometry(coords);
          } else {
            setRoadGeometry([[marketLocation.lat, marketLocation.lng], [position.lat, position.lng]]);
          }
        } catch (e) {
          setRoadGeometry([[marketLocation.lat, marketLocation.lng], [position.lat, position.lng]]);
        }
      };
      fetchRoute();
    }
  }, [marketLocation, position]);

  if (!isClient || !mapInstanceKey) return <div className="w-full h-full bg-background-surface animate-pulse flex items-center justify-center">Loading Map...</div>;

  const handleSelectResult = (result: LocationSearchResult) => {
    const lat = result.lat;
    const lng = result.lng;
    setFlyToLocation({ lat, lon: lng });
    setPosition(new L.LatLng(lat, lng));
    onLocationSelected({ lat, lng });
    setSearchResults([]);
    setSearchQuery(result.label);
  };

  return (
    <div key={mapShellKey} ref={containerRef} className="w-full h-full relative z-0">
      {/* Search Container */}
      <div className="absolute top-4 left-4 right-4 z-[500] max-w-md mx-auto">
        <div className="relative group">
          <input 
            type="text" 
            placeholder="Search for Sector, Cell or Village..." 
            className="w-full bg-background-card/95 backdrop-blur border border-border rounded-xl px-4 py-3 shadow-xl outline-none focus:ring-2 focus:ring-primary transition-all pr-12"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary">
            {isSearching ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> : '🔍'}
          </div>

          {/* Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-background-card border border-border rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={`${result.provider || 'geo'}-${result.lat}-${result.lng}-${result.label}`}
                  onClick={() => handleSelectResult(result)}
                  className="w-full text-left px-4 py-3 hover:bg-background-surface border-b border-border/50 last:border-0 transition-colors flex items-start gap-3"
                >
                  <span className="mt-1">📍</span>
                  <div>
                    <div className="font-semibold text-sm line-clamp-1">{result.label.split(',')[0]}</div>
                    <div className="text-xs text-text-secondary line-clamp-1">
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

      <MapContainer 
        key={mapShellKey}
        center={marketLocation ? [marketLocation.lat, marketLocation.lng] : [centerLat, centerLng]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        <RmfTileLayer />
        <MapController flyToLocation={flyToLocation} />
        {marketLocation && (
          <>
            <Marker position={[marketLocation.lat, marketLocation.lng]} icon={marketIcon}></Marker>
            <Circle 
              center={[marketLocation.lat, marketLocation.lng]} 
              radius={15000} // 15km delivery zone
              pathOptions={{ fillColor: '#3B82F6', fillOpacity: 0.1, color: '#3B82F6', weight: 1, dashArray: '5, 5' }} 
            />
          </>
        )}
        {roadGeometry.length > 0 && (
          <Polyline positions={roadGeometry} pathOptions={{ color: '#3B82F6', weight: 5, opacity: 0.8 }} />
        )}
        <LocationMarker 
          position={position} 
          setPosition={setPosition} 
          onLocationSelected={onLocationSelected} 
        />
      </MapContainer>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-2 rounded-full shadow-2xl z-[400] text-sm font-bold animate-bounce border-2 border-white">
        📍 Drop pin here
      </div>
    </div>
  );
};
