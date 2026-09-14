import request from 'supertest';
import express, { Application } from 'express';
import authRoutes from '../../src/routes/auth.routes';
import { errorHandler } from '../../src/middleware/error.middleware';

// Mock Prisma client
jest.mock('../../src/services/database.service', () => ({
  __esModule: true,
  default: {
    prisma: {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      aPIKey: {
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    },
  },
}));

describe('Authentication API', () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/auth', authRoutes);
    app.use(errorHandler);
  });

  describe('POST /api/v1/auth/register', () => {
    it('should return 400 if phone number is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 if phone number is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          phoneNumber: 'invalid-phone',
          firstName: 'John',
          lastName: 'Doe',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 if first name is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          phoneNumber: '+254712345678',
          lastName: 'Doe',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 if last name is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          phoneNumber: '+254712345678',
          firstName: 'John',
        });

      expect(response.status).toBe(400);
    });

    it('should accept valid phone number formats', async () => {
      const validPhoneNumbers = [
        '+254712345678',
        '+1234567890',
        '+447911123456',
      ];

      for (const phoneNumber of validPhoneNumbers) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            phoneNumber,
            firstName: 'John',
            lastName: 'Doe',
          });

        // Will fail at controller level (mocked), but should pass validation
        expect(response.status).not.toBe(400);
      }
    });

    it('should reject invalid phone number formats', async () => {
      const invalidPhoneNumbers = [
        '1234',
        'abcd',
        '+',
        '++1234567890',
        'phone',
      ];

      for (const phoneNumber of invalidPhoneNumbers) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            phoneNumber,
            firstName: 'John',
            lastName: 'Doe',
          });

        expect(response.status).toBe(400);
      }
    });

    it('should accept optional email field', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          phoneNumber: '+254712345678',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
        });

      // Will fail at controller level (mocked), but validation should pass
      expect(response.status).not.toBe(400);
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          phoneNumber: '+254712345678',
          firstName: 'John',
          lastName: 'Doe',
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return 400 if phone number is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 400 if phone number is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          phoneNumber: 'invalid',
        });

      expect(response.status).toBe(400);
    });

    it('should accept valid phone number', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          phoneNumber: '+254712345678',
        });

      // Will fail at controller level (mocked), but validation should pass
      expect(response.status).not.toBe(400);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return 400 if refresh token is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should accept refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'some-token',
        });

      // Will fail at controller level (mocked), but validation should pass
      expect(response.status).not.toBe(400);
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    it('should return 401 if no token provided', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile');

      expect(response.status).toBe(401);
    });

    it('should return 401 if invalid token provided', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/api-keys', () => {
    it('should return 401 if no token provided', async () => {
      const response = await request(app)
        .post('/api/v1/auth/api-keys')
        .send({ name: 'Test Key' });

      expect(response.status).toBe(401);
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/api-keys')
        .set('Authorization', 'Bearer some-token')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/auth/api-keys', () => {
    it('should return 401 if no token provided', async () => {
      const response = await request(app)
        .get('/api/v1/auth/api-keys');

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/auth/api-keys/:keyId', () => {
    it('should return 401 if no token provided', async () => {
      const response = await request(app)
        .delete('/api/v1/auth/api-keys/some-key-id');

      expect(response.status).toBe(401);
    });
  });
});
