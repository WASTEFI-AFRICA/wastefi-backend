import RedisService from '../services/redis.service';
import { config } from '../config';
import { logger } from './logger.util';

/**
 * Cache Utility
 * 
 * Provides high-level caching patterns with automatic fallback
 * when Redis is unavailable
 */

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

/**
 * Generate cache key with optional prefix
 */
export function generateCacheKey(parts: string[], prefix?: string): string {
  const key = parts.join(':');
  return prefix ? `${prefix}:${key}` : key;
}

/**
 * Cache-aside pattern: Try to get from cache, fallback to fetcher
 * 
 * @param key - Cache key
 * @param fetcher - Async function to fetch data if not in cache
 * @param options - Cache options (ttl, prefix)
 * @returns Cached or fetched data
 */
export async function cacheAside<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = config.redis.ttl.cache, prefix } = options;
  const cacheKey = prefix ? generateCacheKey([key], prefix) : key;

  try {
    // Try to get from cache
    if (RedisService.isAvailable()) {
      const cached = await RedisService.get<T>(cacheKey);
      if (cached !== null) {
        logger.debug('Cache hit', { key: cacheKey });
        return cached;
      }
      logger.debug('Cache miss', { key: cacheKey });
    }

    // Fetch data
    const data = await fetcher();

    // Store in cache (fire and forget)
    if (RedisService.isAvailable()) {
      RedisService.set(cacheKey, data, ttl).catch(err => {
        logger.error('Failed to cache data', { key: cacheKey, error: err });
      });
    }

    return data;
  } catch (error: unknown) {
    logger.error('Cache-aside error', { key: cacheKey, error: error as Error });
    // Fallback to fetcher on any error
    return await fetcher();
  }
}

/**
 * Invalidate cache key or pattern
 */
export async function invalidateCache(keyOrPattern: string, isPattern = false): Promise<void> {
  try {
    if (!RedisService.isAvailable()) return;

    if (isPattern) {
      const deleted = await RedisService.delPattern(keyOrPattern);
      logger.info('Cache pattern invalidated', { pattern: keyOrPattern, deleted });
    } else {
      await RedisService.del(keyOrPattern);
      logger.info('Cache key invalidated', { key: keyOrPattern });
    }
  } catch (error: unknown) {
    logger.error('Cache invalidation error', { keyOrPattern, error: error as Error });
  }
}

/**
 * User-specific cache keys
 */
export const UserCache = {
  profile: (userId: string) => generateCacheKey(['user', 'profile', userId]),
  collections: (userId: string) => generateCacheKey(['user', 'collections', userId]),
  payments: (userId: string) => generateCacheKey(['user', 'payments', userId]),
  wallet: (userId: string) => generateCacheKey(['user', 'wallet', userId]),
  stats: (userId: string) => generateCacheKey(['user', 'stats', userId]),
  
  invalidate: async (userId: string) => {
    await invalidateCache(`user:*:${userId}`, true);
  },
};

/**
 * Collection point cache keys
 */
export const CollectionPointCache = {
  point: (pointId: string) => generateCacheKey(['collection-point', pointId]),
  list: (filters?: string) => generateCacheKey(['collection-points', filters || 'all']),
  nearby: (lat: number, lon: number, radius: number) => 
    generateCacheKey(['collection-points', 'nearby', `${lat},${lon}`, `${radius}km`]),
  
  invalidate: async (pointId?: string) => {
    if (pointId) {
      await invalidateCache(CollectionPointCache.point(pointId));
    }
    await invalidateCache('collection-points:*', true);
  },
};

/**
 * Material pricing cache keys
 */
export const PricingCache = {
  material: (materialType: string) => generateCacheKey(['pricing', 'material', materialType]),
  all: () => generateCacheKey(['pricing', 'all']),
  
  invalidate: async () => {
    await invalidateCache('pricing:*', true);
  },
};

/**
 * Statistics cache keys
 */
export const StatsCache = {
  admin: () => generateCacheKey(['stats', 'admin', 'dashboard']),
  userStats: (userId: string) => generateCacheKey(['stats', 'user', userId]),
  collectionStats: () => generateCacheKey(['stats', 'collections']),
  paymentStats: () => generateCacheKey(['stats', 'payments']),
  
  invalidate: async () => {
    await invalidateCache('stats:*', true);
  },
};

/**
 * Session management with Redis
 */
export const SessionCache = {
  set: async (sessionId: string, data: any, ttl = config.redis.ttl.session) => {
    try {
      await RedisService.setSession(sessionId, data, ttl);
    } catch (error: unknown) {
      logger.error('Session set error', { sessionId, error: error as Error });
    }
  },
  
  get: async <T = any>(sessionId: string): Promise<T | null> => {
    try {
      return await RedisService.getSession<T>(sessionId);
    } catch (error: unknown) {
      logger.error('Session get error', { sessionId, error: error as Error });
      return null;
    }
  },
  
  delete: async (sessionId: string) => {
    try {
      await RedisService.deleteSession(sessionId);
    } catch (error: unknown) {
      logger.error('Session delete error', { sessionId, error: error as Error });
    }
  },
  
  refresh: async (sessionId: string, ttl = config.redis.ttl.session) => {
    try {
      await RedisService.refreshSession(sessionId, ttl);
    } catch (error: unknown) {
      logger.error('Session refresh error', { sessionId, error: error as Error });
    }
  },
};

/**
 * Rate limiting with Redis
 */
export const RateLimitCache = {
  increment: async (identifier: string, window = 60): Promise<number> => {
    try {
      if (!RedisService.isAvailable()) return 0;
      
      const key = generateCacheKey(['ratelimit', identifier]);
      return await RedisService.incrementRateLimit(key, window);
    } catch (error: unknown) {
      logger.error('Rate limit increment error', { identifier, error: error as Error });
      return 0;
    }
  },
  
  get: async (identifier: string): Promise<number> => {
    try {
      if (!RedisService.isAvailable()) return 0;
      
      const key = generateCacheKey(['ratelimit', identifier]);
      return await RedisService.getRateLimit(key);
    } catch (error: unknown) {
      logger.error('Rate limit get error', { identifier, error: error as Error });
      return 0;
    }
  },
  
  reset: async (identifier: string) => {
    try {
      const key = generateCacheKey(['ratelimit', identifier]);
      await RedisService.resetRateLimit(key);
    } catch (error: unknown) {
      logger.error('Rate limit reset error', { identifier, error: error as Error });
    }
  },
};

/**
 * Distributed locking for critical sections
 */
export const LockCache = {
  acquire: async (lockName: string, ttl = 10): Promise<boolean> => {
    try {
      if (!RedisService.isAvailable()) return true; // Allow if Redis unavailable
      
      const key = generateCacheKey(['lock', lockName]);
      const acquired = await RedisService.set(key, '1', ttl);
      
      if (acquired) {
        logger.debug('Lock acquired', { lockName });
      } else {
        logger.debug('Lock not acquired', { lockName });
      }
      
      return acquired;
    } catch (error: unknown) {
      logger.error('Lock acquire error', { lockName, error: error as Error });
      return true; // Allow on error to prevent deadlocks
    }
  },
  
  release: async (lockName: string) => {
    try {
      const key = generateCacheKey(['lock', lockName]);
      await RedisService.del(key);
      logger.debug('Lock released', { lockName });
    } catch (error: unknown) {
      logger.error('Lock release error', { lockName, error: error as Error });
    }
  },
  
  extend: async (lockName: string, ttl = 10): Promise<boolean> => {
    try {
      if (!RedisService.isAvailable()) return true;
      
      const key = generateCacheKey(['lock', lockName]);
      return await RedisService.expire(key, ttl);
    } catch (error: unknown) {
      logger.error('Lock extend error', { lockName, error: error as Error });
      return false;
    }
  },
};

/**
 * Cache wrapper for async functions (decorator pattern)
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string,
  options: CacheOptions = {}
): T {
  return (async (...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    return await cacheAside(key, () => fn(...args), options);
  }) as T;
}

/**
 * Memoization with cache
 */
export class CacheMemo<K, V> {
  private prefix: string;
  private ttl: number;
  
  constructor(prefix: string, ttl = config.redis.ttl.cache) {
    this.prefix = prefix;
    this.ttl = ttl;
  }
  
  async get(key: K, fetcher: () => Promise<V>): Promise<V> {
    const cacheKey = generateCacheKey([String(key)], this.prefix);
    return await cacheAside(cacheKey, fetcher, { ttl: this.ttl });
  }
  
  async set(key: K, value: V): Promise<void> {
    const cacheKey = generateCacheKey([String(key)], this.prefix);
    await RedisService.set(cacheKey, value, this.ttl);
  }
  
  async delete(key: K): Promise<void> {
    const cacheKey = generateCacheKey([String(key)], this.prefix);
    await RedisService.del(cacheKey);
  }
  
  async clear(): Promise<void> {
    await invalidateCache(`${this.prefix}:*`, true);
  }
}

/**
 * Batch cache operations
 */
export const BatchCache = {
  getMany: async <T>(keys: string[]): Promise<Map<string, T>> => {
    const results = new Map<string, T>();
    
    if (!RedisService.isAvailable()) return results;
    
    await Promise.all(
      keys.map(async (key) => {
        const value = await RedisService.get<T>(key);
        if (value !== null) {
          results.set(key, value);
        }
      })
    );
    
    return results;
  },
  
  setMany: async (entries: Map<string, any>, ttl?: number): Promise<void> => {
    if (!RedisService.isAvailable()) return;
    
    await Promise.all(
      Array.from(entries.entries()).map(([key, value]) =>
        RedisService.set(key, value, ttl)
      )
    );
  },
  
  deleteMany: async (keys: string[]): Promise<void> => {
    if (!RedisService.isAvailable()) return;
    
    await Promise.all(keys.map(key => RedisService.del(key)));
  },
};


