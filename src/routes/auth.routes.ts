import { Router } from 'express';
import { body } from 'express-validator';
import { AuthController } from '../controllers/auth.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  [
    body('phoneNumber')
      .matches(/^\+?[1-9]\d{1,14}$/)
      .withMessage('Invalid phone number format'),
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
  ],
  AuthController.register
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  [
    body('phoneNumber')
      .matches(/^\+?[1-9]\d{1,14}$/)
      .withMessage('Invalid phone number format'),
  ],
  AuthController.login
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  AuthController.refreshToken
);

/**
 * @route   GET /api/v1/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateJWT, AuthController.getProfile);

/**
 * @route   POST /api/v1/auth/api-keys
 * @desc    Create API key
 * @access  Private
 */
router.post(
  '/api-keys',
  authenticateJWT,
  [body('name').trim().notEmpty().withMessage('API key name is required')],
  AuthController.createApiKey
);

/**
 * @route   GET /api/v1/auth/api-keys
 * @desc    List user's API keys
 * @access  Private
 */
router.get('/api-keys', authenticateJWT, AuthController.listApiKeys);

/**
 * @route   DELETE /api/v1/auth/api-keys/:keyId
 * @desc    Revoke API key
 * @access  Private
 */
router.delete('/api-keys/:keyId', authenticateJWT, AuthController.revokeApiKey);

export default router;
