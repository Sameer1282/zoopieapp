import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import { initSocketServer, type TypedSocketServer } from '../src/socket/index.js';
import { matchManager } from '../src/socket/match-manager.js';
import {
  SOCKET_EVENTS,
  type ServerToClientEvents,
  type ClientToServerEvents,
} from '@zoopie/shared';
import crypto from 'node:crypto';

describe('Phase 4 Real-Time Socket Layer & Text Chat', () => {
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
        ioServer.close(() => {
          httpServer.close(() => {
            resolve();
          });
        });
      })
  );

  beforeEach(() => {
    matchManager.reset();
  });

  it('allows two clients to join a match, exchange messages, and acknowledge delivery', async () => {
    const clientA = await createConnectedClient();
    const clientB = await createConnectedClient();
    const matchId = 'test-match-auth-1';
    const sessionA = crypto.randomUUID();
    const sessionB = crypto.randomUUID();

    try {
      // Client A joins
      await new Promise<void>(resolve => {
        clientA.on(SOCKET_EVENTS.MATCH_JOINED, payload => {
          expect(payload.matchId).toBe(matchId);
          expect(payload.role).toBe('initiator');
          resolve();
        });
        clientA.emit(SOCKET_EVENTS.JOIN_MATCH, { matchId, sessionId: sessionA });
      });

      // Client B joins -> peer:joined fired to A, match:joined fired to B
      await new Promise<void>(resolve => {
        let bJoined = false;
        let aNotified = false;

        clientA.on(SOCKET_EVENTS.PEER_JOINED, payload => {
          expect(payload.matchId).toBe(matchId);
          aNotified = true;
          if (bJoined && aNotified) resolve();
        });

        clientB.on(SOCKET_EVENTS.MATCH_JOINED, payload => {
          expect(payload.matchId).toBe(matchId);
          expect(payload.role).toBe('receiver');
          expect(payload.peerConnected).toBe(true);
          bJoined = true;
          if (bJoined && aNotified) resolve();
        });

        clientB.emit(SOCKET_EVENTS.JOIN_MATCH, { matchId, sessionId: sessionB });
      });

      // Send message from A to B
      const messageId = 'msg-test-101';
      const textContent = 'Hello from Client A! Privacy-first real-time chat.';

      await new Promise<void>((resolve, reject) => {
        let ackReceived = false;
        let peerReceived = false;

        clientA.on(SOCKET_EVENTS.MESSAGE_ACK, ack => {
          expect(ack.messageId).toBe(messageId);
          expect(ack.status).toBe('delivered');
          ackReceived = true;
          if (ackReceived && peerReceived) resolve();
        });

        clientB.on(SOCKET_EVENTS.RECEIVE_MESSAGE, msg => {
          expect(msg.matchId).toBe(matchId);
          expect(msg.messageId).toBe(messageId);
          expect(msg.content).toBe(textContent);
          expect(msg.sender).toBe('peer');
          peerReceived = true;
          if (ackReceived && peerReceived) resolve();
        });

        clientA.emit(SOCKET_EVENTS.SEND_MESSAGE, {
          matchId,
          messageId,
          content: textContent,
          clientTimestamp: Date.now(),
        });

        setTimeout(() => reject(new Error('Message exchange timed out')), 4000);
      });
    } finally {
      clientA.disconnect();
      clientB.disconnect();
    }
  });

  it('rejects message sent to unauthorized match or non-member client', async () => {
    const clientA = await createConnectedClient();
    const rogueClient = await createConnectedClient();
    const matchId = 'test-match-isolated-1';
    const sessionA = crypto.randomUUID();

    try {
      await new Promise<void>(resolve => {
        clientA.on(SOCKET_EVENTS.MATCH_JOINED, () => resolve());
        clientA.emit(SOCKET_EVENTS.JOIN_MATCH, { matchId, sessionId: sessionA });
      });

      await new Promise<void>((resolve, reject) => {
        rogueClient.on(SOCKET_EVENTS.MESSAGE_ACK, ack => {
          expect(ack.status).toBe('failed');
          expect(ack.error).toContain('Unauthorized');
          resolve();
        });

        rogueClient.on(SOCKET_EVENTS.ERROR, err => {
          expect(err.code).toBe('UNAUTHORIZED_MATCH');
        });

        rogueClient.emit(SOCKET_EVENTS.SEND_MESSAGE, {
          matchId,
          messageId: 'rogue-msg-1',
          content: 'I should be rejected',
          clientTimestamp: Date.now(),
        });

        setTimeout(() => reject(new Error('Rogue rejection timed out')), 4000);
      });
    } finally {
      clientA.disconnect();
      rogueClient.disconnect();
    }
  });

  it('rejects oversized messages exceeding MAX_MESSAGE_LENGTH', async () => {
    const clientA = await createConnectedClient();
    const matchId = 'test-match-length-1';
    const sessionA = crypto.randomUUID();

    try {
      await new Promise<void>(resolve => {
        clientA.on(SOCKET_EVENTS.MATCH_JOINED, () => resolve());
        clientA.emit(SOCKET_EVENTS.JOIN_MATCH, { matchId, sessionId: sessionA });
      });

      const oversizedContent = 'X'.repeat(1200);

      await new Promise<void>((resolve, reject) => {
        clientA.on(SOCKET_EVENTS.MESSAGE_ACK, ack => {
          expect(ack.status).toBe('failed');
          expect(ack.error).toContain('1000');
          resolve();
        });

        clientA.emit(SOCKET_EVENTS.SEND_MESSAGE, {
          matchId,
          messageId: 'oversized-msg',
          content: oversizedContent,
          clientTimestamp: Date.now(),
        });

        setTimeout(() => reject(new Error('Oversized rejection timed out')), 4000);
      });
    } finally {
      clientA.disconnect();
    }
  });

  it('enforces socket message rate limiting on high-frequency flood', async () => {
    const clientA = await createConnectedClient();
    const clientB = await createConnectedClient();
    const matchId = 'test-match-rate-1';
    const sessionA = crypto.randomUUID();
    const sessionB = crypto.randomUUID();

    try {
      await new Promise<void>(resolve => {
        clientA.on(SOCKET_EVENTS.MATCH_JOINED, () => {
          clientB.emit(SOCKET_EVENTS.JOIN_MATCH, { matchId, sessionId: sessionB });
        });
        clientB.on(SOCKET_EVENTS.MATCH_JOINED, () => resolve());
        clientA.emit(SOCKET_EVENTS.JOIN_MATCH, { matchId, sessionId: sessionA });
      });

      const ackStatuses: string[] = [];

      await new Promise<void>(resolve => {
        clientA.on(SOCKET_EVENTS.MESSAGE_ACK, ack => {
          ackStatuses.push(ack.status);
          if (ackStatuses.length === 8) {
            resolve();
          }
        });

        for (let i = 0; i < 8; i++) {
          clientA.emit(SOCKET_EVENTS.SEND_MESSAGE, {
            matchId,
            messageId: `flood-msg-${i}`,
            content: `Flood test message #${i}`,
            clientTimestamp: Date.now(),
          });
        }
      });

      expect(ackStatuses.filter(s => s === 'delivered').length).toBeLessThanOrEqual(5);
      expect(ackStatuses.some(s => s === 'failed')).toBe(true);
    } finally {
      clientA.disconnect();
      clientB.disconnect();
    }
  });

  it('notifies peer when a participant disconnects', async () => {
    const clientA = await createConnectedClient();
    const clientB = await createConnectedClient();
    const matchId = 'test-match-disconnect-1';
    const sessionA = crypto.randomUUID();
    const sessionB = crypto.randomUUID();

    try {
      await new Promise<void>(resolve => {
        clientA.on(SOCKET_EVENTS.MATCH_JOINED, () => {
          clientB.emit(SOCKET_EVENTS.JOIN_MATCH, { matchId, sessionId: sessionB });
        });
        clientB.on(SOCKET_EVENTS.MATCH_JOINED, () => resolve());
        clientA.emit(SOCKET_EVENTS.JOIN_MATCH, { matchId, sessionId: sessionA });
      });

      await new Promise<void>((resolve, reject) => {
        clientA.on(SOCKET_EVENTS.MATCH_ENDED, payload => {
          expect(payload.matchId).toBe(matchId);
          expect(payload.reason).toBe('peer_disconnected');
          resolve();
        });

        clientB.disconnect();
        setTimeout(() => reject(new Error('Peer disconnect notification timed out')), 4000);
      });
    } finally {
      clientA.disconnect();
    }
  });
});
