import { Router } from 'express';
import { body, query } from 'express-validator';
import { WalletController } from '../controllers/wallet.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   POST /api/v1/wallet/create
 * @desc    Create or get user's Stellar wallet
 * @access  Private
 */
router.post('/create', authenticateJWT, WalletController.createWallet);

/**
 * @route   GET /api/v1/wallet/balance
 * @desc    Get wallet balance
 * @access  Private
 */
router.get('/balance', authenticateJWT, WalletController.getBalance);

/**
 * @route   GET /api/v1/wallet/transactions
 * @desc    Get transaction history
 * @access  Private
 */
router.get(
  '/transactions',
  authenticateJWT,
  [query('limit').optional().isInt({ min: 1, max: 100 }).toInt()],
  WalletController.getTransactionHistory
);

/**
 * @route   POST /api/v1/wallet/send
 * @desc    Send payment to another wallet
 * @access  Private
 */
router.post(
  '/send',
  authenticateJWT,
  [
    body('destinationPublicKey').notEmpty().withMessage('Destination public key is required'),
    body('amount').isFloat({ min: 0.0000001 }).withMessage('Invalid amount'),
    body('memo').optional().isString().isLength({ max: 28 }),
  ],
  WalletController.sendPayment
);

/**
 * @route   GET /api/v1/wallet/exchange-rate
 * @desc    Get XLM to KES exchange rate
 * @access  Public
 */
router.get('/exchange-rate', WalletController.getExchangeRate);

export default router;
