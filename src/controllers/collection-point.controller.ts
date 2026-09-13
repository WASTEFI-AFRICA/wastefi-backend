import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { CollectionPointService } from '../services/collection-point.service';
import { logger } from '../utils/logger.util';

export class CollectionPointController {
  /**
   * List collection points with filters
   */
  static async listCollectionPoints(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { city, country, latitude, longitude, radius, limit } = req.query;

      const filters = {
        city: city as string,
        country: country as string,
        latitude: latitude ? parseFloat(latitude as string) : undefined,
        longitude: longitude ? parseFloat(longitude as string) : undefined,
        radius: radius ? parseFloat(radius as string) : undefined,
      };

      const collectionPoints = await CollectionPointService.listCollectionPoints(
        filters,
        limit ? parseInt(limit as string) : undefined
      );

      res.status(200).json({
        success: true,
        data: collectionPoints,
        count: collectionPoints.length,
      });
    } catch (error) {
      logger.error('Failed to list collection points', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch collection points',
      });
    }
  }

  /**
   * Find nearby collection points
   */
  static async findNearby(req: AuthRequest, res: Response): Promise<void> {
    try {
      const latitude = parseFloat(req.query.latitude as string);
      const longitude = parseFloat(req.query.longitude as string);
      const radius = req.query.radius ? parseFloat(req.query.radius as string) : 10;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const nearby = await CollectionPointService.findNearby(
        latitude,
        longitude,
        radius,
        limit
      );

      res.status(200).json({
        success: true,
        data: nearby,
        count: nearby.length,
      });
    } catch (error) {
      logger.error('Failed to find nearby collection points', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to find nearby collection points',
      });
    }
  }

  /**
   * Get collection point by ID
   */
  static async getCollectionPointById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const collectionPoint = await CollectionPointService.getCollectionPointById(id);

      if (!collectionPoint) {
        res.status(404).json({
          success: false,
          error: 'Collection point not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: collectionPoint,
      });
    } catch (error) {
      logger.error('Failed to get collection point', {
        error: error as Error,
        id: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch collection point',
      });
    }
  }

  /**
   * Create new collection point
   */
  static async createCollectionPoint(req: AuthRequest, res: Response): Promise<void> {
    try {
      const collectionPoint = await CollectionPointService.createCollectionPoint(req.body);

      logger.info('Collection point created', {
        id: collectionPoint.id,
        name: collectionPoint.name,
        createdBy: req.user?.userId,
      });

      res.status(201).json({
        success: true,
        data: collectionPoint,
        message: 'Collection point created successfully',
      });
    } catch (error) {
      logger.error('Failed to create collection point', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to create collection point',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update collection point
   */
  static async updateCollectionPoint(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const updated = await CollectionPointService.updateCollectionPoint(id, req.body);

      logger.info('Collection point updated', {
        id,
        updatedBy: req.user?.userId,
      });

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Collection point updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update collection point', {
        error: error as Error,
        id: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to update collection point',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete collection point (soft delete)
   */
  static async deleteCollectionPoint(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await CollectionPointService.deleteCollectionPoint(id);

      logger.warn('Collection point deleted', {
        id,
        deletedBy: req.user?.userId,
      });

      res.status(200).json({
        success: true,
        message: 'Collection point deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete collection point', {
        error: error as Error,
        id: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to delete collection point',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Verify collection point
   */
  static async verifyCollectionPoint(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const verified = await CollectionPointService.verifyCollectionPoint(id);

      logger.info('Collection point verified', {
        id,
        verifiedBy: req.user?.userId,
      });

      res.status(200).json({
        success: true,
        data: verified,
        message: 'Collection point verified successfully',
      });
    } catch (error) {
      logger.error('Failed to verify collection point', {
        error: error as Error,
        id: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to verify collection point',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
