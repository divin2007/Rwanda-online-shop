import { marketApi } from './api';

export type LocationSearchResult = {
  lat: number;
  lng: number;
  label: string;
  provider?: string;
  confidence?: string;
};

export type ReverseGeocodeResult = {
  address: string;
  city: string;
  provider?: string;
};

export const searchRwandaLocation = async (query: string): Promise<LocationSearchResult[]> => {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) return [];

  const response = await marketApi.get('/markets/geocode/search', {
    params: { query: trimmedQuery },
  });
  const data = response.data?.data;
  if (!data || !Number.isFinite(Number(data.lat)) || !Number.isFinite(Number(data.lng))) {
    return [];
  }

  return [
    {
      lat: Number(data.lat),
      lng: Number(data.lng),
      label: data.formattedAddress || `${trimmedQuery}, Rwanda`,
      provider: data.provider,
      confidence: data.confidence,
    },
  ];
};

export const reverseGeocodeRwandaLocation = async (lat: number, lng: number): Promise<ReverseGeocodeResult | null> => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const response = await marketApi.get('/markets/geocode/reverse', {
    params: { lat, lng },
  });
  return response.data?.data || null;
};

