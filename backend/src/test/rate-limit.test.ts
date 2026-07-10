import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { rateLimit } from '../middleware/rate-limit';

function buildApp(perMin: number) {
  const app = express();
  app.post('/x', rateLimit(perMin), (_req, res) => { res.json({ ok: true }); });
  return app;
}

describe('rateLimit', () => {
  it('allows requests under the limit', async () => {
    const app = buildApp(5);
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/x');
      expect(res.status).toBe(200);
    }
  });

  it('returns 429 once the bucket is empty', async () => {
    const app = buildApp(2);
    await request(app).post('/x');
    await request(app).post('/x');
    const res = await request(app).post('/x');
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('rate limited');
  });
});
