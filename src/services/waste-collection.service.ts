import { prisma } from './database.service';
import { ChainStatus, TransactionStatus } from '@prisma/client';
import { OnChainCollectionService } from './onchain-collection.service';
import { MaterialPricingUtil } from '../utils/material-pricing.util';
import { cacheAside } from '../utils/cache.util';
import { AppError } from '../middleware/error.middleware';

export interface RecordCollectionData {
  collectionPointId: string;
  materialType: string;
  materialCategory: string;
  weight: number;
  quantity?: number;
  imageUrls?: string[];
  notes?: string;
}

export interface CollectionFilters {
  collectorId?: string;
  collectionPointId?: string;
  materialType?: string;
  status?: string;
  /** false: not yet reviewed (approved or rejected); true: reviewed */
  verified?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface StatisticsFilters {
  userId?: string;
  collectionPointId?: string;
  startDate?: Date;
  endDate?: Date;
}

export class WasteCollectionService {
  /**
   * Record new waste collection
   */
  static async recordCollection(collectorId: string, data: RecordCollectionData) {
    // Validate collection point exists
    const collectionPoint = await prisma.collectionPoint.findUnique({
      where: { id: data.collectionPointId },
    });

    if (!collectionPoint) {
      throw new Error('Collection point not found');
    }

    if (!collectionPoint.isActive) {
      throw new Error('Collection point is not active');
    }

    // Calculate payment amount based on material and weight
    const paymentAmount = MaterialPricingUtil.calculatePayment(data.materialType, data.weight);

    // Create collection record
    const collection = await prisma.wasteCollection.create({
      data: {
        collectorId,
        collectionPointId: data.collectionPointId,
        materialType: data.materialType,
        materialCategory: data.materialCategory,
        weight: data.weight,
        quantity: data.quantity,
        imageUrls: data.imageUrls ? JSON.stringify(data.imageUrls) : JSON.stringify([]),
        notes: data.notes,
        paymentAmount,
        paymentCurrency: 'KES',
        paymentStatus: TransactionStatus.PENDING,
      },
      include: {
        collector: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
          },
        },
        collectionPoint: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
          },
        },
      },
    });

    // Create the collector's wallet and on-chain registration now, so approving
    // this collection later only has to record and pay it.
    OnChainCollectionService.prepareCollector(collectorId);

    return collection;
  }

  /**
   * Get collection by ID
   */
  static async getCollectionById(id: string, collectionPointId?: string) {
    return prisma.wasteCollection.findFirst({
      where: { id, ...(collectionPointId ? { collectionPointId } : {}) },
      include: {
        collector: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
          },
        },
        collectionPoint: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
          },
        },
      },
    });
  }

  /**
   * List collections with filters and pagination
   */
  static async listCollections(filters: CollectionFilters, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.collectorId) where.collectorId = filters.collectorId;
    if (filters.collectionPointId) where.collectionPointId = filters.collectionPointId;

    // Enhanced material type search - supports partial matching
    if (filters.materialType) {
      where.materialType = {
        contains: filters.materialType,
        mode: 'insensitive',
      };
    }

    if (filters.status) where.paymentStatus = filters.status;

    if (filters.verified === true) where.verifiedAt = { not: null };
    if (filters.verified === false) where.verifiedAt = null;

    // Date range filtering
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [collections, total] = await Promise.all([
      prisma.wasteCollection.findMany({
        where,
        skip,
        take: limit,
        // The verification queue is worked oldest first; everything else newest first
        orderBy: { createdAt: filters.verified === false ? 'asc' : 'desc' },
        include: {
          collector: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
            },
          },
          collectionPoint: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
        },
      }),
      prisma.wasteCollection.count({ where }),
    ]);

    return {
      collections,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Get user's collection history
   */
  static async getUserCollections(userId: string, page: number = 1, limit: number = 20) {
    const result = await this.listCollections({ collectorId: userId }, page, limit);

    // Calculate summary statistics
    const summary = await prisma.wasteCollection.aggregate({
      where: { collectorId: userId },
      _sum: {
        weight: true,
        paymentAmount: true,
      },
      _count: true,
    });

    return {
      ...result,
      summary: {
        totalCollections: summary._count,
        totalWeight: summary._sum.weight || 0,
        totalEarnings: summary._sum.paymentAmount || 0,
      },
    };
  }

  /**
   * Verify waste collection
   */
  static async verifyCollection(
    collectionId: string,
    verifierId: string,
    approved: boolean,
    notes?: string,
    adjustedWeight?: number,
    adjustedAmount?: number,
    collectionPointId?: string
  ) {
    const collection = await prisma.wasteCollection.findFirst({
      where: { id: collectionId, ...(collectionPointId ? { collectionPointId } : {}) },
    });

    if (!collection) {
      throw new AppError('Collection not found', 404);
    }

    if (collection.verifiedAt) {
      throw new AppError('Collection already reviewed', 409);
    }

    const updateData: any = {
      verifiedAt: new Date(),
      verifiedBy: verifierId,
      notes: notes || collection.notes,
    };

    if (adjustedWeight) {
      updateData.weight = adjustedWeight;
    }

    if (adjustedAmount) {
      updateData.paymentAmount = adjustedAmount;
    } else if (adjustedWeight) {
      // Recalculate payment based on adjusted weight
      updateData.paymentAmount = MaterialPricingUtil.calculatePayment(
        collection.materialType,
        adjustedWeight
      );
    }

    if (!approved) {
      updateData.paymentStatus = TransactionStatus.CANCELLED;
    } else if (OnChainCollectionService.enabled) {
      // Approved collections are also recorded and paid on Soroban, in the background
      updateData.chainStatus = ChainStatus.PENDING;
    }

    // The conditional write prevents duplicate decisions and checks assignment
    // again if an administrator reassigns the operator while the request runs.
    const result = await prisma.wasteCollection.updateMany({
      where: {
        id: collectionId,
        verifiedAt: null,
        ...(collectionPointId
          ? {
              collectionPointId,
              collectionPoint: {
                isActive: true,
                operators: { some: { id: verifierId, role: 'COLLECTION_POINT', status: 'ACTIVE' } },
              },
            }
          : {}),
      },
      data: updateData,
    });
    if (result.count !== 1)
      throw new AppError(
        'Collection was already reviewed or your access changed. Refresh the queue.',
        409
      );
    const updated = await prisma.wasteCollection.findUniqueOrThrow({
      where: { id: collectionId },
      include: {
        collector: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (updateData.chainStatus === ChainStatus.PENDING) {
      OnChainCollectionService.kick(collectionId);
    }

    return updated;
  }

  /**
   * Add images to collection
   */
  static async addImages(collectionId: string, imageUrls: string[]) {
    const collection = await prisma.wasteCollection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new Error('Collection not found');
    }

    const existingUrls = collection.imageUrls ? JSON.parse(collection.imageUrls) : [];
    const updatedUrls = [...existingUrls, ...imageUrls];

    return prisma.wasteCollection.update({
      where: { id: collectionId },
      data: {
        imageUrls: JSON.stringify(updatedUrls),
      },
    });
  }

  /**
   * Get collection statistics
   */
  static async getStatistics(filters: StatisticsFilters) {
    const where: any = {};

    if (filters.userId) where.collectorId = filters.userId;
    if (filters.collectionPointId) where.collectionPointId = filters.collectionPointId;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [totalCollections, totalWeight, totalPayments, byMaterial, byStatus] = await Promise.all([
      prisma.wasteCollection.count({ where }),
      prisma.wasteCollection.aggregate({
        where,
        _sum: { weight: true },
      }),
      prisma.wasteCollection.aggregate({
        where,
        _sum: { paymentAmount: true },
      }),
      prisma.wasteCollection.groupBy({
        by: ['materialType'],
        where,
        _sum: {
          weight: true,
          paymentAmount: true,
        },
        _count: true,
      }),
      prisma.wasteCollection.groupBy({
        by: ['paymentStatus'],
        where,
        _count: true,
      }),
    ]);

    return {
      totalCollections,
      totalWeight: totalWeight._sum.weight || 0,
      totalPayments: totalPayments._sum.paymentAmount || 0,
      byMaterial: byMaterial.map((item) => ({
        materialType: item.materialType,
        count: item._count,
        totalWeight: item._sum.weight || 0,
        totalPayment: item._sum.paymentAmount || 0,
      })),
      byStatus: byStatus.reduce(
        (acc, item) => {
          acc[item.paymentStatus] = item._count;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }

  /**
   * Delete collection
   */
  static async deleteCollection(collectionId: string): Promise<void> {
    const collection = await prisma.wasteCollection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new Error('Collection not found');
    }

    if (collection.paymentStatus === TransactionStatus.COMPLETED) {
      throw new Error('Cannot delete completed collection');
    }

    await prisma.wasteCollection.delete({
      where: { id: collectionId },
    });
  }

  /**
   * Get material breakdown for a collector
   */
  static async getMaterialBreakdown(userId: string, startDate?: Date, endDate?: Date) {
    const where: any = { collectorId: userId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const breakdown = await prisma.wasteCollection.groupBy({
      by: ['materialType', 'materialCategory'],
      where,
      _sum: {
        weight: true,
        paymentAmount: true,
      },
      _count: true,
    });

    return breakdown.map((item) => ({
      materialType: item.materialType,
      materialCategory: item.materialCategory,
      collections: item._count,
      totalWeight: item._sum.weight || 0,
      totalEarnings: item._sum.paymentAmount || 0,
      averageWeight: (item._sum.weight || 0) / item._count,
      averageEarnings: (item._sum.paymentAmount || 0) / item._count,
    }));
  }

  /**
   * Get collection statistics by material type with caching
   */
  static async getMaterialStatistics(filters: {
    startDate?: Date;
    endDate?: Date;
    collectionPointId?: string;
  }) {
    const cacheKey = `material-stats:${filters.collectionPointId || 'all'}:${filters.startDate?.toISOString() || 'none'}:${filters.endDate?.toISOString() || 'none'}`;

    // Cached for 5 minutes; falls back to the database when Redis is unavailable.
    return cacheAside(cacheKey, () => this.computeMaterialStatistics(filters), { ttl: 300 });
  }

  private static async computeMaterialStatistics(filters: {
    startDate?: Date;
    endDate?: Date;
    collectionPointId?: string;
  }) {
    // Build where clause
    const where: any = {};

    if (filters.collectionPointId) {
      where.collectionPointId = filters.collectionPointId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    // Get statistics grouped by material type
    const materialStats = await prisma.wasteCollection.groupBy({
      by: ['materialType'],
      where,
      _sum: {
        weight: true,
        paymentAmount: true,
      },
      _count: true,
      _avg: {
        weight: true,
      },
    });

    // Get category breakdown
    const categoryStats = await prisma.wasteCollection.groupBy({
      by: ['materialCategory'],
      where,
      _sum: {
        weight: true,
      },
      _count: true,
    });

    // Format the response
    const result = {
      summary: {
        totalCollections: materialStats.reduce((sum, item) => sum + item._count, 0),
        totalWeight: materialStats.reduce((sum, item) => sum + (item._sum.weight || 0), 0),
        totalValue: materialStats.reduce((sum, item) => sum + (item._sum.paymentAmount || 0), 0),
      },
      byMaterialType: materialStats.map((item) => ({
        materialType: item.materialType,
        count: item._count,
        totalWeight: item._sum.weight || 0,
        averageWeight: item._avg.weight || 0,
        totalValue: item._sum.paymentAmount || 0,
        averageValue: (item._sum.paymentAmount || 0) / item._count,
      })),
      byCategory: categoryStats.map((item) => ({
        category: item.materialCategory,
        count: item._count,
        totalWeight: item._sum.weight || 0,
        percentage:
          ((item._sum.weight || 0) /
            categoryStats.reduce((sum, c) => sum + (c._sum.weight || 0), 1)) *
          100,
      })),
      filters: {
        startDate: filters.startDate?.toISOString(),
        endDate: filters.endDate?.toISOString(),
        collectionPointId: filters.collectionPointId,
      },
    };

    return result;
  }
}
