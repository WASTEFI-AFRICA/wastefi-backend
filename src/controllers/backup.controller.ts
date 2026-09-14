/**
 * Backup Management Controller
 * Admin-only endpoints for database backup and recovery
 */

import { Request, Response } from 'express';
import backupService from '../services/backup.service';
import { logger } from '../utils/logger.util';

export class BackupController {
  /**
   * Create new backup
   * POST /api/v1/admin/backups
   */
  async createBackup(req: Request, res: Response): Promise<void> {
    try {
      const { type = 'full' } = req.body;

      const metadata = await backupService.createBackup(type);

      res.status(201).json({
        success: true,
        message: 'Backup created successfully',
        data: metadata,
      });
    } catch (error) {
      logger.error('Create backup failed', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Backup Failed',
        message: 'Failed to create database backup',
      });
    }
  }

  /**
   * List all backups
   * GET /api/v1/admin/backups
   */
  async listBackups(_req: Request, res: Response): Promise<void> {
    try {
      const backups = await backupService.listBackups();

      res.json({
        success: true,
        data: backups,
        count: backups.length,
      });
    } catch (error) {
      logger.error('List backups failed', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to list backups',
      });
    }
  }

  /**
   * Get backup details
   * GET /api/v1/admin/backups/:filename
   */
  async getBackup(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;

      const backup = await backupService.getBackupInfo(filename);

      if (!backup) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Backup not found',
        });
        return;
      }

      res.json({
        success: true,
        data: backup,
      });
    } catch (error) {
      logger.error('Get backup failed', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to get backup details',
      });
    }
  }

  /**
   * Restore from backup
   * POST /api/v1/admin/backups/:filename/restore
   */
  async restoreBackup(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      const { verifyOnly = false } = req.body;

      await backupService.restoreBackup(filename, verifyOnly);

      res.json({
        success: true,
        message: verifyOnly ? 'Backup verified successfully' : 'Database restored successfully',
        filename,
      });
    } catch (error) {
      logger.error('Restore backup failed', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Restore Failed',
        message: 'Failed to restore database',
      });
    }
  }

  /**
   * Delete backup
   * DELETE /api/v1/admin/backups/:filename
   */
  async deleteBackup(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;

      await backupService.deleteBackup(filename);

      res.json({
        success: true,
        message: 'Backup deleted successfully',
        filename,
      });
    } catch (error) {
      logger.error('Delete backup failed', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Delete Failed',
        message: 'Failed to delete backup',
      });
    }
  }

  /**
   * Get backup statistics
   * GET /api/v1/admin/backups/stats
   */
  async getStatistics(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await backupService.getStatistics();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Get backup statistics failed', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to get backup statistics',
      });
    }
  }

  /**
   * Cleanup old backups
   * POST /api/v1/admin/backups/cleanup
   */
  async cleanupBackups(_req: Request, res: Response): Promise<void> {
    try {
      await backupService.cleanupOldBackups();

      res.json({
        success: true,
        message: 'Old backups cleaned up successfully',
      });
    } catch (error) {
      logger.error('Cleanup backups failed', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Cleanup Failed',
        message: 'Failed to cleanup old backups',
      });
    }
  }
}

export default new BackupController();
