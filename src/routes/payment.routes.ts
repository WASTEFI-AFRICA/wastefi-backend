import { Router } from 'express';
import { body, query } from 'express-validator';
import { PaymentController } from '../controllers/payment.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';

const router = Router();

/**
 * @route   POST /api/v1/payments/process
 * @desc    Process payment for collection (Admin only)
 * @access  Private (Admin)
 */
router.post(
  '/process',
  authenticateJWT,
  requireRole('ADMIN', 'COLLECTION_POINT'),
  [body('collectionId').notEmpty().isUUID(), validate],
  PaymentController.processCollectionPayment
);

/**
 * @route   GET /api/v1/payments/transactions/me
 * @desc    Get current user's transaction history
 * @access  Private
 */
router.get(
  '/transactions/me',
  authenticateJWT,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    validate,
  ],
  PaymentController.getUserTransactions
);

/**
 * @route   GET /api/v1/payments/transactions/:id
 * @desc    Get transaction by ID
 * @access  Private
 */
router.get('/transactions/:id', authenticateJWT, PaymentController.getTransaction);

/**
 * @route   POST /api/v1/payments/transactions/:id/retry
 * @desc    Retry failed payment
 * @access  Private (Admin)
 */
router.post(
  '/transactions/:id/retry',
  authenticateJWT,
  requireRole('ADMIN'),
  PaymentController.retryPayment
);

/**
 * @route   POST /api/v1/payments/withdraw
 * @desc    Request withdrawal to mobile money
 * @access  Private
 */
router.post(
  '/withdraw',
  authenticateJWT,
  [
    body('amount').isFloat({ min: 100 }).withMessage('Minimum withdrawal is KES 100'),
    body('phoneNumber')
      .matches(/^\+?[1-9]\d{1,14}$/)
      .withMessage('Invalid phone number'),
    body('paymentMethod')
      .isIn(['MPESA', 'MTN_MONEY', 'AIRTEL_MONEY'])
      .withMessage('Invalid payment method'),
    validate,
  ],
  PaymentController.requestWithdrawal
);

/**
 * @route   GET /api/v1/payments/statistics
 * @desc    Get payment statistics
 * @access  Private (Admin)
 */
router.get(
  '/statistics',
  authenticateJWT,
  requireRole('ADMIN'),
  [query('startDate').optional().isISO8601(), query('endDate').optional().isISO8601(), validate],
  PaymentController.getStatistics
);

/**
 * @route   DELETE /api/v1/payments/transactions/:id
 * @desc    Cancel pending transaction
 * @access  Private
 */
router.delete('/transactions/:id', authenticateJWT, PaymentController.cancelTransaction);

/**
 * @route   POST /api/v1/payments/callbacks/mpesa
 * @desc    M-Pesa payment callback
 * @access  Public (called by M-Pesa)
 */
router.post('/callbacks/mpesa', PaymentController.mpesaCallback);

/**
 * @route   POST /api/v1/payments/callbacks/mtn
 * @desc    MTN Money payment callback
 * @access  Public (called by MTN)
 */
router.post('/callbacks/mtn', PaymentController.mtnCallback);

/**
 * @route   POST /api/v1/payments/callbacks/airtel
 * @desc    Airtel Money payment callback
 * @access  Public (called by Airtel)
 */
router.post('/callbacks/airtel', PaymentController.airtelCallback);

export default router;
