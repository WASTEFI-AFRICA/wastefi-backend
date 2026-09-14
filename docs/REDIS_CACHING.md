# Redis Caching Guide

Complete guide for Redis integration and caching strategies in WasteFi Backend.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Configuration](#configuration)
- [Redis Service](#redis-service)
- [Caching Utilities](#caching-utilities)
- [Caching Patterns](#caching-patterns)
- [Best Practices](#best-practices)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

## Overview

WasteFi uses **Redis** for:

- ✅ Response caching
- ✅ Session management
- ✅ Rate limiting
- ✅ Distributed locking
- ✅ Pub/Sub messaging
- ✅ Temporary data storage

### Key Features

- **Automatic fallback** - App works without Redis
- **Connection resilience** - Auto-reconnect on failure
- **Type-safe operations** - TypeScript support
- **High-level utilities** - Common patterns pre-built
- **Monitoring** - Health checks and metrics

## Installation

### Install Redis Server

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**macOS (Homebrew):**

```bash
brew install redis
brew services start redis
```

**Windows:**

```bash
# Download from: https://redis.io/download
# Or use Windows Subsystem for Linux (WSL)
```

**Docker:**

```bash
docker run -d \
  --name wastefi-redis \
  -p 6379:6379 \
  redis:7-alpine
```

### Verify Installation

```bash
redis-cli ping
# Should respond: PONG
```

### NPM Dependencies

Already installed:

```json
{
  "redis": "^4.x",
  "ioredis": "^5.x",
  "@types/ioredis": "^5.x"
}
```

## Configuration

### Environment Variables

Add to `.env`:

```env
# Redis Configuration
REDIS_ENABLED=true          # Enable/disable Redis
REDIS_HOST=localhost        # Redis server host
REDIS_PORT=6379             # Redis server port
REDIS_PASSWORD=             # Redis password (if any)
REDIS_DB=0                  # Redis database number (0-15)
```

### Config File

`src/config/index.ts`:

```typescript
redis: {
  enabled: process.env.REDIS_ENABLED === 'true',
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || '',
  db: parseInt(process.env.REDIS_DB || '0', 10),
  ttl: {
    default: 3600,    // 1 hour
    session: 86400,   // 24 hours
    cache: 300,       // 5 minutes
    rateLimit: 60,    // 1 minute
  },
}
```

## Redis Service

### Basic Operations

```typescript
import RedisService from './services/redis.service';

// Set value with TTL
await RedisService.set('key', 'value', 60); // 60 seconds

// Get value
const value = await RedisService.get<string>('key');

// Delete key
await RedisService.del('key');

// Check if exists
const exists = await RedisService.exists('key');

// Set expiration
await RedisService.expire('key', 120);

// Get TTL
const ttl = await RedisService.ttl('key');
```

### Hash Operations

```typescript
// Set hash field
await RedisService.hset('user:123', 'name', 'John Doe');

// Get hash field
const name = await RedisService.hget('user:123', 'name');

// Get all fields
const user = await RedisService.hgetall('user:123');

// Delete field
await RedisService.hdel('user:123', 'name');
```

### List Operations

```typescript
// Push to list
await RedisService.lpush('queue', { task: 'process-payment' });
await RedisService.rpush('queue', { task: 'send-email' });

// Get list items
const items = await RedisService.lrange('queue', 0, -1);

// Get list length
const length = await RedisService.llen('queue');
```

### Pub/Sub

```typescript
// Subscribe to channel
await RedisService.subscribe('notifications', (message) => {
  console.log('Received:', message);
});

// Publish message
await RedisService.publish('notifications', {
  type: 'payment',
  userId: '123',
  amount: 100,
});

// Unsubscribe
await RedisService.unsubscribe('notifications');
```

## Caching Utilities

### Cache-Aside Pattern

```typescript
import { cacheAside } from './utils/cache.util';

// Automatic caching with fallback
const user = await cacheAside(
  'user:123',
  async () => {
    // Fetch from database if not in cache
    return await prisma.user.findUnique({ where: { id: '123' } });
  },
  { ttl: 300 } // 5 minutes
);
```

### Pre-built Cache Keys

```typescript
import { UserCache, CollectionPointCache, StatsCache } from './utils/cache.util';

// User caching
const profile = await cacheAside(
  UserCache.profile(userId),
  async () => await getUserProfile(userId),
  { ttl: 300 }
);

// Invalidate user cache
await UserCache.invalidate(userId);

// Collection point caching
const point = await cacheAside(
  CollectionPointCache.point(pointId),
  async () => await getCollectionPoint(pointId)
);

// Invalidate collection point
await CollectionPointCache.invalidate(pointId);
```

### Session Management

```typescript
import { SessionCache } from './utils/cache.util';

// Store session
await SessionCache.set(
  sessionId,
  {
    userId: '123',
    role: 'USER',
    lastActivity: new Date(),
  },
  86400
); // 24 hours

// Get session
const session = await SessionCache.get(sessionId);

// Refresh session TTL
await SessionCache.refresh(sessionId, 86400);

// Delete session
await SessionCache.delete(sessionId);
```

### Rate Limiting

```typescript
import { RateLimitCache } from './utils/cache.util';

// Increment counter
const count = await RateLimitCache.increment(
  `api:${userId}`,
  60 // 1 minute window
);

if (count > 100) {
  throw new Error('Rate limit exceeded');
}

// Get current count
const current = await RateLimitCache.get(`api:${userId}`);

// Reset rate limit
await RateLimitCache.reset(`api:${userId}`);
```

### Distributed Locking

```typescript
import { LockCache } from './utils/cache.util';

// Acquire lock
const acquired = await LockCache.acquire('payment:process:123', 10);

if (acquired) {
  try {
    // Critical section
    await processPayment('123');
  } finally {
    // Release lock
    await LockCache.release('payment:process:123');
  }
} else {
  console.log('Could not acquire lock');
}

// Extend lock TTL
await LockCache.extend('payment:process:123', 20);
```

### Cache Memoization

```typescript
import { CacheMemo } from './utils/cache.util';

const materialPricing = new CacheMemo<string, number>('pricing', 3600);

// Get with auto-caching
const price = await materialPricing.get('PET', async () => {
  return await fetchPriceFromDatabase('PET');
});

// Manual set
await materialPricing.set('HDPE', 45);

// Delete
await materialPricing.delete('PET');

// Clear all
await materialPricing.clear();
```

### Function Decorator

```typescript
import { withCache } from './utils/cache.util';

// Original function
async function getUserStats(userId: string) {
  return await fetchStatsFromDB(userId);
}

// Cached version
const getUserStatsCached = withCache(getUserStats, (userId) => `stats:user:${userId}`, {
  ttl: 600,
});

// Usage (automatically caches)
const stats = await getUserStatsCached('123');
```

## Caching Patterns

### Pattern 1: Cache-Aside (Lazy Loading)

**When:** Most common pattern for read-heavy operations

```typescript
async function getUser(userId: string) {
  return await cacheAside(
    UserCache.profile(userId),
    async () => await prisma.user.findUnique({ where: { id: userId } }),
    { ttl: 300 }
  );
}
```

### Pattern 2: Write-Through

**When:** Consistency is critical

```typescript
async function updateUser(userId: string, data: UpdateData) {
  // Update database
  const user = await prisma.user.update({
    where: { id: userId },
    data,
  });

  // Update cache
  await RedisService.set(UserCache.profile(userId), user, 300);

  return user;
}
```

### Pattern 3: Write-Behind (Write-Back)

**When:** High write throughput needed

```typescript
async function recordCollection(data: CollectionData) {
  // Store in cache immediately
  const cacheKey = `collection:pending:${data.id}`;
  await RedisService.set(cacheKey, data, 3600);

  // Queue for async DB write
  await RedisService.lpush('collection:write:queue', data);

  return data;
}

// Background worker processes queue
async function processCollectionQueue() {
  const items = await RedisService.lrange('collection:write:queue', 0, 9);
  for (const item of items) {
    await prisma.wasteCollection.create({ data: item });
  }
}
```

### Pattern 4: Cache Warming

**When:** Predictable access patterns

```typescript
async function warmCache() {
  // Pre-load frequently accessed data
  const collectionPoints = await prisma.collectionPoint.findMany({
    where: { isVerified: true },
  });

  for (const point of collectionPoints) {
    await RedisService.set(CollectionPointCache.point(point.id), point, 3600);
  }

  logger.info('Cache warmed', { points: collectionPoints.length });
}

// Run on server start or scheduled
warmCache();
```

### Pattern 5: Time-based Expiration

**When:** Data has natural expiration

```typescript
async function cacheVerificationCode(phone: string, code: string) {
  await RedisService.set(
    `verification:${phone}`,
    code,
    300 // 5 minutes
  );
}
```

## Best Practices

### 1. Always Handle Redis Unavailability

```typescript
// ✅ Good - Graceful fallback
const cached = await RedisService.get('key');
if (cached) {
  return cached;
}
const data = await fetchFromDB();

// ❌ Bad - Fails if Redis is down
const data = await RedisService.get('key')!; // Assumes always available
```

### 2. Use Appropriate TTLs

```typescript
// Frequently changing data - short TTL
await RedisService.set('wallet:balance:123', balance, 60);

// Rarely changing data - longer TTL
await RedisService.set('collection-point:123', point, 3600);

// Static data - very long TTL
await RedisService.set('pricing:materials', prices, 86400);
```

### 3. Invalidate Cache on Updates

```typescript
async function updateCollectionPoint(id: string, data: any) {
  // Update database
  const point = await prisma.collectionPoint.update({
    where: { id },
    data,
  });

  // Invalidate cache
  await CollectionPointCache.invalidate(id);

  return point;
}
```

### 4. Use Structured Keys

```typescript
// ✅ Good - Hierarchical, easy to invalidate
const key = 'user:123:collections:pending';

// ❌ Bad - Flat, hard to manage
const key = 'user123collectionspending';
```

### 5. Monitor Cache Hit Rates

```typescript
let cacheHits = 0;
let cacheMisses = 0;

const cached = await RedisService.get(key);
if (cached) {
  cacheHits++;
} else {
  cacheMisses++;
}

// Log metrics periodically
const hitRate = cacheHits / (cacheHits + cacheMisses);
logger.info('Cache metrics', { hitRate, hits: cacheHits, misses: cacheMisses });
```

### 6. Avoid Caching Everything

**Don't cache:**

- User credentials
- Payment tokens
- OTPs/verification codes (except temporarily)
- Highly sensitive data

**Do cache:**

- User profiles
- Collection points
- Material pricing
- Statistics
- API responses

### 7. Set Memory Limits

Configure in Redis:

```conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

### 8. Use Compression for Large Objects

```typescript
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Compress before caching
const compressed = await gzip(JSON.stringify(largeObject));
await RedisService.set(key, compressed.toString('base64'));

// Decompress after retrieval
const compressed = await RedisService.get(key);
const buffer = Buffer.from(compressed, 'base64');
const decompressed = await gunzip(buffer);
const data = JSON.parse(decompressed.toString());
```

## Performance Optimization

### 1. Pipeline Multiple Commands

```typescript
// Instead of multiple individual calls
await RedisService.set('key1', 'value1');
await RedisService.set('key2', 'value2');
await RedisService.set('key3', 'value3');

// Use batch operations
await BatchCache.setMany(
  new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
    ['key3', 'value3'],
  ])
);
```

### 2. Use Appropriate Data Structures

```typescript
// For counters - use INCR
await RedisService.incrementRateLimit('counter');

// For sets - use SADD/SMEMBERS
// For sorted sets - use ZADD/ZRANGE

// For simple key-value - use GET/SET
```

### 3. Avoid Large Keys

```typescript
// ❌ Bad - Storing entire collection
await RedisService.set('all:collections', allCollections);

// ✅ Good - Store references, paginate
await RedisService.set('collections:ids', collectionIds.slice(0, 100));
```

## Troubleshooting

### Issue: Redis Connection Fails

**Symptoms:**

```
❌ Redis connection failed
```

**Solutions:**

1. Check Redis is running: `redis-cli ping`
2. Verify host/port in `.env`
3. Check firewall settings
4. Ensure password is correct (if set)

### Issue: Cache Not Working

**Symptoms:** Always fetching from database

**Solutions:**

1. Check `REDIS_ENABLED=true` in `.env`
2. Verify Redis service is connected: `RedisService.isAvailable()`
3. Check TTL is not too short
4. Verify cache keys are consistent

### Issue: Memory Usage High

**Symptoms:** Redis using too much memory

**Solutions:**

1. Check key count: `redis-cli DBSIZE`
2. Find large keys: `redis-cli --bigkeys`
3. Set maxmemory limit in redis.conf
4. Use shorter TTLs
5. Implement cache eviction policy

### Issue: Stale Data

**Symptoms:** Cache returns old data

**Solutions:**

1. Reduce TTL for that data type
2. Implement cache invalidation on updates
3. Use write-through pattern for critical data
4. Add version numbers to cache keys

## Monitoring

### Health Check

```typescript
// Check Redis health
const healthy = await RedisService.healthCheck();
console.log('Redis:', healthy ? 'OK' : 'DOWN');

// Get connection status
const available = RedisService.isAvailable();
```

### Metrics

```typescript
// Database size
const size = await RedisService.dbSize();

// Memory usage for key
const usage = await RedisService.memoryUsage('key');

// Server info
const info = await RedisService.info();
```

### Redis CLI Commands

```bash
# Monitor commands in real-time
redis-cli MONITOR

# Get statistics
redis-cli INFO stats

# Find keys by pattern
redis-cli KEYS "user:*"

# Get key type
redis-cli TYPE mykey

# Check TTL
redis-cli TTL mykey

# Flush all data (CAUTION!)
redis-cli FLUSHALL
```

## Production Checklist

- [ ] Redis server secured with password
- [ ] Firewall configured (only allow app server)
- [ ] Maxmemory limit set
- [ ] Eviction policy configured
- [ ] Persistence enabled (RDB or AOF)
- [ ] Monitoring set up
- [ ] Backup strategy in place
- [ ] Redis Sentinel or Cluster for HA (if needed)
- [ ] Connection pooling configured
- [ ] Graceful degradation tested

## Resources

- [Redis Documentation](https://redis.io/documentation)
- [ioredis GitHub](https://github.com/luin/ioredis)
- [Redis Best Practices](https://redis.io/topics/best-practices)
- [Caching Strategies](https://redis.io/topics/lru-cache)

## Support

For caching issues:

- Check Redis logs
- Verify configuration
- Test with redis-cli
- Review application logs
- Contact: support@wastefi.com
