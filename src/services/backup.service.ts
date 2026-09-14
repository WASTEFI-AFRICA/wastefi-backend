/**
 * Database Backup & Recovery Service
 * Automated backup management with retention policies
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger.util';
import { config } from '../config';

const execAsync = promisify(exec);

interface BackupMetadata {
  filename: string;
  timestamp: Date;
  size: number;
  type: 'full' | 'incremental';
  status: 'success' | 'failed' | 'in_progress';
  duration?: number;
  error?: string;
}

interface BackupConfig {
  backupDir: string;
  retentionDays: number;
  maxBackups: number;
  compressionLevel: number;
}

export class BackupService {
  private config: BackupConfig;
  private backupDir: string;
  private metadataFile: string;

  constructor() {
    this.config = {
      backupDir: process.env.BACKUP_DIR || './backups/db',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
      maxBackups: parseInt(process.env.MAX_BACKUPS || '50'),
      compressionLevel: 9,
    };

    this.backupDir = path.resolve(this.config.backupDir);
    this.metadataFile = path.join(this.backupDir, 'backup-metadata.json');
  }

  /**
   * Initialize backup directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      logger.info('Backup directory initialized', { path: this.backupDir });
    } catch (error) {
      logger.error('Failed to initialize backup directory', { error: error as Error });
      throw error;
    }
  }

  /**
   * Create full database backup
   */
  async createBackup(type: 'full' | 'incremental' = 'full'): Promise<BackupMetadata> {
    const startTime = Date.now();
    const timestamp = new Date();
    const filename = this.generateFilename(type, timestamp);
    const filepath = path.join(this.backupDir, filename);

    const metadata: BackupMetadata = {
      filename,
      timestamp,
      size: 0,
      type,
      status: 'in_progress',
    };

    try {
      logger.info('Starting database backup', { filename, type });

      // Create backup using pg_dump
      const dbUrl = config.database.url;
      const command = this.buildBackupCommand(dbUrl, filepath);

      await execAsync(command);

      // Get file size
      const stats = await fs.stat(filepath);
      metadata.size = stats.size;
      metadata.status = 'success';
      metadata.duration = Date.now() - startTime;

      // Save metadata
      await this.saveMetadata(metadata);

      logger.info('Database backup completed', {
        filename,
        size: this.formatBytes(metadata.size),
        duration: metadata.duration,
      });

      // Clean up old backups
      await this.cleanupOldBackups();

      return metadata;
    } catch (error) {
      metadata.status = 'failed';
      metadata.error = (error as Error).message;
      metadata.duration = Date.now() - startTime;

      await this.saveMetadata(metadata);

      logger.error('Database backup failed', {
        filename,
        error: error as Error,
        duration: metadata.duration,
      });

      throw error;
    }
  }

  /**
   * Restore database from backup
   */
  async restoreBackup(filename: string, verifyOnly: boolean = false): Promise<void> {
    const filepath = path.join(this.backupDir, filename);

    try {
      // Check if backup file exists
      await fs.access(filepath);

      logger.info('Starting database restore', { filename, verifyOnly });

      if (verifyOnly) {
        // Verify backup integrity without restoring
        await this.verifyBackup(filepath);
        logger.info('Backup verification successful', { filename });
        return;
      }

      // Restore database using pg_restore
      const dbUrl = config.database.url;
      const command = this.buildRestoreCommand(dbUrl, filepath);

      await execAsync(command);

      logger.info('Database restore completed', { filename });
    } catch (error) {
      logger.error('Database restore failed', {
        filename,
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const metadataList = await this.loadAllMetadata();
      return metadataList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      logger.error('Failed to list backups', { error: error as Error });
      return [];
    }
  }

  /**
   * Get backup metadata
   */
  async getBackupInfo(filename: string): Promise<BackupMetadata | null> {
    const backups = await this.listBackups();
    return backups.find((b) => b.filename === filename) || null;
  }

  /**
   * Delete specific backup
   */
  async deleteBackup(filename: string): Promise<void> {
    const filepath = path.join(this.backupDir, filename);

    try {
      await fs.unlink(filepath);

      // Remove from metadata
      const metadataList = await this.loadAllMetadata();
      const filtered = metadataList.filter((m) => m.filename !== filename);
      await this.saveAllMetadata(filtered);

      logger.info('Backup deleted', { filename });
    } catch (error) {
      logger.error('Failed to delete backup', {
        filename,
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      let deleted = 0;

      // Delete backups older than retention period
      for (const backup of backups) {
        if (backup.timestamp < cutoffDate || backups.length - deleted > this.config.maxBackups) {
          await this.deleteBackup(backup.filename);
          deleted++;
        }
      }

      if (deleted > 0) {
        logger.info('Cleaned up old backups', {
          deleted,
          retentionDays: this.config.retentionDays,
        });
      }
    } catch (error) {
      logger.error('Failed to cleanup old backups', { error: error as Error });
    }
  }

  /**
   * Verify backup integrity
   */
  private async verifyBackup(filepath: string): Promise<void> {
    // For SQL dumps, verify it's valid gzip and readable
    const command = process.platform === 'win32' ? `type "${filepath}"` : `gzip -t "${filepath}"`;

    await execAsync(command);
  }

  /**
   * Build backup command
   */
  private buildBackupCommand(dbUrl: string, filepath: string): string {
    // Parse database URL
    const url = new URL(dbUrl);
    const [username, password] = url.username ? [url.username, url.password] : ['postgres', ''];
    const host = url.hostname;
    const port = url.port || '5432';
    const database = url.pathname.substring(1);

    if (process.platform === 'win32') {
      // Windows command
      return `set PGPASSWORD=${password}&& pg_dump -h ${host} -p ${port} -U ${username} -F c -b -v -f "${filepath}" ${database}`;
    } else {
      // Linux/Mac command
      return `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -F c -b -v -f "${filepath}" ${database}`;
    }
  }

  /**
   * Build restore command
   */
  private buildRestoreCommand(dbUrl: string, filepath: string): string {
    // Parse database URL
    const url = new URL(dbUrl);
    const [username, password] = url.username ? [url.username, url.password] : ['postgres', ''];
    const host = url.hostname;
    const port = url.port || '5432';
    const database = url.pathname.substring(1);

    if (process.platform === 'win32') {
      // Windows command
      return `set PGPASSWORD=${password}&& pg_restore -h ${host} -p ${port} -U ${username} -d ${database} -c -v "${filepath}"`;
    } else {
      // Linux/Mac command
      return `PGPASSWORD="${password}" pg_restore -h ${host} -p ${port} -U ${username} -d ${database} -c -v "${filepath}"`;
    }
  }

  /**
   * Generate backup filename
   */
  private generateFilename(type: string, timestamp: Date): string {
    const dateStr = timestamp.toISOString().replace(/[:.]/g, '-').split('T')[0];
    const timeStr = timestamp.toISOString().replace(/[:.]/g, '-').split('T')[1].split('Z')[0];
    return `wastefi_${type}_${dateStr}_${timeStr}.backup`;
  }

  /**
   * Save backup metadata
   */
  private async saveMetadata(metadata: BackupMetadata): Promise<void> {
    const metadataList = await this.loadAllMetadata();
    metadataList.push(metadata);
    await this.saveAllMetadata(metadataList);
  }

  /**
   * Load all metadata
   */
  private async loadAllMetadata(): Promise<BackupMetadata[]> {
    try {
      const data = await fs.readFile(this.metadataFile, 'utf-8');
      const parsed = JSON.parse(data);
      // Convert timestamp strings back to Date objects
      return parsed.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
    } catch (error) {
      // File doesn't exist yet
      return [];
    }
  }

  /**
   * Save all metadata
   */
  private async saveAllMetadata(metadataList: BackupMetadata[]): Promise<void> {
    await fs.writeFile(this.metadataFile, JSON.stringify(metadataList, null, 2));
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get backup statistics
   */
  async getStatistics(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
    successRate: number;
  }> {
    const backups = await this.listBackups();

    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    const successCount = backups.filter((b) => b.status === 'success').length;

    return {
      totalBackups: backups.length,
      totalSize,
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
      newestBackup: backups.length > 0 ? backups[0].timestamp : null,
      successRate: backups.length > 0 ? (successCount / backups.length) * 100 : 0,
    };
  }
}

// Export singleton instance
export default new BackupService();
