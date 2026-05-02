import { Coordinates, RouteDto } from './interfaces/location.interface';
import { LocationService } from './location.service';

export class RouteService {
  private locationService: LocationService;

  constructor() {
    this.locationService = new LocationService();
  }

  /**
   * Stub for optimal route calculation (OSRM / Google Maps)
   * Falls back to straight-line distance with a multiplier for road distance
   */
  public async getOptimizedRoute(from: Coordinates, to: Coordinates): Promise<RouteDto> {
    // Calculate straight-line distance
    const straightLineDist = this.locationService.calculateDistance(from, to);
    
    // In absence of an actual routing engine, apply a tortuosity factor (1.4 is average for urban areas)
    const distanceKm = straightLineDist * 1.4;
    
    // Assume average speed of 25 km/h in Kigali traffic + 5 mins base time
    const estimatedMinutes = Math.ceil((distanceKm / 25) * 60) + 5;
    
    return {
      distanceKm: Number(distanceKm.toFixed(2)),
      estimatedMinutes
    };
  }
}
