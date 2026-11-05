import { Request, Response } from 'express';
import { PublicStatsService } from '../services/public-stats.service';
import { MaterialPricingUtil } from '../utils/material-pricing.util';
import { logger } from '../utils/logger.util';

export class PublicController {
  /**
   * Aggregate platform statistics, readable without logging in.
   */
  static async getStats(_req: Request, res: Response): Promise<void> {
    try {
      const data = await PublicStatsService.getStats();

      // Browsers and any CDN in front may reuse this for as long as the service does.
      res.set('Cache-Control', 'public, max-age=30');
      res.status(200).json({ success: true, data });
    } catch (error) {
      logger.error('Failed to load public stats', { error: error as Error });
      res.status(500).json({ success: false, error: 'Failed to load statistics' });
    }
  }

  /**
   * The materials the API accepts and what it pays for each, in KES per kg.
   */
  static getMaterials(_req: Request, res: Response): void {
    const materials = Object.entries(MaterialPricingUtil.getAllPrices()).map(
      ([materialType, price]) => ({
        materialType,
        category: price.category,
        description: price.description,
        pricePerKg: price.pricePerKg,
      })
    );
    res.set('Cache-Control', 'public, max-age=300');
    res.status(200).json({ success: true, data: { currency: 'KES', materials } });
  }
}
