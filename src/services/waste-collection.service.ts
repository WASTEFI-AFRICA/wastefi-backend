import { prisma } from './database.service';
import { TransactionStatus } from '@prisma/client';
import { MaterialPricingUtil } from '../utils/material-pricing.util';

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
    const paymentAmount = MaterialPricingUtil.calculatePayment(
      data.materialType,
      data.weight
    );

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

    return collection;
  }

  /**
   * Get collection by ID
   */
  static async getCollectionById(id: string) {
    return prisma.wasteCollection.findUnique({
      where: { id },
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
  static async listCollections(
    filters: CollectionFilters,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.collectorId) where.collectorId = filters.collectorId;
    if (filters.collectionPointId) where.collectionPointId = filters.collectionPointId;
    if (filters.materialType) where.materialType = filters.materialType;
    if (filters.status) where.paymentStatus = filters.status;

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
        orderBy: { createdAt: 'desc' },
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
    adjustedAmount?: number
  ) {
    const collection = await prisma.wasteCollection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new Error('Collection not found');
    }

    if (collection.verifiedAt) {
      throw new Error('Collection already verified');
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
    }

    return prisma.wasteCollection.update({
      where: { id: collectionId },
      data: updateData,
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

    const existingUrls = collection.imageUrls
      ? JSON.parse(collection.imageUrls)
      : [];
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

    const [
      totalCollections,
      totalWeight,
      totalPayments,
      byMaterial,
      byStatus,
    ] = await Promise.all([
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
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.paymentStatus] = item._count;
        return acc;
      }, {} as Record<string, number>),
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
}
