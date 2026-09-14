# Swagger API Documentation Guide

Complete guide for using and maintaining the Swagger/OpenAPI documentation in WasteFi Backend.

## Table of Contents

- [Overview](#overview)
- [Accessing Documentation](#accessing-documentation)
- [Using Swagger UI](#using-swagger-ui)
- [Authentication in Swagger](#authentication-in-swagger)
- [Testing Endpoints](#testing-endpoints)
- [Exporting Specification](#exporting-specification)
- [Adding Documentation](#adding-documentation)
- [Best Practices](#best-practices)

## Overview

WasteFi Backend uses **Swagger/OpenAPI 3.0** for API documentation. This provides:

- ✅ Interactive API explorer
- ✅ Automatic request/response validation
- ✅ Schema definitions
- ✅ Try-it-out functionality
- ✅ Code generation support
- ✅ API client testing

## Accessing Documentation

### Development

Start the server:

```bash
npm run dev
```

Access Swagger UI:

```
http://localhost:3000/api/docs
```

### Production

```
https://api.wastefi.com/api/docs
```

## Using Swagger UI

### Interface Components

1. **Header**
   - API title and version
   - Server selector (dev/production)
   - Description

2. **Tags**
   - Endpoints grouped by functionality
   - Authentication, Users, Wallet, Collections, etc.

3. **Endpoints**
   - HTTP method and path
   - Description
   - Parameters
   - Request body schema
   - Response schemas
   - Try-it-out button

4. **Models**
   - Schema definitions
   - Data structures
   - Example values

### Exploring Endpoints

1. **Click on a tag** to expand endpoints
2. **Click on an endpoint** to see details
3. **View parameters** required for the request
4. **See example requests** and responses
5. **Check response codes** and meanings

## Authentication in Swagger

### Step 1: Obtain Access Token

1. Navigate to **Authentication** tag
2. Expand `POST /api/v1/auth/login`
3. Click **"Try it out"**
4. Enter phone number:
   ```json
   {
     "phoneNumber": "+254712345678"
   }
   ```
5. Click **"Execute"**
6. Copy the `accessToken` from the response

### Step 2: Authorize Swagger

1. Click the **"Authorize"** button (lock icon) at the top right
2. In the **bearerAuth** section:
   - Enter: `Bearer <your-access-token>`
   - Example: `Bearer eyJhbGciOiJIUzI1NiIs...`
3. Click **"Authorize"**
4. Click **"Close"**

### Step 3: Test Authenticated Endpoints

Now all requests will include your authentication token automatically.

**Note**: The lock icon next to endpoints indicates authentication is required.

## Testing Endpoints

### Example: Create Waste Collection

1. **Authenticate** (see above)

2. **Navigate to endpoint**:
   - Tag: Waste Collections
   - Endpoint: `POST /api/v1/collections`

3. **Click "Try it out"**

4. **Fill in request body**:

   ```json
   {
     "collectionPointId": "uuid-of-collection-point",
     "materialType": "PET Bottles",
     "materialCategory": "PLASTIC",
     "weight": 5.5,
     "quantity": 20,
     "imageUrls": ["https://example.com/image1.jpg"],
     "notes": "Clean PET bottles"
   }
   ```

5. **Click "Execute"**

6. **View response**:
   - Response code (201 Created)
   - Response body with collection details
   - Response headers

### Example: List Collections

1. Navigate to `GET /api/v1/collections/me`
2. Click "Try it out"
3. Set query parameters (optional):
   - page: 1
   - limit: 20
   - status: PENDING
4. Click "Execute"
5. View paginated results

## Exporting Specification

### JSON Format

Download the OpenAPI specification:

```bash
curl http://localhost:3000/api/docs.json -o openapi.json
```

Or visit in browser:

```
http://localhost:3000/api/docs.json
```

### Import to Tools

**Postman:**

1. Open Postman
2. Import → Link
3. Paste: `http://localhost:3000/api/docs.json`
4. Import

**Insomnia:**

1. Open Insomnia
2. Import/Export → Import Data
3. From URL: `http://localhost:3000/api/docs.json`

**VS Code REST Client:**

1. Install REST Client extension
2. Import OpenAPI file
3. Generate requests

## Adding Documentation

### Basic Swagger Annotation

```typescript
/**
 * @swagger
 * /api/v1/endpoint:
 *   post:
 *     tags: [Tag Name]
 *     summary: Short description
 *     description: Detailed description
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - field1
 *             properties:
 *               field1:
 *                 type: string
 *                 description: Field description
 *                 example: "Example value"
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/endpoint', handler);
```

### Authenticated Endpoint

Add security requirement:

```typescript
/**
 * @swagger
 * /api/v1/protected-endpoint:
 *   get:
 *     tags: [Tag Name]
 *     summary: Protected endpoint
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
```

### Query Parameters

```typescript
/**
 * @swagger
 * /api/v1/items:
 *   get:
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 */
```

### Path Parameters

```typescript
/**
 * @swagger
 * /api/v1/items/{itemId}:
 *   get:
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Item ID
 */
```

### Reusing Schemas

Reference shared schemas:

```typescript
/**
 * @swagger
 * /api/v1/users/{userId}:
 *   get:
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
```

## Best Practices

### 1. Complete Documentation

Document all endpoints with:

- ✅ Summary and description
- ✅ All parameters
- ✅ Request body schema
- ✅ All response codes
- ✅ Examples

### 2. Use Tags

Organize endpoints with meaningful tags:

```typescript
tags: [Authentication];
tags: [Users];
tags: [Payments];
```

### 3. Provide Examples

Include realistic examples:

```typescript
example: '+254712345678';
example: 'john.doe@example.com';
example: 5.5;
```

### 4. Reference Common Responses

Reuse error responses:

```typescript
401:
  $ref: '#/components/responses/UnauthorizedError'
404:
  $ref: '#/components/responses/NotFoundError'
```

### 5. Document Security

Clearly indicate protected endpoints:

```typescript
security:
  - bearerAuth: []
```

### 6. Version API

Include version in path:

```typescript
/api/1v / endpoint;
```

### 7. Use HTTP Status Codes Correctly

- 200: Success (GET, PUT)
- 201: Created (POST)
- 204: No Content (DELETE)
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Server Error

### 8. Schema Validation

Define strict schemas:

```typescript
type: object;
required: -field1 - field2;
properties: field1: type: string;
minLength: 1;
maxLength: 255;
```

### 9. Pagination Documentation

Document pagination parameters:

```typescript
parameters:
  - in: query
    name: page
    schema:
      type: integer
      minimum: 1
      default: 1
  - in: query
    name: limit
    schema:
      type: integer
      minimum: 1
      maximum: 100
      default: 20
```

### 10. Keep Documentation Updated

When modifying endpoints:

1. Update Swagger annotations
2. Update examples
3. Update response schemas
4. Test in Swagger UI

## Testing Documentation

### 1. Start Server

```bash
npm run dev
```

### 2. Open Swagger UI

```
http://localhost:3000/api/docs
```

### 3. Verify All Endpoints

- Check all tags are present
- Verify endpoint descriptions
- Test example requests
- Confirm authentication works

### 4. Validate Specification

```bash
# Install validator
npm install -g @apidevtools/swagger-cli

# Validate
swagger-cli validate http://localhost:3000/api/docs.json
```

## Common Issues

### Issue: Endpoints Not Appearing

**Cause**: Route file not included in swagger config

**Fix**: Add to `src/config/swagger.ts`:

```typescript
apis: [
  './src/routes/*.ts',
  './src/routes/**/*.ts',  // Add subdirectories
],
```

### Issue: Schema Not Found

**Cause**: Schema not defined in components

**Fix**: Add schema to `src/config/swagger.ts`:

```typescript
components: {
  schemas: {
    YourSchema: {
      type: 'object',
      properties: { ... }
    }
  }
}
```

### Issue: Authentication Not Working

**Cause**: Missing security scheme

**Fix**: Verify security scheme in config:

```typescript
securitySchemes: {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  }
}
```

## Advanced Features

### Code Generation

Generate client SDKs from OpenAPI spec:

```bash
# TypeScript/JavaScript
npm install @openapitools/openapi-generator-cli
openapi-generator-cli generate -i http://localhost:3000/api/docs.json -g typescript-axios -o ./client

# Python
openapi-generator-cli generate -i http://localhost:3000/api/docs.json -g python -o ./client
```

### Mock Server

Create mock server from specification:

```bash
npm install -g @stoplight/prism-cli
prism mock http://localhost:3000/api/docs.json
```

### Automated Testing

Use specification for automated tests:

```bash
npm install schemathesis
schemathesis run http://localhost:3000/api/docs.json
```

## Resources

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger Editor](https://editor.swagger.io/)
- [API Documentation Best Practices](https://swagger.io/blog/api-documentation/)

## Support

For questions or issues with API documentation:

- Check existing documentation files
- Review Swagger configuration
- Test in Swagger UI
- Contact: support@wastefi.com
