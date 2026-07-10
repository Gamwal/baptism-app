import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { createRequire } from 'module';
import bcrypt from 'bcryptjs';

// NOTE on mocking approach: the whole backend is CommonJS (`require` /
// `module.exports`). Loading it via `await import(...)` from an ESM test
// file puts it through Vite's SSR module graph, which keeps its own module
// cache *separate* from Node's native `require.cache`. That produces two
// independent instances of db/index.js — one we can mutate, and a totally
// different one the real routes actually use — so neither `vi.mock` nor
// mutating an `import()`-loaded `pool` object affects what the app sees
// (verified empirically: both were tried and both left the real routes
// hitting an unmocked pool).
//
// Fix: use Node's own `createRequire` so every module here loads through
// the *same* native `require.cache` that server.js's internal `require()`
// calls use. That guarantees `require('../src/db/index.js')` here and
// `require('../db')` inside auth.js resolve to the exact same object, so
// mutating `pool.query` on it is visible everywhere.
const require = createRequire(import.meta.url);

process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
process.env.JWT_SECRET ||= 'test-only-secret';
process.env.LOG_LEVEL ||= 'silent';

const { pool } = require('../src/db/index.js');
pool.query = vi.fn();

const request = require('supertest');
const app = require('../src/server.js');

let realPasswordHash;

beforeAll(async () => {
  realPasswordHash = await bcrypt.hash('correct-password', 10);
});

beforeEach(() => {
  pool.query.mockReset();
});

describe('POST /api/auth/login', () => {
  it('rejects a request missing email or password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('rejects an unknown email with a generic message (no user enumeration)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@church.org', password: 'x' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('rejects a wrong password with the same generic message', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Test', email: 'a@b.com', role: 'interviewer', password_hash: realPasswordHash }],
    });
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('returns a token and interviewer profile on success, without the password hash', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Test Admin', email: 'a@b.com', role: 'admin', password_hash: realPasswordHash }],
    });
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'correct-password' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.interviewer).toEqual({ id: 1, name: 'Test Admin', email: 'a@b.com', role: 'admin' });
    expect(res.body.interviewer.password_hash).toBeUndefined();
  });
});

describe('GET /api/registrations/track/:regNumber', () => {
  it('returns only public-safe fields when found', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{
        reg_number: 'WB-2026-00001', full_name: 'Jane Doe', status: 'pending',
        interview_date: '2026-07-13', interview_time: '09:00',
        // These must never appear in the response even though the mock DB row has them:
        phone_number: '08012345678', residential_address: '1 Secret St',
      }],
    });
    const res = await request(app).get('/api/registrations/track/WB-2026-00001');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      regNumber: 'WB-2026-00001', fullName: 'Jane Doe', status: 'pending',
      interviewDate: '2026-07-13', interviewTime: '09:00',
    });
    expect(res.body.phoneNumber).toBeUndefined();
    expect(res.body.residentialAddress).toBeUndefined();
  });

  it('returns 404 for an unknown tracking number', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/registrations/track/WB-9999-99999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/registrations validation', () => {
  it('rejects a submission missing required fields before touching the database', async () => {
    const res = await request(app).post('/api/registrations').send({ fullName: 'Only A Name' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects an invalid phone number', async () => {
    const res = await request(app).post('/api/registrations').send({
      fullName: 'Test Candidate', gender: 'Male', dateOfBirth: '1990-01-01',
      maritalStatus: 'Single', residentialAddress: '1 Test St',
      phoneNumber: 'not-a-phone', branchChurch: 'Test Branch',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/phone/i);
  });

  it('rejects out-of-order spiritual experience dates', async () => {
    const res = await request(app).post('/api/registrations').send({
      fullName: 'Test Candidate', gender: 'Male', dateOfBirth: '1990-01-01',
      maritalStatus: 'Single', residentialAddress: '1 Test St',
      phoneNumber: '08012345678', branchChurch: 'Test Branch',
      hasSalvation: true, salvationDate: '2020-01-01',
      hasSanctification: true, sanctificationDate: '2015-01-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/follow the order/i);
  });
});

describe('Unknown API routes', () => {
  it('returns a JSON 404 instead of the SPA fallback', async () => {
    const res = await request(app).get('/api/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});
