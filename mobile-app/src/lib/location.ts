import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };

/**
 * Calculates the geodesic distance between two points on the Earth's surface
 * in kilometers using the Haversine formula.
 */
export const getDistanceKm = (fromLat: number, fromLng: number, toLat: number, toLng: number): number => {
  if (
    typeof fromLat !== 'number' ||
    typeof fromLng !== 'number' ||
    typeof toLat !== 'number' ||
    typeof toLng !== 'number' ||
    Number.isNaN(fromLat) ||
    Number.isNaN(fromLng) ||
    Number.isNaN(toLat) ||
    Number.isNaN(toLng)
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Requests device location permission and returns current latitude/longitude coordinates if granted.
 * Falls back to null gracefully on any decline or error.
 */
export async function requestLocationAndCoords(): Promise<Coords | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    if (loc?.coords) {
      return {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      };
    }
  } catch (err) {
    console.warn('[Location] Failed to fetch device position:', err);
  }
  return null;
}
