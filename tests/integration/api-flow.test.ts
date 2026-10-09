/**
 * End-to-end API tests.
 *
 * These drive the real Express app against a real PostgreSQL database; nothing is
 * mocked. They need DATABASE_URL to point at a database that has had
 * `prisma migrate deploy` applied, which is how CI runs them. They create their
 * own users, collection point and collections under a unique phone prefix and
 * delete them afterwards.
 *
 * The older tests/integration/auth.test.ts mocks Prisma, so it could not notice a
 * database that was missing the users.password column or a login that skipped
 * the password check. These can.
 */

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { EncryptionUtil } from '../../src/utils/encryption.util';
import { MaterialPricingUtil } from '../../src/utils/material-pricing.util';

process.env.NODE_ENV = 'test';
process.env.REDIS_ENABLED = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// Imported after the environment is set, because the app reads it at import time.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require('../../src/server');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('../../src/services/database.service');

const API = '/api/v1';
const PASSWORD = 'Str0ng!Passw0rd#1';

// Unique per run so parallel or repeated runs never collide on phone numbers.
const RUN = Date.now().toString().slice(-7);
const phone = (n: number) => `+2547${RUN}${n}`;

const ADMIN_PHONE = phone(0);
const COLLECTOR_PHONE = phone(1);
const OTHER_COLLECTOR_PHONE = phone(2);

let collectionPointId: string;
let adminToken: string;
let collectorToken: string;
let otherCollectorToken: string;
let collectorId: string;
let collectionId: string;

const login = (phoneNumber: string, password?: string) =>
  request(app)
    .post(`${API}/auth/login`)
    .send(password === undefined ? { phoneNumber } : { phoneNumber, password });

const register = (phoneNumber: string, password: string = PASSWORD) =>
  request(app).post(`${API}/auth/register`).send({
    phoneNumber,
    firstName: 'Test',
    lastName: 'User',
    password,
  });

async function activate(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
}

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      phoneNumber: ADMIN_PHONE,
      firstName: 'Admin',
      lastName: 'Test',
      password: await EncryptionUtil.hashPassword(PASSWORD),
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  void admin;

  const point = await prisma.collectionPoint.create({
    data: {
      name: `Test Point ${RUN}`,
      latitude: -1.2864,
      longitude: 36.8172,
      address: 'Test Street',
      city: 'Nairobi',
      country: 'Kenya',
      contactPerson: 'Tester',
      contactPhone: phone(9),
    },
  });
  collectionPointId = point.id;

  adminToken = (await login(ADMIN_PHONE, PASSWORD)).body.data.accessToken;
});

afterAll(async () => {
  const phones = [ADMIN_PHONE, COLLECTOR_PHONE, OTHER_COLLECTOR_PHONE];
  const users = await prisma.user.findMany({
    where: { phoneNumber: { in: phones } },
    select: { id: true },
  });
  const ids = users.map((u: { id: string }) => u.id);
  await prisma.wasteCollection.deleteMany({ where: { collectorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.collectionPoint.deleteMany({ where: { id: collectionPointId } });
  await prisma.$disconnect();
});

describe('registration', () => {
  it('creates an account and returns tokens', async () => {
    const res = await register(COLLECTOR_PHONE);

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.phoneNumber).toBe(COLLECTOR_PHONE);
    // The password hash must never be echoed back.
    expect(JSON.stringify(res.body)).not.toContain('password');
    collectorId = res.body.data.user.id;
  });

  // Regression: the whole request body used to reach the service, so a client could
  // register as ADMIN by adding "role" to the request.
  it('ignores a role supplied by the client', async () => {
    const res = await request(app)
      .post(`${API}/auth/register`)
      .send({
        phoneNumber: phone(5),
        firstName: 'Sneaky',
        lastName: 'User',
        password: PASSWORD,
        role: 'ADMIN',
      });

    expect(res.status).toBe(201);
    const stored = await prisma.user.findUnique({ where: { phoneNumber: phone(5) } });
    expect(stored.role).toBe('COLLECTOR');
    await prisma.user.delete({ where: { phoneNumber: phone(5) } });
  });

  it('stores a hash, never the password itself', async () => {
    const stored = await prisma.user.findUnique({ where: { phoneNumber: COLLECTOR_PHONE } });
    expect(stored.password).toBeTruthy();
    expect(stored.password).not.toBe(PASSWORD);
    expect(await EncryptionUtil.comparePassword(PASSWORD, stored.password)).toBe(true);
  });

  it('starts the account as PENDING', async () => {
    const stored = await prisma.user.findUnique({ where: { phoneNumber: COLLECTOR_PHONE } });
    expect(stored.status).toBe('PENDING');
  });

  it('rejects a phone number that is already registered', async () => {
    const res = await register(COLLECTOR_PHONE);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('rejects a weak password', async () => {
    const res = await register(phone(7), 'weak');
    expect(res.status).toBe(400);
  });

  it('rejects an invalid phone number', async () => {
    const res = await register('not-a-phone');
    expect(res.status).toBe(400);
  });
});

describe('login', () => {
  it('refuses an account that has not been activated', async () => {
    const res = await login(COLLECTOR_PHONE, PASSWORD);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/not active/i);
  });

  it('logs in an active account with the right password', async () => {
    await activate(collectorId);
    const res = await login(COLLECTOR_PHONE, PASSWORD);

    expect(res.status).toBe(200);
    collectorToken = res.body.data.accessToken;
    expect(collectorToken).toEqual(expect.any(String));
  });

  it('rejects a wrong password', async () => {
    const res = await login(COLLECTOR_PHONE, 'Wr0ng!Passw0rd#1');
    expect(res.status).toBe(401);
  });

  it('gives the same answer for an unknown phone and a wrong password', async () => {
    const unknown = await login(phone(8), PASSWORD);
    const wrong = await login(COLLECTOR_PHONE, 'Wr0ng!Passw0rd#1');

    expect(unknown.status).toBe(wrong.status);
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  // Regression: login used to succeed for any active account when no password was
  // sent, which meant anyone knowing the admin's phone number could become admin.
  it('does not log anyone in without a password', async () => {
    const res = await login(ADMIN_PHONE);

    expect(res.status).toBe(400);
    expect(res.body.data?.accessToken).toBeUndefined();
  });

  it('does not accept an OTP in place of a password', async () => {
    const res = await request(app)
      .post(`${API}/auth/login`)
      .send({ phoneNumber: ADMIN_PHONE, otp: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.data?.accessToken).toBeUndefined();
  });

  it('does not log in a passwordless account even with a password supplied', async () => {
    const created = await prisma.user.create({
      data: {
        phoneNumber: phone(6),
        firstName: 'No',
        lastName: 'Password',
        status: 'ACTIVE',
      },
    });
    try {
      const res = await login(phone(6), PASSWORD);
      expect(res.status).toBe(401);
    } finally {
      await prisma.user.delete({ where: { id: created.id } });
    }
  });
});

describe('authentication', () => {
  it('returns the profile for a valid token', async () => {
    const res = await request(app)
      .get(`${API}/auth/profile`)
      .set('Authorization', `Bearer ${collectorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.phoneNumber).toBe(COLLECTOR_PHONE);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get(`${API}/auth/profile`);
    expect(res.status).toBe(401);
  });

  it('rejects a malformed token', async () => {
    const res = await request(app)
      .get(`${API}/auth/profile`)
      .set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = jwt.sign(
      { userId: collectorId, phoneNumber: COLLECTOR_PHONE, role: 'ADMIN' },
      'some-other-secret',
      { issuer: 'wastefi' }
    );
    const res = await request(app)
      .get(`${API}/auth/profile`)
      .set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  // Regression: both token kinds share one secret, so a 30-day refresh token used
  // to work as a bearer token and an access token used to work as a refresh token.
  describe('token types', () => {
    let access: string;
    let refresh: string;

    beforeAll(async () => {
      const res = await login(COLLECTOR_PHONE, PASSWORD);
      access = res.body.data.accessToken;
      refresh = res.body.data.refreshToken;
    });

    it('issues a new token pair for a valid refresh token', async () => {
      const res = await request(app).post(`${API}/auth/refresh`).send({ refreshToken: refresh });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
    });

    it('rejects an access token presented as a refresh token', async () => {
      const res = await request(app).post(`${API}/auth/refresh`).send({ refreshToken: access });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.data?.accessToken).toBeUndefined();
    });

    it('rejects a refresh token presented as a bearer token', async () => {
      const res = await request(app)
        .get(`${API}/auth/profile`)
        .set('Authorization', `Bearer ${refresh}`);
      expect(res.status).toBe(401);
    });

    it('rejects a token with no type claim', async () => {
      const untyped = jwt.sign(
        { userId: collectorId, phoneNumber: COLLECTOR_PHONE, role: 'COLLECTOR' },
        process.env.JWT_SECRET as string,
        { issuer: 'wastefi' }
      );
      const res = await request(app)
        .get(`${API}/auth/profile`)
        .set('Authorization', `Bearer ${untyped}`);
      expect(res.status).toBe(401);
    });
  });

  it('does not let a collector use admin endpoints', async () => {
    const res = await request(app)
      .put(`${API}/users/${collectorId}/status`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .send({ status: 'BANNED' });
    expect(res.status).toBe(403);
  });

  it('lets an admin activate a pending account', async () => {
    const created = await register(OTHER_COLLECTOR_PHONE);
    const userId = created.body.data.user.id;

    const res = await request(app)
      .put(`${API}/users/${userId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(200);
    const next = await login(OTHER_COLLECTOR_PHONE, PASSWORD);
    expect(next.status).toBe(200);
    otherCollectorToken = next.body.data.accessToken;
  });
});

describe('waste collections', () => {
  const body = () => ({
    collectionPointId,
    materialType: 'PET',
    materialCategory: 'PLASTIC',
    weight: 12.5,
  });

  it('records a collection and calculates the payment from the price list', async () => {
    const res = await request(app)
      .post(`${API}/collections`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .send(body());

    expect(res.status).toBe(201);
    expect(res.body.data.collectorId).toBe(collectorId);
    expect(res.body.data.paymentStatus).toBe('PENDING');
    expect(res.body.data.paymentAmount).toBe(MaterialPricingUtil.calculatePayment('PET', 12.5));
    expect(res.body.data.verifiedAt).toBeNull();
    collectionId = res.body.data.id;
  });

  it('requires authentication', async () => {
    const res = await request(app).post(`${API}/collections`).send(body());
    expect(res.status).toBe(401);
  });

  it('rejects a weight below the minimum', async () => {
    const res = await request(app)
      .post(`${API}/collections`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .send({ ...body(), weight: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects a missing collection point', async () => {
    const rest: Record<string, unknown> = body();
    delete rest.collectionPointId;
    const res = await request(app)
      .post(`${API}/collections`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .send(rest);
    expect(res.status).toBe(400);
  });

  it("lists the collector's own collections", async () => {
    const res = await request(app)
      .get(`${API}/collections/me`)
      .set('Authorization', `Bearer ${collectorToken}`);

    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).toContain(collectionId);
  });

  it("does not show one collector another's collections in their list", async () => {
    const res = await request(app)
      .get(`${API}/collections/me`)
      .set('Authorization', `Bearer ${otherCollectorToken}`);

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(collectionId);
  });

  it('lets the owner read their collection', async () => {
    const res = await request(app)
      .get(`${API}/collections/${collectionId}`)
      .set('Authorization', `Bearer ${collectorToken}`);
    expect(res.status).toBe(200);
  });

  // Regression: any logged-in user could read any collection by id.
  it("does not let another collector read someone else's collection", async () => {
    const res = await request(app)
      .get(`${API}/collections/${collectionId}`)
      .set('Authorization', `Bearer ${otherCollectorToken}`);
    expect(res.status).toBe(403);
  });

  it('lets an admin read any collection', async () => {
    const res = await request(app)
      .get(`${API}/collections/${collectionId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('does not let a collector verify their own collection', async () => {
    const res = await request(app)
      .post(`${API}/collections/${collectionId}/verify`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .send({ approved: true });
    expect(res.status).toBe(403);
  });

  it('lets an admin verify a collection and records who did', async () => {
    const res = await request(app)
      .post(`${API}/collections/${collectionId}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approved: true });

    expect(res.status).toBe(200);
    expect(res.body.data.verifiedAt).toEqual(expect.any(String));
    expect(res.body.data.verifiedBy).toEqual(expect.any(String));
  });
});

describe('payment calculation', () => {
  it('pays the listed price per kilogram', () => {
    expect(MaterialPricingUtil.calculatePayment('PET', 10)).toBe(250);
  });

  it('is case-insensitive about the material', () => {
    expect(MaterialPricingUtil.calculatePayment('pet', 10)).toBe(
      MaterialPricingUtil.calculatePayment('PET', 10)
    );
  });

  it('rounds to two decimal places', () => {
    const amount = MaterialPricingUtil.calculatePayment('PET', 0.333);
    expect(Math.round(amount * 100) / 100).toBe(amount);
  });
});

describe('production configuration', () => {
  const load = () => {
    let config: any;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      config = require('../../src/config').config;
    });
    return config;
  };

  const saved = { env: process.env.NODE_ENV, secret: process.env.JWT_SECRET };
  afterEach(() => {
    process.env.NODE_ENV = saved.env;
    process.env.JWT_SECRET = saved.secret;
  });

  it('refuses to start in production without a JWT secret', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    expect(load).toThrow(/JWT_SECRET/);
  });

  it('refuses to start in production with the built-in default secret', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'default-secret-change-me';
    expect(load).toThrow(/JWT_SECRET/);
  });

  it('starts in production with a real secret', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a-real-secret-that-is-long-enough-123456';
    expect(load().jwt.secret).toBe('a-real-secret-that-is-long-enough-123456');
  });
});
