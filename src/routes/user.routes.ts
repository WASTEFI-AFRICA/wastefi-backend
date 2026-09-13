import { Router } from 'express';
import { body, query } from 'express-validator';
import { UserController } from '../controllers/user.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';

const router = Router();

/**
 * @route   GET /api/v1/users/me
 * @desc    Get current user details
 * @access  Private
 */
router.get('/me', authenticateJWT, UserController.getCurrentUser);

/**
 * @route   PUT /api/v1/users/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put(
  '/me',
  authenticateJWT,
  [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('email').optional().isEmail(),
    body('address').optional().trim(),
    body('city').optional().trim(),
    validate,
  ],
  UserController.updateProfile
);

/**
 * @route   POST /api/v1/users/kyc/submit
 * @desc    Submit KYC documents
 * @access  Private
 */
router.post(
  '/kyc/submit',
  authenticateJWT,
  [
    body('nationalId').notEmpty().withMessage('National ID is required'),
    body('idDocumentUrl').optional().isURL().withMessage('Invalid document URL'),
    body('photoUrl').optional().isURL().withMessage('Invalid photo URL'),
    body('address').notEmpty().withMessage('Address is required'),
    body('city').notEmpty().withMessage('City is required'),
    validate,
  ],
  UserController.submitKYC
);

/**
 * @route   GET /api/v1/users/kyc/status
 * @desc    Get KYC verification status
 * @access  Private
 */
router.get('/kyc/status', authenticateJWT, UserController.getKYCStatus);

/**
 * @route   POST /api/v1/users/:userId/kyc/verify
 * @desc    Verify user KYC (Admin only)
 * @access  Private (Admin)
 */
router.post(
  '/:userId/kyc/verify',
  authenticateJWT,
  requireRole('ADMIN', 'VERIFIER'),
  [
    body('approved').isBoolean().withMessage('Approval status is required'),
    body('notes').optional().trim(),
    validate,
  ],
  UserController.verifyKYC
);

/**
 * @route   GET /api/v1/users
 * @desc    List users with filters (Admin only)
 * @access  Private (Admin)
 */
router.get(
  '/',
  authenticateJWT,
  requireRole('ADMIN'),
  [
    query('status').optional().isIn(['PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED']),
    query('role').optional().isIn(['COLLECTOR', 'ADMIN', 'COLLECTION_POINT', 'VERIFIER']),
    query('kycStatus').optional().isIn(['NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    validate,
  ],
  UserController.listUsers
);

/**
 * @route   GET /api/v1/users/:userId
 * @desc    Get user by ID (Admin only)
 * @access  Private (Admin)
 */
router.get('/:userId', authenticateJWT, requireRole('ADMIN'), UserController.getUserById);

/**
 * @route   PUT /api/v1/users/:userId/status
 * @desc    Update user status (Admin only)
 * @access  Private (Admin)
 */
router.put(
  '/:userId/status',
  authenticateJWT,
  requireRole('ADMIN'),
  [
    body('status').isIn(['ACTIVE', 'SUSPENDED', 'BANNED']).withMessage('Invalid status'),
    body('reason').optional().trim(),
    validate,
  ],
  UserController.updateUserStatus
);

/**
 * @route   DELETE /api/v1/users/:userId
 * @desc    Delete user (Admin only)
 * @access  Private (Admin)
 */
router.delete('/:userId', authenticateJWT, requireRole('ADMIN'), UserController.deleteUser);

export default router;
