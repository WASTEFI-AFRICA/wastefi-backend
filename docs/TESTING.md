# Testing Guide

Complete guide for testing the WasteFi Backend application.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Coverage](#test-coverage)
- [Best Practices](#best-practices)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Overview

WasteFi Backend uses **Jest** as the testing framework with support for:

- ✅ Unit tests
- ✅ Integration tests
- ✅ API endpoint tests
- ✅ Code coverage reporting
- ✅ Mocking and stubbing
- ✅ Async/await support

### Test Stack

- **Jest** - Testing framework
- **ts-jest** - TypeScript support
- **Supertest** - HTTP endpoint testing
- **@types/jest** - TypeScript definitions

## Test Structure

```
tests/
├── setup.ts                    # Global test setup
├── unit/                       # Unit tests
│   ├── utils/
│   │   ├── encryption.test.ts
│   │   ├── geolocation.test.ts
│   │   └── material-pricing.test.ts
│   ├── services/
│   └── middleware/
├── integration/                # Integration tests
│   ├── auth.test.ts
│   ├── wallet.test.ts
│   └── collections.test.ts
└── e2e/                        # End-to-end tests (future)
```

## Running Tests

### All Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

### Unit Tests Only

```bash
npm run test:unit
```

### Integration Tests Only

```bash
npm run test:integration
```

### With Coverage

```bash
npm run test:coverage
```

### CI Mode

```bash
npm run test:ci
```

## Test Configuration

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### Test Environment (`.env.test`)

```env
NODE_ENV=test
DATABASE_URL=postgresql://postgres:password@localhost:5432/wastefi_test
JWT_SECRET=test-secret-key
REDIS_ENABLED=false
```

## Writing Tests

### Unit Test Example

```typescript
// tests/unit/utils/encryption.test.ts
import { encrypt, decrypt } from '../../../src/utils/encryption.util';

describe('Encryption Utility', () => {
  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt text correctly', () => {
      const plaintext = 'sensitive data';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    it('should produce different ciphertext for same input', () => {
      const plaintext = 'test data';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });
});
```

### Integration Test Example

```typescript
// tests/integration/auth.test.ts
import request from 'supertest';
import app from '../../src/server';

describe('Authentication API', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          phoneNumber: '+254712345678',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('tokens');
    });

    it('should return 400 for invalid phone number', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          phoneNumber: 'invalid',
          firstName: 'John',
          lastName: 'Doe',
        });

      expect(response.status).toBe(400);
    });
  });
});
```

### Service Test with Mocking

```typescript
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../../../src/services/auth.service';

jest.mock('@prisma/client');

describe('AuthService', () => {
  let prisma: jest.Mocked<PrismaClient>;
  let authService: AuthService;

  beforeEach(() => {
    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    authService = new AuthService(prisma);
  });

  describe('register', () => {
    it('should create a new user', async () => {
      const mockUser = {
        id: '123',
        phoneNumber: '+254712345678',
        firstName: 'John',
        lastName: 'Doe',
      };

      prisma.user.create = jest.fn().mockResolvedValue(mockUser);

      const result = await authService.register({
        phoneNumber: '+254712345678',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result).toEqual(mockUser);
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });
  });
});
```

### Testing Middleware

```typescript
import { authenticateJWT } from '../../../src/middleware/auth.middleware';
import { mockRequest, mockResponse, mockNext } from '../../setup';

describe('Auth Middleware', () => {
  describe('authenticateJWT', () => {
    it('should call next() for valid token', async () => {
      const req = mockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = mockResponse();
      const next = mockNext();

      await authenticateJWT(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 for missing token', async () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      await authenticateJWT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
```

### Testing Async Code

```typescript
describe('Async Operations', () => {
  it('should handle promises', async () => {
    const result = await fetchData();
    expect(result).toBeDefined();
  });

  it('should handle rejected promises', async () => {
    await expect(failingOperation()).rejects.toThrow('Error message');
  });

  it('should use done callback', (done) => {
    fetchData((error, result) => {
      if (error) {
        done(error);
      } else {
        expect(result).toBeDefined();
        done();
      }
    });
  });
});
```

## Test Coverage

### View Coverage Report

```bash
npm run test:coverage
```

This generates:
- Console summary
- HTML report in `coverage/` directory
- LCOV report for CI tools

### Open HTML Report

```bash
# Windows
start coverage/index.html

# macOS
open coverage/index.html

# Linux
xdg-open coverage/index.html
```

### Coverage Thresholds

Configured in `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    branches: 70,      // 70% branch coverage
    functions: 70,     // 70% function coverage
    lines: 70,         // 70% line coverage
    statements: 70,    // 70% statement coverage
  },
}
```

### Exclude from Coverage

```javascript
collectCoverageFrom: [
  'src/**/*.ts',
  '!src/**/*.d.ts',           // Type definitions
  '!src/server.ts',           // Entry point
  '!src/**/*.interface.ts',   // Interfaces
  '!src/**/*.type.ts',        // Type files
],
```

## Best Practices

### 1. Test Organization

- **Arrange-Act-Assert (AAA)** pattern
- One assertion per test when possible
- Descriptive test names
- Group related tests with `describe`

```typescript
describe('Feature', () => {
  describe('Behavior', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = doSomething(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### 2. Test Naming

```typescript
// ❌ Bad
it('test1', () => {});
it('should work', () => {});

// ✅ Good
it('should return user when valid ID is provided', () => {});
it('should throw error when user is not found', () => {});
it('should calculate distance between two coordinates', () => {});
```

### 3. Setup and Teardown

```typescript
describe('Service', () => {
  let service: MyService;
  let mockDB: any;

  beforeAll(() => {
    // Runs once before all tests
    mockDB = setupMockDatabase();
  });

  beforeEach(() => {
    // Runs before each test
    service = new MyService(mockDB);
  });

  afterEach(() => {
    // Runs after each test
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Runs once after all tests
    mockDB.disconnect();
  });

  it('test case', () => {
    // Test code
  });
});
```

### 4. Mocking

```typescript
// Mock entire module
jest.mock('../../../src/services/database.service');

// Mock specific function
const mockFunction = jest.fn().mockReturnValue('result');

// Mock resolved promise
const mockAsync = jest.fn().mockResolvedValue(data);

// Mock rejected promise
const mockError = jest.fn().mockRejectedValue(new Error('Failed'));

// Mock implementation
const mockFn = jest.fn((x) => x * 2);

// Spy on existing function
const spy = jest.spyOn(obj, 'method');
```

### 5. Assertions

```typescript
// Equality
expect(value).toBe(expected);
expect(value).toEqual(expected);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeGreaterThanOrEqual(3);
expect(value).toBeLessThan(5);
expect(value).toBeCloseTo(0.3, 2); // Floating point

// Strings
expect(str).toMatch(/pattern/);
expect(str).toContain('substring');

// Arrays
expect(array).toContain(item);
expect(array).toHaveLength(3);

// Objects
expect(obj).toHaveProperty('key');
expect(obj).toMatchObject({ key: 'value' });

// Exceptions
expect(() => func()).toThrow();
expect(() => func()).toThrow('error message');

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();
```

### 6. Test Independence

```typescript
// ❌ Bad - Tests depend on each other
let userId;

it('should create user', () => {
  userId = createUser();
});

it('should get user', () => {
  getUser(userId); // Depends on previous test
});

// ✅ Good - Tests are independent
it('should create user', () => {
  const userId = createUser();
  expect(userId).toBeDefined();
});

it('should get user', () => {
  const userId = createUser(); // Create own data
  const user = getUser(userId);
  expect(user).toBeDefined();
});
```

### 7. Avoid Testing Implementation Details

```typescript
// ❌ Bad - Testing implementation
it('should call internal method', () => {
  const spy = jest.spyOn(service, '_internalMethod');
  service.publicMethod();
  expect(spy).toHaveBeenCalled();
});

// ✅ Good - Testing behavior
it('should return correct result', () => {
  const result = service.publicMethod();
  expect(result).toBe(expected);
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:ci
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/wastefi_test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### GitLab CI Example

```yaml
test:
  image: node:18
  services:
    - postgres:14
  variables:
    POSTGRES_PASSWORD: postgres
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/wastefi_test
  script:
    - npm ci
    - npm run test:ci
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
```

## Troubleshooting

### Issue: Tests Timeout

**Solution:**
```typescript
// Increase timeout for specific test
it('slow test', async () => {
  // Test code
}, 15000); // 15 seconds

// Or globally in jest.config.js
testTimeout: 10000
```

### Issue: Database Connection Errors

**Solution:**
- Ensure test database exists
- Check DATABASE_URL in `.env.test`
- Run migrations: `npx prisma migrate deploy`

### Issue: Module Not Found

**Solution:**
```bash
# Clear Jest cache
npx jest --clearCache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Issue: Tests Pass Locally But Fail in CI

**Solution:**
- Check environment variables
- Ensure all dependencies are in `package.json`
- Use `npm ci` instead of `npm install`
- Check Node.js version consistency

### Issue: Flaky Tests

**Solution:**
- Remove time-dependent logic
- Clear mocks between tests
- Ensure tests are independent
- Use `jest.useFakeTimers()` for time-based code

## Test Helpers

### Mock Utilities

```typescript
// tests/setup.ts
export const mockRequest = (data: any = {}) => ({
  body: data.body || {},
  params: data.params || {},
  query: data.query || {},
  headers: data.headers || {},
  user: data.user || null,
});

export const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
```

### Test Data Factories

```typescript
// tests/factories/user.factory.ts
export const createTestUser = (overrides = {}) => ({
  id: 'test-id',
  phoneNumber: '+254712345678',
  firstName: 'John',
  lastName: 'Doe',
  role: 'USER',
  ...overrides,
});
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest GitHub](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)
- [Test-Driven Development](https://en.wikipedia.org/wiki/Test-driven_development)

## Support

For testing issues:
- Check Jest documentation
- Review test logs
- Run with `--verbose` flag
- Contact: support@wastefi.com
