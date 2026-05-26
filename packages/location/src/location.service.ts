import { Coordinates, Address, GeocodedCoordinates, GeocodeConfidence } from './interfaces/location.interface';

type NominatimSearchResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
  };
};

type NominatimReverseResult = {
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
  };
};

type MapboxFeature = {
  center?: [number, number];
  place_name?: string;
  relevance?: number;
  place_type?: string[];
  context?: Array<{ id?: string; text?: string }>;
};

type OpenCageResult = {
  formatted?: string;
  confidence?: number;
  geometry?: {
    lat?: number;
    lng?: number;
  };
};

export class LocationService {
  private readonly kigaliFallback: GeocodedCoordinates = {
    lat: -1.9441,
    lng: 30.0619,
    provider: 'fallback',
    formattedAddress: 'Kigali, Rwanda',
    confidence: 'fallback',
  };
  private readonly geocodeCache = new Map<string, { expiresAt: number; value: GeocodedCoordinates }>();

  /**
   * Validates if the given coordinates are valid GPS coordinates
   * Latitude: -90 to +90
   * Longitude: -180 to +180
   */
  public validateCoordinates(coords: Coordinates): boolean {
    if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
      return false;
    }
    
    if (coords.lat < -90 || coords.lat > 90) {
      return false;
    }
    
    if (coords.lng < -180 || coords.lng > 180) {
      return false;
    }
    
    return true;
  }

  public async geocode(address: string): Promise<GeocodedCoordinates> {
    if (!address?.trim()) {
      return this.kigaliFallback;
    }

    const normalizedQuery = this.normalizeRwandaAddress(address);
    const cacheKey = normalizedQuery.toLowerCase();
    const cached = this.geocodeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const providers = this.getProviderOrder();
    for (const provider of providers) {
      try {
        const result = await this.geocodeWithProvider(provider, normalizedQuery);
        if (result && this.isRwandaCoordinate(result)) {
          this.geocodeCache.set(cacheKey, {
            value: result,
            expiresAt: Date.now() + Number(process.env.GEOCODING_CACHE_TTL_MS || 24 * 60 * 60 * 1000),
          });
          return result;
        }
      } catch {
        // Try the next provider. The final fallback below keeps checkout usable offline.
      }
    }

    return this.kigaliFallback;
  }

  public async reverseGeocode(coords: Coordinates): Promise<Address> {
    if (!this.validateCoordinates(coords)) {
      return { address: 'Unknown Location', city: 'Kigali' };
    }

    const providers = this.getProviderOrder();
    for (const provider of providers) {
      try {
        const result = await this.reverseGeocodeWithProvider(provider, coords);
        if (result) return result;
      } catch {
        // Try the next provider. The fallback below keeps maps/order flows usable.
      }
    }

    return { address: 'Unknown Location', city: 'Kigali', provider: 'fallback' };
  }

  /**
   * Calculates straight-line distance between two coordinates using Haversine formula
   */
  public calculateDistance(from: Coordinates, to: Coordinates): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(to.lat - from.lat);
    const dLon = this.deg2rad(to.lng - from.lng);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(from.lat)) * Math.cos(this.deg2rad(to.lat)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
      
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance; // Distance in km
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  private normalizeRwandaAddress(address: string): string {
    const trimmed = address.trim().replace(/\s+/g, ' ');
    return /rwanda|kigali|rubavu|musanze|huye|nyagatare|nyarugenge|gasabo|kicukiro/i.test(trimmed)
      ? trimmed
      : `${trimmed}, Rwanda`;
  }

  private getProviderOrder(): Array<'mapbox' | 'opencage' | 'nominatim'> {
    const configured = String(process.env.GEOCODER_PROVIDER || 'auto').toLowerCase();
    if (configured === 'mapbox') return ['mapbox', 'opencage', 'nominatim'];
    if (configured === 'opencage') return ['opencage', 'mapbox', 'nominatim'];
    if (configured === 'nominatim') return ['nominatim'];

    const providers: Array<'mapbox' | 'opencage' | 'nominatim'> = [];
    if (process.env.MAPBOX_ACCESS_TOKEN) providers.push('mapbox');
    if (process.env.OPENCAGE_API_KEY) providers.push('opencage');
    providers.push('nominatim');
    return providers;
  }

  private async geocodeWithProvider(provider: 'mapbox' | 'opencage' | 'nominatim', query: string): Promise<GeocodedCoordinates | null> {
    if (provider === 'mapbox') return this.geocodeWithMapbox(query);
    if (provider === 'opencage') return this.geocodeWithOpenCage(query);
    return this.geocodeWithNominatim(query);
  }

  private async reverseGeocodeWithProvider(provider: 'mapbox' | 'opencage' | 'nominatim', coords: Coordinates): Promise<Address | null> {
    if (provider === 'mapbox') return this.reverseGeocodeWithMapbox(coords);
    if (provider === 'opencage') return this.reverseGeocodeWithOpenCage(coords);
    return this.reverseGeocodeWithNominatim(coords);
  }

  private async geocodeWithMapbox(query: string): Promise<GeocodedCoordinates | null> {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) return null;
    const params = new URLSearchParams({
      access_token: token,
      country: 'rw',
      limit: '1',
      proximity: '30.0619,-1.9441',
      types: 'address,poi,place,locality,neighborhood',
    });
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`;
    const response = await this.fetchJson<{ features?: MapboxFeature[] }>(url);
    const feature = response.features?.[0];
    const lng = Number(feature?.center?.[0]);
    const lat = Number(feature?.center?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      provider: 'mapbox',
      formattedAddress: feature?.place_name,
      confidence: this.confidenceFromScore(Number(feature?.relevance || 0) * 10),
    };
  }

  private async geocodeWithOpenCage(query: string): Promise<GeocodedCoordinates | null> {
    const key = process.env.OPENCAGE_API_KEY;
    if (!key) return null;
    const params = new URLSearchParams({
      q: query,
      key,
      countrycode: 'rw',
      limit: '1',
      no_annotations: '1',
    });
    const response = await this.fetchJson<{ results?: OpenCageResult[] }>(`https://api.opencagedata.com/geocode/v1/json?${params.toString()}`);
    const result = response.results?.[0];
    const lat = Number(result?.geometry?.lat);
    const lng = Number(result?.geometry?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      provider: 'opencage',
      formattedAddress: result?.formatted,
      confidence: this.confidenceFromScore(Number(result?.confidence || 0)),
    };
  }

  private async geocodeWithNominatim(query: string): Promise<GeocodedCoordinates | null> {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'rw',
      addressdetails: '1',
    });
    const results = await this.fetchJson<NominatimSearchResult[]>(`${process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org'}/search?${params.toString()}`);
    const firstResult = results[0];
    const lat = Number(firstResult?.lat);
    const lng = Number(firstResult?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      provider: 'nominatim',
      formattedAddress: firstResult?.display_name,
      confidence: 'medium',
    };
  }

  private async reverseGeocodeWithMapbox(coords: Coordinates): Promise<Address | null> {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) return null;
    const params = new URLSearchParams({
      access_token: token,
      country: 'rw',
      limit: '1',
      types: 'address,poi,place,locality,neighborhood',
    });
    const response = await this.fetchJson<{ features?: MapboxFeature[] }>(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.lng},${coords.lat}.json?${params.toString()}`,
    );
    const feature = response.features?.[0];
    if (!feature?.place_name) return null;
    return {
      address: feature.place_name,
      city: this.cityFromMapboxFeature(feature),
      provider: 'mapbox',
    };
  }

  private async reverseGeocodeWithOpenCage(coords: Coordinates): Promise<Address | null> {
    const key = process.env.OPENCAGE_API_KEY;
    if (!key) return null;
    const params = new URLSearchParams({
      q: `${coords.lat},${coords.lng}`,
      key,
      countrycode: 'rw',
      limit: '1',
      no_annotations: '1',
    });
    const response = await this.fetchJson<{ results?: OpenCageResult[] }>(
      `https://api.opencagedata.com/geocode/v1/json?${params.toString()}`,
    );
    const result = response.results?.[0];
    if (!result?.formatted) return null;
    return {
      address: result.formatted,
      city: this.cityFromAddress(result.formatted),
      provider: 'opencage',
    };
  }

  private async reverseGeocodeWithNominatim(coords: Coordinates): Promise<Address | null> {
    const params = new URLSearchParams({
      lat: String(coords.lat),
      lon: String(coords.lng),
      format: 'jsonv2',
    });
    const baseUrl = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
    const result = await this.fetchJson<NominatimReverseResult>(`${baseUrl}/reverse?${params.toString()}`);
    const city = result.address?.city || result.address?.town || result.address?.village || result.address?.county || result.address?.state || 'Kigali';
    return {
      address: result.display_name || 'Unknown Location',
      city,
      provider: 'nominatim',
    };
  }

  private cityFromMapboxFeature(feature: MapboxFeature): string {
    const directCity = feature.context?.find(item => /place|locality|district|region/.test(item.id || ''))?.text;
    if (directCity) return directCity;
    return this.cityFromAddress(feature.place_name || '');
  }

  private cityFromAddress(address: string): string {
    const known = ['Kigali', 'Rubavu', 'Musanze', 'Huye', 'Nyagatare', 'Nyarugenge', 'Gasabo', 'Kicukiro', 'Rwamagana', 'Muhanga'];
    return known.find(city => address.toLowerCase().includes(city.toLowerCase())) || 'Kigali';
  }

  private isRwandaCoordinate(coords: Coordinates): boolean {
    return coords.lat >= -2.95 && coords.lat <= -1.0 && coords.lng >= 28.7 && coords.lng <= 31.1;
  }

  private confidenceFromScore(score: number): GeocodeConfidence {
    if (score >= 8) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const timeoutMs = Number(process.env.GEOCODING_TIMEOUT_MS || 3000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': process.env.GEOCODING_USER_AGENT || process.env.NOMINATIM_USER_AGENT || 'rwshop-location-service/1.0 contact:ops@rwshop.org',
        },
      });

      if (!response.ok) {
        throw new Error(`Geocoding provider returned ${response.status}`);
      }

      return await response.json() as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
