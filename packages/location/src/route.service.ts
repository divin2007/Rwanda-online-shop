import { Coordinates, RouteDto } from './interfaces/location.interface';
import { LocationService } from './location.service';

export class RouteService {
  private locationService: LocationService;

  constructor() {
    this.locationService = new LocationService();
  }

  /**
   * Calculates the optimal route using the OSRM Public API
   * Follows the nearest road network instead of a straight line
   */
  public async getOptimizedRoute(from: Coordinates, to: Coordinates): Promise<RouteDto> {
    try {
      // Request full geometry in GeoJSON format
      const url = `http://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = route.distance / 1000;
        const estimatedMinutes = Math.ceil(route.duration / 60) + 5;

        // OSRM GeoJSON gives [lng, lat], Leaflet needs [lat, lng]
        const geometry = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);

        return {
          distanceKm: Number(distanceKm.toFixed(2)),
          estimatedMinutes,
          geometry
        };
      }
    } catch (error) {
      console.warn('OSRM routing failed, falling back to straight-line estimate:', error);
    }

    // Fallback: Calculate straight-line distance with tortuosity factor
    const straightLineDist = this.locationService.calculateDistance(from, to);
    const distanceKm = straightLineDist * 1.4; // Average urban multiplier
    const estimatedMinutes = Math.ceil((distanceKm / 25) * 60) + 5;
    
    return {
      distanceKm: Number(distanceKm.toFixed(2)),
      estimatedMinutes
    };
  }
}
