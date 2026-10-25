import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  SOCKET_EVENTS,
  PingPayloadSchema,
  JoinMatchPayloadSchema,
  SendMessagePayloadSchema,
  TypingIndicatorPayloadSchema,
  LeaveMatchPayloadSchema,
  MAX_MESSAGES_PER_WINDOW,
  RATE_LIMIT_WINDOW_SECONDS,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type InterServerEvents,
  type SocketData,
} from '@zoopie/shared';
import { env } from '../config/env.js';
import { matchManager } from './match-manager.js';
import { logger } from '../utils/logger.js';

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

/**
 * Checks sliding-window rate limit for a connected socket
 */
function checkSocketMessageRateLimit(socket: TypedSocket): boolean {
  const now = Date.now();
  const windowMs = RATE_LIMIT_WINDOW_SECONDS * 1000;

  if (!socket.data.messageTimestamps) {
    socket.data.messageTimestamps = [];
  }

  // Filter timestamps within current window
  socket.data.messageTimestamps = socket.data.messageTimestamps.filter(t => now - t < windowMs);

  if (socket.data.messageTimestamps.length >= MAX_MESSAGES_PER_WINDOW) {
    return false; // Rate limit exceeded
  }

  socket.data.messageTimestamps.push(now);
  return true;
}

export function initSocketServer(httpServer: HttpServer): TypedSocketServer {
  const allowedOrigins =
    env.CLIENT_ORIGIN === '*' ? '*' : env.CLIENT_ORIGIN.split(',').map(o => o.trim());

  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  io.on('connection', (socket: TypedSocket) => {
    socket.data.connectedAt = Date.now();
    socket.data.messageTimestamps = [];

    // ==========================================
    // 1. Core Health Ping / Pong (Phase 1)
    // ==========================================
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

    // ==========================================
    // 2. Match Lifecycle: Join Match Room
    // ==========================================
    socket.on(SOCKET_EVENTS.JOIN_MATCH, payload => {
      const parsed = JoinMatchPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Malformed join match payload',
          details: parsed.error.format(),
        });
        return;
      }

      const { matchId, sessionId } = parsed.data;

      // Register session and socket in match manager
      const joinResult = matchManager.joinMatch(matchId, sessionId, socket.id);

      if (!joinResult.success) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'JOIN_FAILED',
          message: joinResult.error || 'Unable to join match',
        });
        return;
      }

      socket.data.sessionId = sessionId;
      socket.data.currentMatchId = matchId;

      // Join isolated Socket.IO room for this match
      const roomKey = `match:${matchId}`;
      socket.join(roomKey);

      // Confirm match join to requesting socket
      socket.emit(SOCKET_EVENTS.MATCH_JOINED, {
        matchId,
        role: joinResult.role,
        peerConnected: joinResult.peerConnected,
        mode: 'text',
      });

      // If peer is already in the room, notify them
      if (joinResult.peerSocketId) {
        io.to(joinResult.peerSocketId).emit(SOCKET_EVENTS.PEER_JOINED, { matchId });
      }

      logger.info('Participant joined match room', {
        matchId,
        sessionId,
        role: joinResult.role,
      });
    });

    // ==========================================
    // 3. Text Chat: Send Message
    // ==========================================
    socket.on(SOCKET_EVENTS.SEND_MESSAGE, payload => {
      const parsed = SendMessagePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        // Emit explicit failure acknowledgement
        const rawMessageId =
          typeof payload === 'object' && payload !== null && 'messageId' in payload
            ? String((payload as { messageId: unknown }).messageId)
            : 'unknown';

        socket.emit(SOCKET_EVENTS.MESSAGE_ACK, {
          messageId: rawMessageId,
          status: 'failed',
          error: parsed.error.issues[0]?.message || 'Invalid message payload',
        });
        return;
      }

      const { matchId, messageId, content } = parsed.data;
      const sessionId = socket.data.sessionId;

      // 3.1 Authorization Check: Must be an authorized participant
      if (!sessionId || !matchManager.isAuthorizedParticipant(matchId, sessionId)) {
        socket.emit(SOCKET_EVENTS.MESSAGE_ACK, {
          messageId,
          status: 'failed',
          error: 'Unauthorized: You are not an active participant in this match',
        });
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'UNAUTHORIZED_MATCH',
          message: 'Cannot send messages to unauthorized or inactive match',
        });
        return;
      }

      // 3.2 Match State Check
      const match = matchManager.getMatch(matchId);
      if (!match || match.status !== 'active') {
        socket.emit(SOCKET_EVENTS.MESSAGE_ACK, {
          messageId,
          status: 'failed',
          error: 'Match is waiting for partner or has ended',
        });
        return;
      }

      // 3.3 Rate Limit Enforcement
      if (!checkSocketMessageRateLimit(socket)) {
        socket.emit(SOCKET_EVENTS.MESSAGE_ACK, {
          messageId,
          status: 'failed',
          error: 'Rate limit exceeded: You are sending messages too quickly',
        });
        return;
      }

      // 3.4 Duplicate Delivery Prevention
      const isNew = matchManager.recordMessageId(matchId, messageId);
      if (!isNew) {
        // Acknowledge duplicate idempotently without re-broadcasting
        socket.emit(SOCKET_EVENTS.MESSAGE_ACK, {
          messageId,
          status: 'delivered',
        });
        return;
      }

      // 3.5 Ephemeral Relay to Peer (Zero DB persistence)
      const roomKey = `match:${matchId}`;
      socket.to(roomKey).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, {
        matchId,
        messageId,
        content,
        timestamp: Date.now(),
        sender: 'peer',
      });

      // Acknowledge delivery success to sender
      socket.emit(SOCKET_EVENTS.MESSAGE_ACK, {
        messageId,
        status: 'delivered',
      });
    });

    // ==========================================
    // 4. Typing Indicator
    // ==========================================
    socket.on(SOCKET_EVENTS.TYPING_INDICATOR, payload => {
      const parsed = TypingIndicatorPayloadSchema.safeParse(payload);
      if (!parsed.success) return;

      const { matchId, isTyping } = parsed.data;
      const sessionId = socket.data.sessionId;

      if (!sessionId || !matchManager.isAuthorizedParticipant(matchId, sessionId)) {
        return;
      }

      const roomKey = `match:${matchId}`;
      socket.to(roomKey).emit(SOCKET_EVENTS.PEER_TYPING, {
        matchId,
        isTyping,
      });
    });

    // ==========================================
    // 5. Leave Match
    // ==========================================
    socket.on(SOCKET_EVENTS.LEAVE_MATCH, payload => {
      const parsed = LeaveMatchPayloadSchema.safeParse(payload);
      const matchId = parsed.success ? parsed.data.matchId : socket.data.currentMatchId;
      const sessionId = socket.data.sessionId;

      if (matchId && sessionId) {
        const leaveResult = matchManager.leaveMatch(matchId, sessionId);
        socket.leave(`match:${matchId}`);
        socket.data.currentMatchId = undefined;

        if (leaveResult.peerSocketId) {
          io.to(leaveResult.peerSocketId).emit(SOCKET_EVENTS.PEER_LEFT, {
            matchId,
            reason: 'peer_left',
          });
          io.to(leaveResult.peerSocketId).emit(SOCKET_EVENTS.MATCH_ENDED, {
            matchId,
            reason: 'peer_left',
          });
        }
      }
    });

    // ==========================================
    // 6. Disconnect Handling
    // ==========================================
    socket.on('disconnect', () => {
      const matchId = socket.data.currentMatchId;
      const sessionId = socket.data.sessionId;

      if (matchId && sessionId) {
        const leaveResult = matchManager.leaveMatch(matchId, sessionId);
        if (leaveResult.peerSocketId) {
          io.to(leaveResult.peerSocketId).emit(SOCKET_EVENTS.PEER_LEFT, {
            matchId,
            reason: 'peer_disconnected',
          });
          io.to(leaveResult.peerSocketId).emit(SOCKET_EVENTS.MATCH_ENDED, {
            matchId,
            reason: 'peer_disconnected',
          });
        }
      }
    });
  });

  return io;
}
