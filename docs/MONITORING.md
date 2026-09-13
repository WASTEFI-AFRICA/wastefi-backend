# Monitoring & Logging Guide

## Overview

WasteFi Backend includes comprehensive logging, monitoring, and error handling capabilities to ensure system reliability and ease of debugging.

## Features

✅ **Structured Logging** - JSON-formatted logs with metadata
✅ **Request Tracking** - Unique request IDs for tracing
✅ **Performance Monitoring** - Automatic slow request detection
✅ **Error Handling** - Centralized error handling with proper HTTP status codes
✅ **Rate Limiting** - Protect against abuse and DDoS
✅ **Input Validation** - Request validation and sanitization
✅ **Security Logging** - Track authentication and security events

## Logging System

### Log Levels

```typescript
LogLevel.ERROR  // Critical errors requiring immediate attention
LogLevel.WARN   // Warning conditions
LogLevel.INFO   // Informational messages (default)
LogLevel.DEBUG  // Detailed debug information
```

### Configuration

Set log level in `.env`:
```env
LOG_LEVEL=info  # error | warn | info | debug
```

### Usage Examples

```typescript
import { logger } from './utils/logger.util';

// Basic logging
logger.info('User logged in');
logger.warn('API rate limit approaching');
logger.error('Payment processing failed');
logger.debug('Database query executed');

// With metadata
logger.info('User registered', {
  userId: '123',
  phoneNumber: '+254712345678',
  service: 'auth',
});

// HTTP request logging (automatic)
logger.http('POST', '/api/v1/auth/login', 200, 45, {
  requestId: 'abc-123',
  userId: '456',
});

// Transaction logging
logger.transaction('WASTE_COLLECTION', '10.5', {
  collectorId: '789',
  collectionPointId: '012',
});

// Security events
logger.security('Failed login attempt', {
  phoneNumber: '+254712345678',
  ip: '192.168.1.1',
});
```

## Request Tracking

Every request gets a unique ID for tracking across services.

### Request ID Header

```bash
GET /api/v1/wallet/balance
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
```

### In Logs

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "message": "→ GET /api/v1/wallet/balance",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-123",
  "duration": 45
}
```

## Performance Monitoring

### Automatic Detection

- **Slow Requests** (> 1s): Logged as WARN
- **Very Slow Requests** (> 5s): Logged as ERROR

### Example Log

```json
{
  "level": "WARN",
  "message": "Slow request detected",
  "requestId": "abc-123",
  "method": "POST",
  "url": "/api/v1/wallet/send",
  "duration": 1250,
  "statusCode": 200
}
```

## Error Handling

### Custom Error Class

```typescript
import { AppError } from './middleware/error.middleware';

// Throw operational errors
throw new AppError('User not found', 404);
throw new AppError('Insufficient balance', 400);
throw new AppError('Payment processing failed', 500);
```

### Error Response Format

```json
{
  "success": false,
  "error": "Validation failed",
  "message": "Invalid phone number format",
  "stack": "Error: ... (only in development)"
}
```

### Common HTTP Status Codes

- **400** - Bad Request (validation errors)
- **401** - Unauthorized (authentication required)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found (resource doesn't exist)
- **429** - Too Many Requests (rate limit exceeded)
- **500** - Internal Server Error (unexpected errors)
- **503** - Service Unavailable (database down)

## Rate Limiting

### Default Limits

- **General API**: 100 requests/minute
- **Authentication**: 10 requests/minute
- **Payments**: 20 requests/minute

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642252800000
```

### Rate Limit Response

```json
{
  "success": false,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 45
}
```

### Custom Rate Limiters

```typescript
import { RateLimiter } from './middleware/rate-limiter.middleware';

// Create custom limiter
const customLimiter = new RateLimiter(
  60000,  // 1 minute window
  50      // 50 requests max
);

// Apply to routes
router.post('/heavy-operation', customLimiter.middleware(), handler);
```

## Input Validation

### Automatic Sanitization

All requests are automatically sanitized to prevent:
- NoSQL injection
- Prototype pollution
- XSS attacks

### Validation Middleware

```typescript
import { body, query } from 'express-validator';
import { validate } from './middleware/validation.middleware';

router.post(
  '/register',
  [
    body('phoneNumber').matches(/^\+?[1-9]\d{1,14}$/),
    body('email').isEmail(),
    validate,  // Check for errors
  ],
  controller
);
```

### Validation Error Response

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "phoneNumber",
      "message": "Invalid phone number format",
      "value": "123"
    }
  ]
}
```

## Health Checks

### Endpoint

```bash
GET /health
```

### Response

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "service": "wastefi-backend",
  "version": "1.0.0",
  "environment": "production",
  "database": "connected",
  "stellar": "testnet"
}
```

### Status Codes

- **200** - All services healthy
- **503** - Service degraded (database down)

## Database Logging

All ERROR level logs are automatically persisted to the database.

### SystemLog Table

```sql
SELECT * FROM system_logs
WHERE level = 'error'
ORDER BY created_at DESC
LIMIT 100;
```

### Fields

- `level` - Log level (error, warn, info, debug)
- `message` - Log message
- `service` - Service name (api, auth, payment, etc.)
- `metadata` - JSON object with additional data
- `created_at` - Timestamp

## Production Monitoring

### Recommended Setup

1. **Log Aggregation**
   - Send logs to external service (e.g., Datadog, LogDNA)
   - Implement in `logger.persistLog()`

2. **Error Tracking**
   - Integrate Sentry or Rollbar
   - Add to error handler middleware

3. **Performance Monitoring**
   - Track slow requests
   - Monitor API response times
   - Set up alerts for > 5s requests

4. **Alerting**
   - Database connection failures
   - High error rates (> 5%)
   - Rate limit violations
   - Master wallet low balance

### Metrics to Track

- **Request Metrics**
  - Total requests per minute
  - Error rate (%)
  - Average response time
  - P95/P99 response times

- **Business Metrics**
  - User registrations per day
  - Transactions per day
  - Total payment volume
  - Failed payments (%)

- **System Metrics**
  - Database connection pool usage
  - Memory usage
  - CPU usage
  - Stellar API response time

## Debugging Tips

### Find Errors

```bash
# View all errors today
grep "ERROR" logs/*.log | grep "2024-01-15"

# Find slow requests
grep "Slow request" logs/*.log

# Track specific user
grep "userId.*user-123" logs/*.log
```

### Database Queries

```sql
-- Recent errors
SELECT * FROM system_logs
WHERE level = 'error'
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Error summary
SELECT message, COUNT(*) as count
FROM system_logs
WHERE level = 'error'
GROUP BY message
ORDER BY count DESC;
```

### Performance Analysis

```typescript
// Add timing to functions
const startTime = Date.now();
await someOperation();
const duration = Date.now() - startTime;
logger.debug('Operation completed', { duration });
```

## Testing Error Handling

### Trigger Errors

```bash
# 404 Not Found
GET /api/v1/nonexistent

# 400 Validation Error
POST /api/v1/auth/register
{ "phoneNumber": "invalid" }

# 429 Rate Limit
# Make 101 requests in 1 minute

# 500 Internal Error
# Disconnect database and make request
```

## Best Practices

✅ **Always log errors** with context
✅ **Use structured logging** with metadata
✅ **Track request IDs** for debugging
✅ **Monitor slow requests** and optimize
✅ **Set up alerts** for critical errors
✅ **Never log sensitive data** (passwords, tokens, secrets)
✅ **Use appropriate log levels**
✅ **Include stack traces** in development
✅ **Sanitize user input** before logging

## Security Considerations

⚠️ **Never Log:**
- Passwords or password hashes
- JWT tokens or API keys
- Credit card numbers
- Private Stellar keys
- Session tokens
- Personal identification documents

✅ **Safe to Log:**
- User IDs
- Phone numbers (partially masked)
- Transaction amounts
- Public keys
- Request paths
- Status codes
- Timing information

## Troubleshooting

### High Memory Usage

Check for:
- Memory leaks in rate limiter
- Large log files not rotated
- Too many concurrent requests

### Slow Performance

Check:
- Database query performance
- Stellar API response time
- Large response payloads
- Unoptimized algorithms

### Frequent Errors

Check:
- Database connection pool
- Stellar network status
- Invalid user input
- Misconfiguration

## Support

For monitoring and logging issues:
- Check application logs
- Review system_logs table
- Monitor health endpoint
- Check rate limit status
