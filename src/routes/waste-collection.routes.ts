import { Router } from 'express';
import { body, query } from 'express-validator';
import { WasteCollectionController } from '../controllers/waste-collection.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';

const router = Router();

/**
 * @route   POST /api/v1/collections
 * @desc    Record new waste collection
 * @access  Private
 */
router.post(
  '/',
  authenticateJWT,
  [
    body('collectionPointId').notEmpty().withMessage('Collection point ID is required'),
    body('materialType').notEmpty().withMessage('Material type is required'),
    body('materialCategory').notEmpty().withMessage('Material category is required'),
    body('weight').isFloat({ min: 0.1 }).withMessage('Weight must be at least 0.1 kg'),
    body('quantity').optional().isInt({ min: 1 }),
    body('imageUrls').optional().isArray(),
    body('notes').optional().trim(),
    validate,
  ],
  WasteCollectionController.recordCollection
);

/**
 * @route   GET /api/v1/collections/me
 * @desc    Get current user's collection history
 * @access  Private
 */
router.get(
  '/me',
  authenticateJWT,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    validate,
  ],
  WasteCollectionController.getUserCollections
);

/**
 * @route   GET /api/v1/collections/statistics
 * @desc    Get collection statistics
 * @access  Private (Admin)
 */
router.get(
  '/statistics',
  authenticateJWT,
  requireRole('ADMIN', 'COLLECTION_POINT'),
  [
    query('userId').optional().isUUID(),
    query('collectionPointId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    validate,
  ],
  WasteCollectionController.getStatistics
);

/**
 * @route   GET /api/v1/collections
 * @desc    List all collections with filters
 * @access  Private (Admin/Collection Point)
 */
router.get(
  '/',
  authenticateJWT,
  requireRole('ADMIN', 'COLLECTION_POINT', 'VERIFIER'),
  [
    query('collectorId').optional().isUUID(),
    query('collectionPointId').optional().isUUID(),
    query('materialType').optional().trim(),
    query('status').optional().isIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    validate,
  ],
  WasteCollectionController.listCollections
);

/**
 * @route   GET /api/v1/collections/:id
 * @desc    Get collection by ID
 * @access  Private
 */
router.get('/:id', authenticateJWT, WasteCollectionController.getCollectionById);

/**
 * @route   POST /api/v1/collections/:id/verify
 * @desc    Verify waste collection
 * @access  Private (Admin/Verifier)
 */
router.post(
  '/:id/verify',
  authenticateJWT,
  requireRole('ADMIN', 'VERIFIER', 'COLLECTION_POINT'),
  [
    body('approved').isBoolean().withMessage('Approval status is required'),
    body('notes').optional().trim(),
    body('adjustedWeight').optional().isFloat({ min: 0.1 }),
    body('adjustedAmount').optional().isFloat({ min: 0 }),
    validate,
  ],
  WasteCollectionController.verifyCollection
);

/**
 * @route   POST /api/v1/collections/:collectionId/images
 * @desc    Add images to collection
 * @access  Private
 */
router.post(
  '/:collectionId/images',
  authenticateJWT,
  [
    body('imageUrls').isArray({ min: 1 }).withMessage('At least one image URL is required'),
    body('imageUrls.*').isURL().withMessage('Invalid image URL'),
    validate,
  ],
  WasteCollectionController.uploadImages
);

/**
 * @route   DELETE /api/v1/collections/:id
 * @desc    Delete collection
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  authenticateJWT,
  requireRole('ADMIN'),
  WasteCollectionController.deleteCollection
);

export default router;
