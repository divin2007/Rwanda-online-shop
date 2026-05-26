'use client';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { patchLeafletSafeRemove } from '@/lib/leafletSafeRemove';
import { LocationSearchResult, searchRwandaLocation } from '@/lib/geocoding';
import { RmfTileLayer } from './RmfTileLayer';

patchLeafletSafeRemove();

const markerSvg = `PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIuNSAwQzUuNTk2NDUgMCAwIDUuNTk2NDUgMCAxMi41QzAgMjEuODc1IDEyLjUgNDEgMTIuNSA0MUMxMi41IDQxIDI1IDIxLjg3NSAyNSAxMi41QzI1IDUuNTk2NDUgMTkuNDAzNiAwIDEyLjUgMFpNMTIuNSAxNy4xODc1QzkuOTExMTcgMTcuMTg3NSA3LjgxMjUgMTUuMDg4OCA3LjgxMjUgMTIuNUM3LjgxMjUgOS45MTExNyA5LjkxMTE3IDcuODEyNSAxMi41IDcuODEyNUMxNS4wODg4IDcuODEyNSAxNy4xODc1IDkuOTExMTcgMTcuMTg3NSAxMi41QzE3LjE4NzUgMTUuMDg4OCAxNS4wODg4IDcuODEyNSAxMi41IDcuODEyNVoiIGZpbGw9IiMzQjgyRTYiLz48L3N2Zz4=`;

const riderIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${markerSvg}`,
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  className: 'hue-rotate-[120deg]', // Green for Rider
});

const storeIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${markerSvg}`,
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  className: 'hue-rotate-[220deg]', // Purple/Blue for Store
});

const customerIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${markerSvg}`,
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  className: 'hue-rotate-[0deg]', // Default Blue for Customer
});

interface Coordinates {
  lat: number;
  lng: number;
}

interface DeliveryMapProps {
  riderLocation: Coordinates;
  pickupLocation?: Coordinates;
  dropoffLocation?: Coordinates;
  status?: string;
  routeGeometry?: [number, number][];
}

const MapController = ({ flyToLocation, center }: { flyToLocation: { lat: number, lon: number } | null, center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    if (flyToLocation) {
      map.flyTo([flyToLocation.lat, flyToLocation.lon], 16);
    } else {
      map.setView(center, map.getZoom());
    }
  }, [flyToLocation, center, map]);
  return null;
};

export const DeliveryMap = ({ riderLocation, pickupLocation, dropoffLocation, status, routeGeometry }: DeliveryMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [mapInstanceKey, setMapInstanceKey] = useState('');
  const [liveRoute, setLiveRoute] = useState<[number, number][]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [flyToLocation, setFlyToLocation] = useState<{ lat: number, lon: number } | null>(null);
  const mapShellKey = `${mapInstanceKey}-${riderLocation.lat}-${riderLocation.lng}`;

  const releaseLeafletContainer = () => {
    const leafletContainers = containerRef.current?.querySelectorAll('.leaflet-container') || [];
    leafletContainers.forEach((element) => {
      delete (element as HTMLElement & { _leaflet_id?: number })._leaflet_id;
    });
  };

  useLayoutEffect(() => {
    releaseLeafletContainer();
    return releaseLeafletContainer;
  }, [mapInstanceKey, riderLocation.lat, riderLocation.lng]);

  useEffect(() => {
    setIsClient(true);
    setMapInstanceKey(`delivery-map-${Date.now()}`);
  }, []);

  // Fetch LIVE road-following route from Rider to Destination
  useEffect(() => {
    const target = (status === 'assigned' || status === 'en_route_to_pickup') ? pickupLocation : dropoffLocation;
    if (target && riderLocation) {
      const fetchLiveRoute = async () => {
        try {
          const url = `http://router.project-osrm.org/route/v1/driving/${riderLocation.lng},${riderLocation.lat};${target.lng},${target.lat}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.code === 'Ok' && data.routes?.[0]) {
            const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
            setLiveRoute(coords);
          } else {
            setLiveRoute([[riderLocation.lat, riderLocation.lng], [target.lat, target.lng]]);
          }
        } catch (e) {
          setLiveRoute([[riderLocation.lat, riderLocation.lng], [target.lat, target.lng]]);
        }
      };
      fetchLiveRoute();
    }
  }, [riderLocation, pickupLocation, dropoffLocation, status]);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) doSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!isClient || !mapInstanceKey) return <div className="w-full h-full bg-background-surface animate-pulse rounded-xl"></div>;

  const handleSelectResult = (result: LocationSearchResult) => {
    setFlyToLocation({ lat: result.lat, lon: result.lng });
    setSearchResults([]);
    setSearchQuery(result.label.split(',')[0]);
  };

  const center: [number, number] = [riderLocation.lat, riderLocation.lng];

  return (
    <div key={mapShellKey} ref={containerRef} className="w-full h-full relative z-0 rounded-xl overflow-hidden border border-border shadow-inner">
      {/* Search Overlay */}
      <div className="absolute top-4 left-4 right-4 z-[500] max-w-sm">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search landmarks..." 
            className="w-full bg-background-card/90 backdrop-blur-md border border-border rounded-lg px-4 py-2 text-sm shadow-xl outline-none focus:ring-2 focus:ring-primary pr-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isSearching ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> : '🔍'}
          </div>

          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-background-card border border-border rounded-lg shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={`${result.provider || 'geo'}-${result.lat}-${result.lng}-${result.label}`}
                  onClick={() => handleSelectResult(result)}
                  className="w-full text-left px-4 py-2 hover:bg-background-surface border-b border-border/50 last:border-0 transition-colors flex items-start gap-2"
                >
                  <span className="mt-0.5 text-xs">📍</span>
                  <div className="min-w-0">
                    <div className="font-medium text-xs truncate">{result.label.split(',')[0]}</div>
                    <div className="text-[10px] text-text-secondary truncate">
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
        center={center} 
        zoom={16} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <RmfTileLayer />
        <MapController flyToLocation={flyToLocation} center={center} />

        <Marker position={[riderLocation.lat, riderLocation.lng]} icon={riderIcon}>
          <Popup>
            <div className="text-center">
              <p className="font-bold text-sm">Rider Location</p>
              <p className="text-[10px] text-text-secondary">GPS Active</p>
            </div>
          </Popup>
        </Marker>

        {pickupLocation && (
          <Marker position={[pickupLocation.lat, pickupLocation.lng]} icon={storeIcon}>
            <Popup>
              <div className="text-center">
                <p className="font-bold text-sm text-primary">Pickup Point</p>
              </div>
            </Popup>
          </Marker>
        )}

        {dropoffLocation && (
          <Marker position={[dropoffLocation.lat, dropoffLocation.lng]} icon={customerIcon}>
            <Popup>
              <div className="text-center">
                <p className="font-bold text-sm text-primary">Drop-off Point</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Unified Blue Route following the ROAD */}
        {liveRoute.length > 0 && (
          <Polyline 
            positions={liveRoute} 
            color="#3b82f6" 
            weight={7}
            opacity={0.9}
          />
        )}

        {/* Background Full Route Geometry (Planned Route) */}
        {routeGeometry && routeGeometry.length > 0 && (
          <Polyline 
            positions={routeGeometry} 
            color="#3b82f6" 
            weight={3}
            opacity={0.3}
            dashArray="5, 10"
          />
        )}
      </MapContainer>
    </div>
  );
};
