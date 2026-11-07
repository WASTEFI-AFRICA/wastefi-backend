import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.REDIS_ENABLED = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

/* eslint-disable @typescript-eslint/no-var-requires */
const { app } = require('../../src/server');
const { prisma } = require('../../src/services/database.service');
const { JWTUtil } = require('../../src/utils/jwt.util');
const { UserService } = require('../../src/services/user.service');
/* eslint-enable @typescript-eslint/no-var-requires */

const run = Date.now().toString().slice(-8);
const phone = `+2348${run}1`;
const email = `profile-${run}@example.com`;
const otherEmail = `other-profile-${run}@example.com`;
const endpoint = '/api/v1/users/me';
let userId: string;
let otherId: string;
let token: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { firstName: 'Amina', lastName: 'Bello', phoneNumber: phone, status: 'ACTIVE' },
  });
  userId = user.id;
  const other = await prisma.user.create({
    data: {
      firstName: 'Other',
      lastName: 'Collector',
      phoneNumber: `+2348${run}2`,
      email: otherEmail,
      status: 'ACTIVE',
    },
  });
  otherId = other.id;
  token = JWTUtil.generateToken({ userId, phoneNumber: phone, role: 'COLLECTOR' });
});

beforeEach(async () => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: 'Amina',
      lastName: 'Bello',
      email,
      address: '10 Test Street',
      city: 'Lagos',
      role: 'COLLECTOR',
      status: 'ACTIVE',
      stellarPublicKey: null,
      password: null,
    },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
  await prisma.$disconnect();
});

const update = (data: Record<string, unknown>) =>
  request(app).put(endpoint).set('Authorization', `Bearer ${token}`).send(data);

describe('current user profile', () => {
  it('returns the current account without authentication secrets', async () => {
    const response = await request(app).get(endpoint).set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: userId,
      firstName: 'Amina',
      phoneNumber: phone,
    });
    expect(response.body.data).not.toHaveProperty('password');
    expect(response.body.data).not.toHaveProperty('stellarSecretKey');
  });

  it('requires authentication to read or update the profile', async () => {
    expect((await request(app).get(endpoint)).status).toBe(401);
    expect((await request(app).put(endpoint).send({ firstName: 'Changed' })).status).toBe(401);
  });

  it('saves only the current user and returns the saved details', async () => {
    const response = await update({ firstName: '  Ada  ', lastName: 'Okafor', city: '  Abuja  ' });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: userId,
      firstName: 'Ada',
      lastName: 'Okafor',
      city: 'Abuja',
    });
    expect(response.body.data).not.toHaveProperty('password');
    expect(response.body.data).not.toHaveProperty('stellarSecretKey');
    const stored = await prisma.user.findUnique({ where: { id: userId } });
    expect(stored).toMatchObject({ firstName: 'Ada', lastName: 'Okafor', city: 'Abuja', email });
    const other = await prisma.user.findUnique({ where: { id: otherId } });
    expect(other.firstName).toBe('Other');
  });

  it('clears optional details with null and preserves omitted details', async () => {
    expect((await update({ email: null, address: null, city: null })).status).toBe(200);
    const stored = await prisma.user.findUnique({ where: { id: userId } });
    expect(stored).toMatchObject({ email: null, address: null, city: null, firstName: 'Amina' });
  });

  it('reports a conflicting email without exposing database errors', async () => {
    const response = await update({ email: otherEmail });
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      error: 'This email address is already in use',
    });
    expect((await prisma.user.findUnique({ where: { id: userId } })).email).toBe(email);
  });

  it.each([
    { role: 'ADMIN' },
    { status: 'ACTIVE' },
    { kycStatus: 'APPROVED' },
    { id: 'another-account' },
    { phoneNumber: '+2348000000000' },
    { password: 'replacement-test-value' },
    { stellarPublicKey: 'replacement-test-address' },
    { stellarSecretKey: 'replacement-test-value' },
    { mobileMoneyNumber: '+2348000000000' },
    { nationalId: 'replacement-test-value' },
    { country: 'Other' },
    { profilePicture: 'https://example.com/picture.png' },
    { collections: { deleteMany: {} } },
    { apiKeys: { deleteMany: {} } },
    { firstName: { set: 'Changed' } },
    { firstName: ['Changed'] },
    { firstName: null },
    { firstName: '   ' },
    { lastName: '' },
    { email: 'not-an-email' },
    { city: { set: 'Changed' } },
    { firstName: 'x'.repeat(101) },
    { lastName: 'x'.repeat(101) },
    { address: 'x'.repeat(501) },
    { city: 'x'.repeat(121) },
  ])('rejects protected fields, nested writes and invalid details (%#)', async (payload) => {
    const before = await prisma.user.findUnique({ where: { id: userId } });
    const response = await update(payload);
    expect(response.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { id: userId } })).toEqual(before);
  });

  it('does not apply an allowed field when the same request includes a protected field', async () => {
    expect((await update({ firstName: 'Changed', role: 'ADMIN' })).status).toBe(400);
    const stored = await prisma.user.findUnique({ where: { id: userId } });
    expect(stored.firstName).toBe('Amina');
    expect(stored.role).toBe('COLLECTOR');
    const admin = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${token}`);
    expect(admin.status).toBe(403);
  });

  it('also protects account fields when the service is called without the route validator', async () => {
    await UserService.updateProfile(userId, {
      firstName: 'Changed',
      role: 'ADMIN',
      status: 'BANNED',
      stellarPublicKey: 'replacement-test-address',
      password: 'replacement-test-value',
    });
    const stored = await prisma.user.findUnique({ where: { id: userId } });
    expect(stored).toMatchObject({
      firstName: 'Changed',
      role: 'COLLECTOR',
      status: 'ACTIVE',
      stellarPublicKey: null,
      password: null,
    });
  });
});
