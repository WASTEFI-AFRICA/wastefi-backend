/**
 * Backup Management Routes
 * Admin-only routes for database backup and recovery
 */

import { Router } from 'express';
import backupController from '../controllers/backup.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// All backup routes require admin authentication
router.use(authenticate, requireRole('ADMIN'));

/**
 * @route   POST /api/v1/admin/backups
 * @desc    Create new backup
 * @access  Admin
 */
router.post('/', backupController.createBackup);

/**
 * @route   GET /api/v1/admin/backups
 * @desc    List all backups
 * @access  Admin
 */
router.get('/', backupController.listBackups);

/**
 * @route   GET /api/v1/admin/backups/stats
 * @desc    Get backup statistics
 * @access  Admin
 */
router.get('/stats', backupController.getStatistics);

/**
 * @route   POST /api/v1/admin/backups/cleanup
 * @desc    Cleanup old backups
 * @access  Admin
 */
router.post('/cleanup', backupController.cleanupBackups);

/**
 * @route   GET /api/v1/admin/backups/:filename
 * @desc    Get backup details
 * @access  Admin
 */
router.get('/:filename', backupController.getBackup);

/**
 * @route   POST /api/v1/admin/backups/:filename/restore
 * @desc    Restore from backup
 * @access  Admin
 */
router.post('/:filename/restore', backupController.restoreBackup);

/**
 * @route   DELETE /api/v1/admin/backups/:filename
 * @desc    Delete backup
 * @access  Admin
 */
router.delete('/:filename', backupController.deleteBackup);

export default router;
