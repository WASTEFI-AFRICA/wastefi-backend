# Rate Limiting Documentation

## Overview

WasteFi API implements advanced rate limiting to ensure fair usage, prevent abuse, and maintain service quality for all users.

## Features

- **Redis-Backed**: Distributed rate limiting using Redis
- **Per-User & Per-IP**: Tracks limits by authenticated user or IP address
- **Tiered Limits**: Different limits for different user tiers
- **Endpoint-Specific**: Custom limits for different API endpoints
- **Informative Headers**: Rate limit information in response headers
- **Graceful Degradation**: Falls back to allowing requests if Redis is unavailable

## Rate Limit Tiers

### Free Tier (Default)

- **Global**: 100 requests per minute
- **Authentication**: 10 requests per minute
- **Read Operations**: 200 requests per minute
- **Write Operations**: 50 requests per minute
- **Payments**: 20 requests per minute

### Premium Tier (Admin/Premium Users)

- **Global**: 1000 requests per minute
- All other limits scale proportionally

## Response Headers

All API responses include rate limit information:

```
X-RateLimit-Limit: 100          # Maximum requests allowed
X-RateLimit-Remaining: 95       # Requests remaining in current window
X-RateLimit-Reset: 1632847200   # Unix timestamp when limit resets
```

When rate limit is exceeded:

```
Retry-After: 45                  # Seconds to wait before retry
```

## Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "limit": 100,
  "reset": 1632847200
}
```

**Status Code**: 429 Too Many Requests

## Endpoint-Specific Limits

### Authentication Endpoints

**Limit**: 10 requests/minute

```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/forgot-password
```

### Payment Endpoints

**Limit**: 20 requests/minute

```
POST /api/v1/payments
POST /api/v1/payments/withdraw
GET /api/v1/payments
```

### Write Operations

**Limit**: 50 requests/minute

```
POST /api/v1/waste-collections
PUT /api/v1/users/profile
POST /api/v1/collection-points
```

### Read Operations

**Limit**: 200 requests/minute

```
GET /api/v1/users/profile
GET /api/v1/collection-points
GET /api/v1/waste-collections
```

## Implementation

### Using Pre-Configured Limiters

```typescript
import { RateLimiters } from '../middleware/advanced-rate-limiter.middleware';

// Apply auth rate limiter
router.post('/login', RateLimiters.auth.middleware(), authController.login);

// Apply payment rate limiter
router.post('/payments', RateLimiters.payment.middleware(), paymentController.create);
```

### Creating Custom Limiters

```typescript
import { createRateLimiter } from '../middleware/advanced-rate-limiter.middleware';

const customLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 30, // 30 requests per window
  keyPrefix: 'ratelimit:custom',
});

router.post('/custom', customLimiter.middleware(), controller.action);
```

### Tier-Based Rate Limiting

```typescript
import { tierBasedRateLimiter } from '../middleware/advanced-rate-limiter.middleware';

// Automatically applies premium or standard limits based on user tier
router.get('/data', tierBasedRateLimiter(), controller.getData);
```

## Rate Limit Management

### Reset User Rate Limit

```typescript
import { RateLimiters } from '../middleware/advanced-rate-limiter.middleware';

// Reset rate limit for specific user
await RateLimiters.global.reset('user:123');

// Reset rate limit for IP
await RateLimiters.global.reset('ip:192.168.1.1');
```

### Check Rate Limit Status

```typescript
// Get rate limit info for user
const info = await RateLimiters.global.getInfo('user:123');

console.log(info);
// {
//   limit: 100,
//   remaining: 75,
//   reset: 1632847200
// }
```

## Best Practices

### For API Consumers

1. **Check Headers**: Always check rate limit headers in responses
2. **Implement Exponential Backoff**: When rate limited, wait before retrying
3. **Cache Data**: Reduce API calls by caching responses locally
4. **Batch Requests**: Combine multiple operations when possible
5. **Upgrade Tier**: Consider premium tier for high-volume applications

### For API Developers

1. **Apply Appropriate Limits**: Use endpoint-specific limiters
2. **Monitor Usage**: Track rate limit hits in logs
3. **Graceful Handling**: Handle 429 responses appropriately
4. **Test Limits**: Include rate limit testing in CI/CD

## Monitoring

Rate limit exceeded events are logged:

```json
{
  "level": "warn",
  "message": "Rate limit exceeded",
  "identifier": "user:123",
  "path": "/api/v1/payments",
  "limit": 20,
  "timestamp": "2026-09-14T10:30:00Z"
}
```

## Configuration

Rate limits can be adjusted in `advanced-rate-limiter.middleware.ts`:

```typescript
export const RateLimiters = {
  global: new AdvancedRateLimiter({
    windowMs: 60 * 1000, // Time window
    maxRequests: 100, // Max requests
    keyPrefix: 'ratelimit:global',
  }),
  // ... other limiters
};
```

## Redis Dependency

Rate limiting requires Redis for distributed tracking. If Redis is unavailable:

- Rate limiting is **disabled** to prevent blocking requests
- Errors are logged for monitoring
- Service continues normally

## Upgrade to Premium

Contact support to upgrade to premium tier for higher rate limits:

- Email: support@wastefi.com
- Premium tier includes 10x higher limits
- Custom limits available for enterprise

## FAQs

**Q: Why am I being rate limited?**  
A: You've exceeded the maximum requests allowed in the current time window.

**Q: How long until my limit resets?**  
A: Check the `X-RateLimit-Reset` header or the `reset` field in the error response.

**Q: Can I increase my rate limit?**  
A: Yes, upgrade to premium tier or contact support for custom limits.

**Q: Does rate limiting apply to webhooks?**  
A: No, incoming webhooks are not rate limited.

**Q: What happens if I'm rate limited?**  
A: You receive a 429 status code. Wait for the specified time and retry.

## Related Documentation

- [Authentication](./AUTHENTICATION.md)
- [Redis Caching](./REDIS_CACHING.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Monitoring](./MONITORING.md)
