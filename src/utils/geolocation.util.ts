/**
 * Geolocation utility functions
 */

export class GeolocationUtil {
  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in kilometers
   */
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Convert degrees to radians
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees
   */
  static toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  /**
   * Validate coordinates
   */
  static isValidCoordinate(latitude: number, longitude: number): boolean {
    return (
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      !isNaN(latitude) &&
      !isNaN(longitude)
    );
  }

  /**
   * Get bounding box for a given center point and radius
   * Returns {minLat, maxLat, minLon, maxLon}
   */
  static getBoundingBox(
    latitude: number,
    longitude: number,
    radiusKm: number
  ): {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  } {
    const latDelta = radiusKm / 111; // 1 degree latitude ≈ 111 km
    const lonDelta = radiusKm / (111 * Math.cos(this.toRadians(latitude)));

    return {
      minLat: latitude - latDelta,
      maxLat: latitude + latDelta,
      minLon: longitude - lonDelta,
      maxLon: longitude + lonDelta,
    };
  }

  /**
   * Format distance for display
   */
  static formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(1)}km`;
  }

  /**
   * Get compass bearing between two points
   * Returns bearing in degrees (0-360)
   */
  static getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = this.toRadians(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(this.toRadians(lat2));
    const x =
      Math.cos(this.toRadians(lat1)) * Math.sin(this.toRadians(lat2)) -
      Math.sin(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.cos(dLon);

    const bearing = this.toDegrees(Math.atan2(y, x));
    return (bearing + 360) % 360;
  }

  /**
   * Get cardinal direction from bearing
   */
  static getCardinalDirection(bearing: number): string {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  }

  /**
   * Check if a point is within a circular area
   */
  static isWithinRadius(
    pointLat: number,
    pointLon: number,
    centerLat: number,
    centerLon: number,
    radiusKm: number
  ): boolean {
    const distance = this.calculateDistance(pointLat, pointLon, centerLat, centerLon);
    return distance <= radiusKm;
  }

  /**
   * Get the midpoint between two coordinates
   */
  static getMidpoint(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): { latitude: number; longitude: number } {
    const dLon = this.toRadians(lon2 - lon1);

    const Bx = Math.cos(this.toRadians(lat2)) * Math.cos(dLon);
    const By = Math.cos(this.toRadians(lat2)) * Math.sin(dLon);

    const lat3 = Math.atan2(
      Math.sin(this.toRadians(lat1)) + Math.sin(this.toRadians(lat2)),
      Math.sqrt(
        (Math.cos(this.toRadians(lat1)) + Bx) * (Math.cos(this.toRadians(lat1)) + Bx) +
          By * By
      )
    );

    const lon3 = this.toRadians(lon1) + Math.atan2(By, Math.cos(this.toRadians(lat1)) + Bx);

    return {
      latitude: this.toDegrees(lat3),
      longitude: this.toDegrees(lon3),
    };
  }

  /**
   * Parse coordinates from various string formats
   */
  static parseCoordinates(coordString: string): { latitude: number; longitude: number } | null {
    // Try different formats: "lat,lon" or "lat, lon" or "lat lon"
    const cleaned = coordString.trim().replace(/\s+/g, ',');
    const parts = cleaned.split(',').map((p) => parseFloat(p.trim()));

    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      if (this.isValidCoordinate(parts[0], parts[1])) {
        return {
          latitude: parts[0],
          longitude: parts[1],
        };
      }
    }

    return null;
  }
}
