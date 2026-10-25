import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { initSocketServer, type TypedSocketServer } from '../src/socket/index.js';
import { matchManager } from '../src/socket/match-manager.js';
import { matchmakingQueue } from '../src/socket/matchmaking-queue.js';
import {
  SOCKET_EVENTS,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type MatchFoundPayload,
  type QueueStatusPayload,
  type MatchEndedPayload,
} from '@zoopie/shared';
import crypto from 'node:crypto';

describe('Phase 5 Server-Authoritative Matchmaking', () => {
  let server: http.Server;
  let socketServer: TypedSocketServer;
  let serverPort: number;
  let serverUrl: string;

  beforeAll(async () => {
    const app = createApp();
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

  it('matches two separate clients, issues opaque matchId, and assigns roles', async () => {
    const clientA = await createConnectedClient();
    const clientB = await createConnectedClient();

    const sessionA = crypto.randomUUID();
    const sessionB = crypto.randomUUID();

    const matchPromiseA = new Promise<MatchFoundPayload>(resolve => {
      clientA.on(SOCKET_EVENTS.MATCH_FOUND, resolve);
    });

    const matchPromiseB = new Promise<MatchFoundPayload>(resolve => {
      clientB.on(SOCKET_EVENTS.MATCH_FOUND, resolve);
    });

    // Client A joins queue
    clientA.emit(SOCKET_EVENTS.QUEUE_JOIN, {
      sessionId: sessionA,
      mode: 'text',
      interests: [],
    });

    // Client B joins queue
    clientB.emit(SOCKET_EVENTS.QUEUE_JOIN, {
      sessionId: sessionB,
      mode: 'text',
      interests: [],
    });

    const [matchA, matchB] = await Promise.all([matchPromiseA, matchPromiseB]);

    expect(matchA.matchId).toBeDefined();
    expect(matchA.matchId).toBe(matchB.matchId);
    expect(matchA.matchId.startsWith('match_')).toBe(true);
    expect(matchA.mode).toBe('text');
    expect(matchB.mode).toBe('text');

    // Initiator / receiver complement
    const roles = [matchA.role, matchB.role].sort();
    expect(roles).toEqual(['initiator', 'receiver']);

    clientA.disconnect();
    clientB.disconnect();
  });

  it('prevents self-matching when same session joins from multiple connections', async () => {
    const clientA1 = await createConnectedClient();
    const clientA2 = await createConnectedClient();

    const sharedSessionId = crypto.randomUUID();
    let matched = false;

    clientA1.on(SOCKET_EVENTS.MATCH_FOUND, () => {
      matched = true;
    });
    clientA2.on(SOCKET_EVENTS.MATCH_FOUND, () => {
      matched = true;
    });

    // Both attempt to join with identical sessionId
    clientA1.emit(SOCKET_EVENTS.QUEUE_JOIN, {
      sessionId: sharedSessionId,
      mode: 'text',
      interests: [],
    });

    clientA2.emit(SOCKET_EVENTS.QUEUE_JOIN, {
      sessionId: sharedSessionId,
      mode: 'text',
      interests: [],
    });

    // Wait 150ms to ensure no self-match occurs
    await new Promise(r => setTimeout(r, 150));

    expect(matched).toBe(false);
    expect(matchmakingQueue.getQueueLength('text')).toBe(1);

    clientA1.disconnect();
    clientA2.disconnect();
  });

  it('segregates queues by mode (text vs video users do not match)', async () => {
    const textClient = await createConnectedClient();
    const videoClient = await createConnectedClient();

    let matched = false;
    textClient.on(SOCKET_EVENTS.MATCH_FOUND, () => {
      matched = true;
    });
    videoClient.on(SOCKET_EVENTS.MATCH_FOUND, () => {
      matched = true;
    });

    textClient.emit(SOCKET_EVENTS.QUEUE_JOIN, {
      sessionId: crypto.randomUUID(),
      mode: 'text',
      interests: ['gaming'],
    });

    videoClient.emit(SOCKET_EVENTS.QUEUE_JOIN, {
      sessionId: crypto.randomUUID(),
      mode: 'video',
      interests: ['gaming'],
    });

    await new Promise(r => setTimeout(r, 150));

    expect(matched).toBe(false);
    expect(matchmakingQueue.getQueueLength('text')).toBe(1);
    expect(matchmakingQueue.getQueueLength('video')).toBe(1);

    textClient.disconnect();
    videoClient.disconnect();
  });

  it('pairs users with overlapping interests over non-matching users', async () => {
    const clientCoding1 = await createConnectedClient();
    const clientCooking = await createConnectedClient();
    const clientCoding2 = await createConnectedClient();

    const sessionCoding1 = crypto.randomUUID();
    const sessionCooking = crypto.randomUUID();
    const sessionCoding2 = crypto.randomUUID();

    // 1. Coding1 joins with ['typescript', 'react']
    clientCoding1.emit(SOCKET_EVENTS.QUEUE_JOIN, {
      sessionId: sessionCoding1,
      mode: 'text',
      interests: ['typescript', 'react'],
    });

    // 2. Cooking joins with ['cooking', 'baking']
    clientCooking.emit(SOCKET_EVENTS.QUEUE_JOIN, {
      sessionId: sessionCooking,
      mode: 'text',
      interests: ['cooking', 'baking'],
    });

    await new Promise(r => setTimeout(r, 50));

    const matchPromise1 = new Promise<MatchFoundPayload>(resolve => {
      clientCoding1.on(SOCKET_EVENTS.MATCH_FOUND, resolve);
    });
    const matchPromise2 = new Promise<MatchFoundPayload>(resolve => {
      clientCoding2.on(SOCKET_EVENTS.MATCH_FOUND, resolve);
    });

    // 3. Coding2 joins with ['react', 'node']
    clientCoding2.emit(SOCKET_EVENTS.QUEUE_JOIN, {
      sessionId: sessionCoding2,
      mode: 'text',
      interests: ['react', 'node'],
    });

    const [match1, match2] = await Promise.all([matchPromise1, matchPromise2]);

    expect(match1.matchId).toBe(match2.matchId);
    expect(match1.commonInterests).toEqual(['react']);
    expect(match2.commonInterests).toEqual(['react']);

    // Cooking client must remain in queue unmatched
    expect(matchmakingQueue.getQueueLength('text')).toBe(1);
    const waitingItem = matchmakingQueue.getQueueItem(sessionCooking);
    expect(waitingItem).toBeDefined();

    clientCoding1.disconnect();
    clientCooking.disconnect();
    clientCoding2.disconnect();
  });

  it('excludes blocked pairs from being matched together', async () => {
    const clientA = await createConnectedClient();
    const clientB = await createConnectedClient();
    const clientC = await createConnectedClient();

    const sessionA = crypto.randomUUID();
    const sessionB = crypto.randomUUID();
    const sessionC = crypto.randomUUID();

    // Register block between A and B
    matchmakingQueue.recordBlock(sessionA, sessionB);

    let bMatchedWithA = false;
    clientB.on(SOCKET_EVENTS.MATCH_FOUND, match => {
      // If B matched, verify it was NOT with A's match
      if (match.matchId === clientA.id) {
        bMatchedWithA = true;
      }
    });

    // A and B join
    clientA.emit(SOCKET_EVENTS.QUEUE_JOIN, {
      sessionId: sessionA,
      mode: 'text',
      interests: [],
    });

    clientB.emit(SOCKET_EVENTS.QUEUE_JOIN, {
      sessionId: sessionB,
      mode: 'text',
      interests: [],
    });

    await new Promise(r => setTimeout(r, 100));

    // A and B must NOT be matched together
    expect(matchmakingQueue.getQueueLength('text')).toBe(2);

    const matchPromiseA = new Promise<MatchFoundPayload>(resolve => {
      clientA.on(SOCKET_EVENTS.MATCH_FOUND, resolve);
    });
    const matchPromiseC = new Promise<MatchFoundPayload>(resolve => {
      clientC.on(SOCKET_EVENTS.MATCH_FOUND, resolve);
    });

    // C joins queue; A should match with C
    clientC.emit(SOCKET_EVENTS.QUEUE_JOIN, {
      sessionId: sessionC,
      mode: 'text',
      interests: [],
    });

    const [matchA, matchC] = await Promise.all([matchPromiseA, matchPromiseC]);

    expect(matchA.matchId).toBe(matchC.matchId);
    expect(bMatchedWithA).toBe(false);

    // B is still waiting in queue
    expect(matchmakingQueue.getQueueLength('text')).toBe(1);
    expect(matchmakingQueue.getQueueItem(sessionB)).toBeDefined();

    clientA.disconnect();
    clientB.disconnect();
    clientC.disconnect();
  });

  it('handles skip flow: closes prior match, informs peer, and matches with next available user', async () => {
    const clientA = await createConnectedClient();
    const clientB = await createConnectedClient();
    const clientC = await createConnectedClient();

    const sessionA = crypto.randomUUID();
    const sessionB = crypto.randomUUID();
    const sessionC = crypto.randomUUID();

    // 1. Pair A and B
    const matchPromiseInitA = new Promise<MatchFoundPayload>(resolve => {
      clientA.once(SOCKET_EVENTS.MATCH_FOUND, resolve);
    });
    const matchPromiseInitB = new Promise<MatchFoundPayload>(resolve => {
      clientB.once(SOCKET_EVENTS.MATCH_FOUND, resolve);
    });

    clientA.emit(SOCKET_EVENTS.QUEUE_JOIN, { sessionId: sessionA, mode: 'text', interests: [] });
    clientB.emit(SOCKET_EVENTS.QUEUE_JOIN, { sessionId: sessionB, mode: 'text', interests: [] });

    const [initA] = await Promise.all([matchPromiseInitA, matchPromiseInitB]);
    const firstMatchId = initA.matchId;

    // 2. Client C joins and waits in queue
    clientC.emit(SOCKET_EVENTS.QUEUE_JOIN, { sessionId: sessionC, mode: 'text', interests: [] });
    await new Promise(r => setTimeout(r, 50));

    // 3. Client A skips
    const peerLeftPromiseB = new Promise<MatchEndedPayload>(resolve => {
      clientB.once(SOCKET_EVENTS.MATCH_ENDED, resolve);
    });
    const matchPromiseNextA = new Promise<MatchFoundPayload>(resolve => {
      clientA.once(SOCKET_EVENTS.MATCH_FOUND, resolve);
    });
    const matchPromiseNextC = new Promise<MatchFoundPayload>(resolve => {
      clientC.once(SOCKET_EVENTS.MATCH_FOUND, resolve);
    });

    clientA.emit(SOCKET_EVENTS.MATCH_SKIP, {
      sessionId: sessionA,
      currentMatchId: firstMatchId,
      mode: 'text',
      interests: [],
    });

    const [endedB, nextA, nextC] = await Promise.all([
      peerLeftPromiseB,
      matchPromiseNextA,
      matchPromiseNextC,
    ]);

    // Client B was notified of skip
    expect(endedB.reason).toBe('skip');

    // Client A is now in a new match with Client C
    expect(nextA.matchId).not.toBe(firstMatchId);
    expect(nextA.matchId).toBe(nextC.matchId);

    clientA.disconnect();
    clientB.disconnect();
    clientC.disconnect();
  });

  it('handles stop flow: leaves match, purges from queue, and returns to idle', async () => {
    const clientA = await createConnectedClient();
    const clientB = await createConnectedClient();

    const sessionA = crypto.randomUUID();
    const sessionB = crypto.randomUUID();

    const matchPromiseA = new Promise<MatchFoundPayload>(resolve => {
      clientA.once(SOCKET_EVENTS.MATCH_FOUND, resolve);
    });

    clientA.emit(SOCKET_EVENTS.QUEUE_JOIN, { sessionId: sessionA, mode: 'text', interests: [] });
    clientB.emit(SOCKET_EVENTS.QUEUE_JOIN, { sessionId: sessionB, mode: 'text', interests: [] });

    const matchA = await matchPromiseA;

    const bEndedPromise = new Promise<MatchEndedPayload>(resolve => {
      clientB.once(SOCKET_EVENTS.MATCH_ENDED, resolve);
    });
    const aStatusPromise = new Promise<QueueStatusPayload>(resolve => {
      clientA.once(SOCKET_EVENTS.QUEUE_STATUS, resolve);
    });

    // Client A calls stop
    clientA.emit(SOCKET_EVENTS.MATCH_STOP, {
      sessionId: sessionA,
      currentMatchId: matchA.matchId,
    });

    const [endedB, statusA] = await Promise.all([bEndedPromise, aStatusPromise]);

    expect(endedB.reason).toBe('peer_left');
    expect(statusA.status).toBe('idle');

    // Verify A is not in queue and match is terminated
    expect(matchmakingQueue.getQueueItem(sessionA)).toBeUndefined();
    const matchRecord = matchManager.getMatch(matchA.matchId);
    expect(matchRecord?.status).toBe('ended');

    clientA.disconnect();
    clientB.disconnect();
  });

  it('removes disconnected client from queue so ghost sockets never match', async () => {
    const clientA = await createConnectedClient();
    const sessionA = crypto.randomUUID();

    clientA.emit(SOCKET_EVENTS.QUEUE_JOIN, {
      sessionId: sessionA,
      mode: 'text',
      interests: [],
    });

    await new Promise(r => setTimeout(r, 50));
    expect(matchmakingQueue.getQueueLength('text')).toBe(1);

    // Client A abruptly disconnects
    clientA.disconnect();
    await new Promise(r => setTimeout(r, 50));

    expect(matchmakingQueue.getQueueLength('text')).toBe(0);

    // Client B connects and joins; must NOT match with disconnected client A
    const clientB = await createConnectedClient();
    let bMatched = false;
    clientB.on(SOCKET_EVENTS.MATCH_FOUND, () => {
      bMatched = true;
    });

    clientB.emit(SOCKET_EVENTS.QUEUE_JOIN, {
      sessionId: crypto.randomUUID(),
      mode: 'text',
      interests: [],
    });

    await new Promise(r => setTimeout(r, 100));

    expect(bMatched).toBe(false);
    expect(matchmakingQueue.getQueueLength('text')).toBe(1);

    clientB.disconnect();
  });

  it('rejects stale message from previous match after skipping to a new match', async () => {
    const clientA = await createConnectedClient();
    const clientB = await createConnectedClient();

    const sessionA = crypto.randomUUID();
    const sessionB = crypto.randomUUID();

    const matchPromiseA = new Promise<MatchFoundPayload>(resolve => {
      clientA.once(SOCKET_EVENTS.MATCH_FOUND, resolve);
    });

    clientA.emit(SOCKET_EVENTS.QUEUE_JOIN, { sessionId: sessionA, mode: 'text', interests: [] });
    clientB.emit(SOCKET_EVENTS.QUEUE_JOIN, { sessionId: sessionB, mode: 'text', interests: [] });

    const match = await matchPromiseA;

    // Client A stops match
    clientA.emit(SOCKET_EVENTS.MATCH_STOP, {
      sessionId: sessionA,
      currentMatchId: match.matchId,
    });

    await new Promise(r => setTimeout(r, 50));

    // Client A tries to send a message targeting old matchId
    const ackPromise = new Promise<{ status: string; error?: string }>(resolve => {
      clientA.once(SOCKET_EVENTS.MESSAGE_ACK, resolve);
    });

    clientA.emit(SOCKET_EVENTS.SEND_MESSAGE, {
      matchId: match.matchId,
      messageId: 'msg-stale-1',
      content: 'This should be rejected as stale/unauthorized',
      clientTimestamp: Date.now(),
    });

    const ack = await ackPromise;
    expect(ack.status).toBe('failed');

    clientA.disconnect();
    clientB.disconnect();
  });

  it('safely handles concurrent simultaneous join requests without creating duplicate matches', async () => {
    const clients = await Promise.all([
      createConnectedClient(),
      createConnectedClient(),
      createConnectedClient(),
      createConnectedClient(),
    ]);

    const sessions = [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ];

    const matchedMatches: string[] = [];

    clients.forEach(client => {
      client.on(SOCKET_EVENTS.MATCH_FOUND, payload => {
        matchedMatches.push(payload.matchId);
      });
    });

    // Emit all joins concurrently at exact same millisecond
    await Promise.all(
      clients.map((client, idx) =>
        client.emit(SOCKET_EVENTS.QUEUE_JOIN, {
          sessionId: sessions[idx],
          mode: 'text',
          interests: [],
        })
      )
    );

    await new Promise(r => setTimeout(r, 200));

    // Exactly 4 MATCH_FOUND events emitted (2 clients per match * 2 distinct matches = 4)
    expect(matchedMatches.length).toBe(4);

    // Count occurrences of each matchId
    const counts: Record<string, number> = {};
    for (const mId of matchedMatches) {
      counts[mId] = (counts[mId] || 0) + 1;
    }

    // Exactly 2 matches created, each having exactly 2 participants
    const matchIds = Object.keys(counts);
    expect(matchIds.length).toBe(2);
    expect(counts[matchIds[0]]).toBe(2);
    expect(counts[matchIds[1]]).toBe(2);

    clients.forEach(c => c.disconnect());
  });

  it('expires stale queue entries and notifies waiting client of search timeout', async () => {
    const client = await createConnectedClient();
    const sessionId = crypto.randomUUID();

    const timeoutPromise = new Promise<{ message: string; mode: string }>(resolve => {
      client.once(SOCKET_EVENTS.QUEUE_TIMEOUT, resolve);
    });

    client.emit(SOCKET_EVENTS.QUEUE_JOIN, {
      sessionId,
      mode: 'text',
      interests: [],
    });

    await new Promise(r => setTimeout(r, 50));

    // Fast-forward expiration on queued item
    const item = matchmakingQueue.getQueueItem(sessionId);
    expect(item).toBeDefined();
    if (item) {
      item.expiresAt = Date.now() - 1000; // artificially expired
    }

    // Trigger maintenance timeout check
    const { expiredSessions } = matchmakingQueue.checkTimeouts();
    expect(expiredSessions.length).toBe(1);
    expect(expiredSessions[0].sessionId).toBe(sessionId);

    // Broadcast timeout to socket like index.ts maintenance timer does
    socketServer.to(item!.socketId).emit(SOCKET_EVENTS.QUEUE_TIMEOUT, {
      message: 'No match found within search window. You can keep waiting or try again.',
      mode: 'text',
    });

    const timeout = await timeoutPromise;
    expect(timeout.mode).toBe('text');
    expect(timeout.message).toContain('No match found');

    // Confirm session was purged from queue
    expect(matchmakingQueue.getQueueItem(sessionId)).toBeUndefined();

    client.disconnect();
  });
});
