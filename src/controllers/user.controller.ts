import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { UserService } from '../services/user.service';
import { logger } from '../utils/logger.util';

export class UserController {
  /**
   * Get current user details
   */
  static async getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const user = await UserService.getUserById(req.user.userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error('Failed to get current user', {
        error: error as Error,
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user details',
      });
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const updatedUser = await UserService.updateProfile(req.user.userId, req.body);

      logger.info('User profile updated', { userId: req.user.userId });

      res.status(200).json({
        success: true,
        data: updatedUser,
        message: 'Profile updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update profile', {
        error: error as Error,
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to update profile',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Submit KYC documents
   */
  static async submitKYC(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const result = await UserService.submitKYC(req.user.userId, req.body);

      logger.info('KYC documents submitted', { userId: req.user.userId });

      res.status(200).json({
        success: true,
        data: result,
        message: 'KYC documents submitted successfully. Awaiting verification.',
      });
    } catch (error) {
      logger.error('Failed to submit KYC', {
        error: error as Error,
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to submit KYC',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get KYC verification status
   */
  static async getKYCStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const status = await UserService.getKYCStatus(req.user.userId);

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Failed to get KYC status', {
        error: error as Error,
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch KYC status',
      });
    }
  }

  /**
   * Verify user KYC (Admin/Verifier only)
   */
  static async verifyKYC(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { userId } = req.params;
      const { approved, notes } = req.body;

      const result = await UserService.verifyKYC(userId, approved, req.user.userId, notes);

      logger.info('KYC verification completed', {
        userId,
        verifierId: req.user.userId,
        approved,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: approved ? 'KYC approved successfully' : 'KYC rejected',
      });
    } catch (error) {
      logger.error('Failed to verify KYC', {
        error: error as Error,
        userId: req.params.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to verify KYC',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * List users with filters (Admin only)
   */
  static async listUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status, role, kycStatus, page = 1, limit = 10 } = req.query;

      const filters = {
        status: status as string | undefined,
        role: role as string | undefined,
        kycStatus: kycStatus as string | undefined,
      };

      const result = await UserService.listUsers(filters, Number(page), Number(limit));

      res.status(200).json({
        success: true,
        data: result.users,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to list users', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch users',
      });
    }
  }

  /**
   * Get user by ID (Admin only)
   */
  static async getUserById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const user = await UserService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error('Failed to get user by ID', {
        error: error as Error,
        userId: req.params.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user',
      });
    }
  }

  /**
   * Update user status (Admin only)
   */
  static async updateUserStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { status, reason } = req.body;

      const updatedUser = await UserService.updateUserStatus(userId, status, reason);

      logger.info('User status updated', {
        userId,
        newStatus: status,
        updatedBy: req.user?.userId,
      });

      res.status(200).json({
        success: true,
        data: updatedUser,
        message: 'User status updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update user status', {
        error: error as Error,
        userId: req.params.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to update user status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete user (Admin only)
   */
  static async deleteUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      await UserService.deleteUser(userId);

      logger.warn('User deleted', { userId, deletedBy: req.user?.userId });

      res.status(200).json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete user', {
        error: error as Error,
        userId: req.params.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to delete user',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
