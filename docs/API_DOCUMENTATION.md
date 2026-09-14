# WasteFi API Documentation

Complete API documentation for the WasteFi Backend platform.

## Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Interactive Documentation](#interactive-documentation)
- [API Endpoints](#api-endpoints)

## Overview

The WasteFi API provides a comprehensive platform for waste collection management, financial inclusion through blockchain payments, and material tracking. The API follows RESTful principles and returns JSON responses.

### Key Features

- **User Management**: Registration, KYC verification, and profile management
- **Waste Collection**: Record and verify waste collections with pricing
- **Blockchain Payments**: Stellar-based payments and wallet management
- **Mobile Money**: Integration with M-Pesa, MTN Money, and Airtel Money
- **Material Passports**: Digital product passports with RecycleGraph integration
- **Real-Time Updates**: WebSocket support for instant notifications
- **Geolocation**: Find nearby collection points
- **Admin Dashboard**: Analytics and management tools

## Base URL

### Development
```
http://localhost:3000/api/v1
```

### Production
```
https://api.wastefi.com/api/v1
```

## Authentication

WasteFi API supports two authentication methods:

### 1. JWT Bearer Token (Recommended for users)

Include the JWT token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

**Obtaining a Token:**

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "phoneNumber": "+254712345678"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

**Token Lifetime:**
- Access Token: 1 hour
- Refresh Token: 7 days

**Refreshing Tokens:**

```bash
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

### 2. API Key (Recommended for machine-to-machine)

Include the API key in the X-API-Key header:

```http
X-API-Key: <your-api-key>
```

**Creating an API Key:**

```bash
POST /api/v1/auth/api-keys
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "My Application"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "apiKey": "wf_live_abc123def456...",
    "keyId": "uuid",
    "name": "My Application"
  }
}
```

⚠️ **Important**: Store the API key securely. It's only shown once and cannot be retrieved later.

## Rate Limiting

To ensure fair usage and service stability, the API implements rate limiting:

| Endpoint Type | Rate Limit |
|---------------|------------|
| General API | 100 requests/minute |
| Authentication | 10 requests/minute |
| Payment Operations | 20 requests/minute |

**Rate Limit Headers:**

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1694678400
```

**Rate Limit Exceeded Response:**

```json
{
  "success": false,
  "error": {
    "message": "Too many requests",
    "code": "RATE_LIMIT_EXCEEDED"
  },
  "timestamp": "2026-09-14T10:00:00Z",
  "requestId": "uuid"
}
```

## Response Format

All API responses follow a consistent structure:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "timestamp": "2026-09-14T10:00:00Z",
  "requestId": "uuid"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {
      // Additional error details (optional)
    }
  },
  "timestamp": "2026-09-14T10:00:00Z",
  "requestId": "uuid"
}
```

### Pagination

Endpoints that return lists support pagination:

**Request:**
```http
GET /api/v1/collections?page=2&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "collections": [...],
    "pagination": {
      "total": 150,
      "page": 2,
      "limit": 20,
      "totalPages": 8,
      "hasMore": true
    }
  }
}
```

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |
| 503 | Service Unavailable - Service temporarily unavailable |

### Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Missing or invalid authentication |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid input data |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `DUPLICATE_RESOURCE` | Resource already exists |
| `INSUFFICIENT_BALANCE` | Insufficient wallet balance |
| `PAYMENT_FAILED` | Payment processing failed |
| `EXTERNAL_SERVICE_ERROR` | External service error |

## Interactive Documentation

### Swagger UI

Access the interactive API documentation at:

```
http://localhost:3000/api/docs
```

The Swagger UI provides:
- ✅ Complete API reference
- ✅ Try-it-out functionality
- ✅ Request/response examples
- ✅ Schema definitions
- ✅ Authentication testing

### OpenAPI Specification

Download the raw OpenAPI specification:

```
GET /api/docs.json
```

This can be imported into tools like Postman, Insomnia, or other API clients.

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| POST | `/auth/refresh` | Refresh access token | No |
| GET | `/auth/profile` | Get user profile | Yes |
| POST | `/auth/api-keys` | Create API key | Yes |
| GET | `/auth/api-keys` | List API keys | Yes |
| DELETE | `/auth/api-keys/:keyId` | Revoke API key | Yes |

[Full Authentication Documentation](./AUTHENTICATION.md)

### Users

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users` | List users (Admin) | Yes (Admin) |
| GET | `/users/:userId` | Get user details | Yes |
| PUT | `/users/:userId` | Update user profile | Yes |
| DELETE | `/users/:userId` | Delete user (soft) | Yes |
| POST | `/users/:userId/kyc` | Submit KYC documents | Yes |
| PUT | `/users/:userId/kyc/verify` | Verify KYC (Admin) | Yes (Admin) |
| PUT | `/users/:userId/status` | Update user status (Admin) | Yes (Admin) |

[Full User Management Documentation](./USER_MANAGEMENT.md)

### Wallet

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/wallet/create` | Create Stellar wallet | Yes |
| GET | `/wallet/balance` | Get wallet balance | Yes |
| POST | `/wallet/send` | Send payment | Yes |
| GET | `/wallet/transactions` | Get transaction history | Yes |

[Full Wallet Documentation](./WALLET_SETUP.md)

### Waste Collections

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/collections` | Record waste collection | Yes |
| GET | `/collections` | List collections | Yes |
| GET | `/collections/:collectionId` | Get collection details | Yes |
| PUT | `/collections/:collectionId/verify` | Verify collection (Admin) | Yes (Admin) |
| GET | `/collections/stats` | Get collection statistics | Yes |

[Full Waste Collections Documentation](./WASTE_COLLECTIONS.md)

### Collection Points

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/collection-points` | Create collection point | Yes (Admin) |
| GET | `/collection-points` | List collection points | No |
| GET | `/collection-points/nearby` | Find nearby points | No |
| GET | `/collection-points/:pointId` | Get point details | No |
| PUT | `/collection-points/:pointId` | Update collection point | Yes (Admin) |
| DELETE | `/collection-points/:pointId` | Delete collection point | Yes (Admin) |
| PUT | `/collection-points/:pointId/verify` | Verify point (Admin) | Yes (Admin) |

[Full Collection Points Documentation](./COLLECTION_POINTS.md)

### Payments

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/payments/process` | Process collection payment | Yes (Admin) |
| POST | `/payments/withdraw` | Request withdrawal | Yes |
| GET | `/payments` | List payments | Yes |
| GET | `/payments/:paymentId` | Get payment details | Yes |
| POST | `/payments/:paymentId/retry` | Retry failed payment | Yes (Admin) |
| GET | `/payments/stats` | Get payment statistics | Yes |
| POST | `/payments/mobile-money/callback/:provider` | Mobile money callback | No |

[Full Payments Documentation](./PAYMENTS.md)

### Material Passports

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/passports` | Create material passport | Yes |
| GET | `/passports` | List passports | Yes |
| GET | `/passports/:passportId` | Get passport details | Yes |
| POST | `/passports/:passportId/verify` | Verify passport | Yes |
| POST | `/passports/:passportId/custody` | Update custody | Yes |
| GET | `/passports/:passportId/carbon` | Calculate carbon credits | Yes |

[Full Material Passports Documentation](./RECYCLEGRAPH_INTEGRATION.md)

### Admin

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/dashboard` | Get dashboard stats | Yes (Admin) |
| GET | `/admin/users` | List all users | Yes (Admin) |
| GET | `/admin/collections` | List all collections | Yes (Admin) |
| GET | `/admin/transactions` | List all transactions | Yes (Admin) |
| GET | `/admin/collection-points` | List all points | Yes (Admin) |
| GET | `/admin/activity` | Get recent activity | Yes (Admin) |
| GET | `/admin/health` | Get system health | Yes (Admin) |

[Full Admin Documentation](./ADMIN_DASHBOARD.md)

### Health Check

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Service health check | No |

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-09-14T10:00:00Z",
  "service": "wastefi-backend",
  "version": "1.0.0",
  "environment": "production",
  "database": "connected",
  "stellar": "testnet"
}
```

## WebSocket Events

For real-time updates, connect to the WebSocket endpoint:

```
ws://localhost:3000/socket.io/
```

[Full WebSocket Documentation](./WEBSOCKET.md)

## Code Examples

### JavaScript/TypeScript

```typescript
// Using fetch API
const response = await fetch('http://localhost:3000/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    phoneNumber: '+254712345678',
  }),
});

const data = await response.json();
console.log(data);
```

### Python

```python
import requests

response = requests.post(
    'http://localhost:3000/api/v1/auth/login',
    json={'phoneNumber': '+254712345678'}
)

data = response.json()
print(data)
```

### cURL

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+254712345678"}'
```

## Best Practices

### 1. Always Use HTTPS in Production
Never send requests over HTTP in production environments.

### 2. Store Credentials Securely
- Never hardcode API keys or tokens
- Use environment variables or secure vaults
- Rotate API keys regularly

### 3. Handle Errors Gracefully
```typescript
try {
  const response = await api.call();
  // Handle success
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Implement exponential backoff
  } else if (error.code === 'UNAUTHORIZED') {
    // Refresh token or re-authenticate
  }
  // Handle other errors
}
```

### 4. Implement Retry Logic
For transient errors (5xx, network issues), implement exponential backoff:

```typescript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

### 5. Use Pagination
When fetching large datasets, always use pagination to reduce load.

### 6. Cache Responses
Cache responses when appropriate to reduce API calls:
- User profiles
- Collection point data
- Material pricing

### 7. Monitor Rate Limits
Check rate limit headers and adjust request frequency accordingly.

## Support

### Documentation
- [Authentication Guide](./AUTHENTICATION.md)
- [User Management](./USER_MANAGEMENT.md)
- [Payments Guide](./PAYMENTS.md)
- [Mobile Money Integration](./MOBILE_MONEY.md)
- [WebSocket Guide](./WEBSOCKET.md)

### Contact
- Email: support@wastefi.com
- GitHub: https://github.com/wastefi/backend

## Changelog

### Version 1.0.0 (2026-09-14)
- Initial API release
- Complete authentication system
- Waste collection management
- Stellar blockchain integration
- Mobile money support
- Material passport generation
- WebSocket real-time updates
- Admin dashboard
- Comprehensive documentation

## License

MIT License - See LICENSE file for details
