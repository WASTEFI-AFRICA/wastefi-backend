# Authentication System

WasteFi Backend supports two authentication methods:

## 1. JWT Authentication (Recommended for Mobile Apps)

### Register User

```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "phoneNumber": "+254712345678",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Note:** Password is optional but recommended. If provided, it must meet strength requirements:
- At least 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*()_+-=[]{};':"\\|,.<>/?)

See [Password Security](./PASSWORD_SECURITY.md) for detailed requirements.

Response:

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "7d",
    "user": {
      "id": "uuid",
      "phoneNumber": "+254712345678",
      "firstName": "John",
      "lastName": "Doe",
      "role": "COLLECTOR"
    }
  }
}
```

### Login

Login supports both password and OTP authentication:

**With Password:**
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "phoneNumber": "+254712345678",
  "password": "SecurePass123!"
}
```

**With OTP:**
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "phoneNumber": "+254712345678",
  "otp": "123456"
}
```

**Backwards Compatible (Phone Only):**
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "phoneNumber": "+254712345678"
}
```

### Get Profile (Protected Route)

```bash
GET /api/v1/auth/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Refresh Token

```bash
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

## 2. API Key Authentication (Recommended for Server-to-Server)

### Create API Key

```bash
POST /api/v1/auth/api-keys
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "name": "My Integration",
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "key": "wf_live_xxxxxxxxxxxxxxxxxxxx",
    "name": "My Integration",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "message": "API key created successfully. Save this key - it will not be shown again."
}
```

**Important:** Save the API key immediately. It cannot be retrieved again.

### Use API Key

```bash
GET /api/v1/auth/profile
X-API-Key: wf_live_xxxxxxxxxxxxxxxxxxxx
```

### List API Keys

```bash
GET /api/v1/auth/api-keys
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Revoke API Key

```bash
DELETE /api/v1/auth/api-keys/{keyId}
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## Authorization & Roles

### User Roles

- `COLLECTOR` - Waste collectors (default)
- `ADMIN` - Platform administrators
- `COLLECTION_POINT` - Collection point managers
- `VERIFIER` - Material verifiers

### Role-Based Access Control

Use the `requireRole` middleware in routes:

```typescript
import { requireRole } from '../middleware/auth.middleware';

router.post('/admin/users', authenticate, requireRole('ADMIN'), UserController.createUser);
```

## Security Features

Done **JWT with HS256 signing**

- Access tokens expire in 7 days
- Refresh tokens expire in 30 days
- Tokens include issuer validation

Done **Password Security**

- Strong password requirements enforced
- Minimum 8 characters with complexity requirements
- bcrypt hashing with 10 salt rounds
- Secure password comparison
- Password strength indicator available
- See [Password Security](./PASSWORD_SECURITY.md) for details

Done **API Key Security**

- Keys are hashed (SHA-256) before storage
- Last used timestamp tracking
- Optional expiration dates
- Can be revoked anytime

Done **Data Encryption**

- AES-256-CBC for sensitive data
- Used for storing Stellar private keys

## Error Responses

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Authentication required",
  "message": "No token provided"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

### 400 Validation Error

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "phoneNumber",
      "message": "Invalid phone number format"
    }
  ]
}
```

**Password Validation Error:**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "password",
      "message": "Password does not meet requirements: Password must contain at least one uppercase letter; Password must contain at least one special character"
    }
  ]
}
```

## Best Practices

1. **Mobile Apps**: Use JWT authentication with refresh tokens
2. **Server-to-Server**: Use API keys
3. **Store Tokens Securely**: Use secure storage (Keychain, KeyStore)
4. **Use Strong Passwords**: Follow password strength requirements (see [Password Security](./PASSWORD_SECURITY.md))
5. **Rotate API Keys**: Create new keys periodically
6. **Monitor Usage**: Check API key last used timestamps
7. **Handle Expiration**: Implement token refresh logic
8. **Use HTTPS**: Always use HTTPS in production
9. **Password Authentication**: Enable password-based login for enhanced security

## Environment Variables

```env
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
```

**Important:** Change `JWT_SECRET` in production to a strong random value.
