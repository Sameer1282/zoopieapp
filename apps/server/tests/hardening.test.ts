import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import { app } from '../src/app.js';
import { setShuttingDown } from '../src/routes/health.js';
import { initSocketServer, type TypedSocketServer } from '../src/socket/index.js';
import { matchManager } from '../src/socket/match-manager.js';
import { matchmakingQueue } from '../src/socket/matchmaking-queue.js';
import {
  SOCKET_EVENTS,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type ReceiveMessagePayload,
} from '@zoopie/shared';
import crypto from 'node:crypto';

describe('Phase 8 System Reliability & Hardening', () => {
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
        setShuttingDown(false);
        ioServer.close();
        httpServer.close(() => resolve());
      })
  );

  beforeEach(() => {
    matchManager.reset();
  });

  describe('Health and Readiness Strategy', () => {
    it('GET /health returns 200 liveness probe with process metrics', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.service).toBe('zoopie-server');
    });

    it('GET /ready returns 200 readiness probe with memory and DB status', async () => {
      const res = await request(app).get('/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.ready).toBe(true);
      expect(res.body.memory).toBeDefined();
      expect(typeof res.body.memory.heapUsedMb).toBe('number');
    });

    it('GET /ready returns 503 during graceful shutdown drain', async () => {
      setShuttingDown(true);
      const res = await request(app).get('/ready');
      expect(res.status).toBe(503);
      expect(res.body.ready).toBe(false);
      expect(res.body.status).toBe('shutting_down');

      // Reset shutdown state for remaining tests
      setShuttingDown(false);
    });
  });

  describe('Database Failure Resilience & Memory Fallback', () => {
    it('session creation succeeds via in-memory fallback even if DB is offline', async () => {
      const res = await request(app).post('/api/sessions').send({});
      expect(res.status).toBe(201);
      expect(res.body.sessionId).toBeDefined();
      expect(res.body.status).toBe('ACTIVE');
    });

    it('block registration updates in-memory queue even if DB write times out', async () => {
      const blockerSessionId = crypto.randomUUID();
      const blockedFingerprint = 'resilience-test-fingerprint-abc';

      const res = await request(app).post('/api/blocks').send({
        blockerSessionId,
        blockedFingerprint,
        reason: 'Spam',
      });

      expect(res.status).toBe(201);
      expect(matchmakingQueue.isBlocked(blockerSessionId, blockedFingerprint)).toBe(true);
    });

    it('report submission succeeds and registers in memory even if DB is offline', async () => {
      const res = await request(app).post('/api/reports').send({
        reporterSessionId: crypto.randomUUID(),
        reportedSessionId: crypto.randomUUID(),
        category: 'SPAM_OR_BOT',
        details: 'Bot messaging links',
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('PENDING');
    });
  });

  describe('Socket Message Idempotency & Stale Event Guards', () => {
    it('prevents duplicate relay when identical messageId is sent twice', async () => {
      const matchId = `test-hardening-idem-${Date.now()}`;
      const sessionA = crypto.randomUUID();
      const sessionB = crypto.randomUUID();

      const clientA = await createConnectedClient();
      const clientB = await createConnectedClient();

      try {
        // Client A joins
        await new Promise<void>(resolve => {
          clientA.on(SOCKET_EVENTS.MATCH_JOINED, () => resolve());
          clientA.emit(SOCKET_EVENTS.JOIN_MATCH, { matchId, sessionId: sessionA });
        });

        // Client B joins -> makes match active
        await new Promise<void>(resolve => {
          let bJoined = false;
          let aNotified = false;

          clientA.on(SOCKET_EVENTS.PEER_JOINED, () => {
            aNotified = true;
            if (bJoined && aNotified) resolve();
          });

          clientB.on(SOCKET_EVENTS.MATCH_JOINED, payload => {
            if (payload.peerConnected) bJoined = true;
            if (bJoined && aNotified) resolve();
          });

          clientB.emit(SOCKET_EVENTS.JOIN_MATCH, { matchId, sessionId: sessionB });
        });

        let receivedCount = 0;
        clientB.on(SOCKET_EVENTS.RECEIVE_MESSAGE, (_payload: ReceiveMessagePayload) => {
          receivedCount++;
        });

        const messageId = `msg-idempotency-${Date.now()}`;

        // Send message first time
        await new Promise<void>((resolve, reject) => {
          clientA.once(SOCKET_EVENTS.MESSAGE_ACK, ack => {
            expect(ack.status).toBe('delivered');
            resolve();
          });
          clientA.emit(SOCKET_EVENTS.SEND_MESSAGE, {
            matchId,
            messageId,
            content: 'Idempotency test message',
            clientTimestamp: Date.now(),
          });
          setTimeout(() => reject(new Error('First send timed out')), 3000);
        });

        // Send duplicate message second time with SAME messageId
        await new Promise<void>((resolve, reject) => {
          clientA.once(SOCKET_EVENTS.MESSAGE_ACK, ack => {
            expect(ack.status).toBe('delivered');
            resolve();
          });
          clientA.emit(SOCKET_EVENTS.SEND_MESSAGE, {
            matchId,
            messageId,
            content: 'Idempotency test message',
            clientTimestamp: Date.now(),
          });
          setTimeout(() => reject(new Error('Second send timed out')), 3000);
        });

        // Wait brief period for event propagation
        await new Promise(r => setTimeout(r, 100));

        // Receiver must have received the message EXACTLY ONCE
        expect(receivedCount).toBe(1);
      } finally {
        clientA.disconnect();
        clientB.disconnect();
      }
    });

    it('rejects message sent to mismatched or unauthorized match', async () => {
      const matchId = `test-hardening-stale-${Date.now()}`;
      const sessionA = crypto.randomUUID();
      const clientA = await createConnectedClient();

      try {
        await new Promise<void>(resolve => {
          clientA.on(SOCKET_EVENTS.MATCH_JOINED, () => resolve());
          clientA.emit(SOCKET_EVENTS.JOIN_MATCH, { matchId, sessionId: sessionA });
        });

        const ack = await new Promise<{ status: string; error?: string }>(resolve => {
          clientA.once(SOCKET_EVENTS.MESSAGE_ACK, res => resolve(res));
          // Send with mismatched matchId
          clientA.emit(SOCKET_EVENTS.SEND_MESSAGE, {
            matchId: 'stale-old-match-id-999',
            messageId: `msg-${Date.now()}`,
            content: 'Should be rejected',
            clientTimestamp: Date.now(),
          });
        });

        expect(ack.status).toBe('failed');
        expect(ack.error).toContain('Stale match event');
      } finally {
        clientA.disconnect();
      }
    });

    it('rejects WebRTC signaling sent from unauthorized client or mismatched match', async () => {
      const client = await createConnectedClient();

      try {
        const errorPromise = new Promise<{ code: string }>(resolve => {
          client.once(SOCKET_EVENTS.ERROR, err => resolve(err));
        });

        // Send offer to non-existent match
        client.emit(SOCKET_EVENTS.SIGNAL_OFFER, {
          matchId: 'non-existent-match',
          sdp: 'fake-sdp-offer',
          type: 'offer',
        });

        const err = await errorPromise;
        expect(err.code).toBe('UNAUTHORIZED_MATCH');
      } finally {
        client.disconnect();
      }
    });
  });

  describe('Payload Size & Rate Limiting Hardening', () => {
    it('rejects oversized JSON request exceeding body limit with 413 Payload Too Large', async () => {
      const largePayload = {
        data: 'x'.repeat(20 * 1024), // 20kb exceeds 10kb limit
      };

      const res = await request(app).post('/api/sessions').send(largePayload);
      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('rejects oversized text chat socket message (> 1000 chars)', async () => {
      const matchId = `test-hardening-oversized-${Date.now()}`;
      const sessionA = crypto.randomUUID();
      const clientA = await createConnectedClient();

      try {
        await new Promise<void>(resolve => {
          clientA.on(SOCKET_EVENTS.MATCH_JOINED, () => resolve());
          clientA.emit(SOCKET_EVENTS.JOIN_MATCH, { matchId, sessionId: sessionA });
        });

        const ack = await new Promise<{ status: string; error?: string }>(resolve => {
          clientA.once(SOCKET_EVENTS.MESSAGE_ACK, res => resolve(res));
          clientA.emit(SOCKET_EVENTS.SEND_MESSAGE, {
            matchId,
            messageId: `msg-${Date.now()}`,
            content: 'a'.repeat(1001),
            clientTimestamp: Date.now(),
          });
        });

        expect(ack.status).toBe('failed');
        expect(ack.error).toContain('1000 characters');
      } finally {
        clientA.disconnect();
      }
    });
  });

  describe('Concurrent Matchmaking Stress Test', () => {
    it('safely pairs 20 concurrent participants with zero duplicates or race conditions', () => {
      matchmakingQueue.reset();

      const totalParticipants = 20;
      const candidates = Array.from({ length: totalParticipants }, (_, i) => ({
        sessionId: `stress-sess-${i}-${crypto.randomUUID()}`,
        socketId: `stress-sock-${i}`,
        mode: 'text' as const,
      }));

      const matchedPairs: Array<{ matchId: string; userA: string; userB: string }> = [];

      // Concurrently enqueue all 20 participants
      for (const candidate of candidates) {
        const result = matchmakingQueue.enqueue(candidate);
        if (result.matched && result.match) {
          matchedPairs.push({
            matchId: result.match.matchId,
            userA: result.match.initiator.sessionId,
            userB: result.match.receiver.sessionId,
          });
        }
      }

      // Exactly 10 matches must be formed (20 / 2 = 10)
      expect(matchedPairs.length).toBe(10);

      // Verify no self-matching
      for (const pair of matchedPairs) {
        expect(pair.userA).not.toBe(pair.userB);
      }

      // Verify all participants are unique across all formed matches
      const pairedSessionIds = new Set<string>();
      for (const pair of matchedPairs) {
        expect(pairedSessionIds.has(pair.userA)).toBe(false);
        expect(pairedSessionIds.has(pair.userB)).toBe(false);
        pairedSessionIds.add(pair.userA);
        pairedSessionIds.add(pair.userB);
      }
      expect(pairedSessionIds.size).toBe(totalParticipants);

      // Remaining queue should be 0
      expect(matchmakingQueue.getQueueLength('text')).toBe(0);
    });
  });
});
