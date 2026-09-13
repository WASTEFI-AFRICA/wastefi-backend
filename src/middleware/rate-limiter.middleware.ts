import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.util';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

export class RateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach((key) => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  private getKey(req: Request): string {
    // Use user ID if authenticated, otherwise use IP
    const userId = (req as any).user?.userId;
    return userId || req.ip || 'unknown';
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = this.getKey(req);
      const now = Date.now();

      if (!this.store[key] || this.store[key].resetTime < now) {
        // New window
        this.store[key] = {
          count: 1,
          resetTime: now + this.windowMs,
        };
        return next();
      }

      this.store[key].count++;

      if (this.store[key].count > this.maxRequests) {
        logger.warn('Rate limit exceeded', {
          key,
          count: this.store[key].count,
          maxRequests: this.maxRequests,
          url: req.url,
        });

        res.status(429).json({
          success: false,
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((this.store[key].resetTime - now) / 1000),
        });
        return;
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', this.maxRequests - this.store[key].count);
      res.setHeader('X-RateLimit-Reset', this.store[key].resetTime);

      next();
    };
  }
}

// Create rate limiters for different endpoints
export const generalLimiter = new RateLimiter(60000, 100); // 100 requests per minute
export const authLimiter = new RateLimiter(60000, 10); // 10 auth requests per minute
export const paymentLimiter = new RateLimiter(60000, 20); // 20 payment requests per minute
