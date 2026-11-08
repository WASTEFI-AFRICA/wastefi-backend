import request from 'supertest';
import { randomUUID } from 'crypto';

process.env.NODE_ENV = 'test';
process.env.REDIS_ENABLED = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-operator-secret';
process.env.SOROBAN_ADMIN_SECRET = '';
process.env.SEED_DEMO_DATA = 'false';
/* eslint-disable @typescript-eslint/no-var-requires */
const { app } = require('../../src/server');
const { prisma } = require('../../src/services/database.service');
const { JWTUtil } = require('../../src/utils/jwt.util');
/* eslint-enable @typescript-eslint/no-var-requires */

const run = Date.now().toString().slice(-7);
const actors: Record<string, { id: string; phoneNumber: string; role: string }> = {};
const tokens: Record<string, string> = {};
const points: string[] = [];
const rows: string[] = [];
const API = '/api/v1';
const auth = (actor = 'operator') => ({ Authorization: `Bearer ${tokens[actor]}` });
const list = (actor = 'operator', query = '') =>
  request(app).get(`${API}/collections?verified=false&${query}`).set(auth(actor));
const assign = (pointId: string | null, actor = 'admin', userId?: string) =>
  request(app)
    .put(`${API}/users/${userId || actors.operator.id}/collection-point`)
    .set(auth(actor))
    .send({ collectionPointId: pointId });
const review = (id: string, actor = 'operator', approved = false) =>
  request(app).post(`${API}/collections/${id}/verify`).set(auth(actor)).send({ approved });

beforeAll(async () => {
  for (let index = 0; index < 3; index++) {
    const point = await prisma.collectionPoint.create({
      data: {
        name: `Scope ${run} ${index}`,
        latitude: 6.5,
        longitude: 3.4,
        address: 'Test street',
        city: 'Lagos',
        contactPerson: 'Tester',
        contactPhone: `+2345${run}${index}`,
        isActive: index < 2,
      },
    });
    points.push(point.id);
  }
  const roles = {
    admin: 'ADMIN',
    operator: 'COLLECTION_POINT',
    otherOperator: 'COLLECTION_POINT',
    unassigned: 'COLLECTION_POINT',
    verifier: 'VERIFIER',
    collector: 'COLLECTOR',
    otherCollector: 'COLLECTOR',
  };
  for (const [index, [name, role]] of Object.entries(roles).entries()) {
    const user = await prisma.user.create({
      data: {
        firstName: 'Scope',
        lastName: name,
        phoneNumber: `+2346${run}${index}`,
        role,
        status: 'ACTIVE',
        ...(name === 'operator'
          ? { collectionPointId: points[0] }
          : name === 'otherOperator'
            ? { collectionPointId: points[1] }
            : {}),
      },
    });
    actors[name] = user;
    tokens[name] = JWTUtil.generateToken({ userId: user.id, phoneNumber: user.phoneNumber, role });
  }
  for (const [index, weight] of [2, 3, 5, 7, 11, 13].entries()) {
    const row = await prisma.wasteCollection.create({
      data: {
        collectorId: index === 1 ? actors.otherCollector.id : actors.collector.id,
        collectionPointId: points[index < 3 ? 0 : index < 5 ? 1 : 2],
        materialType: 'PET',
        materialCategory: 'Plastic',
        weight,
        imageUrls: '[]',
        paymentAmount: weight * 10,
      },
    });
    rows.push(row.id);
  }
});

beforeEach(async () => {
  await prisma.user.update({
    where: { id: actors.operator.id },
    data: { role: 'COLLECTION_POINT', status: 'ACTIVE', collectionPointId: points[0] },
  });
  await prisma.collectionPoint.update({ where: { id: points[0] }, data: { isActive: true } });
  await prisma.wasteCollection.updateMany({
    where: { id: { in: rows } },
    data: { verifiedAt: null, verifiedBy: null, paymentStatus: 'PENDING', imageUrls: '[]' },
  });
});

afterAll(async () => {
  await prisma.wasteCollection.deleteMany({ where: { id: { in: rows } } });
  await prisma.user.deleteMany({
    where: { id: { in: Object.values(actors).map((user) => user.id) } },
  });
  await prisma.collectionPoint.deleteMany({ where: { id: { in: points } } });
  await prisma.$disconnect();
});

describe('operator collection point boundary', () => {
  it('returns only its assigned queue and explicit server scope', async () => {
    const response = await list();
    expect(response.status).toBe(200);
    expect(response.body.pagination.total).toBe(3);
    expect(response.body.data.map((row: { id: string }) => row.id).sort()).toEqual(
      rows.slice(0, 3).sort()
    );
    expect(response.body.scope).toMatchObject({ mode: 'assigned_point', point: { id: points[0] } });
    expect(
      response.body.data.every(
        (row: { collectionPointId: string }) => row.collectionPointId === points[0]
      )
    ).toBe(true);
  });

  it('scopes totals and material statistics, including optional collector filters', async () => {
    const stats = await request(app).get(`${API}/collections/statistics`).set(auth());
    expect(stats.status).toBe(200);
    expect(stats.body.data).toMatchObject({ totalCollections: 3, totalWeight: 10 });
    expect(stats.body.scope.point.id).toBe(points[0]);
    const material = await request(app).get(`${API}/collections/statistics/materials`).set(auth());
    expect(material.status).toBe(200);
    expect(material.body.data.summary).toMatchObject({ totalCollections: 3, totalWeight: 10 });
    const filtered = await request(app)
      .get(`${API}/collections/statistics?userId=${actors.otherCollector.id}`)
      .set(auth());
    expect(filtered.body.data).toMatchObject({ totalCollections: 1, totalWeight: 3 });
  });

  it.each(['/collections', '/collections/statistics', '/collections/statistics/materials'])(
    'rejects another point filter on %s',
    async (path) => {
      expect(
        (await request(app).get(`${API}${path}?collectionPointId=${points[1]}`).set(auth())).status
      ).toBe(403);
    }
  );

  it('allows an explicit own point filter and pagination without widening the result', async () => {
    const response = await list('operator', `collectionPointId=${points[0]}&limit=1&page=2`);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination.total).toBe(3);
    expect(response.body.data[0].collectionPointId).toBe(points[0]);
  });

  it('blocks foreign detail, approval, rejection and image writes without modifying the record', async () => {
    expect((await request(app).get(`${API}/collections/${rows[3]}`).set(auth())).status).toBe(404);
    expect((await review(rows[3], 'operator', true)).status).toBe(404);
    expect((await review(rows[3])).status).toBe(404);
    expect(
      (
        await request(app)
          .post(`${API}/collections/${rows[3]}/images`)
          .set(auth())
          .send({ imageUrls: ['https://example.com/test.jpg'] })
      ).status
    ).toBe(404);
    const stored = await prisma.wasteCollection.findUnique({ where: { id: rows[3] } });
    expect(stored).toMatchObject({ verifiedAt: null, verifiedBy: null, imageUrls: '[]' });
  });

  it('allows own detail and review, preserving central administrator/verifier access', async () => {
    expect((await request(app).get(`${API}/collections/${rows[0]}`).set(auth())).status).toBe(200);
    expect((await review(rows[0])).status).toBe(200);
    expect((await review(rows[3], 'admin')).status).toBe(200);
    expect((await review(rows[4], 'verifier')).status).toBe(200);
    const central = await list('admin');
    expect(central.status).toBe(200);
    expect(central.body.scope.mode).toBe('platform');
    expect((await list('verifier')).status).toBe(200);
  });

  it.each(['unassigned', 'inactive'])('fails closed for an %s operator', async (state) => {
    if (state === 'inactive')
      await prisma.collectionPoint.update({ where: { id: points[0] }, data: { isActive: false } });
    const actor = state === 'unassigned' ? 'unassigned' : 'operator';
    for (const path of [
      '/collections',
      '/collections/statistics',
      '/collections/statistics/materials',
      `/collections/${rows[0]}`,
    ]) {
      const response = await request(app)
        .get(API + path)
        .set(auth(actor));
      expect(response.status).toBe(403);
      expect(response.body.code).toBe(
        state === 'unassigned' ? 'COLLECTION_POINT_REQUIRED' : 'COLLECTION_POINT_INACTIVE'
      );
    }
    expect((await review(rows[0], actor)).status).toBe(403);
  });

  it('uses current database role even when the access token still claims ADMIN', async () => {
    const stale = JWTUtil.generateToken({
      userId: actors.operator.id,
      phoneNumber: actors.operator.phoneNumber,
      role: 'ADMIN',
    });
    const response = await request(app)
      .get(`${API}/collections`)
      .set('Authorization', `Bearer ${stale}`);
    expect(response.status).toBe(200);
    expect(response.body.pagination.total).toBe(3);
    expect(
      (
        await request(app)
          .put(`${API}/users/${actors.operator.id}/collection-point`)
          .set('Authorization', `Bearer ${stale}`)
          .send({ collectionPointId: points[1] })
      ).status
    ).toBe(403);
  });

  it('permits only one concurrent decision and does not overwrite the first decision', async () => {
    const responses = await Promise.all([
      review(rows[0], 'operator', true),
      review(rows[0], 'operator', false),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const first = await prisma.wasteCollection.findUnique({ where: { id: rows[0] } });
    expect((await review(rows[0])).status).toBe(409);
    const after = await prisma.wasteCollection.findUnique({ where: { id: rows[0] } });
    expect(after.verifiedAt).toEqual(first.verifiedAt);
    expect(after.paymentStatus).toBe(first.paymentStatus);
  });

  it('checks assignment again at the write if it changes after the initial read', async () => {
    const original = prisma.wasteCollection.findFirst.bind(prisma.wasteCollection);
    const spy = jest
      .spyOn(prisma.wasteCollection, 'findFirst')
      .mockImplementationOnce(async (...args: unknown[]) => {
        const result = await original(...args);
        await prisma.user.update({
          where: { id: actors.operator.id },
          data: { collectionPointId: points[1] },
        });
        return result;
      });
    try {
      expect((await review(rows[0])).status).toBe(409);
    } finally {
      spy.mockRestore();
    }
    expect(
      (await prisma.wasteCollection.findUnique({ where: { id: rows[0] } })).verifiedAt
    ).toBeNull();
  });

  it('keeps collector detail and image access restricted to their own records', async () => {
    expect(
      (await request(app).get(`${API}/collections/${rows[1]}`).set(auth('collector'))).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`${API}/collections/${rows[1]}/images`)
          .set(auth('collector'))
          .send({ imageUrls: ['https://example.com/test.jpg'] })
      ).status
    ).toBe(403);
  });
});

describe('administrator assignment', () => {
  it('assigns, reassigns and removes access immediately with the same operator token', async () => {
    const changed = await assign(points[1]);
    expect(changed.status).toBe(200);
    expect(changed.body.data).toMatchObject({
      id: actors.operator.id,
      collectionPoint: { id: points[1] },
    });
    expect(changed.body.data).not.toHaveProperty('password');
    expect(changed.body.data).not.toHaveProperty('stellarSecretKey');
    expect((await list()).body.pagination.total).toBe(2);
    expect((await review(rows[0])).status).toBe(404);
    expect((await assign(null)).status).toBe(200);
    expect((await list()).body.code).toBe('COLLECTION_POINT_REQUIRED');
    const stored = await prisma.user.findUnique({ where: { id: actors.operator.id } });
    expect(stored).toMatchObject({
      role: 'COLLECTION_POINT',
      status: 'ACTIVE',
      collectionPointId: null,
    });
    const logs = await prisma.systemLog.findMany({
      where: {
        service: 'user-management',
        message: 'Operator collection point assignment changed',
      },
    });
    expect(
      logs.some(
        (log: { metadata: string }) => JSON.parse(log.metadata).userId === actors.operator.id
      )
    ).toBe(true);
  });

  it('requires admin access and does not accept a collector or verifier as an operator', async () => {
    for (const actor of ['operator', 'otherOperator', 'collector', 'verifier'])
      expect((await assign(points[1], actor)).status).toBe(403);
    expect(
      (
        await request(app)
          .put(`${API}/users/${actors.operator.id}/collection-point`)
          .send({ collectionPointId: points[1] })
      ).status
    ).toBe(401);
    expect((await assign(points[1], 'admin', actors.collector.id)).status).toBe(409);
    expect((await assign(points[1], 'admin', actors.verifier.id)).status).toBe(409);
  });

  it('rejects inactive/unknown points, unknown users, invalid and extra fields', async () => {
    expect((await assign(points[2])).status).toBe(409);
    expect((await assign(randomUUID())).status).toBe(404);
    expect((await assign(points[0], 'admin', randomUUID())).status).toBe(404);
    for (const body of [
      {},
      { collectionPointId: [] },
      { collectionPointId: '' },
      { collectionPointId: points[1], role: 'ADMIN' },
      { collectionPointId: null, status: 'BANNED' },
    ]) {
      expect(
        (
          await request(app)
            .put(`${API}/users/${actors.operator.id}/collection-point`)
            .set(auth('admin'))
            .send(body)
        ).status
      ).toBe(400);
    }
    expect(
      (await prisma.user.findUnique({ where: { id: actors.operator.id } })).collectionPointId
    ).toBe(points[0]);
  });

  it('returns assignment metadata to the admin directory and current account, without a self-assignment route', async () => {
    const response = await request(app)
      .get(`${API}/users?role=COLLECTION_POINT&limit=100`)
      .set(auth('admin'));
    const operator = response.body.data.find(
      (user: { id: string }) => user.id === actors.operator.id
    );
    expect(operator.collectionPoint).toMatchObject({ id: points[0], isActive: true });
    expect(
      (await request(app).get(`${API}/users/me`).set(auth())).body.data.collectionPoint.id
    ).toBe(points[0]);
    expect(
      (await request(app).put(`${API}/users/me`).set(auth()).send({ collectionPointId: points[1] }))
        .status
    ).toBe(400);
  });
});
