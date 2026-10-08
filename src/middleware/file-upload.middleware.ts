import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request } from 'express';
import { FileUploadUtil } from '../utils/file-upload.util';

// Initialize upload directories
FileUploadUtil.initializeDirectories();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, FileUploadUtil.PROFILE_PICTURES_DIR);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // @ts-ignore - user is added by auth middleware
    const userId = req.user?.userId || 'unknown';
    const fileName = FileUploadUtil.generateFileName(userId, file.originalname);
    cb(null, fileName);
  },
});

// File filter for validation
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (FileUploadUtil.isValidImageType(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Only ${FileUploadUtil.ALLOWED_IMAGE_TYPES.join(', ')} are allowed.`
      )
    );
  }
};

// Configure multer upload
export const profilePictureUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: FileUploadUtil.MAX_FILE_SIZE,
  },
});

/**
 * Middleware to handle multer errors
 */
export const handleUploadError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `File size too large. Maximum size is ${FileUploadUtil.MAX_FILE_SIZE / 1024 / 1024}MB.`,
      });
    }
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  } else if (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
  next();
};
