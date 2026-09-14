import { GeolocationUtil } from '../../../src/utils/geolocation.util';

describe('Geolocation Utility', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points correctly', () => {
      // Nairobi to Mombasa (approximately 440 km)
      const nairobi = { latitude: -1.286389, longitude: 36.817223 };
      const mombasa = { latitude: -4.043477, longitude: 39.668206 };
      
      const distance = GeolocationUtil.GeolocationUtil.calculateDistance(
        nairobi.latitude,
        nairobi.longitude,
        mombasa.latitude,
        mombasa.longitude
      );

      expect(distance).toBeGreaterThan(400);
      expect(distance).toBeLessThan(500);
    });

    it('should return 0 for same coordinates', () => {
      const distance = GeolocationUtil.calculateDistance(0, 0, 0, 0);
      expect(distance).toBe(0);
    });

    it('should handle equator crossing', () => {
      const north = { latitude: 1, longitude: 0 };
      const south = { latitude: -1, longitude: 0 };
      
      const distance = GeolocationUtil.calculateDistance(
        north.latitude,
        north.longitude,
        south.latitude,
        south.longitude
      );

      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeCloseTo(222.4, 0); // Approximately 222 km
    });

    it('should handle prime meridian crossing', () => {
      const east = { latitude: 0, longitude: 1 };
      const west = { latitude: 0, longitude: -1 };
      
      const distance = GeolocationUtil.calculateDistance(
        east.latitude,
        east.longitude,
        west.latitude,
        west.longitude
      );

      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeCloseTo(222.4, 0); // Approximately 222 km
    });

    it('should be symmetric', () => {
      const pointA = { latitude: -1.286389, longitude: 36.817223 };
      const pointB = { latitude: -4.043477, longitude: 39.668206 };
      
      const distanceAB = GeolocationUtil.calculateDistance(
        pointA.latitude,
        pointA.longitude,
        pointB.latitude,
        pointB.longitude
      );
      
      const distanceBA = GeolocationUtil.calculateDistance(
        pointB.latitude,
        pointB.longitude,
        pointA.latitude,
        pointA.longitude
      );

      expect(distanceAB).toBeCloseTo(distanceBA, 2);
    });

    it('should handle North Pole', () => {
      const northPole = { latitude: 90, longitude: 0 };
      const equator = { latitude: 0, longitude: 0 };
      
      const distance = GeolocationUtil.calculateDistance(
        northPole.latitude,
        northPole.longitude,
        equator.latitude,
        equator.longitude
      );

      expect(distance).toBeGreaterThan(10000);
      expect(distance).toBeCloseTo(10007.5, 0); // Quarter of Earth's circumference
    });

    it('should handle South Pole', () => {
      const southPole = { latitude: -90, longitude: 0 };
      const equator = { latitude: 0, longitude: 0 };
      
      const distance = GeolocationUtil.calculateDistance(
        southPole.latitude,
        southPole.longitude,
        equator.latitude,
        equator.longitude
      );

      expect(distance).toBeGreaterThan(10000);
      expect(distance).toBeCloseTo(10007.5, 0);
    });
  });

  describe('isWithinRadius', () => {
    const center = { latitude: -1.286389, longitude: 36.817223 }; // Nairobi

    it('should return true for point within radius', () => {
      // Point 5 km from center
      const nearbyPoint = { latitude: -1.331389, longitude: 36.817223 };
      
      const isWithin = GeolocationUtil.isWithinRadius(
        center.latitude,
        center.longitude,
        nearbyPoint.latitude,
        nearbyPoint.longitude,
        10 // 10 km radius
      );

      expect(isWithin).toBe(true);
    });

    it('should return false for point outside radius', () => {
      // Point 50 km from center
      const farPoint = { latitude: -1.736389, longitude: 36.817223 };
      
      const isWithin = GeolocationUtil.isWithinRadius(
        center.latitude,
        center.longitude,
        farPoint.latitude,
        farPoint.longitude,
        10 // 10 km radius
      );

      expect(isWithin).toBe(false);
    });

    it('should return true for exact center point', () => {
      const isWithin = GeolocationUtil.isWithinRadius(
        center.latitude,
        center.longitude,
        center.latitude,
        center.longitude,
        10
      );

      expect(isWithin).toBe(true);
    });

    it('should handle zero radius', () => {
      const isWithin = GeolocationUtil.isWithinRadius(
        center.latitude,
        center.longitude,
        center.latitude,
        center.longitude,
        0
      );

      expect(isWithin).toBe(true);
    });

    it('should handle very large radius', () => {
      // Point on opposite side of Earth
      const opposite = { latitude: 1.286389, longitude: -143.182777 };
      
      const isWithin = GeolocationUtil.isWithinRadius(
        center.latitude,
        center.longitude,
        opposite.latitude,
        opposite.longitude,
        25000 // Half Earth's circumference
      );

      expect(isWithin).toBe(true);
    });

    it('should handle negative radius (treat as positive)', () => {
      const nearbyPoint = { latitude: -1.331389, longitude: 36.817223 };
      
      const isWithin = GeolocationUtil.isWithinRadius(
        center.latitude,
        center.longitude,
        nearbyPoint.latitude,
        nearbyPoint.longitude,
        -10 // Negative radius should work same as positive
      );

      expect(isWithin).toBe(true);
    });
  });
});

