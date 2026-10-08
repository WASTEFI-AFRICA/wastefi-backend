import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const unlinkAsync = promisify(fs.unlink);
const existsAsync = promisify(fs.exists);

export class FileUploadUtil {
  /**
   * Allowed image mime types
   */
  static readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  /**
   * Maximum file size (5MB)
   */
  static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

  /**
   * Upload directory
   */
  static readonly UPLOAD_DIR = path.join(process.cwd(), 'uploads');
  static readonly PROFILE_PICTURES_DIR = path.join(FileUploadUtil.UPLOAD_DIR, 'profile-pictures');

  /**
   * Initialize upload directories
   */
  static initializeDirectories(): void {
    const directories = [FileUploadUtil.UPLOAD_DIR, FileUploadUtil.PROFILE_PICTURES_DIR];

    directories.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Validate file type
   */
  static isValidImageType(mimetype: string): boolean {
    return FileUploadUtil.ALLOWED_IMAGE_TYPES.includes(mimetype);
  }

  /**
   * Generate unique filename
   */
  static generateFileName(userId: string, originalName: string): string {
    const timestamp = Date.now();
    const extension = path.extname(originalName);
    return `${userId}-${timestamp}${extension}`;
  }

  /**
   * Get file URL path
   */
  static getFileUrl(filename: string): string {
    return `/uploads/profile-pictures/${filename}`;
  }

  /**
   * Delete file from filesystem
   */
  static async deleteFile(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      if (await existsAsync(fullPath)) {
        await unlinkAsync(fullPath);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      // Don't throw error, just log it
    }
  }

  /**
   * Extract filename from URL path
   */
  static extractFilename(fileUrl: string): string {
    return path.basename(fileUrl);
  }

  /**
   * Get full file path from URL
   */
  static getFullPath(fileUrl: string): string {
    const filename = FileUploadUtil.extractFilename(fileUrl);
    return path.join(FileUploadUtil.PROFILE_PICTURES_DIR, filename);
  }
}
