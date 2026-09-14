# Postman Setup Guide

Guide for importing and using WasteFi API with Postman.

## Table of Contents

- [Import OpenAPI Specification](#import-openapi-specification)
- [Setup Environment](#setup-environment)
- [Authentication Setup](#authentication-setup)
- [Testing Workflows](#testing-workflows)
- [Collection Organization](#collection-organization)

## Import OpenAPI Specification

### Method 1: Import from URL

1. **Start WasteFi server**:
   ```bash
   npm run dev
   ```

2. **Open Postman**

3. **Import Collection**:
   - Click **"Import"** button (top left)
   - Select **"Link"** tab
   - Enter: `http://localhost:3000/api/docs.json`
   - Click **"Continue"**
   - Click **"Import"**

4. **Collection Created**:
   - Name: "WasteFi API Documentation"
   - All endpoints organized by tags
   - Request/response examples included

### Method 2: Import from File

1. **Download specification**:
   ```bash
   curl http://localhost:3000/api/docs.json -o wastefi-openapi.json
   ```

2. **Import in Postman**:
   - Click **"Import"**
   - Select **"Files"** tab
   - Upload `wastefi-openapi.json`
   - Click **"Import"**

## Setup Environment

### Create Environment

1. Click **"Environments"** (left sidebar)
2. Click **"+"** to create new environment
3. Name: **"WasteFi Local"**

### Add Variables

| Variable | Initial Value | Current Value | Type |
|----------|---------------|---------------|------|
| `baseUrl` | `http://localhost:3000/api/v1` | `http://localhost:3000/api/v1` | default |
| `accessToken` | | | secret |
| `refreshToken` | | | secret |
| `userId` | | | default |
| `collectionPointId` | | | default |
| `collectionId` | | | default |

### Production Environment

Create second environment: **"WasteFi Production"**

| Variable | Initial Value |
|----------|---------------|
| `baseUrl` | `https://api.wastefi.com/api/v1` |

## Authentication Setup

### Automatic Token Management

Create a **Pre-request Script** at the collection level:

1. Right-click collection → **"Edit"**
2. Go to **"Pre-request Script"** tab
3. Add script:

```javascript
// Auto-add Bearer token if available
const accessToken = pm.environment.get('accessToken');
if (accessToken && !pm.request.headers.has('Authorization')) {
    pm.request.headers.add({
        key: 'Authorization',
        value: `Bearer ${accessToken}`
    });
}
```

### Auto-Save Tokens

Create a **Test Script** for login endpoint:

1. Open **"POST Login"** request
2. Go to **"Tests"** tab
3. Add script:

```javascript
// Save tokens from login response
if (pm.response.code === 200) {
    const response = pm.response.json();
    
    if (response.success && response.data.tokens) {
        pm.environment.set('accessToken', response.data.tokens.accessToken);
        pm.environment.set('refreshToken', response.data.tokens.refreshToken);
        pm.environment.set('userId', response.data.user.id);
        
        console.log('✅ Tokens saved to environment');
    }
}
```

### Refresh Token Script

Create request: **"Refresh Token"**

```javascript
// Tests tab
if (pm.response.code === 200) {
    const response = pm.response.json();
    
    if (response.success && response.data.accessToken) {
        pm.environment.set('accessToken', response.data.accessToken);
        console.log('✅ Access token refreshed');
    }
}
```

## Testing Workflows

### Workflow 1: User Registration & First Collection

1. **Register User**
   - Request: `POST /auth/register`
   - Body:
     ```json
     {
       "phoneNumber": "+254712345678",
       "firstName": "John",
       "lastName": "Doe",
       "email": "john@example.com"
     }
     ```
   - ✅ Tokens auto-saved

2. **Get Profile**
   - Request: `GET /auth/profile`
   - ✅ Token auto-added

3. **Create Wallet**
   - Request: `POST /wallet/create`
   - ✅ Wallet created automatically

4. **Find Collection Point**
   - Request: `GET /collection-points/nearby`
   - Params: `latitude=-1.286389&longitude=36.817223`
   - Save `collectionPointId` from response

5. **Record Collection**
   - Request: `POST /collections`
   - Body:
     ```json
     {
       "collectionPointId": "{{collectionPointId}}",
       "materialType": "PET Bottles",
       "materialCategory": "PLASTIC",
       "weight": 5.5
     }
     ```

6. **Check Collection Status**
   - Request: `GET /collections/me`

### Workflow 2: KYC Submission

1. **Submit KYC**
   - Request: `POST /users/{{userId}}/kyc`
   - Body:
     ```json
     {
       "documentType": "NATIONAL_ID",
       "documentNumber": "12345678",
       "documentUrl": "https://example.com/id.jpg",
       "selfieUrl": "https://example.com/selfie.jpg"
     }
     ```

2. **Check KYC Status**
   - Request: `GET /auth/profile`
   - Check `kycStatus` field

### Workflow 3: Admin Operations

1. **Login as Admin**
   - Phone: Use admin phone from seed data

2. **Get Dashboard**
   - Request: `GET /admin/dashboard`

3. **Verify Collection**
   - Request: `PUT /collections/{{collectionId}}/verify`
   - Body:
     ```json
     {
       "status": "VERIFIED",
       "notes": "Approved"
     }
     ```

4. **Process Payment**
   - Request: `POST /payments/process`
   - Body:
     ```json
     {
       "collectionId": "{{collectionId}}",
       "amount": 275,
       "currency": "KES"
     }
     ```

## Collection Organization

### Folder Structure

```
WasteFi API
├── Authentication
│   ├── Register
│   ├── Login
│   ├── Refresh Token
│   ├── Get Profile
│   └── API Keys
├── Users
│   ├── List Users
│   ├── Get User
│   ├── Update User
│   └── KYC
├── Wallet
│   ├── Create Wallet
│   ├── Get Balance
│   ├── Send Payment
│   └── Transactions
├── Collection Points
│   ├── List Points
│   ├── Find Nearby
│   ├── Get Point
│   └── Admin Operations
├── Waste Collections
│   ├── Record Collection
│   ├── My Collections
│   ├── Get Collection
│   └── Verify (Admin)
├── Payments
│   ├── List Payments
│   ├── Process Payment
│   ├── Request Withdrawal
│   └── Payment Stats
├── Material Passports
│   ├── Create Passport
│   ├── List Passports
│   ├── Get Passport
│   └── Carbon Credits
└── Admin
    ├── Dashboard
    ├── User Management
    ├── Collection Management
    └── System Health
```

## Advanced Features

### Dynamic Variables

Use Postman's dynamic variables:

```json
{
  "email": "{{$randomEmail}}",
  "firstName": "{{$randomFirstName}}",
  "lastName": "{{$randomLastName}}"
}
```

### Chain Requests

Use test scripts to chain requests:

```javascript
// After creating collection, get its details
if (pm.response.code === 201) {
    const collectionId = pm.response.json().data.id;
    pm.environment.set('collectionId', collectionId);
    
    // Auto-run next request
    postman.setNextRequest('Get Collection');
}
```

### Data-Driven Testing

1. **Create CSV file** (`test-data.csv`):
   ```csv
   phoneNumber,firstName,lastName
   +254712345678,John,Doe
   +254723456789,Jane,Smith
   ```

2. **Use Collection Runner**:
   - Click collection → **"Run"**
   - Select **"Data"** → Upload CSV
   - Configure iterations
   - Run collection with different data sets

### Mock Servers

Create mock server from collection:

1. Right-click collection
2. Select **"Mock Collection"**
3. Name: "WasteFi Mock"
4. Click **"Create Mock Server"**
5. Use mock URL for testing without backend

## Testing Best Practices

### 1. Use Tests Tab

Add assertions to verify responses:

```javascript
// Status code
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// Response structure
pm.test("Response has success field", function () {
    pm.expect(pm.response.json()).to.have.property('success');
});

// Response time
pm.test("Response time is less than 500ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(500);
});

// Data validation
pm.test("User has valid email", function () {
    const user = pm.response.json().data;
    pm.expect(user.email).to.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/);
});
```

### 2. Use Pre-request Scripts

Setup data before request:

```javascript
// Generate unique email
pm.environment.set('uniqueEmail', `test${Date.now()}@example.com`);

// Set timestamp
pm.environment.set('timestamp', new Date().toISOString());

// Generate random weight
pm.environment.set('weight', Math.random() * 10 + 1);
```

### 3. Monitor Collections

Set up monitoring:

1. Collection → **"..."** → **"Monitor Collection"**
2. Configure schedule (e.g., every 5 minutes)
3. Select environment
4. **"Create Monitor"**

### 4. Document Requests

Add descriptions to requests:

- **Description tab**: Explain what the request does
- **Examples**: Save successful responses as examples
- **Comments**: Add inline comments in JSON

## Troubleshooting

### Issue: Unauthorized (401)

**Solution:**
1. Check token is saved: `{{accessToken}}`
2. Login again to refresh token
3. Verify Authorization header format: `Bearer <token>`

### Issue: Rate Limit (429)

**Solution:**
1. Add delays between requests
2. Reduce test frequency
3. Check rate limit headers in response

### Issue: Variables Not Working

**Solution:**
1. Select correct environment (top right)
2. Verify variable names match: `{{variableName}}`
3. Check variable scope (environment vs. global)

### Issue: Request Timeout

**Solution:**
1. Check server is running
2. Verify baseUrl is correct
3. Increase timeout: Settings → General → Request timeout

## Export & Share

### Export Collection

1. Right-click collection
2. **"Export"**
3. Select format: **Collection v2.1**
4. Save as: `WasteFi-Collection.json`

### Share with Team

**Method 1: Workspace**
- Create Postman workspace
- Invite team members
- Share collections/environments

**Method 2: Export File**
- Export collection + environment
- Share JSON files
- Team imports into Postman

**Method 3: Public Documentation**
- Collection → **"..."** → **"Publish Docs"**
- Configure documentation site
- Share public URL

## Newman (CLI Runner)

Run collections from command line:

### Install Newman

```bash
npm install -g newman
```

### Run Collection

```bash
# Export collection and environment first
newman run WasteFi-Collection.json \
  -e WasteFi-Environment.json \
  --reporters cli,html \
  --reporter-html-export results.html
```

### CI/CD Integration

```yaml
# GitHub Actions example
name: API Tests
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Newman
        run: |
          npm install -g newman
          newman run tests/WasteFi-Collection.json \
            -e tests/WasteFi-Environment.json \
            --reporters cli,junit \
            --reporter-junit-export results.xml
```

## Resources

- [Postman Learning Center](https://learning.postman.com/)
- [Newman Documentation](https://www.npmjs.com/package/newman)
- [WasteFi API Docs](http://localhost:3000/api/docs)

## Support

For API testing issues:
- Check Swagger documentation first
- Verify environment variables
- Test in Swagger UI
- Contact: support@wastefi.com
