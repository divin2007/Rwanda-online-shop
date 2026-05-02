import { LocationService } from '../location.service';

describe('LocationService', () => {
  let locationService: LocationService;

  beforeEach(() => {
    locationService = new LocationService();
  });

  describe('validateCoordinates', () => {
    it('should return true for valid coordinates', () => {
      expect(locationService.validateCoordinates({ lat: -1.9441, lng: 30.0619 })).toBe(true); // Kigali
      expect(locationService.validateCoordinates({ lat: 0, lng: 0 })).toBe(true);
      expect(locationService.validateCoordinates({ lat: 90, lng: 180 })).toBe(true);
      expect(locationService.validateCoordinates({ lat: -90, lng: -180 })).toBe(true);
    });

    it('should return false for invalid coordinates', () => {
      expect(locationService.validateCoordinates({ lat: 91, lng: 0 })).toBe(false);
      expect(locationService.validateCoordinates({ lat: -91, lng: 0 })).toBe(false);
      expect(locationService.validateCoordinates({ lat: 0, lng: 181 })).toBe(false);
      expect(locationService.validateCoordinates({ lat: 0, lng: -181 })).toBe(false);
    });
    
    it('should return false for missing or non-number values', () => {
      // @ts-ignore
      expect(locationService.validateCoordinates({ lat: '0', lng: 0 })).toBe(false);
      // @ts-ignore
      expect(locationService.validateCoordinates({ lat: 0 })).toBe(false);
      // @ts-ignore
      expect(locationService.validateCoordinates(null)).toBe(false);
    });
  });

  describe('calculateDistance', () => {
    it('should accurately calculate distance between two coordinates', () => {
      // Kigali Convention Centre
      const kcc = { lat: -1.9546, lng: 30.0924 };
      // Kigali Heights
      const kh = { lat: -1.9554, lng: 30.0933 };
      
      const distance = locationService.calculateDistance(kcc, kh);
      
      // Distance is approximately 130 meters (0.13 km)
      expect(distance).toBeGreaterThan(0.1);
      expect(distance).toBeLessThan(0.15);
    });
    
    it('should return 0 for identical coordinates', () => {
      const coord = { lat: -1.9441, lng: 30.0619 };
      expect(locationService.calculateDistance(coord, coord)).toBe(0);
    });
  });
});
