import { RouteService } from '../route.service';

describe('RouteService', () => {
  let routeService: RouteService;

  beforeEach(() => {
    routeService = new RouteService();
  });

  describe('getOptimizedRoute', () => {
    it('should calculate an estimated route distance and time', async () => {
      // Kigali Convention Centre
      const from = { lat: -1.9546, lng: 30.0924 };
      // Kimironko Market
      const to = { lat: -1.9365, lng: 30.1265 };
      
      const route = await routeService.getOptimizedRoute(from, to);
      
      expect(route).toBeDefined();
      expect(route.distanceKm).toBeGreaterThan(0);
      expect(route.estimatedMinutes).toBeGreaterThan(0);
      
      // Straight line is ~4.3km, with 1.4 tortuosity it's ~6km
      expect(route.distanceKm).toBeGreaterThan(5);
      expect(route.distanceKm).toBeLessThan(7);
      
      // At 25km/h, 6km takes ~14 mins + 5 min base = ~19 mins
      expect(route.estimatedMinutes).toBeGreaterThan(15);
      expect(route.estimatedMinutes).toBeLessThan(25);
    });
  });
});
