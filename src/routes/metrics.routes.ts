import { Router, Request, Response } from 'express';
import MetricsService from '../services/metrics.service';
import { logger } from '../utils/logger.util';

const router = Router();

/**
 * @swagger
 * /metrics:
 *   get:
 *     tags: [Monitoring]
 *     summary: Get Prometheus metrics
 *     description: Returns metrics in Prometheus format for scraping
 *     responses:
 *       200:
 *         description: Metrics in Prometheus format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const metrics = await MetricsService.getMetrics();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    logger.error('Failed to get metrics', { error: error as Error });
    res.status(500).send('Failed to collect metrics');
  }
});

/**
 * @swagger
 * /metrics/json:
 *   get:
 *     tags: [Monitoring]
 *     summary: Get metrics as JSON
 *     description: Returns metrics in JSON format for easier parsing
 *     responses:
 *       200:
 *         description: Metrics in JSON format
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 */
router.get('/json', async (_req: Request, res: Response) => {
  try {
    const metrics = await MetricsService.getMetricsJSON();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get metrics JSON', { error: error as Error });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to collect metrics',
        code: 'METRICS_ERROR',
      },
    });
  }
});

export default router;
