import { prisma } from './database.service';
import { TransactionStatus, KYCStatus, UserRole } from '@prisma/client';
import { logger } from '../utils/logger.util';

export interface DashboardStats {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalCollections: number;
    totalTransactions: number;
    totalRevenue: number;
    pendingKYC: number;
  };
  userStats: {
    byRole: Record<string, number>;
    byKYCStatus: Record<string, number>;
    newUsersThisMonth: number;
    newUsersThisWeek: number;
  };
  collectionStats: {
    totalWeight: number;
    byMaterial: Record<string, { count: number; weight: number }>;
    byStatus: Record<string, number>;
    thisMonth: number;
    thisWeek: number;
  };
  transactionStats: {
    totalVolume: number;
    byType: Record<string, { count: number; volume: number }>;
    byMethod: Record<string, { count: number; volume: number }>;
    byStatus: Record<string, number>;
    thisMonth: number;
    thisWeek: number;
  };
  collectionPointStats: {
    total: number;
    verified: number;
    byCounty: Record<string, number>;
    topCollectionPoints: Array<{
      id: string;
      name: string;
      county: string;
      collectionsCount: number;
    }>;
  };
}

export interface SystemHealth {
  database: {
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
  };
  services: {
    stellar: boolean;
    sms: boolean;
    email: boolean;
    mobileMoney: {
      mpesa: boolean;
      mtn: boolean;
      airtel: boolean;
    };
  };
}

export interface ActivityLog {
  id: string;
  action: string;
  userId: string;
  userName: string;
  details: string;
  timestamp: Date;
}

export class AdminService {
  /**
   * Get comprehensive dashboard statistics
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Overview stats
      const [
        totalUsers,
        activeUsers,
        totalCollections,
        totalTransactions,
        pendingKYC,
        revenue,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.wasteCollection.count(),
        prisma.transaction.count(),
        prisma.user.count({ where: { kycStatus: KYCStatus.PENDING } }),
        prisma.transaction.aggregate({
          where: { status: TransactionStatus.COMPLETED },
          _sum: { amount: true },
        }),
      ]);

      // User stats
      const [usersByRole, usersByKYC, newUsersMonth, newUsersWeek] = await Promise.all([
        prisma.user.groupBy({
          by: ['role'],
          _count: true,
        }),
        prisma.user.groupBy({
          by: ['kycStatus'],
          _count: true,
        }),
        prisma.user.count({
          where: { createdAt: { gte: startOfMonth } },
        }),
        prisma.user.count({
          where: { createdAt: { gte: startOfWeek } },
        }),
      ]);

      // Collection stats
      const [collectionsTotal, collectionsByMaterial, collectionsMonth, collectionsWeek] =
        await Promise.all([
          prisma.wasteCollection.aggregate({
            _sum: { weight: true },
          }),
          prisma.wasteCollection.groupBy({
            by: ['materialType'],
            _count: true,
            _sum: { weight: true },
          }),
          prisma.wasteCollection.count({
            where: { createdAt: { gte: startOfMonth } },
          }),
          prisma.wasteCollection.count({
            where: { createdAt: { gte: startOfWeek } },
          }),
        ]);

      // Collection status counts (manually)
      const [pendingCollections, verifiedCollections] = await Promise.all([
        prisma.wasteCollection.count({ where: { paymentStatus: TransactionStatus.PENDING } }),
        prisma.wasteCollection.count({ where: { verifiedAt: { not: null } } }),
      ]);

      // Transaction stats
      const [transactionsByType, transactionsByMethod, transactionsByStatus, transactionsMonth, transactionsWeek] =
        await Promise.all([
          prisma.transaction.groupBy({
            by: ['type'],
            _count: true,
            _sum: { amount: true },
          }),
          prisma.transaction.groupBy({
            by: ['paymentMethod'],
            _count: true,
            _sum: { amount: true },
          }),
          prisma.transaction.groupBy({
            by: ['status'],
            _count: true,
          }),
          prisma.transaction.count({
            where: { createdAt: { gte: startOfMonth } },
          }),
          prisma.transaction.count({
            where: { createdAt: { gte: startOfWeek } },
          }),
        ]);

      // Collection point stats
      const [totalPoints, verifiedPoints, pointsByCountry] = await Promise.all([
        prisma.collectionPoint.count(),
        prisma.collectionPoint.count({ where: { verifiedAt: { not: null } } }),
        prisma.collectionPoint.groupBy({
          by: ['country'],
          _count: true,
        }),
      ]);

      // Top collection points
      const topCollectionPoints = await prisma.collectionPoint.findMany({
        take: 5,
        select: {
          id: true,
          name: true,
          country: true,
        },
      });

      // Get collection counts for each point
      const pointsWithCounts = await Promise.all(
        topCollectionPoints.map(async (point) => {
          const count = await prisma.wasteCollection.count({
            where: { collectionPointId: point.id },
          });
          return {
            id: point.id,
            name: point.name,
            county: point.country,
            collectionsCount: count,
          };
        })
      );

      // Sort by count and take top 5
      const sortedPoints = pointsWithCounts.sort((a, b) => b.collectionsCount - a.collectionsCount).slice(0, 5);

      return {
        overview: {
          totalUsers,
          activeUsers,
          totalCollections,
          totalTransactions,
          totalRevenue: revenue._sum.amount || 0,
          pendingKYC,
        },
        userStats: {
          byRole: usersByRole.reduce((acc, item) => {
            acc[item.role] = item._count;
            return acc;
          }, {} as Record<string, number>),
          byKYCStatus: usersByKYC.reduce((acc, item) => {
            acc[item.kycStatus] = item._count;
            return acc;
          }, {} as Record<string, number>),
          newUsersThisMonth: newUsersMonth,
          newUsersThisWeek: newUsersWeek,
        },
        collectionStats: {
          totalWeight: collectionsTotal._sum.weight || 0,
          byMaterial: collectionsByMaterial.reduce((acc, item) => {
            acc[item.materialType] = {
              count: item._count,
              weight: item._sum.weight || 0,
            };
            return acc;
          }, {} as Record<string, { count: number; weight: number }>),
          byStatus: {
            PENDING: pendingCollections,
            VERIFIED: verifiedCollections,
          },
          thisMonth: collectionsMonth,
          thisWeek: collectionsWeek,
        },
        transactionStats: {
          totalVolume: revenue._sum.amount || 0,
          byType: transactionsByType.reduce((acc, item) => {
            acc[item.type] = {
              count: item._count,
              volume: item._sum.amount || 0,
            };
            return acc;
          }, {} as Record<string, { count: number; volume: number }>),
          byMethod: transactionsByMethod.reduce((acc, item) => {
            acc[item.paymentMethod] = {
              count: item._count,
              volume: item._sum.amount || 0,
            };
            return acc;
          }, {} as Record<string, { count: number; volume: number }>),
          byStatus: transactionsByStatus.reduce((acc, item) => {
            acc[item.status] = item._count;
            return acc;
          }, {} as Record<string, number>),
          thisMonth: transactionsMonth,
          thisWeek: transactionsWeek,
        },
        collectionPointStats: {
          total: totalPoints,
          verified: verifiedPoints,
          byCounty: pointsByCountry.reduce((acc, item) => {
            acc[item.country] = item._count;
            return acc;
          }, {} as Record<string, number>),
          topCollectionPoints: sortedPoints,
        },
      };
    } catch (error) {
      logger.error('Failed to get dashboard stats', { error: error as Error });
      throw error;
    }
  }

  /**
   * Get recent activity logs
   */
  static async getRecentActivity(limit: number = 50): Promise<ActivityLog[]> {
    try {
      // Get recent system logs
      const logs = await prisma.systemLog.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return logs.map((log) => ({
        id: log.id,
        action: log.level.toUpperCase(),
        userId: 'system',
        userName: log.service,
        details: log.message,
        timestamp: log.createdAt,
      }));
    } catch (error) {
      logger.error('Failed to get recent activity', { error: error as Error });
      throw error;
    }
  }

  /**
   * Get system health status
   */
  static async getSystemHealth(): Promise<SystemHealth> {
    try {
      // Test database connection
      const dbStart = Date.now();
      let dbStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
      let dbResponseTime = 0;

      try {
        await prisma.$queryRaw`SELECT 1`;
        dbResponseTime = Date.now() - dbStart;
        if (dbResponseTime > 1000) {
          dbStatus = 'degraded';
        }
      } catch (error) {
        dbStatus = 'down';
        dbResponseTime = Date.now() - dbStart;
      }

      // Check service availability
      const { SMSService } = await import('./sms.service');
      const { EmailService } = await import('./email.service');
      const { MobileMoneyService } = await import('./mobile-money/mobile-money.service');
      const { PaymentMethod } = await import('@prisma/client');

      return {
        database: {
          status: dbStatus,
          responseTime: dbResponseTime,
        },
        services: {
          stellar: true, // Always initialized
          sms: SMSService.isAvailable(),
          email: EmailService.isAvailable(),
          mobileMoney: {
            mpesa: MobileMoneyService.isProviderAvailable(PaymentMethod.MPESA),
            mtn: MobileMoneyService.isProviderAvailable(PaymentMethod.MTN_MONEY),
            airtel: MobileMoneyService.isProviderAvailable(PaymentMethod.AIRTEL_MONEY),
          },
        },
      };
    } catch (error) {
      logger.error('Failed to get system health', { error: error as Error });
      throw error;
    }
  }

  /**
   * Get users list with filters and pagination
   */
  static async getUsers(
    page: number = 1,
    limit: number = 20,
    filters?: {
      role?: UserRole;
      kycStatus?: KYCStatus;
      status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
      search?: string;
    }
  ) {
    try {
      const skip = (page - 1) * limit;
      const where: any = {};

      if (filters?.role) where.role = filters.role;
      if (filters?.kycStatus) where.kycStatus = filters.kycStatus;
      if (filters?.status) where.status = filters.status;
      if (filters?.search) {
        where.OR = [
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { lastName: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
          { phoneNumber: { contains: filters.search } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            role: true,
            status: true,
            kycStatus: true,
            createdAt: true,
            lastLoginAt: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to get users list', { error: error as Error });
      throw error;
    }
  }

  /**
   * Get all collections with filters and pagination
   */
  static async getCollections(
    page: number = 1,
    limit: number = 20,
    filters?: {
      status?: string;
      materialType?: string;
      collectionPointId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    try {
      const skip = (page - 1) * limit;
      const where: any = {};

      if (filters?.status) where.status = filters.status;
      if (filters?.materialType) where.materialType = filters.materialType;
      if (filters?.collectionPointId) where.collectionPointId = filters.collectionPointId;
      if (filters?.startDate || filters?.endDate) {
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
                firstName: true,
                lastName: true,
                phoneNumber: true,
              },
            },
            collectionPoint: {
              select: {
                name: true,
                country: true,
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
    } catch (error) {
      logger.error('Failed to get collections list', { error: error as Error });
      throw error;
    }
  }

  /**
   * Get all transactions with filters and pagination
   */
  static async getTransactions(
    page: number = 1,
    limit: number = 20,
    filters?: {
      type?: string;
      status?: TransactionStatus;
      paymentMethod?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    try {
      const skip = (page - 1) * limit;
      const where: any = {};

      if (filters?.type) where.type = filters.type;
      if (filters?.status) where.status = filters.status;
      if (filters?.paymentMethod) where.paymentMethod = filters.paymentMethod;
      if (filters?.userId) where.userId = filters.userId;
      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
      }

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phoneNumber: true,
              },
            },
          },
        }),
        prisma.transaction.count({ where }),
      ]);

      return {
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to get transactions list', { error: error as Error });
      throw error;
    }
  }

  /**
   * Log admin activity
   */
  static async logActivity(
    _userId: string,
    action: string,
    details?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.systemLog.create({
        data: {
          level: 'info',
          message: `${action}: ${details || ''}`,
          service: 'admin',
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
    } catch (error) {
      logger.error('Failed to log activity', { error: error as Error });
    }
  }
}
