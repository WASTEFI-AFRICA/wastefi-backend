import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { MaterialPassportService } from '../services/material-passport.service';
import { logger } from '../utils/logger.util';

export class MaterialPassportController {
  /**
   * Create material passport for a waste collection
   */
  static async createPassport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        wasteCollectionId,
        productName,
        manufacturer,
        dimensions,
        color,
        composition,
        manufacturingDate,
        expiryDate,
        recyclingInstructions,
      } = req.body;

      const result = await MaterialPassportService.createPassport({
        wasteCollectionId,
        productName,
        manufacturer,
        dimensions,
        color,
        composition,
        manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        recyclingInstructions,
      });

      res.status(201).json({
        success: true,
        data: result.passport,
        message: 'Material passport created successfully',
      });
    } catch (error) {
      logger.error('Failed to create material passport', {
        error: error as Error,
        userId: req.user?.userId,
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create material passport',
      });
    }
  }

  /**
   * Get material passport by ID
   */
  static async getPassport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await MaterialPassportService.getPassport(id);

      res.status(200).json({
        success: true,
        data: result.passport,
        recycleGraphData: result.recycleGraphData,
      });
    } catch (error) {
      logger.error('Failed to get material passport', {
        error: error as Error,
        passportId: req.params.id,
      });

      if (error instanceof Error && error.message === 'Material passport not found') {
        res.status(404).json({
          success: false,
          error: 'Material passport not found',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to fetch material passport',
      });
    }
  }

  /**
   * Update passport custody
   */
  static async updateCustody(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { location, custodian, action } = req.body;

      const result = await MaterialPassportService.updateCustody(
        id,
        location,
        custodian,
        action
      );

      res.status(200).json({
        success: true,
        data: result.passport,
        message: 'Custody updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update passport custody', {
        error: error as Error,
        passportId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update custody',
      });
    }
  }

  /**
   * Verify material passport
   */
  static async verifyPassport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { verificationMethod } = req.body;

      const result = await MaterialPassportService.verifyPassport(
        id,
        verificationMethod || 'MANUAL'
      );

      res.status(200).json({
        success: true,
        verified: result.verified,
        data: result.passport,
        message: result.verified
          ? 'Material passport verified successfully'
          : 'Verification failed',
      });
    } catch (error) {
      logger.error('Failed to verify passport', {
        error: error as Error,
        passportId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to verify passport',
      });
    }
  }

  /**
   * Calculate carbon credits for passport
   */
  static async calculateCarbonCredits(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await MaterialPassportService.calculateCarbonCredits(id);

      res.status(200).json({
        success: true,
        data: {
          passportId: id,
          carbonFootprint: result.carbonFootprint,
          carbonCreditsEarned: result.carbonCreditsEarned,
        },
        message: 'Carbon credits calculated successfully',
      });
    } catch (error) {
      logger.error('Failed to calculate carbon credits', {
        error: error as Error,
        passportId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to calculate carbon credits',
      });
    }
  }

  /**
   * Get user's material passports
   */
  static async getUserPassports(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await MaterialPassportService.getUserPassports(
        req.user.userId,
        page,
        limit
      );

      res.status(200).json({
        success: true,
        data: result.passports,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to get user passports', {
        error: error as Error,
        userId: req.user?.userId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch material passports',
      });
    }
  }
}
