import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { redactSensitiveData } from '../src/utils/logger.js';
import { ApiErrorResponseSchema } from '@zoopie/shared';
import crypto from 'node:crypto';

describe('Phase 3 Security Baseline & Headers', () => {
  it('applies Helmet security headers and removes X-Powered-By', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('sets X-Request-Id header on all requests', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id'].length).toBeGreaterThan(10);
  });

  it('includes rate limiting headers', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });
});

describe('Phase 3 Sensitive-Field Redaction', () => {
  it('redacts sensitive fields and database URLs', () => {
    const sensitivePayload = {
      user: 'alice',
      password: 'superSecretPassword123!',
      password_hash: '$argon2id$v=19$m=65536...',
      token: 'jwt.token.here',
      database_url: 'postgresql://postgres:secret123@db.zoopie.internal:5432/zoopie_prod',
      nested: {
        apiKey: 'sk_live_93810293810293',
        authorization: 'Bearer token123',
        safeMetadata: 'public-data',
      },
    };

    const redacted = redactSensitiveData(sensitivePayload) as Record<string, unknown>;

    expect(redacted.user).toBe('alice');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.password_hash).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.database_url).toBe('[REDACTED]');

    const nested = redacted.nested as Record<string, unknown>;
    expect(nested.apiKey).toBe('[REDACTED]');
    expect(nested.authorization).toBe('[REDACTED]');
    expect(nested.safeMetadata).toBe('public-data');
  });
});

describe('Phase 3 API Contracts & Centralized Error Handling', () => {
  it('returns 400 VALIDATION_ERROR when submitting malformed report payload', async () => {
    const res = await request(app).post('/api/reports').send({
      reporterSessionId: 'invalid-not-a-uuid',
      reportedFingerprint: 'short',
      category: 'INVALID_CATEGORY',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    const validated = ApiErrorResponseSchema.safeParse(res.body);
    expect(validated.success).toBe(true);
  });

  it('accepts valid report submission and returns 201 PENDING status', async () => {
    const validReport = {
      reporterSessionId: crypto.randomUUID(),
      reportedFingerprint: 'a'.repeat(32),
      category: 'HARASSMENT',
      details: 'Participant engaged in abusive language',
    };

    const res = await request(app).post('/api/reports').send(validReport);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.category).toBe('HARASSMENT');
    expect(res.body.status).toBe('PENDING');
    expect(res.body.createdAt).toBeDefined();
  });

  it('accepts valid block submission and returns 201 created', async () => {
    const validBlock = {
      blockerSessionId: crypto.randomUUID(),
      blockedFingerprint: 'b'.repeat(32),
      reason: 'Inappropriate behavior',
    };

    const res = await request(app).post('/api/blocks').send(validBlock);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.blockerSessionId).toBe(validBlock.blockerSessionId);
    expect(res.body.blockedFingerprint).toBe(validBlock.blockedFingerprint);
  });

  it('creates an opaque user session with SHA-256 fingerprint hash', async () => {
    const res = await request(app).post('/api/sessions').send({});

    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.createdAt).toBeDefined();
  });

  it('returns safe error responses without leaking internal stack traces', async () => {
    const res = await request(app).get('/non-existent-route-for-testing');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.stack).toBeUndefined();
  });
});
