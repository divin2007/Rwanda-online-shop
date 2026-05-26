export interface Coordinates {
  lat: number;
  lng: number;
}

export type GeocodeConfidence = 'high' | 'medium' | 'low' | 'fallback';

export interface GeocodedCoordinates extends Coordinates {
  provider?: 'mapbox' | 'opencage' | 'nominatim' | 'fallback';
  formattedAddress?: string;
  confidence?: GeocodeConfidence;
}

export interface Address {
  address: string;
  city: string;
  provider?: string;
}

export interface RouteDto {
  distanceKm: number;
  estimatedMinutes: number;
  actualMinutes?: number;
  geometry?: [number, number][]; // Array of [lat, lng] coordinates
}
