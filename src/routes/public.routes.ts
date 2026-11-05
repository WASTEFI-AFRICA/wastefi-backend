import { Router } from 'express';
import { PublicController } from '../controllers/public.controller';

const router = Router();

/**
 * @swagger
 * /api/v1/public/stats:
 *   get:
 *     summary: Aggregate platform statistics
 *     description: >
 *       Counts and totals across the platform, readable without authentication so
 *       the public stats page can show live numbers. Contains no personal data.
 *       Impact figures (weight, value, materials, recent activity) count verified
 *       collections only. Cached for 30 seconds.
 *     tags: [Public]
 *     security: []
 *     responses:
 *       200:
 *         description: Current statistics
 */

/**
 * @route   GET /api/v1/public/stats
 * @desc    Aggregate, anonymous platform statistics
 * @access  Public
 */
router.get('/stats', PublicController.getStats);

/**
 * @swagger
 * /api/v1/public/materials:
 *   get:
 *     summary: Materials and their prices
 *     description: >
 *       Every material the API accepts, with its category and the price per
 *       kilogram it pays, so clients never keep their own copy of the price list.
 *     tags: [Public]
 *     security: []
 *     responses:
 *       200:
 *         description: The price list
 */

/**
 * @route   GET /api/v1/public/materials
 * @desc    Accepted materials with their category and price per kg
 * @access  Public
 */
router.get('/materials', PublicController.getMaterials);

export default router;
