export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Address {
  address: string;
  city: string;
}

export interface RouteDto {
  distanceKm: number;
  estimatedMinutes: number;
  actualMinutes?: number;
}
