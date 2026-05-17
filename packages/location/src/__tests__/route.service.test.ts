import { RouteService } from '../route.service';

describe('RouteService', () => {
  let routeService: RouteService;

  beforeEach(() => {
    routeService = new RouteService();
  });

  describe('getOptimizedRoute', () => {
    it('should calculate an estimated route distance and time', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        json: async () => ({
          code: 'Ok',
          routes: [
            {
              distance: 6200,
              duration: 840,
              geometry: {
                coordinates: [
                  [30.0924, -1.9546],
                  [30.1265, -1.9365]
                ]
              }
            }
          ]
        })
      } as Response);

      // Kigali Convention Centre
      const from = { lat: -1.9546, lng: 30.0924 };
      // Kimironko Market
      const to = { lat: -1.9365, lng: 30.1265 };
      
      const route = await routeService.getOptimizedRoute(from, to);
      
      expect(route).toBeDefined();
      expect(route.distanceKm).toBeGreaterThan(0);
      expect(route.estimatedMinutes).toBeGreaterThan(0);
      
      expect(route.distanceKm).toBe(6.2);
      
      expect(route.estimatedMinutes).toBe(19);
      expect(route.geometry).toEqual([
        [-1.9546, 30.0924],
        [-1.9365, 30.1265]
      ]);
    });
  });
});
