import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { WasteCollectionService } from '../services/waste-collection.service';
import { logger } from '../utils/logger.util';

export class WasteCollectionController {
  /**
   * Record new waste collection
   */
  static async recordCollection(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const collection = await WasteCollectionService.recordCollection(req.user.userId, req.body);

      logger.info('Waste collection recorded', {
        collectionId: collection.id,
        collectorId: req.user.userId,
        materialType: collection.materialType,
        weight: collection.weight,
      });

      res.status(201).json({
        success: true,
        data: collection,
        message: 'Waste collection recorded successfully',
      });
    } catch (error) {
      logger.error('Failed to record waste collection', {
        error: error as Error,
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to record waste collection',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get collection by ID
   */
  static async getCollectionById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const collection = await WasteCollectionService.getCollectionById(id);

      if (!collection) {
        res.status(404).json({
          success: false,
          error: 'Collection not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: collection,
      });
    } catch (error) {
      logger.error('Failed to get collection', {
        error: error as Error,
        collectionId: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch collection',
      });
    }
  }

  /**
   * List collections with filters
   */
  static async listCollections(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        collectorId,
        collectionPointId,
        materialType,
        status,
        startDate,
        endDate,
        page = 1,
        limit = 20,
      } = req.query;

      const filters = {
        collectorId: collectorId as string,
        collectionPointId: collectionPointId as string,
        materialType: materialType as string,
        status: status as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      };

      const result = await WasteCollectionService.listCollections(
        filters,
        Number(page),
        Number(limit)
      );

      res.status(200).json({
        success: true,
        data: result.collections,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to list collections', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch collections',
      });
    }
  }

  /**
   * Get user's collection history
   */
  static async getUserCollections(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { page = 1, limit = 20 } = req.query;

      const result = await WasteCollectionService.getUserCollections(
        req.user.userId,
        Number(page),
        Number(limit)
      );

      res.status(200).json({
        success: true,
        data: result.collections,
        pagination: result.pagination,
        summary: result.summary,
      });
    } catch (error) {
      logger.error('Failed to get user collections', {
        error: error as Error,
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch collections',
      });
    }
  }

  /**
   * Verify waste collection (Admin/Verifier)
   */
  static async verifyCollection(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const { approved, notes, adjustedWeight, adjustedAmount } = req.body;

      const collection = await WasteCollectionService.verifyCollection(
        id,
        req.user.userId,
        approved,
        notes,
        adjustedWeight,
        adjustedAmount
      );

      logger.info('Waste collection verified', {
        collectionId: id,
        verifierId: req.user.userId,
        approved,
      });

      res.status(200).json({
        success: true,
        data: collection,
        message: approved ? 'Collection verified successfully' : 'Collection rejected',
      });
    } catch (error) {
      logger.error('Failed to verify collection', {
        error: error as Error,
        collectionId: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to verify collection',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Upload collection images
   */
  static async uploadImages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { collectionId } = req.params;
      const { imageUrls } = req.body;

      if (!imageUrls || !Array.isArray(imageUrls)) {
        res.status(400).json({
          success: false,
          error: 'Image URLs array is required',
        });
        return;
      }

      const updated = await WasteCollectionService.addImages(collectionId, imageUrls);

      logger.info('Collection images uploaded', {
        collectionId,
        imageCount: imageUrls.length,
      });

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Images uploaded successfully',
      });
    } catch (error) {
      logger.error('Failed to upload images', {
        error: error as Error,
        collectionId: req.params.collectionId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to upload images',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get collection statistics
   */
  static async getStatistics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId, collectionPointId, startDate, endDate } = req.query;

      const filters = {
        userId: userId as string,
        collectionPointId: collectionPointId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      };

      const stats = await WasteCollectionService.getStatistics(filters);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get statistics', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
      });
    }
  }

  /**
   * Delete collection (Admin only)
   */
  static async deleteCollection(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await WasteCollectionService.deleteCollection(id);

      logger.warn('Collection deleted', {
        collectionId: id,
        deletedBy: req.user?.userId,
      });

      res.status(200).json({
        success: true,
        message: 'Collection deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete collection', {
        error: error as Error,
        collectionId: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to delete collection',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
