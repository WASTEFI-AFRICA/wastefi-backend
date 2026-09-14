import { Router } from 'express';
import { query } from 'express-validator';
import { AdminController } from '../controllers/admin.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';

const router = Router();

// All admin routes require authentication and ADMIN role
router.use(authenticateJWT, requireRole('ADMIN'));

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Get comprehensive dashboard statistics
 * @access  Private (Admin only)
 */
router.get('/dashboard', AdminController.getDashboardStats);

/**
 * @route   GET /api/v1/admin/activity
 * @desc    Get recent activity logs
 * @access  Private (Admin only)
 */
router.get(
  '/activity',
  [query('limit').optional().isInt({ min: 1, max: 200 }).toInt(), validate],
  AdminController.getRecentActivity
);

/**
 * @route   GET /api/v1/admin/health
 * @desc    Get system health status
 * @access  Private (Admin only)
 */
router.get('/health', AdminController.getSystemHealth);

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get users list with filters
 * @access  Private (Admin only)
 */
router.get(
  '/users',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('role').optional().isIn(['ADMIN', 'COLLECTOR', 'COLLECTION_POINT']),
    query('kycStatus').optional().isIn(['PENDING', 'APPROVED', 'REJECTED', 'NOT_SUBMITTED']),
    query('status').optional().isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
    query('search').optional().isString(),
    validate,
  ],
  AdminController.getUsers
);

/**
 * @route   GET /api/v1/admin/collections
 * @desc    Get collections list with filters
 * @access  Private (Admin only)
 */
router.get(
  '/collections',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isString(),
    query('materialType').optional().isString(),
    query('collectionPointId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    validate,
  ],
  AdminController.getCollections
);

/**
 * @route   GET /api/v1/admin/transactions
 * @desc    Get transactions list with filters
 * @access  Private (Admin only)
 */
router.get(
  '/transactions',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('type').optional().isString(),
    query('status').optional().isIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']),
    query('paymentMethod').optional().isIn(['STELLAR', 'MPESA', 'MTN_MONEY', 'AIRTEL_MONEY']),
    query('userId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    validate,
  ],
  AdminController.getTransactions
);

/**
 * @route   GET /api/v1/admin/analytics
 * @desc    Get analytics data for charts
 * @access  Private (Admin only)
 */
router.get(
  '/analytics',
  [
    query('period').optional().isIn(['7d', '30d', '90d', '1y']),
    query('type').optional().isIn(['collections', 'transactions', 'users']),
    validate,
  ],
  AdminController.getAnalytics
);

/**
 * @route   GET /api/v1/admin/export
 * @desc    Export data to CSV/JSON
 * @access  Private (Admin only)
 */
router.get(
  '/export',
  [
    query('type').isIn(['users', 'collections', 'transactions']),
    query('format').optional().isIn(['json', 'csv']),
    validate,
  ],
  AdminController.exportData
);

export default router;
