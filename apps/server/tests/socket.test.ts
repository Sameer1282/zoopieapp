import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import { initSocketServer, type TypedSocketServer } from '../src/socket/index.js';
import {
  SOCKET_EVENTS,
  type ServerToClientEvents,
  type ClientToServerEvents,
} from '@zoopie/shared';

describe('Socket.IO Connection and Ping/Pong Test', () => {
  let httpServer: HttpServer;
  let ioServer: TypedSocketServer;
  let clientSocket: ClientSocket<ServerToClientEvents, ClientToServerEvents>;
  let port: number;

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
        if (clientSocket?.connected) {
          clientSocket.disconnect();
        }
        ioServer.close(() => {
          httpServer.close(() => {
            resolve();
          });
        });
      })
  );

  it('connects successfully and responds to ping with pong', () =>
    new Promise<void>((resolve, reject) => {
      clientSocket = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        autoConnect: true,
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);

        const now = Date.now();
        clientSocket.emit(SOCKET_EVENTS.PING, { clientTimestamp: now, nonce: 'test-123' });
      });

      clientSocket.on(SOCKET_EVENTS.PONG, payload => {
        try {
          expect(payload).toBeDefined();
          expect(typeof payload.serverTimestamp).toBe('number');
          expect(payload.serverTimestamp).toBeGreaterThan(0);
          expect(payload.message).toContain('Zoopie Socket.IO');
          clientSocket.disconnect();
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      clientSocket.on('connect_error', err => {
        reject(err);
      });
    }));
});
