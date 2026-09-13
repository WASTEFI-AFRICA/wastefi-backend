import { prisma } from './database.service';
import { GeolocationUtil } from '../utils/geolocation.util';

export interface CreateCollectionPointData {
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  country?: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail?: string;
  operatingHours?: object;
  acceptedMaterials?: string[];
}

export interface UpdateCollectionPointData {
  name?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  operatingHours?: object;
  acceptedMaterials?: string[];
  isActive?: boolean;
}

export interface CollectionPointFilters {
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

export class CollectionPointService {
  /**
   * List collection points with optional filters
   */
  static async listCollectionPoints(filters: CollectionPointFilters, limit?: number) {
    const where: any = {
      isActive: true,
    };

    if (filters.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    if (filters.country) {
      where.country = { contains: filters.country, mode: 'insensitive' };
    }

    const collectionPoints = await prisma.collectionPoint.findMany({
      where,
      take: limit || 50,
      orderBy: { createdAt: 'desc' },
    });

    // If location-based filtering is requested
    if (filters.latitude && filters.longitude && filters.radius) {
      const nearby = collectionPoints.filter((point) => {
        const distance = GeolocationUtil.calculateDistance(
          filters.latitude!,
          filters.longitude!,
          point.latitude,
          point.longitude
        );
        return distance <= filters.radius!;
      });

      // Add distance and sort by proximity
      return nearby
        .map((point) => ({
          ...point,
          distance: GeolocationUtil.calculateDistance(
            filters.latitude!,
            filters.longitude!,
            point.latitude,
            point.longitude
          ),
        }))
        .sort((a, b) => a.distance - b.distance);
    }

    return collectionPoints;
  }

  /**
   * Find nearby collection points
   */
  static async findNearby(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
    limit: number = 10
  ) {
    // Get all active collection points
    const allPoints = await prisma.collectionPoint.findMany({
      where: { isActive: true },
    });

    // Calculate distances and filter
    const nearby = allPoints
      .map((point) => ({
        ...point,
        distance: GeolocationUtil.calculateDistance(
          latitude,
          longitude,
          point.latitude,
          point.longitude
        ),
      }))
      .filter((point) => point.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return nearby;
  }

  /**
   * Get collection point by ID
   */
  static async getCollectionPointById(id: string) {
    return prisma.collectionPoint.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            collections: true,
          },
        },
      },
    });
  }

  /**
   * Create new collection point
   */
  static async createCollectionPoint(data: CreateCollectionPointData) {
    // Validate coordinates
    if (!GeolocationUtil.isValidCoordinate(data.latitude, data.longitude)) {
      throw new Error('Invalid coordinates');
    }

    return prisma.collectionPoint.create({
      data: {
        name: data.name,
        description: data.description,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address,
        city: data.city,
        country: data.country || 'Kenya',
        contactPerson: data.contactPerson,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        operatingHours: data.operatingHours ? JSON.stringify(data.operatingHours) : null,
        acceptedMaterials: data.acceptedMaterials
          ? JSON.stringify(data.acceptedMaterials)
          : null,
        isActive: true,
      },
    });
  }

  /**
   * Update collection point
   */
  static async updateCollectionPoint(id: string, data: UpdateCollectionPointData) {
    const existing = await prisma.collectionPoint.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Collection point not found');
    }

    // Validate coordinates if provided
    if (data.latitude !== undefined && data.longitude !== undefined) {
      if (!GeolocationUtil.isValidCoordinate(data.latitude, data.longitude)) {
        throw new Error('Invalid coordinates');
      }
    }

    const updateData: any = { ...data };

    // Handle JSON fields
    if (data.operatingHours) {
      updateData.operatingHours = JSON.stringify(data.operatingHours);
    }

    if (data.acceptedMaterials) {
      updateData.acceptedMaterials = JSON.stringify(data.acceptedMaterials);
    }

    return prisma.collectionPoint.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete collection point (soft delete)
   */
  static async deleteCollectionPoint(id: string): Promise<void> {
    const existing = await prisma.collectionPoint.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Collection point not found');
    }

    // Soft delete by setting isActive to false
    await prisma.collectionPoint.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Verify collection point
   */
  static async verifyCollectionPoint(id: string) {
    const existing = await prisma.collectionPoint.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Collection point not found');
    }

    return prisma.collectionPoint.update({
      where: { id },
      data: {
        verifiedAt: new Date(),
        isActive: true,
      },
    });
  }

  /**
   * Get collection point statistics
   */
  static async getStatistics(collectionPointId: string) {
    const [totalCollections, totalWeight, totalPayments] = await Promise.all([
      prisma.wasteCollection.count({
        where: { collectionPointId },
      }),
      prisma.wasteCollection.aggregate({
        where: { collectionPointId },
        _sum: { weight: true },
      }),
      prisma.wasteCollection.aggregate({
        where: { collectionPointId },
        _sum: { paymentAmount: true },
      }),
    ]);

    return {
      totalCollections,
      totalWeight: totalWeight._sum.weight || 0,
      totalPayments: totalPayments._sum.paymentAmount || 0,
    };
  }

  /**
   * Get nearby collection points for a user
   */
  static async getNearbyForUser(userId: string, _radiusKm: number = 10) {
    // Get user's last known location or registered address
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { city: true },
    });

    if (!user || !user.city) {
      // Return all active collection points if no user location
      return prisma.collectionPoint.findMany({
        where: { isActive: true },
        take: 10,
      });
    }

    // Find by city
    return prisma.collectionPoint.findMany({
      where: {
        isActive: true,
        city: { contains: user.city, mode: 'insensitive' },
      },
      take: 10,
    });
  }
}
