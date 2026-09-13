import { Response, NextFunction } from 'express';
import { JWTUtil } from '../utils/jwt.util';
import { EncryptionUtil } from '../utils/encryption.util';
import { AuthRequest } from '../types/auth.types';
import { prisma } from '../services/database.service';
import { UserRole } from '@prisma/client';

/**
 * Middleware to authenticate JWT token
 */
export const authenticateJWT = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = JWTUtil.verifyToken(token);

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        status: true,
        role: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'User is not active',
      });
      return;
    }

    // Attach user to request
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Invalid token',
    });
  }
};

/**
 * Middleware to authenticate API key
 */
export const authenticateApiKey = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'No API key provided',
      });
      return;
    }

    // Hash the provided API key
    const hashedKey = EncryptionUtil.hashApiKey(apiKey);

    // Find API key in database
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { key: hashedKey },
      include: {
        user: {
          select: {
            id: true,
            status: true,
            role: true,
          },
        },
      },
    });

    if (!apiKeyRecord || !apiKeyRecord.isActive) {
      res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid API key',
      });
      return;
    }

    // Check expiration
    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'API key has expired',
      });
      return;
    }

    // Check user status
    if (apiKeyRecord.user.status !== 'ACTIVE') {
      res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'User is not active',
      });
      return;
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() },
    });

    // Attach API key info to request
    req.apiKey = {
      id: apiKeyRecord.id,
      userId: apiKeyRecord.userId,
      name: apiKeyRecord.name,
    };

    req.user = {
      userId: apiKeyRecord.userId,
      phoneNumber: '', // Not available from API key
      role: apiKeyRecord.user.role,
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: 'Invalid API key',
    });
  }
};

/**
 * Middleware to check if user has required role
 */
export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to authenticate with either JWT or API key
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateJWT(req, res, next);
  }

  if (apiKey) {
    return authenticateApiKey(req, res, next);
  }

  res.status(401).json({
    success: false,
    error: 'Authentication required',
    message: 'Provide either Bearer token or API key',
  });
};
