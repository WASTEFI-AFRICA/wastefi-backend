import { Router } from 'express';
import { body, query } from 'express-validator';
import { MaterialPassportController } from '../controllers/material-passport.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';

const router = Router();

/**
 * @route   POST /api/v1/passports
 * @desc    Create material passport for a waste collection
 * @access  Private (Admin, Collection Point)
 */
router.post(
  '/',
  authenticateJWT,
  requireRole('ADMIN', 'COLLECTION_POINT'),
  [
    body('wasteCollectionId').notEmpty().isUUID(),
    body('productName').optional().isString(),
    body('manufacturer').optional().isString(),
    body('dimensions').optional().isObject(),
    body('color').optional().isString(),
    body('composition').optional().isObject(),
    body('manufacturingDate').optional().isISO8601(),
    body('expiryDate').optional().isISO8601(),
    body('recyclingInstructions').optional().isString(),
    validate,
  ],
  MaterialPassportController.createPassport
);

/**
 * @route   GET /api/v1/passports/me
 * @desc    Get current user's material passports
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
  MaterialPassportController.getUserPassports
);

/**
 * @route   GET /api/v1/passports/:id
 * @desc    Get material passport by ID
 * @access  Private
 */
router.get('/:id', authenticateJWT, MaterialPassportController.getPassport);

/**
 * @route   POST /api/v1/passports/:id/custody
 * @desc    Update passport custody/location
 * @access  Private (Admin, Collection Point)
 */
router.post(
  '/:id/custody',
  authenticateJWT,
  requireRole('ADMIN', 'COLLECTION_POINT'),
  [
    body('location').notEmpty().isString(),
    body('custodian').notEmpty().isString(),
    body('action').notEmpty().isString(),
    validate,
  ],
  MaterialPassportController.updateCustody
);

/**
 * @route   POST /api/v1/passports/:id/verify
 * @desc    Verify material passport authenticity
 * @access  Private (Admin)
 */
router.post(
  '/:id/verify',
  authenticateJWT,
  requireRole('ADMIN'),
  [body('verificationMethod').optional().isString(), validate],
  MaterialPassportController.verifyPassport
);

/**
 * @route   POST /api/v1/passports/:id/carbon-credits
 * @desc    Calculate carbon credits for passport
 * @access  Private
 */
router.post(
  '/:id/carbon-credits',
  authenticateJWT,
  MaterialPassportController.calculateCarbonCredits
);

export default router;
