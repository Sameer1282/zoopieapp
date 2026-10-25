import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { HealthCheckResponseSchema } from '@zoopie/shared';

describe('GET /health', () => {
  it('returns 200 OK and conforms to HealthCheckResponseSchema', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('zoopie-server');
    expect(typeof response.body.uptime).toBe('number');
    expect(typeof response.body.timestamp).toBe('string');

    const validationResult = HealthCheckResponseSchema.safeParse(response.body);
    expect(validationResult.success).toBe(true);
  });

  it('returns 404 for unknown endpoints', async () => {
    const response = await request(app).get('/unknown-route-for-testing');
    expect(response.status).toBe(404);
    expect(response.body.status).toBe('error');
  });
});
