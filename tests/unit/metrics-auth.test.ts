import express from 'express';
import request from 'supertest';
import metricsRoutes from '../../src/routes/metrics.routes';

const OLD_ENV = process.env;

function buildApp() {
  const app = express();
  app.use('/metrics', metricsRoutes);
  return app;
}

describe('GET /metrics auth gate (issue #49)', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('returns 401 without a token in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.METRICS_TOKEN = 's3cret';
    const res = await request(buildApp()).get('/metrics');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a wrong token in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.METRICS_TOKEN = 's3cret';
    const res = await request(buildApp())
      .get('/metrics')
      .set('Authorization', 'Bearer nope');
    expect(res.status).toBe(401);
  });

  it('returns 401 in production when METRICS_TOKEN is not set', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.METRICS_TOKEN;
    const res = await request(buildApp())
      .get('/metrics')
      .set('Authorization', 'Bearer anything');
    expect(res.status).toBe(401);
  });

  it('returns 200 with the token in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.METRICS_TOKEN = 's3cret';
    const res = await request(buildApp())
      .get('/metrics')
      .set('Authorization', 'Bearer s3cret');
    expect(res.status).toBe(200);
  });

  it('covers /metrics/json with the same gate', async () => {
    process.env.NODE_ENV = 'production';
    process.env.METRICS_TOKEN = 's3cret';
    const denied = await request(buildApp()).get('/metrics/json');
    expect(denied.status).toBe(401);
    const allowed = await request(buildApp())
      .get('/metrics/json')
      .set('Authorization', 'Bearer s3cret');
    expect(allowed.status).toBe(200);
  });

  it('stays open without a token outside production', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.METRICS_TOKEN;
    const res = await request(buildApp()).get('/metrics');
    expect(res.status).toBe(200);
  });
});
