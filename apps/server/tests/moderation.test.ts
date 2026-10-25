import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { initSocketServer, type TypedSocketServer } from '../src/socket/index.js';
import { matchmakingQueue } from '../src/socket/matchmaking-queue.js';
import {
  SOCKET_EVENTS,
  type ServerToClientEvents,
  type ClientToServerEvents,
} from '@zoopie/shared';
import crypto from 'node:crypto';

describe('Phase 7 Safety, Reporting, Blocking, and Moderation', () => {
  let httpServer: HttpServer;
  let ioServer: TypedSocketServer;
  let port: number;

  const createConnectedClient = (): Promise<
    ClientSocket<ServerToClientEvents, ClientToServerEvents>
  > => {
    return new Promise((resolve, reject) => {
      const client = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        autoConnect: true,
        forceNew: true,
      }) as ClientSocket<ServerToClientEvents, ClientToServerEvents>;

      if (client.connected) {
        resolve(client);
      } else {
        client.on('connect', () => resolve(client));
        client.on('connect_error', err => reject(err));
      }
    });
  };

  beforeAll(
    () =>
      new Promise<void>(resolve => {
        httpServer = createServer();
        ioServer = initSocketServer(httpServer);
        httpServer.listen(0, () => {
          port = (httpServer.address() as AddressInfo).port;
          resolve();
        });
      })
  );

  afterAll(
    () =>
      new Promise<void>(resolve => {
        ioServer.close();
        httpServer.close(() => resolve());
      })
  );

  describe('Report Submission and Anti-Abuse Deduplication', () => {
    it('accepts valid report submission and returns 201 with PENDING status', async () => {
      const reporterSessionId = crypto.randomUUID();
      const reportedSessionId = crypto.randomUUID();

      const res = await request(app).post('/api/reports').send({
        reporterSessionId,
        reportedSessionId,
        conversationId: 'conv_123',
        category: 'HARASSMENT',
        details: 'Repeated offensive remarks during chat session.',
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('PENDING');
      expect(res.body.message).toContain('Report successfully submitted');
    });

    it('rejects duplicate report within the anti-spam window with 409 Conflict', async () => {
      const reporterSessionId = crypto.randomUUID();
      const reportedSessionId = crypto.randomUUID();

      const payload = {
        reporterSessionId,
        reportedSessionId,
        category: 'THREATS_OR_VIOLENCE',
        details: 'Threatening language detected.',
      };

      const res1 = await request(app).post('/api/reports').send(payload);
      expect(res1.status).toBe(201);

      const res2 = await request(app).post('/api/reports').send(payload);
      expect(res2.status).toBe(409);
      expect(res2.body.error.message).toContain('already submitted a report');
    });

    it('rejects invalid report payload with 400 Bad Request', async () => {
      const res = await request(app).post('/api/reports').send({
        reporterSessionId: 'invalid-uuid',
        category: 'INVALID_CATEGORY',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('User Blocking and Matchmaking Isolation', () => {
    it('records a user block and prevents mutual matchmaking', async () => {
      const blockerSessionId = crypto.randomUUID();
      const blockedFingerprint = 'test-blocked-fingerprint-999';

      const res = await request(app).post('/api/blocks').send({
        blockerSessionId,
        blockedFingerprint,
        reason: 'Harassment',
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();

      // Verify matchmaking queue in-memory block check
      const isBlocked = matchmakingQueue.isBlocked(blockerSessionId, blockedFingerprint);
      expect(isBlocked).toBe(true);

      const isReverseBlocked = matchmakingQueue.isBlocked(blockedFingerprint, blockerSessionId);
      expect(isReverseBlocked).toBe(true);
    });
  });

  describe('Admin Authentication & RBAC', () => {
    it('rejects login with incorrect secret key with 401 Unauthorized', async () => {
      const res = await request(app).post('/api/admin/login').send({
        adminKey: 'wrong-secret-key-attempt',
        role: 'MODERATOR',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('authenticates admin with valid key and issues HMAC-signed bearer token', async () => {
      const res = await request(app).post('/api/admin/login').send({
        adminKey: env.ADMIN_SECRET_KEY,
        role: 'MODERATOR',
      });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.role).toBe('MODERATOR');
      expect(res.body.adminId).toMatch(/^admin_/);
      expect(res.body.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('rejects unauthenticated requests to protected admin routes', async () => {
      const res = await request(app).get('/api/admin/reports');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects requests with tampered or malformed admin token', async () => {
      const res = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', 'Bearer invalid.tampered.token');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Moderation Workflows & Least-Privilege Action Enforcement', () => {
    let moderatorToken: string;
    let auditorToken: string;
    let targetReportId: string;
    const reportedSessionId = crypto.randomUUID();

    beforeAll(async () => {
      // Create Moderator token
      const modRes = await request(app).post('/api/admin/login').send({
        adminKey: env.ADMIN_SECRET_KEY,
        role: 'MODERATOR',
      });
      moderatorToken = modRes.body.token;

      // Create Auditor token
      const audRes = await request(app).post('/api/admin/login').send({
        adminKey: env.ADMIN_SECRET_KEY,
        role: 'AUDITOR',
      });
      auditorToken = audRes.body.token;

      // Create a report to moderate
      const repRes = await request(app).post('/api/reports').send({
        reporterSessionId: crypto.randomUUID(),
        reportedSessionId,
        category: 'INAPPROPRIATE_CONTENT',
        details: 'Displaying inappropriate imagery.',
      });
      targetReportId = repRes.body.id;
    });

    it('allows Auditor to list reports and retrieve report metadata', async () => {
      const res = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${auditorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.reports).toBeDefined();
      expect(Array.isArray(res.body.reports)).toBe(true);

      const detailRes = await request(app)
        .get(`/api/admin/reports/${targetReportId}`)
        .set('Authorization', `Bearer ${auditorToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.id).toBe(targetReportId);
    });

    it('forbids Auditor from executing moderation actions (least privilege 403)', async () => {
      const res = await request(app)
        .post(`/api/admin/reports/${targetReportId}/action`)
        .set('Authorization', `Bearer ${auditorToken}`)
        .send({
          actionType: 'PERMANENT_BAN',
          reason: 'Severe violation of guidelines',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows Moderator to execute a PERMANENT_BAN action and verifies target suspension', async () => {
      const res = await request(app)
        .post(`/api/admin/reports/${targetReportId}/action`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          actionType: 'PERMANENT_BAN',
          reason: 'Confirmed community guideline violation',
        });

      expect(res.status).toBe(200);
      expect(res.body.actionType).toBe('PERMANENT_BAN');
      expect(res.body.reportId).toBe(targetReportId);

      // Verify the target session is now suspended in the matchmaking engine
      const isSuspended = matchmakingQueue.isSuspended(reportedSessionId);
      expect(isSuspended).toBe(true);
    });

    it('rejects suspended participant from joining matchmaking queue via socket', async () => {
      const client = await createConnectedClient();

      const socketErrorPromise = new Promise<{ code: string; message: string }>(resolve => {
        client.on(SOCKET_EVENTS.ERROR, error => {
          resolve(error);
        });
      });

      // Attempt to join queue with the banned sessionId
      client.emit(SOCKET_EVENTS.QUEUE_JOIN, {
        sessionId: reportedSessionId,
        mode: 'text',
        interests: [],
      });

      const error = await socketErrorPromise;
      expect(error.code).toBe('SESSION_SUSPENDED');
      expect(error.message).toContain('restricted or suspended');

      client.disconnect();
    });

    it('logs moderation actions to the audit trail', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${auditorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.auditLogs).toBeDefined();
      const actionLog = res.body.auditLogs.find(
        (log: { reportId?: string }) => log.reportId === targetReportId
      );
      expect(actionLog).toBeDefined();
      expect(actionLog.actionType).toBe('PERMANENT_BAN');
      expect(actionLog.adminId).toMatch(/^admin_/);
    });

    it('returns moderation overview stats', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${moderatorToken}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.totalReports).toBe('number');
      expect(typeof res.body.pendingReports).toBe('number');
      expect(typeof res.body.activeBans).toBe('number');
    });
  });
});
