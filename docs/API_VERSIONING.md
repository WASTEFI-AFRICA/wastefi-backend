# API Versioning Guide

## Overview

WasteFi API uses semantic versioning to manage API evolution while maintaining backward compatibility. This ensures existing integrations continue working while allowing the API to evolve.

## Current Version

**Latest Stable**: `v1`  
**Supported Versions**: `v1`, `v2`  
**Default Version**: `v1`

## Versioning Strategies

The API supports multiple ways to specify the version:

### 1. URL Path (Recommended)

Include the version in the URL path:

```
GET /api/v1/users
GET /api/v2/users
```

**Pros**: Clear, cacheable, easy to test  
**Cons**: Requires different URLs for different versions

### 2. Custom Header

Use the `X-API-Version` header:

```http
GET /api/users HTTP/1.1
Host: api.wastefi.com
X-API-Version: v1
```

**Pros**: Single URL, flexible  
**Cons**: Not cacheable by default, less visible

### 3. Accept Header (Content Negotiation)

Use vendor-specific media type:

```http
GET /api/users HTTP/1.1
Host: api.wastefi.com
Accept: application/vnd.wastefi.v1+json
```

**Pros**: RESTful, flexible  
**Cons**: Complex, less common

### 4. Query Parameter

Add version as query parameter:

```
GET /api/users?version=v1
```

**Pros**: Simple for testing  
**Cons**: Pollutes query string, not recommended for production

## Priority Order

When multiple version indicators are present:

1. URL Path (highest priority)
2. X-API-Version header
3. Accept header
4. Query parameter
5. Default version (lowest priority)

## Version Response Headers

All responses include version information:

```http
HTTP/1.1 200 OK
X-API-Version: v1
Content-Type: application/json
```

## Breaking Changes

### What Constitutes a Breaking Change?

- Removing or renaming fields
- Changing field types
- Adding required parameters
- Changing error codes
- Modifying authentication
- Altering rate limits

### What's NOT a Breaking Change?

- Adding optional fields
- Adding new endpoints
- Adding optional parameters
- Deprecation warnings
- Bug fixes
- Performance improvements

## Version Lifecycle

### 1. Active

Current production version, fully supported.

**Current**: `v1`, `v2`

### 2. Deprecated

Still functional but scheduled for removal. Warning headers included.

```http
HTTP/1.1 200 OK
Warning: 299 - "API version v1 is deprecated and will be sunset on 2027-01-01"
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
```

**Current**: None

### 3. Sunset

Version is no longer available. Returns error.

```json
{
  "success": false,
  "error": "Unsupported API Version",
  "message": "API version 'v0' is not supported. Supported versions: v1, v2",
  "supportedVersions": ["v1", "v2"]
}
```

## Version Differences

### V1 (Current Default)

**Released**: September 2026  
**Status**: Active

**Features**:

- Basic CRUD operations
- Authentication with JWT
- Payment processing
- Waste collection management
- Simple response format

**Response Format**:

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "John Doe"
  }
}
```

### V2 (Latest)

**Released**: September 2026  
**Status**: Active

**New Features**:

- Enhanced metadata
- Pagination improvements
- Better error messages
- Expanded filtering

**Response Format**:

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "John Doe"
  },
  "meta": {
    "version": "v2",
    "timestamp": "2026-09-14T10:30:00Z"
  }
}
```

**Breaking Changes**:

- Phone numbers must include country code (e.g., +254712345678)
- Date format changed to ISO 8601
- Pagination parameters renamed

## Migration Guide

### Upgrading from V1 to V2

#### 1. Update Base URL

```javascript
// V1
const baseUrl = 'https://api.wastefi.com/api/v1';

// V2
const baseUrl = 'https://api.wastefi.com/api/v2';
```

#### 2. Phone Number Format

```javascript
// V1 (accepted without country code)
{
  "phoneNumber": "712345678"
}

// V2 (requires country code)
{
  "phoneNumber": "+254712345678"
}
```

#### 3. Pagination

```javascript
// V1
GET /api/v1/users?page=1&limit=20

// V2
GET /api/v2/users?page=1&pageSize=20
```

#### 4. Response Format

```javascript
// V1
{
  success: true,
  data: { ... }
}

// V2
{
  success: true,
  data: { ... },
  meta: {
    version: "v2",
    timestamp: "2026-09-14T10:30:00Z"
  }
}
```

## Implementation Examples

### Using URL Path

```typescript
// JavaScript/TypeScript
const response = await fetch('https://api.wastefi.com/api/v1/users');
```

```bash
# cURL
curl https://api.wastefi.com/api/v1/users
```

### Using Custom Header

```typescript
// JavaScript/TypeScript
const response = await fetch('https://api.wastefi.com/api/users', {
  headers: {
    'X-API-Version': 'v1',
  },
});
```

```bash
# cURL
curl -H "X-API-Version: v1" https://api.wastefi.com/api/users
```

### Using Accept Header

```typescript
// JavaScript/TypeScript
const response = await fetch('https://api.wastefi.com/api/users', {
  headers: {
    Accept: 'application/vnd.wastefi.v1+json',
  },
});
```

```bash
# cURL
curl -H "Accept: application/vnd.wastefi.v1+json" https://api.wastefi.com/api/users
```

### Version-Specific Logic (Backend)

```typescript
import { getApiVersion, isVersion } from '../middleware/api-versioning.middleware';

export async function getUsers(req: Request, res: Response) {
  const version = getApiVersion(req);

  if (isVersion(req, 'v1')) {
    // V1 logic
    return res.json({
      success: true,
      data: users,
    });
  }

  if (isVersion(req, 'v2')) {
    // V2 logic with metadata
    return res.json({
      success: true,
      data: users,
      meta: {
        version: 'v2',
        timestamp: new Date().toISOString(),
      },
    });
  }
}
```

## Best Practices

### For API Consumers

1. **Always specify version explicitly** - Don't rely on defaults
2. **Use URL path versioning** - Most reliable and cacheable
3. **Monitor deprecation warnings** - Check response headers
4. **Test new versions early** - Don't wait until sunset
5. **Version your client libraries** - Match API versions

### For API Developers

1. **Never break existing versions** - Create new version instead
2. **Maintain at least 2 versions** - Give users time to migrate
3. **Announce deprecations early** - Minimum 6 months notice
4. **Document all changes** - Keep comprehensive changelog
5. **Monitor version usage** - Track adoption and deprecation impact

## Deprecation Policy

### Timeline

1. **Announcement** (T-0): New version released, old version marked as deprecated
2. **Deprecation Period** (T+6 months): Both versions fully supported
3. **Sunset Warning** (T+9 months): Increased warnings, migration support
4. **Sunset Date** (T+12 months): Old version removed

### Communication

- Email notifications to registered developers
- Warning headers in API responses
- Status page announcements
- Developer blog posts

## Error Handling

### Unsupported Version

```json
{
  "success": false,
  "error": "Unsupported API Version",
  "message": "API version 'v0' is not supported. Supported versions: v1, v2",
  "supportedVersions": ["v1", "v2"]
}
```

**Status Code**: 400 Bad Request

### Deprecated Version

Response succeeds but includes warning headers:

```http
HTTP/1.1 200 OK
Warning: 299 - "API version v1 is deprecated and will be sunset on 2027-01-01"
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
X-API-Version: v1
```

## Monitoring

Version usage is logged for analytics:

```json
{
  "level": "info",
  "message": "API version",
  "version": "v1",
  "path": "/api/v1/users",
  "method": "GET",
  "timestamp": "2026-09-14T10:30:00Z"
}
```

## FAQs

**Q: What happens if I don't specify a version?**  
A: The default version (currently v1) will be used.

**Q: How long are API versions supported?**  
A: Minimum 12 months after deprecation announcement.

**Q: Can I use different versions for different endpoints?**  
A: Yes, each request can specify its own version.

**Q: Will my API keys work across versions?**  
A: Yes, authentication is version-independent.

**Q: How do I know when a version is deprecated?**  
A: Check the `Warning` and `Sunset` response headers.

**Q: Can I request features to be backported?**  
A: Contact support, though we generally encourage upgrading to latest version.

## Support

For version-specific support:

- Email: api-support@wastefi.com
- Documentation: https://docs.wastefi.com
- Status Page: https://status.wastefi.com

## Related Documentation

- [API Documentation](./API_DOCUMENTATION.md)
- [Authentication](./AUTHENTICATION.md)
- [Rate Limiting](./RATE_LIMITING.md)
- [API Quick Reference](./API_QUICK_REFERENCE.md)
