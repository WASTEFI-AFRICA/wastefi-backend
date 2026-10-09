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

export default router;
