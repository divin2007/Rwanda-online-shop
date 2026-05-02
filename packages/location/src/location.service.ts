import { Coordinates, Address, RouteDto } from './interfaces/location.interface';

export class LocationService {
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

  /**
   * Stub for geocoding
   */
  public async geocode(address: string): Promise<Coordinates> {
    // In a real app, this would call Google Maps API or OSRM
    return { lat: -1.9441, lng: 30.0619 }; // Default to Kigali coordinates
  }

  /**
   * Stub for reverse geocoding
   */
  public async reverseGeocode(coords: Coordinates): Promise<Address> {
    // In a real app, this would call Google Maps API
    return { address: 'Unknown Location', city: 'Kigali' };
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
}
