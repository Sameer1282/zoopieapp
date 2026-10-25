import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  SOCKET_EVENTS,
  PingPayloadSchema,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type InterServerEvents,
  type SocketData,
} from '@zoopie/shared';
import { env } from '../config/env.js';

export type TypedSocketServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function initSocketServer(httpServer: HttpServer): TypedSocketServer {
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN === '*' ? '*' : env.CLIENT_ORIGIN.split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  io.on('connection', (socket: TypedSocket) => {
    socket.data.connectedAt = Date.now();
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Ping / Pong test handler
    socket.on(SOCKET_EVENTS.PING, payload => {
      const parsed = PingPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Payload does not match PingPayloadSchema',
        });
        return;
      }

      socket.emit(SOCKET_EVENTS.PONG, {
        clientTimestamp: parsed.data.clientTimestamp,
        serverTimestamp: Date.now(),
        message: 'Zoopie Socket.IO Pong Response',
      });
    });

    socket.on('disconnect', reason => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (reason: ${reason})`);
    });
  });

  return io;
}
