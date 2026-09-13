# Admin Dashboard API Documentation

Complete API reference for the WasteFi Admin Dashboard endpoints.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Dashboard Endpoints](#dashboard-endpoints)
- [Management Endpoints](#management-endpoints)
- [Response Examples](#response-examples)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## Overview

The Admin Dashboard API provides comprehensive endpoints for platform administration, monitoring, and analytics. All endpoints require **ADMIN** role authentication.

### Base URL
```
/api/v1/admin
```

### Key Features
- Real-time dashboard statistics
- User, collection, and transaction management
- System health monitoring
- Activity logging and audit trails
- Data export capabilities
- Analytics and reporting

---

## Authentication

All admin endpoints require:
1. Valid JWT token in Authorization header
2. User with **ADMIN** role

```http
Authorization: Bearer <your-jwt-token>
```

**Example:**
```bash
curl -H "Authorization: Bearer eyJhbGc..." \
  https://api.wastefi.com/api/v1/admin/dashboard
```

---

## Dashboard Endpoints

### 1. Get Dashboard Statistics

Get comprehensive platform statistics for the admin dashboard.

**Endpoint:** `GET /api/v1/admin/dashboard`

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 1250,
      "activeUsers": 980,
      "totalCollections": 5430,
      "totalTransactions": 8920,
      "totalRevenue": 2750000,
      "pendingKYC": 45
    },
    "userStats": {
      "byRole": {
        "COLLECTOR": 1100,
        "COLLECTION_POINT": 140,
        "ADMIN": 10
      },
      "byKYCStatus": {
        "APPROVED": 850,
        "PENDING": 45,
        "REJECTED": 25,
        "NOT_SUBMITTED": 330
      },
      "newUsersThisMonth": 120,
      "newUsersThisWeek": 28
    },
    "collectionStats": {
      "totalWeight": 125500.5,
      "byMaterial": {
        "Plastic": { "count": 2100, "weight": 52500 },
        "Paper": { "count": 1800, "weight": 45000 },
        "Metal": { "count": 900, "weight": 18000 }
      },
      "byStatus": {
        "PENDING": 150,
        "VERIFIED": 4800,
        "REJECTED": 480
      },
      "thisMonth": 450,
      "thisWeek": 105
    },
    "transactionStats": {
      "totalVolume": 2750000,
      "byType": {
        "WASTE_COLLECTION": { "count": 5200, "volume": 1950000 },
        "WITHDRAWAL": { "count": 3720, "volume": 800000 }
      },
      "byMethod": {
        "STELLAR": { "count": 5200, "volume": 1950000 },
        "MPESA": { "count": 2500, "volume": 600000 },
        "MTN_MONEY": { "count": 920, "volume": 150000 }
      },
      "byStatus": {
        "COMPLETED": 8100,
        "PENDING": 520,
        "FAILED": 300
      },
      "thisMonth": 720,
      "thisWeek": 165
    },
    "collectionPointStats": {
      "total": 140,
      "verified": 125,
      "byCounty": {
        "Nairobi": 45,
        "Mombasa": 28,
        "Kisumu": 22
      },
      "topCollectionPoints": [
        {
          "id": "point-uuid-1",
          "name": "Nairobi Green Center",
          "county": "Nairobi",
          "collectionsCount": 850
        }
      ]
    }
  }
}
```

**Use Cases:**
- Main dashboard overview
- Real-time platform monitoring
- Quick access to key metrics

---

### 2. Get Recent Activity

Get recent system activity and audit logs.

**Endpoint:** `GET /api/v1/admin/activity`

**Authentication:** Required (Admin)

**Query Parameters:**
- `limit` (optional): Number of logs to return (1-200, default: 50)

**Example Request:**
```bash
GET /api/v1/admin/activity?limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "log-uuid-1",
      "action": "APPROVE_KYC",
      "userId": "admin-uuid",
      "userName": "John Admin",
      "details": "Approved KYC for user Jane Doe",
      "timestamp": "2026-09-13T10:30:00Z"
    },
    {
      "id": "log-uuid-2",
      "action": "VERIFY_COLLECTION",
      "userId": "admin-uuid-2",
      "userName": "Sarah Admin",
      "details": "Verified waste collection #12345",
      "timestamp": "2026-09-13T10:25:00Z"
    }
  ]
}
```

**Use Cases:**
- Audit trail monitoring
- Security review
- Admin action tracking

---

### 3. Get System Health

Get real-time system health status and service availability.

**Endpoint:** `GET /api/v1/admin/health`

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "database": {
      "status": "healthy",
      "responseTime": 45
    },
    "services": {
      "stellar": true,
      "sms": true,
      "email": true,
      "mobileMoney": {
        "mpesa": true,
        "mtn": true,
        "airtel": false
      }
    }
  }
}
```

**Status Values:**
- `healthy` - Response time < 1000ms
- `degraded` - Response time >= 1000ms
- `down` - Service unavailable

**Use Cases:**
- System monitoring
- Service availability checks
- Troubleshooting

---

## Management Endpoints

### 4. Get Users List

Get paginated list of all users with filtering options.

**Endpoint:** `GET /api/v1/admin/users`

**Authentication:** Required (Admin)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (1-100, default: 20)
- `role` (optional): Filter by role (ADMIN, COLLECTOR, COLLECTION_POINT)
- `kycStatus` (optional): Filter by KYC status (PENDING, APPROVED, REJECTED, NOT_SUBMITTED)
- `status` (optional): Filter by status (ACTIVE, INACTIVE, SUSPENDED)
- `search` (optional): Search by name, email, or phone

**Example Request:**
```bash
GET /api/v1/admin/users?page=1&limit=20&kycStatus=PENDING&search=john
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-uuid-1",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phoneNumber": "+254712345678",
      "role": "COLLECTOR",
      "status": "ACTIVE",
      "kycStatus": "PENDING",
      "createdAt": "2026-08-15T10:30:00Z",
      "lastLoginAt": "2026-09-13T09:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1250,
    "totalPages": 63
  }
}
```

**Use Cases:**
- User management
- KYC review workflow
- User search and filtering

---

### 5. Get Collections List

Get paginated list of all waste collections with filtering options.

**Endpoint:** `GET /api/v1/admin/collections`

**Authentication:** Required (Admin)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (1-100, default: 20)
- `status` (optional): Filter by status (PENDING, VERIFIED, REJECTED)
- `materialType` (optional): Filter by material type
- `collectionPointId` (optional): Filter by collection point UUID
- `startDate` (optional): Filter from date (ISO 8601)
- `endDate` (optional): Filter to date (ISO 8601)

**Example Request:**
```bash
GET /api/v1/admin/collections?status=PENDING&startDate=2026-09-01
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "collection-uuid-1",
      "materialType": "Plastic",
      "weight": 25.5,
      "status": "PENDING",
      "paymentAmount": 500,
      "paymentCurrency": "KES",
      "createdAt": "2026-09-13T08:00:00Z",
      "collector": {
        "firstName": "Jane",
        "lastName": "Doe",
        "phoneNumber": "+254723456789"
      },
      "collectionPoint": {
        "name": "Nairobi Green Center",
        "county": "Nairobi"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

**Use Cases:**
- Collection verification workflow
- Material tracking
- Collection point performance

---

### 6. Get Transactions List

Get paginated list of all transactions with filtering options.

**Endpoint:** `GET /api/v1/admin/transactions`

**Authentication:** Required (Admin)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (1-100, default: 20)
- `type` (optional): Filter by type (WASTE_COLLECTION, WITHDRAWAL, etc.)
- `status` (optional): Filter by status (PENDING, COMPLETED, FAILED, CANCELLED)
- `paymentMethod` (optional): Filter by method (STELLAR, MPESA, MTN_MONEY, AIRTEL_MONEY)
- `userId` (optional): Filter by user UUID
- `startDate` (optional): Filter from date (ISO 8601)
- `endDate` (optional): Filter to date (ISO 8601)

**Example Request:**
```bash
GET /api/v1/admin/transactions?status=FAILED&paymentMethod=MPESA
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "transaction-uuid-1",
      "userId": "user-uuid-1",
      "amount": 500,
      "currency": "KES",
      "type": "WASTE_COLLECTION",
      "status": "FAILED",
      "paymentMethod": "MPESA",
      "failureReason": "Insufficient balance",
      "createdAt": "2026-09-13T10:00:00Z",
      "user": {
        "firstName": "John",
        "lastName": "Doe",
        "phoneNumber": "+254712345678"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 300,
    "totalPages": 15
  }
}
```

**Use Cases:**
- Transaction monitoring
- Failed payment investigation
- Financial reporting

---

### 7. Get Analytics

Get analytics data for charts and visualizations.

**Endpoint:** `GET /api/v1/admin/analytics`

**Authentication:** Required (Admin)

**Query Parameters:**
- `period` (optional): Time period (7d, 30d, 90d, 1y, default: 30d)
- `type` (optional): Data type (collections, transactions, users, default: collections)

**Example Request:**
```bash
GET /api/v1/admin/analytics?period=30d&type=transactions
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [...],
    "pagination": {...}
  }
}
```

**Use Cases:**
- Trend analysis
- Performance charts
- Business intelligence

---

### 8. Export Data

Export platform data to JSON or CSV format.

**Endpoint:** `GET /api/v1/admin/export`

**Authentication:** Required (Admin)

**Query Parameters:**
- `type` (required): Data type (users, collections, transactions)
- `format` (optional): Export format (json, csv, default: json)

**Example Request:**
```bash
GET /api/v1/admin/export?type=users&format=csv
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [...],
    "pagination": {...}
  }
}
```

**Use Cases:**
- Data backup
- External reporting
- Third-party integrations

---

## Error Handling

### Common Error Responses

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "Authentication required"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Admin access required"
}
```

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Invalid query parameters",
  "details": [
    {
      "field": "limit",
      "message": "Must be between 1 and 100"
    }
  ]
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Failed to fetch dashboard statistics"
}
```

---

## Best Practices

### 1. Pagination

Always use pagination for large datasets:

```javascript
// Good - Paginated request
GET /api/v1/admin/users?page=1&limit=20

// Bad - Loading all users
GET /api/v1/admin/users?limit=10000
```

### 2. Filtering

Use filters to reduce response size:

```javascript
// Good - Filtered request
GET /api/v1/admin/collections?status=PENDING&startDate=2026-09-01

// Less efficient - No filters
GET /api/v1/admin/collections
```

### 3. Caching

Cache dashboard statistics for better performance:

```javascript
// Cache for 5 minutes
const cacheKey = 'admin:dashboard';
const cachedStats = await cache.get(cacheKey);

if (cachedStats) {
  return cachedStats;
}

const stats = await AdminService.getDashboardStats();
await cache.set(cacheKey, stats, 300);
```

### 4. Error Handling

Always handle errors gracefully:

```javascript
try {
  const stats = await fetch('/api/v1/admin/dashboard');
  // Handle success
} catch (error) {
  // Log error
  console.error('Dashboard fetch failed:', error);
  // Show user-friendly message
  showNotification('Failed to load dashboard');
}
```

### 5. Rate Limiting

Respect rate limits (100 requests/minute for general endpoints):

```javascript
// Implement client-side rate limiting
const limiter = new RateLimiter({ max: 90, window: 60000 });

if (!limiter.canMakeRequest()) {
  console.warn('Rate limit approaching');
  return;
}
```

---

## Frontend Integration Example

### React Dashboard Component

```typescript
import { useEffect, useState } from 'react';
import axios from 'axios';

interface DashboardStats {
  overview: { /* ... */ };
  userStats: { /* ... */ };
  // ... other stats
}

function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/v1/admin/dashboard', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setStats(response.data.data);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!stats) return null;

  return (
    <div className="dashboard">
      <h1>Admin Dashboard</h1>
      
      <div className="stats-grid">
        <StatCard 
          title="Total Users" 
          value={stats.overview.totalUsers}
        />
        <StatCard 
          title="Total Revenue" 
          value={`KES ${stats.overview.totalRevenue.toLocaleString()}`}
        />
        {/* More stat cards... */}
      </div>

      {/* Charts, tables, etc. */}
    </div>
  );
}
```

---

## Security Considerations

### 1. Authentication

- All endpoints require valid JWT token
- Tokens should be stored securely (httpOnly cookies recommended)
- Implement token refresh mechanism

### 2. Authorization

- Only users with ADMIN role can access these endpoints
- Role is verified on every request
- Activity is logged for audit purposes

### 3. Data Protection

- Sensitive user data (passwords, payment details) are never exposed
- Phone numbers and emails are included but should be handled carefully
- Implement additional PII protection in frontend display

### 4. Rate Limiting

- General endpoints: 100 requests/minute
- Admin endpoints use the same limits
- Consider implementing separate, more lenient limits for admin users

### 5. Logging

- All admin actions are logged
- Logs include user ID, action, and timestamp
- Use logs for security audits and compliance

---

**Last Updated:** 2026-09-13  
**Version:** 1.0.0
