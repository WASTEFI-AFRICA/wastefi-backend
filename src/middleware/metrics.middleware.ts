import { Request, Response, NextFunction } from 'express';
import responseTime from 'response-time';
import MetricsService from '../services/metrics.service';

/**
 * Middleware to collect HTTP request metrics
 */
export const metricsMiddleware = responseTime((req: Request, res: Response, time: number) => {
  const route = req.route?.path || req.path || 'unknown';
  const method = req.method;
  const statusCode = res.statusCode;

  // Convert milliseconds to seconds
  const durationSeconds = time / 1000;

  // Record metrics
  MetricsService.recordHttpRequest(method, route, statusCode, durationSeconds);

  // Record errors if status code >= 400
  if (statusCode >= 400) {
    const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
    MetricsService.recordHttpError(method, route, errorType);
  }
});

/**
 * Middleware to track active connections
 */
export const trackActiveConnections = (_req: Request, res: Response, next: NextFunction) => {
  // Increment on request
  MetricsService.updateActiveConnections('http', 1);

  // Decrement on response finish
  res.on('finish', () => {
    MetricsService.updateActiveConnections('http', -1);
  });

  next();
};
