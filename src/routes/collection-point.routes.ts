import { Router } from 'express';
import { body, query } from 'express-validator';
import { CollectionPointController } from '../controllers/collection-point.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';

const router = Router();

/**
 * @route   GET /api/v1/collection-points
 * @desc    List all active collection points with optional filters
 * @access  Public
 */
router.get(
  '/',
  [
    query('city').optional().trim(),
    query('country').optional().trim(),
    query('latitude').optional().isFloat(),
    query('longitude').optional().isFloat(),
    query('radius').optional().isFloat({ min: 0.1, max: 100 }), // km
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    validate,
  ],
  CollectionPointController.listCollectionPoints
);

/**
 * @route   GET /api/v1/collection-points/nearby
 * @desc    Find nearby collection points based on user location
 * @access  Public
 */
router.get(
  '/nearby',
  [
    query('latitude').notEmpty().isFloat({ min: -90, max: 90 }),
    query('longitude').notEmpty().isFloat({ min: -180, max: 180 }),
    query('radius').optional().isFloat({ min: 0.1, max: 100 }).toFloat(), // km, default 10
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    validate,
  ],
  CollectionPointController.findNearby
);

/**
 * @route   GET /api/v1/collection-points/:id
 * @desc    Get collection point details by ID
 * @access  Public
 */
router.get('/:id', CollectionPointController.getCollectionPointById);

/**
 * @route   POST /api/v1/collection-points
 * @desc    Create new collection point
 * @access  Private (Admin only)
 */
router.post(
  '/',
  authenticateJWT,
  requireRole('ADMIN'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('description').optional().trim(),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    body('address').trim().notEmpty().withMessage('Address is required'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('country').optional().trim(),
    body('contactPerson').trim().notEmpty().withMessage('Contact person is required'),
    body('contactPhone').trim().notEmpty().withMessage('Contact phone is required'),
    body('contactEmail').optional().isEmail(),
    body('operatingHours').optional().isObject(),
    body('acceptedMaterials').optional().isArray(),
    validate,
  ],
  CollectionPointController.createCollectionPoint
);

/**
 * @route   PUT /api/v1/collection-points/:id
 * @desc    Update collection point
 * @access  Private (Admin only)
 */
router.put(
  '/:id',
  authenticateJWT,
  requireRole('ADMIN'),
  [
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('address').optional().trim(),
    body('city').optional().trim(),
    body('contactPerson').optional().trim(),
    body('contactPhone').optional().trim(),
    body('contactEmail').optional().isEmail(),
    body('operatingHours').optional().isObject(),
    body('acceptedMaterials').optional().isArray(),
    body('isActive').optional().isBoolean(),
    validate,
  ],
  CollectionPointController.updateCollectionPoint
);

/**
 * @route   DELETE /api/v1/collection-points/:id
 * @desc    Delete collection point (soft delete)
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  authenticateJWT,
  requireRole('ADMIN'),
  CollectionPointController.deleteCollectionPoint
);

/**
 * @route   POST /api/v1/collection-points/:id/verify
 * @desc    Verify collection point
 * @access  Private (Admin only)
 */
router.post(
  '/:id/verify',
  authenticateJWT,
  requireRole('ADMIN'),
  CollectionPointController.verifyCollectionPoint
);

export default router;
