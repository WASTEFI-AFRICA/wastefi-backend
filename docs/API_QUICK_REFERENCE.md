# WasteFi API Quick Reference

Quick reference card for common API operations.

## Base URL

```
Development: http://localhost:3000/api/v1
Production:  https://api.wastefi.com/api/v1
```

## Authentication

### Register User

```http
POST /auth/register
Content-Type: application/json

{
  "phoneNumber": "+254712345678",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com"
}
```

### Login

```http
POST /auth/login
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
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc..."
    }
  }
}
```

### Use Token

```http
Authorization: Bearer <accessToken>
```

## User Management

### Get Profile

```http
GET /auth/profile
Authorization: Bearer <token>
```

### Submit KYC

```http
POST /users/:userId/kyc
Authorization: Bearer <token>
Content-Type: application/json

{
  "documentType": "NATIONAL_ID",
  "documentNumber": "12345678",
  "documentUrl": "https://...",
  "selfieUrl": "https://..."
}
```

## Wallet Operations

### Create Wallet

```http
POST /wallet/create
Authorization: Bearer <token>
```

### Get Balance

```http
GET /wallet/balance
Authorization: Bearer <token>
```

### Get Transactions

```http
GET /wallet/transactions?page=1&limit=20
Authorization: Bearer <token>
```

## Collection Points

### Find Nearby

```http
GET /collection-points/nearby?latitude=-1.286389&longitude=36.817223&radius=10
```

### Get Point Details

```http
GET /collection-points/:pointId
```

### List All Points

```http
GET /collection-points?page=1&limit=20
```

## Waste Collections

### Record Collection

```http
POST /collections
Authorization: Bearer <token>
Content-Type: application/json

{
  "collectionPointId": "uuid",
  "materialType": "PET Bottles",
  "materialCategory": "PLASTIC",
  "weight": 5.5,
  "quantity": 20,
  "imageUrls": ["https://..."],
  "notes": "Clean bottles"
}
```

### Get My Collections

```http
GET /collections/me?page=1&limit=20&status=VERIFIED
Authorization: Bearer <token>
```

### Get Collection Stats

```http
GET /collections/stats
Authorization: Bearer <token>
```

## Payments

### List Payments

```http
GET /payments?page=1&limit=20
Authorization: Bearer <token>
```

### Request Withdrawal

```http
POST /payments/withdraw
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 1000,
  "currency": "KES",
  "method": "MPESA",
  "phoneNumber": "+254712345678"
}
```

### Get Payment Stats

```http
GET /payments/stats
Authorization: Bearer <token>
```

## Material Passports

### Create Passport

```http
POST /passports
Authorization: Bearer <token>
Content-Type: application/json

{
  "collectionId": "uuid",
  "materialType": "PET Bottles",
  "weight": 5.5,
  "origin": "Nairobi, Kenya"
}
```

### Get Passport

```http
GET /passports/:passportId
Authorization: Bearer <token>
```

### Calculate Carbon Credits

```http
GET /passports/:passportId/carbon
Authorization: Bearer <token>
```

## Admin Dashboard

### Get Dashboard Stats

```http
GET /admin/dashboard
Authorization: Bearer <admin-token>
```

### Verify Collection

```http
PUT /collections/:collectionId/verify
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "status": "VERIFIED",
  "notes": "Approved"
}
```

### Verify KYC

```http
PUT /users/:userId/kyc/verify
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "status": "APPROVED",
  "notes": "Documents verified"
}
```

### Process Payment

```http
POST /payments/process
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "collectionId": "uuid",
  "amount": 275,
  "currency": "KES"
}
```

## Common Query Parameters

### Pagination

```
?page=1&limit=20
```

### Filtering

```
?status=VERIFIED
?materialType=PLASTIC
?startDate=2026-01-01
?endDate=2026-12-31
```

### Sorting

```
?sortBy=createdAt&order=desc
```

## Response Codes

| Code | Meaning      |
| ---- | ------------ |
| 200  | OK           |
| 201  | Created      |
| 400  | Bad Request  |
| 401  | Unauthorized |
| 403  | Forbidden    |
| 404  | Not Found    |
| 429  | Rate Limited |
| 500  | Server Error |

## Rate Limits

| Endpoint | Limit   |
| -------- | ------- |
| General  | 100/min |
| Auth     | 10/min  |
| Payments | 20/min  |

## Material Types & Pricing

| Material        | Category   | Base Price (KES/kg) |
| --------------- | ---------- | ------------------- |
| PET Bottles     | PLASTIC    | 50                  |
| HDPE Containers | PLASTIC    | 45                  |
| Aluminum Cans   | METAL      | 80                  |
| Steel           | METAL      | 30                  |
| Cardboard       | PAPER      | 15                  |
| White Paper     | PAPER      | 20                  |
| Clear Glass     | GLASS      | 10                  |
| E-Waste         | ELECTRONIC | 100                 |

**Volume Bonuses:**

- 50kg+: 5% bonus
- 100kg+: 10% bonus

## cURL Examples

### Register

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+254712345678",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+254712345678"}'
```

### Record Collection

```bash
curl -X POST http://localhost:3000/api/v1/collections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "collectionPointId": "uuid",
    "materialType": "PET Bottles",
    "materialCategory": "PLASTIC",
    "weight": 5.5
  }'
```

### Get Balance

```bash
curl -X GET http://localhost:3000/api/v1/wallet/balance \
  -H "Authorization: Bearer <token>"
```

## WebSocket Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: '<your-jwt-token>' },
});

socket.on('connected', (data) => {
  console.log('Connected:', data);
});

socket.on('notification', (notification) => {
  console.log('New notification:', notification);
});
```

## Health Check

```http
GET /health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-09-14T10:00:00Z",
  "service": "wastefi-backend",
  "version": "1.0.0",
  "database": "connected",
  "stellar": "testnet"
}
```

## Error Response Format

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {}
  },
  "timestamp": "2026-09-14T10:00:00Z",
  "requestId": "uuid"
}
```

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://postgres:password@localhost:5432/wastefi
JWT_SECRET=your-secret-key
STELLAR_MASTER_SECRET=your-stellar-secret

# Optional
NODE_ENV=development
PORT=3000
STELLAR_NETWORK=testnet
```

## Documentation Links

- **Interactive Docs**: http://localhost:3000/api/docs
- **OpenAPI Spec**: http://localhost:3000/api/docs.json
- **Full Documentation**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Swagger Guide**: [SWAGGER_GUIDE.md](./SWAGGER_GUIDE.md)

## Support

- Email: support@wastefi.com
- Docs: http://localhost:3000/api/docs
