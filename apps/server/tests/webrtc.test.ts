import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { initSocketServer, type TypedSocketServer } from '../src/socket/index.js';
import { matchManager } from '../src/socket/match-manager.js';
import { matchmakingQueue } from '../src/socket/matchmaking-queue.js';
import {
  SOCKET_EVENTS,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type WebRtcOfferPayload,
  type WebRtcAnswerPayload,
  type WebRtcIceCandidatePayload,
} from '@zoopie/shared';
import crypto from 'node:crypto';

describe('Phase 6 WebRTC Signaling & Configuration', () => {
  let app: ReturnType<typeof createApp>;
  let server: http.Server;
  let socketServer: TypedSocketServer;
  let serverPort: number;
  let serverUrl: string;

  beforeAll(async () => {
    app = createApp();
    server = http.createServer(app);
    socketServer = initSocketServer(server);

    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          serverPort = addr.port;
          serverUrl = `http://127.0.0.1:${serverPort}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    socketServer.close();
    await new Promise<void>((resolve, reject) => {
      server.close(err => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    matchManager.reset();
    matchmakingQueue.reset();
  });

  function createConnectedClient(): Promise<
    ClientSocket<ServerToClientEvents, ClientToServerEvents>
  > {
    return new Promise(resolve => {
      const client = ioClient(serverUrl, {
        transports: ['websocket'],
        forceNew: true,
      });

      if (client.connected) {
        resolve(client);
      } else {
        client.on('connect', () => resolve(client));
      }
    });
  }

  describe('GET /api/webrtc/ice-servers', () => {
    it('returns default STUN configuration and valid TTL structure', async () => {
      const res = await request(app).get('/api/webrtc/ice-servers');

      expect(res.status).toBe(200);
      expect(res.body.iceServers).toBeDefined();
      expect(Array.isArray(res.body.iceServers)).toBe(true);
      expect(res.body.iceServers.length).toBeGreaterThanOrEqual(1);

      // Verify STUN server presence
      const stunEntry = res.body.iceServers.find((s: { urls: string | string[] }) => {
        const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
        return urls.some(u => u.startsWith('stun:'));
      });
      expect(stunEntry).toBeDefined();
      expect(res.body.ttl).toBeGreaterThan(0);
    });
  });

  describe('Authorized Signaling Exchange', () => {
    it('relays offer, answer, and ICE candidates between authorized match peers', async () => {
      const clientA = await createConnectedClient();
      const clientB = await createConnectedClient();

      const sessionA = crypto.randomUUID();
      const sessionB = crypto.randomUUID();
      const matchId = `test-webrtc-${Date.now()}`;

      // Join fixture match
      const joinPromiseA = new Promise(resolve =>
        clientA.once(SOCKET_EVENTS.MATCH_JOINED, resolve)
      );
      const joinPromiseB = new Promise(resolve =>
        clientB.once(SOCKET_EVENTS.MATCH_JOINED, resolve)
      );

      clientA.emit(SOCKET_EVENTS.JOIN_MATCH, { matchId, sessionId: sessionA });
      clientB.emit(SOCKET_EVENTS.JOIN_MATCH, { matchId, sessionId: sessionB });

      await Promise.all([joinPromiseA, joinPromiseB]);

      // 1. Client A sends WebRTC Offer -> Client B receives Offer
      const offerPromiseB = new Promise<WebRtcOfferPayload>(resolve => {
        clientB.once(SOCKET_EVENTS.SIGNAL_OFFER, resolve);
      });

      const mockOfferSdp =
        'v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n';
      clientA.emit(SOCKET_EVENTS.SIGNAL_OFFER, {
        matchId,
        sdp: mockOfferSdp,
        type: 'offer',
      });

      const receivedOffer = await offerPromiseB;
      expect(receivedOffer.matchId).toBe(matchId);
      expect(receivedOffer.sdp).toBe(mockOfferSdp);
      expect(receivedOffer.type).toBe('offer');

      // 2. Client B sends WebRTC Answer -> Client A receives Answer
      const answerPromiseA = new Promise<WebRtcAnswerPayload>(resolve => {
        clientA.once(SOCKET_EVENTS.SIGNAL_ANSWER, resolve);
      });

      const mockAnswerSdp =
        'v=0\r\no=- 987654321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n';
      clientB.emit(SOCKET_EVENTS.SIGNAL_ANSWER, {
        matchId,
        sdp: mockAnswerSdp,
        type: 'answer',
      });

      const receivedAnswer = await answerPromiseA;
      expect(receivedAnswer.matchId).toBe(matchId);
      expect(receivedAnswer.sdp).toBe(mockAnswerSdp);
      expect(receivedAnswer.type).toBe('answer');

      // 3. Client A sends ICE Candidate -> Client B receives Candidate
      const candidatePromiseB = new Promise<WebRtcIceCandidatePayload>(resolve => {
        clientB.once(SOCKET_EVENTS.SIGNAL_ICE_CANDIDATE, resolve);
      });

      const mockCandidate = {
        candidate: 'candidate:1 1 UDP 2122260223 192.168.1.100 50000 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      };

      clientA.emit(SOCKET_EVENTS.SIGNAL_ICE_CANDIDATE, {
        matchId,
        candidate: mockCandidate,
      });

      const receivedCandidate = await candidatePromiseB;
      expect(receivedCandidate.matchId).toBe(matchId);
      expect(receivedCandidate.candidate.candidate).toBe(mockCandidate.candidate);

      clientA.disconnect();
      clientB.disconnect();
    });

    it('rejects signaling attempt from unauthorized non-participant socket', async () => {
      const clientAuthorized = await createConnectedClient();
      const clientIntruder = await createConnectedClient();

      const sessionAuth = crypto.randomUUID();
      const matchId = `test-secure-${Date.now()}`;

      // Only clientAuthorized joins
      clientAuthorized.emit(SOCKET_EVENTS.JOIN_MATCH, { matchId, sessionId: sessionAuth });
      await new Promise(r => setTimeout(r, 50));

      const errorPromiseIntruder = new Promise<{ code: string; message: string }>(resolve => {
        clientIntruder.once(SOCKET_EVENTS.ERROR, resolve);
      });

      let authReceivedOffer = false;
      clientAuthorized.on(SOCKET_EVENTS.SIGNAL_OFFER, () => {
        authReceivedOffer = true;
      });

      // Intruder attempts to inject an offer
      clientIntruder.emit(SOCKET_EVENTS.SIGNAL_OFFER, {
        matchId,
        sdp: 'v=0\r\nm=video 9 fake',
        type: 'offer',
      });

      const err = await errorPromiseIntruder;
      expect(err.code).toBe('UNAUTHORIZED_MATCH');
      expect(authReceivedOffer).toBe(false);

      clientAuthorized.disconnect();
      clientIntruder.disconnect();
    });

    it('rejects stale offer when client provides mismatched matchId', async () => {
      const client = await createConnectedClient();
      const session = crypto.randomUUID();
      const activeMatchId = `test-active-${Date.now()}`;
      const staleMatchId = `test-stale-${Date.now()}`;

      client.emit(SOCKET_EVENTS.JOIN_MATCH, { matchId: activeMatchId, sessionId: session });
      await new Promise(r => setTimeout(r, 50));

      const errorPromise = new Promise<{ code: string; message: string }>(resolve => {
        client.once(SOCKET_EVENTS.ERROR, resolve);
      });

      client.emit(SOCKET_EVENTS.SIGNAL_OFFER, {
        matchId: staleMatchId, // Mismatched!
        sdp: 'v=0\r\nm=video 9 fake',
        type: 'offer',
      });

      const err = await errorPromise;
      expect(err.code).toBe('UNAUTHORIZED_MATCH');

      client.disconnect();
    });
  });
});
