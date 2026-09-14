/**
 * Advanced rate limiting middleware with Redis support
 * Provides per-user, per-IP, and per-endpoint rate limiting
 */

import { Request, Response, NextFunction } from 'express';
import redisService from '../services/redis.service';
import { logger } from '../utils/logger.util';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix: string; // Redis key prefix
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

export class AdvancedRateLimiter {
  private redis: typeof redisService;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.redis = redisService;
    this.config = config;
  }

  /**
   * Create rate limiter middleware
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Get identifier (user ID or IP)
        const identifier = this.getIdentifier(req);
        const key = `${this.config.keyPrefix}:${identifier}`;

        // Get current count and TTL
        const result = await this.checkLimit(key);

        // Set rate limit headers
        this.setHeaders(res, result);

        // Check if limit exceeded
        if (result.remaining < 0) {
          logger.warn('Rate limit exceeded', {
            identifier,
            path: req.path,
            limit: result.limit,
          });

          res.status(429).json({
            success: false,
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil(
              (result.reset - Date.now()) / 1000
            )} seconds.`,
            limit: result.limit,
            reset: result.reset,
          });
          return;
        }

        // Increment counter
        await this.increment(key);

        next();
      } catch (error) {
        // If Redis is down, log error but don't block requests
        logger.error('Rate limiter error', { error: error as Error });
        next();
      }
    };
  }

  /**
   * Get identifier for rate limiting (user ID or IP)
   */
  private getIdentifier(req: Request): string {
    // Use user ID if authenticated
    const user = (req as any).user;
    if (user?.userId) {
      return `user:${user.userId}`;
    }

    // Otherwise use IP address
    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.headers['x-real-ip']?.toString() ||
      req.socket.remoteAddress ||
      'unknown';

    return `ip:${ip}`;
  }

  /**
   * Check current rate limit status
   */
  private async checkLimit(key: string): Promise<RateLimitInfo> {
    if (!this.redis.isAvailable()) {
      // If Redis not available, allow request
      return {
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests,
        reset: Date.now() + this.config.windowMs,
      };
    }

    const count = (await this.redis.get(key)) || 0;
    const ttl = await this.redis.ttl(key);

    const reset = ttl > 0 ? Date.now() + ttl * 1000 : Date.now() + this.config.windowMs;

    return {
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - Number(count) - 1),
      reset,
    };
  }

  /**
   * Increment rate limit counter
   */
  private async increment(key: string): Promise<void> {
    if (!this.redis.isAvailable()) {
      return;
    }

    const current = await this.redis.get(key);

    if (!current) {
      // First request in window
      await this.redis.set(key, '1', Math.ceil(this.config.windowMs / 1000));
    } else {
      // Increment using Redis incrementRateLimit
      await this.redis.incrementRateLimit(key, Math.ceil(this.config.windowMs / 1000));
    }
  }

  /**
   * Set rate limit headers
   */
  private setHeaders(res: Response, info: RateLimitInfo): void {
    res.setHeader('X-RateLimit-Limit', info.limit.toString());
    res.setHeader('X-RateLimit-Remaining', info.remaining.toString());
    res.setHeader('X-RateLimit-Reset', info.reset.toString());

    if (info.remaining < 0) {
      res.setHeader('Retry-After', Math.ceil((info.reset - Date.now()) / 1000).toString());
    }
  }

  /**
   * Reset rate limit for a specific identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    await this.redis.del(key);
  }

  /**
   * Get rate limit info for identifier
   */
  async getInfo(identifier: string): Promise<RateLimitInfo> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    return this.checkLimit(key);
  }
}

/**
 * Pre-configured rate limiters for different use cases
 */
export const RateLimiters = {
  // Global API rate limiter (100 requests per minute)
  global: new AdvancedRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyPrefix: 'ratelimit:global',
  }),

  // Strict rate limiter for auth endpoints (10 per minute)
  auth: new AdvancedRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'ratelimit:auth',
  }),

  // Payment endpoints (20 per minute)
  payment: new AdvancedRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'ratelimit:payment',
  }),

  // Write operations (50 per minute)
  write: new AdvancedRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 50,
    keyPrefix: 'ratelimit:write',
  }),

  // Read operations (200 per minute)
  read: new AdvancedRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 200,
    keyPrefix: 'ratelimit:read',
  }),

  // Premium users (1000 per minute)
  premium: new AdvancedRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 1000,
    keyPrefix: 'ratelimit:premium',
  }),
};

/**
 * Create custom rate limiter
 */
export function createRateLimiter(config: RateLimitConfig): AdvancedRateLimiter {
  return new AdvancedRateLimiter(config);
}

/**
 * Middleware to apply different rate limits based on user tier
 */
export function tierBasedRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;

    // Check if user is premium (you can add this field to your User model)
    const isPremium = user?.role === 'ADMIN' || user?.isPremium === true;

    const limiter = isPremium ? RateLimiters.premium : RateLimiters.global;

    return limiter.middleware()(req, res, next);
  };
}
