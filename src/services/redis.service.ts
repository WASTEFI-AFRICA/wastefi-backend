import Redis, { RedisOptions } from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger.util';

/**
 * Redis Service for caching and session management
 * 
 * Features:
 * - Connection management with auto-reconnect
 * - Key-value caching with TTL
 * - Session storage
 * - Rate limiting support
 * - Pub/Sub messaging
 * - Health monitoring
 */
class RedisService {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    try {
      // Skip if Redis is disabled
      if (!config.redis.enabled) {
        logger.warn('Redis is disabled in configuration');
        return;
      }

      const redisOptions: RedisOptions = {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        db: config.redis.db,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          logger.warn(`Redis reconnecting attempt ${times}`, { delay });
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
      };

      // Create main client
      this.client = new Redis(redisOptions);

      // Create pub/sub clients
      this.subscriber = new Redis(redisOptions);
      this.publisher = new Redis(redisOptions);

      // Setup event handlers
      this.setupEventHandlers();

      // Wait for connection
      await this.client.ping();
      this.isConnected = true;

      logger.info('✅ Redis connected successfully', {
        host: config.redis.host,
        port: config.redis.port,
        db: config.redis.db,
      });
    } catch (error: unknown) {
      logger.error('❌ Redis connection failed', { error: error as Error });
      this.isConnected = false;
      // Don't throw - allow app to run without Redis
    }
  }

  /**
   * Setup event handlers for Redis client
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis client ready');
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error', { error: error as Error });
      this.isConnected = false;
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis client connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
        this.client = null;
      }
      if (this.subscriber) {
        await this.subscriber.quit();
        this.subscriber = null;
      }
      if (this.publisher) {
        await this.publisher.quit();
        this.publisher = null;
      }
      this.isConnected = false;
      logger.info('Redis disconnected successfully');
    } catch (error: unknown) {
      logger.error('Error disconnecting from Redis', { error: error as Error });
    }
  }

  /**
   * Check if Redis is connected and available
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) return false;
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error: unknown) {
      logger.error('Redis health check failed', { error: error as Error });
      return false;
    }
  }

  // ==================== CACHING METHODS ====================

  /**
   * Get value from cache
   */
  async get<T = string>(key: string): Promise<T | null> {
    try {
      if (!this.isAvailable()) return null;

      const value = await this.client!.get(key);
      if (!value) return null;

      // Try to parse as JSON, otherwise return as string
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error: unknown) {
      logger.error('Redis GET error', { key, error: error as Error });
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL (seconds)
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      if (!this.isAvailable()) return false;

      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

      if (ttl) {
        await this.client!.setex(key, ttl, stringValue);
      } else {
        await this.client!.set(key, stringValue);
      }

      return true;
    } catch (error: unknown) {
      logger.error('Redis SET error', { key, error: error as Error });
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<boolean> {
    try {
      if (!this.isAvailable()) return false;

      await this.client!.del(key);
      return true;
    } catch (error: unknown) {
      logger.error('Redis DEL error', { key, error: error as Error });
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      if (!this.isAvailable()) return 0;

      const keys = await this.client!.keys(pattern);
      if (keys.length === 0) return 0;

      await this.client!.del(...keys);
      return keys.length;
    } catch (error: unknown) {
      logger.error('Redis DEL pattern error', { pattern, error: error as Error });
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isAvailable()) return false;

      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error: unknown) {
      logger.error('Redis EXISTS error', { key, error: error as Error });
      return false;
    }
  }

  /**
   * Set expiration on key (seconds)
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      if (!this.isAvailable()) return false;

      await this.client!.expire(key, seconds);
      return true;
    } catch (error: unknown) {
      logger.error('Redis EXPIRE error', { key, error: error as Error });
      return false;
    }
  }

  /**
   * Get TTL (time to live) for key
   */
  async ttl(key: string): Promise<number> {
    try {
      if (!this.isAvailable()) return -2;

      return await this.client!.ttl(key);
    } catch (error: unknown) {
      logger.error('Redis TTL error', { key, error: error as Error });
      return -2;
    }
  }

  // ==================== SESSION METHODS ====================

  /**
   * Store session data
   */
  async setSession(sessionId: string, data: any, ttl: number = 3600): Promise<boolean> {
    const key = `session:${sessionId}`;
    return await this.set(key, data, ttl);
  }

  /**
   * Get session data
   */
  async getSession<T = any>(sessionId: string): Promise<T | null> {
    const key = `session:${sessionId}`;
    return await this.get<T>(key);
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const key = `session:${sessionId}`;
    return await this.del(key);
  }

  /**
   * Refresh session TTL
   */
  async refreshSession(sessionId: string, ttl: number = 3600): Promise<boolean> {
    const key = `session:${sessionId}`;
    return await this.expire(key, ttl);
  }

  // ==================== RATE LIMITING METHODS ====================

  /**
   * Increment rate limit counter
   * Returns current count
   */
  async incrementRateLimit(key: string, ttl: number = 60): Promise<number> {
    try {
      if (!this.isAvailable()) return 0;

      const count = await this.client!.incr(key);
      
      // Set expiration only on first increment
      if (count === 1) {
        await this.client!.expire(key, ttl);
      }

      return count;
    } catch (error: unknown) {
      logger.error('Redis rate limit increment error', { key, error: error as Error });
      return 0;
    }
  }

  /**
   * Get rate limit count
   */
  async getRateLimit(key: string): Promise<number> {
    try {
      if (!this.isAvailable()) return 0;

      const value = await this.client!.get(key);
      return value ? parseInt(value, 10) : 0;
    } catch (error: unknown) {
      logger.error('Redis rate limit get error', { key, error: error as Error });
      return 0;
    }
  }

  /**
   * Reset rate limit
   */
  async resetRateLimit(key: string): Promise<boolean> {
    return await this.del(key);
  }

  // ==================== HASH METHODS ====================

  /**
   * Set hash field
   */
  async hset(key: string, field: string, value: any): Promise<boolean> {
    try {
      if (!this.isAvailable()) return false;

      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await this.client!.hset(key, field, stringValue);
      return true;
    } catch (error: unknown) {
      logger.error('Redis HSET error', { key, field, error: error as Error });
      return false;
    }
  }

  /**
   * Get hash field
   */
  async hget<T = string>(key: string, field: string): Promise<T | null> {
    try {
      if (!this.isAvailable()) return null;

      const value = await this.client!.hget(key, field);
      if (!value) return null;

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error: unknown) {
      logger.error('Redis HGET error', { key, field, error: error as Error });
      return null;
    }
  }

  /**
   * Get all hash fields
   */
  async hgetall<T = Record<string, any>>(key: string): Promise<T | null> {
    try {
      if (!this.isAvailable()) return null;

      const data = await this.client!.hgetall(key);
      if (!data || Object.keys(data).length === 0) return null;

      // Try to parse each field as JSON
      const parsed: Record<string, any> = {};
      for (const [field, value] of Object.entries(data)) {
        try {
          parsed[field] = JSON.parse(value);
        } catch {
          parsed[field] = value;
        }
      }

      return parsed as T;
    } catch (error: unknown) {
      logger.error('Redis HGETALL error', { key, error: error as Error });
      return null;
    }
  }

  /**
   * Delete hash field
   */
  async hdel(key: string, field: string): Promise<boolean> {
    try {
      if (!this.isAvailable()) return false;

      await this.client!.hdel(key, field);
      return true;
    } catch (error: unknown) {
      logger.error('Redis HDEL error', { key, field, error: error as Error });
      return false;
    }
  }

  // ==================== LIST METHODS ====================

  /**
   * Push to list (left)
   */
  async lpush(key: string, value: any): Promise<number> {
    try {
      if (!this.isAvailable()) return 0;

      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      return await this.client!.lpush(key, stringValue);
    } catch (error: unknown) {
      logger.error('Redis LPUSH error', { key, error: error as Error });
      return 0;
    }
  }

  /**
   * Push to list (right)
   */
  async rpush(key: string, value: any): Promise<number> {
    try {
      if (!this.isAvailable()) return 0;

      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      return await this.client!.rpush(key, stringValue);
    } catch (error: unknown) {
      logger.error('Redis RPUSH error', { key, error: error as Error });
      return 0;
    }
  }

  /**
   * Get list range
   */
  async lrange<T = any>(key: string, start: number = 0, stop: number = -1): Promise<T[]> {
    try {
      if (!this.isAvailable()) return [];

      const values = await this.client!.lrange(key, start, stop);
      return values.map(v => {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      }) as T[];
    } catch (error: unknown) {
      logger.error('Redis LRANGE error', { key, error: error as Error });
      return [];
    }
  }

  /**
   * Get list length
   */
  async llen(key: string): Promise<number> {
    try {
      if (!this.isAvailable()) return 0;

      return await this.client!.llen(key);
    } catch (error: unknown) {
      logger.error('Redis LLEN error', { key, error: error as Error });
      return 0;
    }
  }

  // ==================== PUB/SUB METHODS ====================

  /**
   * Publish message to channel
   */
  async publish(channel: string, message: any): Promise<number> {
    try {
      if (!this.isAvailable() || !this.publisher) return 0;

      const stringMessage = typeof message === 'string' ? message : JSON.stringify(message);
      return await this.publisher.publish(channel, stringMessage);
    } catch (error: unknown) {
      logger.error('Redis PUBLISH error', { channel, error: error as Error });
      return 0;
    }
  }

  /**
   * Subscribe to channel
   */
  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    try {
      if (!this.isAvailable() || !this.subscriber) return;

      await this.subscriber.subscribe(channel);

      this.subscriber.on('message', (ch, msg) => {
        if (ch === channel) {
          try {
            const parsed = JSON.parse(msg);
            callback(parsed);
          } catch {
            callback(msg);
          }
        }
      });

      logger.info('Subscribed to Redis channel', { channel });
    } catch (error: unknown) {
      logger.error('Redis SUBSCRIBE error', { channel, error: error as Error });
    }
  }

  /**
   * Unsubscribe from channel
   */
  async unsubscribe(channel: string): Promise<void> {
    try {
      if (!this.isAvailable() || !this.subscriber) return;

      await this.subscriber.unsubscribe(channel);
      logger.info('Unsubscribed from Redis channel', { channel });
    } catch (error: unknown) {
      logger.error('Redis UNSUBSCRIBE error', { channel, error: error as Error });
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Flush all keys (use with caution!)
   */
  async flushAll(): Promise<boolean> {
    try {
      if (!this.isAvailable()) return false;

      await this.client!.flushall();
      logger.warn('Redis FLUSHALL executed - all keys deleted');
      return true;
    } catch (error: unknown) {
      logger.error('Redis FLUSHALL error', { error: error as Error });
      return false;
    }
  }

  /**
   * Get database size
   */
  async dbSize(): Promise<number> {
    try {
      if (!this.isAvailable()) return 0;

      return await this.client!.dbsize();
    } catch (error: unknown) {
      logger.error('Redis DBSIZE error', { error: error as Error });
      return 0;
    }
  }

  /**
   * Get server info
   */
  async info(): Promise<string> {
    try {
      if (!this.isAvailable()) return '';

      return await this.client!.info();
    } catch (error: unknown) {
      logger.error('Redis INFO error', { error: error as Error });
      return '';
    }
  }

  /**
   * Get memory usage for key
   */
  async memoryUsage(key: string): Promise<number | null> {
    try {
      if (!this.isAvailable()) return null;

      return await this.client!.memory('USAGE', key);
    } catch (error: unknown) {
      logger.error('Redis MEMORY USAGE error', { key, error: error as Error });
      return null;
    }
  }
}

// Export singleton instance
export default new RedisService();


