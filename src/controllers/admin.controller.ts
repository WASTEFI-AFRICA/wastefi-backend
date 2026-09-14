import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { AdminService } from '../services/admin.service';
import { logger } from '../utils/logger.util';
import { UserRole, KYCStatus, TransactionStatus } from '@prisma/client';

export class AdminController {
  /**
   * Get dashboard statistics
   */
  static async getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const stats = await AdminService.getDashboardStats();

      // Log admin activity
      AdminService.logActivity(req.user!.userId, 'VIEW_DASHBOARD', 'Viewed dashboard statistics');

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get dashboard stats', {
        error: error as Error,
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard statistics',
      });
    }
  }

  /**
   * Get recent activity logs
   */
  static async getRecentActivity(req: AuthRequest, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;

      const activity = await AdminService.getRecentActivity(limit);

      res.status(200).json({
        success: true,
        data: activity,
      });
    } catch (error) {
      logger.error('Failed to get recent activity', {
        error: error as Error,
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recent activity',
      });
    }
  }

  /**
   * Get system health status
   */
  static async getSystemHealth(req: AuthRequest, res: Response): Promise<void> {
    try {
      const health = await AdminService.getSystemHealth();

      res.status(200).json({
        success: true,
        data: health,
      });
    } catch (error) {
      logger.error('Failed to get system health', {
        error: error as Error,
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch system health',
      });
    }
  }

  /**
   * Get users list with filters
   */
  static async getUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { role, kycStatus, status, search } = req.query;

      const filters: any = {};
      if (role) filters.role = role as UserRole;
      if (kycStatus) filters.kycStatus = kycStatus as KYCStatus;
      if (status) filters.status = status;
      if (search) filters.search = search as string;

      const result = await AdminService.getUsers(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result.users,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to get users', {
        error: error as Error,
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch users',
      });
    }
  }

  /**
   * Get collections list with filters
   */
  static async getCollections(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { status, materialType, collectionPointId, startDate, endDate } = req.query;

      const filters: any = {};
      if (status) filters.status = status;
      if (materialType) filters.materialType = materialType;
      if (collectionPointId) filters.collectionPointId = collectionPointId as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const result = await AdminService.getCollections(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result.collections,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to get collections', {
        error: error as Error,
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch collections',
      });
    }
  }

  /**
   * Get transactions list with filters
   */
  static async getTransactions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { type, status, paymentMethod, userId, startDate, endDate } = req.query;

      const filters: any = {};
      if (type) filters.type = type;
      if (status) filters.status = status as TransactionStatus;
      if (paymentMethod) filters.paymentMethod = paymentMethod;
      if (userId) filters.userId = userId as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const result = await AdminService.getTransactions(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result.transactions,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to get transactions', {
        error: error as Error,
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transactions',
      });
    }
  }

  /**
   * Get analytics data for charts
   */
  static async getAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { period = '30d', type = 'collections' } = req.query;

      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      let data: any;

      if (type === 'collections') {
        // Get collections analytics
        data = await AdminService.getCollections(1, 1000, {
          startDate,
          endDate: now,
        });
      } else if (type === 'transactions') {
        // Get transactions analytics
        data = await AdminService.getTransactions(1, 1000, {
          startDate,
          endDate: now,
        });
      } else if (type === 'users') {
        // Get users analytics
        data = await AdminService.getUsers(1, 1000, {});
      }

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Failed to get analytics', {
        error: error as Error,
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch analytics',
      });
    }
  }

  /**
   * Export data to CSV
   */
  static async exportData(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { type = 'users', format = 'json' } = req.query;

      let data: any;

      switch (type) {
        case 'users':
          data = await AdminService.getUsers(1, 10000, {});
          break;
        case 'collections':
          data = await AdminService.getCollections(1, 10000, {});
          break;
        case 'transactions':
          data = await AdminService.getTransactions(1, 10000, {});
          break;
        default:
          res.status(400).json({
            success: false,
            error: 'Invalid export type',
          });
          return;
      }

      // Log export activity
      AdminService.logActivity(req.user!.userId, 'EXPORT_DATA', `Exported ${type} data`, {
        type,
        format,
      });

      if (format === 'csv') {
        // For CSV, we'll return JSON for now
        // In production, you'd convert to CSV format
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${type}-${Date.now()}.csv`);
      }

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Failed to export data', {
        error: error as Error,
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to export data',
      });
    }
  }
}
