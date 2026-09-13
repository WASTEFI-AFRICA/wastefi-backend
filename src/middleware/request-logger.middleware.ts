import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.util';

export interface RequestWithId extends Request {
  requestId?: string;
  startTime?: number;
}

/**
 * Add unique request ID to each request
 */
export const addRequestId = (
  req: RequestWithId,
  _res: Response,
  next: NextFunction
): void => {
  req.requestId = uuidv4();
  req.startTime = Date.now();
  next();
};

/**
 * Log all HTTP requests
 */
export const requestLogger = (
  req: RequestWithId,
  res: Response,
  next: NextFunction
): void => {
  const startTime = req.startTime || Date.now();

  // Log request
  logger.info(`→ ${req.method} ${req.url}`, {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.userId,
  });

  // Capture the original res.json function
  const originalJson = res.json.bind(res);

  // Override res.json to log response
  res.json = function (body: any): Response {
    const duration = Date.now() - startTime;

    logger.http(req.method, req.url, res.statusCode, duration, {
      requestId: req.requestId,
      userId: (req as any).user?.userId,
      responseSize: JSON.stringify(body).length,
    });

    return originalJson(body);
  };

  next();
};

/**
 * Performance monitoring middleware
 */
export const performanceMonitor = (
  req: RequestWithId,
  res: Response,
  next: NextFunction
): void => {
  const startTime = req.startTime || Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Warn on slow requests (> 1 second)
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        duration,
        statusCode: res.statusCode,
      });
    }

    // Track metrics (in production, send to monitoring service)
    if (duration > 5000) {
      logger.error('Very slow request detected', {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        duration,
        statusCode: res.statusCode,
      });
    }
  });

  next();
};
