import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  SOCKET_EVENTS,
  PingPayloadSchema,
  JoinMatchPayloadSchema,
  SendMessagePayloadSchema,
  TypingIndicatorPayloadSchema,
  LeaveMatchPayloadSchema,
  QueueJoinPayloadSchema,
  QueueCancelPayloadSchema,
  MatchSkipPayloadSchema,
  MatchStopPayloadSchema,
  WebRtcOfferPayloadSchema,
  WebRtcAnswerPayloadSchema,
  WebRtcIceCandidatePayloadSchema,
  MAX_MESSAGES_PER_WINDOW,
  RATE_LIMIT_WINDOW_SECONDS,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type InterServerEvents,
  type SocketData,
} from '@zoopie/shared';
import { env } from '../config/env.js';
import { matchManager } from './match-manager.js';
import { matchmakingQueue, type MatchPairResult } from './matchmaking-queue.js';
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

/**
 * Server-authoritative match finalizer:
 * Provisions room in MatchManager, joins sockets, and dispatches events
 */
function finalizeMatch(io: TypedSocketServer, match: MatchPairResult): void {
  const { matchId, mode, initiator, receiver, commonInterests, matchedAt } = match;

  // Register participants in MatchManager
  matchManager.createMatchWithParticipants(
    matchId,
    mode,
    { sessionId: initiator.sessionId, socketId: initiator.socketId },
    { sessionId: receiver.sessionId, socketId: receiver.socketId },
    commonInterests
  );

  const socketInitiator = io.sockets.sockets.get(initiator.socketId);
  const socketReceiver = io.sockets.sockets.get(receiver.socketId);

  const roomKey = `match:${matchId}`;

  if (socketInitiator) {
    socketInitiator.data.sessionId = initiator.sessionId;
    socketInitiator.data.currentMatchId = matchId;
    socketInitiator.join(roomKey);

    socketInitiator.emit(SOCKET_EVENTS.MATCH_FOUND, {
      matchId,
      mode,
      role: 'initiator',
      commonInterests,
      matchedAt,
    });
    socketInitiator.emit(SOCKET_EVENTS.MATCH_JOINED, {
      matchId,
      role: 'initiator',
      peerConnected: true,
      mode,
    });
  }

  if (socketReceiver) {
    socketReceiver.data.sessionId = receiver.sessionId;
    socketReceiver.data.currentMatchId = matchId;
    socketReceiver.join(roomKey);

    socketReceiver.emit(SOCKET_EVENTS.MATCH_FOUND, {
      matchId,
      mode,
      role: 'receiver',
      commonInterests,
      matchedAt,
    });
    socketReceiver.emit(SOCKET_EVENTS.MATCH_JOINED, {
      matchId,
      role: 'receiver',
      peerConnected: true,
      mode,
    });
  }

  logger.info('Match established and sockets connected', {
    matchId,
    mode,
    initiatorSessionId: initiator.sessionId,
    receiverSessionId: receiver.sessionId,
    commonInterests,
  });
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

  // Background queue maintenance timer (purges expired entries, checks fallback pairings)
  const maintenanceTimer = setInterval(() => {
    try {
      const { expiredSessions, newMatches } = matchmakingQueue.checkTimeouts();

      for (const exp of expiredSessions) {
        io.to(exp.socketId).emit(SOCKET_EVENTS.QUEUE_TIMEOUT, {
          message: 'No match found within search window. You can keep waiting or try again.',
          mode: exp.mode,
        });
        io.to(exp.socketId).emit(SOCKET_EVENTS.QUEUE_STATUS, {
          status: 'timeout',
          mode: exp.mode,
          message: 'No match found within search window.',
        });
      }

      for (const match of newMatches) {
        finalizeMatch(io, match);
      }

      matchManager.cleanup();
    } catch (err) {
      logger.error('Error during matchmaking maintenance sweep', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, 2000);

  maintenanceTimer.unref();

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
    // 2. Server-Authoritative Matchmaking (Phase 5)
    // ==========================================
    socket.on(SOCKET_EVENTS.QUEUE_JOIN, payload => {
      const parsed = QueueJoinPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Malformed queue join payload',
          details: parsed.error.format(),
        });
        return;
      }

      const { sessionId, mode, interests } = parsed.data;
      socket.data.sessionId = sessionId;

      // Close prior match before searching again
      const prior = matchManager.leaveAnyActiveMatch(sessionId);
      if (prior.matchEnded && prior.matchId) {
        socket.leave(`match:${prior.matchId}`);
        socket.data.currentMatchId = undefined;
        if (prior.peerSocketId) {
          io.to(prior.peerSocketId).emit(SOCKET_EVENTS.PEER_LEFT, {
            matchId: prior.matchId,
            reason: 'skip',
          });
          io.to(prior.peerSocketId).emit(SOCKET_EVENTS.MATCH_ENDED, {
            matchId: prior.matchId,
            reason: 'skip',
          });
        }
      }

      const result = matchmakingQueue.enqueue({
        sessionId,
        socketId: socket.id,
        mode,
        interests,
      });

      if (result.matched && result.match) {
        finalizeMatch(io, result.match);
      } else {
        if (result.error) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            code: 'SESSION_SUSPENDED',
            message: result.error,
          });
        }
        socket.emit(SOCKET_EVENTS.QUEUE_STATUS, {
          status: result.status,
          mode,
          queuedAt: Date.now(),
          fallbackEligibleAt: result.fallbackEligibleAt,
          message: result.error,
        });
      }
    });

    socket.on(SOCKET_EVENTS.QUEUE_CANCEL, payload => {
      const parsed = QueueCancelPayloadSchema.safeParse(payload);
      const sessionId = parsed.success ? parsed.data.sessionId : socket.data.sessionId;

      if (sessionId) {
        matchmakingQueue.dequeue(sessionId);
        socket.emit(SOCKET_EVENTS.QUEUE_STATUS, {
          status: 'idle',
          mode: 'text',
          message: 'Search cancelled',
        });
      }
    });

    socket.on(SOCKET_EVENTS.MATCH_SKIP, payload => {
      const parsed = MatchSkipPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Malformed skip payload',
        });
        return;
      }

      const { sessionId, mode, interests } = parsed.data;
      const matchId = parsed.data.currentMatchId || socket.data.currentMatchId;

      // 1. Terminate current active match and notify peer
      if (matchId) {
        const leaveResult = matchManager.leaveMatch(matchId, sessionId);
        socket.leave(`match:${matchId}`);
        socket.data.currentMatchId = undefined;

        if (leaveResult.peerSocketId) {
          io.to(leaveResult.peerSocketId).emit(SOCKET_EVENTS.PEER_LEFT, {
            matchId,
            reason: 'skip',
          });
          io.to(leaveResult.peerSocketId).emit(SOCKET_EVENTS.MATCH_ENDED, {
            matchId,
            reason: 'skip',
          });
        }
      }

      // 2. Immediately enqueue for next match
      const result = matchmakingQueue.enqueue({
        sessionId,
        socketId: socket.id,
        mode,
        interests,
      });

      if (result.matched && result.match) {
        finalizeMatch(io, result.match);
      } else {
        if (result.error) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            code: 'SESSION_SUSPENDED',
            message: result.error,
          });
        }
        socket.emit(SOCKET_EVENTS.QUEUE_STATUS, {
          status: result.status,
          mode,
          queuedAt: Date.now(),
          fallbackEligibleAt: result.fallbackEligibleAt,
          message: result.error,
        });
      }
    });

    socket.on(SOCKET_EVENTS.MATCH_STOP, payload => {
      const parsed = MatchStopPayloadSchema.safeParse(payload);
      const sessionId = parsed.success ? parsed.data.sessionId : socket.data.sessionId;
      const matchId =
        parsed.success && parsed.data.currentMatchId
          ? parsed.data.currentMatchId
          : socket.data.currentMatchId;

      if (sessionId) {
        // Immediately remove from queue
        matchmakingQueue.dequeue(sessionId);

        // Terminate current match and inform peer
        if (matchId) {
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

        socket.emit(SOCKET_EVENTS.QUEUE_STATUS, {
          status: 'idle',
          mode: 'text',
          message: 'Stopped search and returned to idle',
        });
      }
    });

    // ==========================================
    // 3. Direct Match Joining (Dev Fixtures & Tests)
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

      const roomKey = `match:${matchId}`;
      socket.join(roomKey);

      socket.emit(SOCKET_EVENTS.MATCH_JOINED, {
        matchId,
        role: joinResult.role,
        peerConnected: joinResult.peerConnected,
        mode: 'text',
      });

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
    // 4. Text Chat: Send Message
    // ==========================================
    socket.on(SOCKET_EVENTS.SEND_MESSAGE, payload => {
      const parsed = SendMessagePayloadSchema.safeParse(payload);
      if (!parsed.success) {
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

      // 4.1 Stale Event & Match ID Check
      if (socket.data.currentMatchId && socket.data.currentMatchId !== matchId) {
        socket.emit(SOCKET_EVENTS.MESSAGE_ACK, {
          messageId,
          status: 'failed',
          error: 'Stale match event: matchId does not match current active match',
        });
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'UNAUTHORIZED_MATCH',
          message: 'Event matchId does not match active match',
        });
        return;
      }

      // 4.2 Authorization Check: Must be an authorized participant
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

      // 4.3 Match State Check
      const match = matchManager.getMatch(matchId);
      if (!match || match.status !== 'active') {
        socket.emit(SOCKET_EVENTS.MESSAGE_ACK, {
          messageId,
          status: 'failed',
          error: 'Match is waiting for partner or has ended',
        });
        return;
      }

      // 4.4 Rate Limit Enforcement
      if (!checkSocketMessageRateLimit(socket)) {
        socket.emit(SOCKET_EVENTS.MESSAGE_ACK, {
          messageId,
          status: 'failed',
          error: 'Rate limit exceeded: You are sending messages too quickly',
        });
        return;
      }

      // 4.5 Duplicate Delivery Prevention
      const isNew = matchManager.recordMessageId(matchId, messageId);
      if (!isNew) {
        socket.emit(SOCKET_EVENTS.MESSAGE_ACK, {
          messageId,
          status: 'delivered',
        });
        return;
      }

      // 4.6 Ephemeral Relay to Peer (Zero DB persistence)
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
    // 5. Typing Indicator
    // ==========================================
    socket.on(SOCKET_EVENTS.TYPING_INDICATOR, payload => {
      const parsed = TypingIndicatorPayloadSchema.safeParse(payload);
      if (!parsed.success) return;

      const { matchId, isTyping } = parsed.data;
      const sessionId = socket.data.sessionId;

      if (!sessionId || !matchManager.isAuthorizedParticipant(matchId, sessionId)) {
        return;
      }

      if (socket.data.currentMatchId && socket.data.currentMatchId !== matchId) {
        return;
      }

      const roomKey = `match:${matchId}`;
      socket.to(roomKey).emit(SOCKET_EVENTS.PEER_TYPING, {
        matchId,
        isTyping,
      });
    });

    // ==========================================
    // 6. Direct Match Leaving
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
    // 7. WebRTC Audio/Video Signaling
    // ==========================================
    socket.on(SOCKET_EVENTS.SIGNAL_OFFER, payload => {
      const parsed = WebRtcOfferPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Malformed WebRTC offer payload',
          details: parsed.error.format(),
        });
        return;
      }

      const { matchId, sdp, type } = parsed.data;
      const sessionId = socket.data.sessionId;

      if (socket.data.currentMatchId && socket.data.currentMatchId !== matchId) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'UNAUTHORIZED_MATCH',
          message: 'Offer matchId does not match current active match',
        });
        return;
      }

      if (!sessionId || !matchManager.isAuthorizedParticipant(matchId, sessionId)) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'UNAUTHORIZED_MATCH',
          message: 'Unauthorized: Cannot send WebRTC offer to unauthorized match',
        });
        return;
      }

      const roomKey = `match:${matchId}`;
      socket.to(roomKey).emit(SOCKET_EVENTS.SIGNAL_OFFER, {
        matchId,
        sdp,
        type,
      });

      logger.info('WebRTC offer relayed', {
        matchId,
        sessionId,
      });
    });

    socket.on(SOCKET_EVENTS.SIGNAL_ANSWER, payload => {
      const parsed = WebRtcAnswerPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Malformed WebRTC answer payload',
          details: parsed.error.format(),
        });
        return;
      }

      const { matchId, sdp, type } = parsed.data;
      const sessionId = socket.data.sessionId;

      if (socket.data.currentMatchId && socket.data.currentMatchId !== matchId) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'UNAUTHORIZED_MATCH',
          message: 'Answer matchId does not match current active match',
        });
        return;
      }

      if (!sessionId || !matchManager.isAuthorizedParticipant(matchId, sessionId)) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'UNAUTHORIZED_MATCH',
          message: 'Unauthorized: Cannot send WebRTC answer to unauthorized match',
        });
        return;
      }

      const roomKey = `match:${matchId}`;
      socket.to(roomKey).emit(SOCKET_EVENTS.SIGNAL_ANSWER, {
        matchId,
        sdp,
        type,
      });

      logger.info('WebRTC answer relayed', {
        matchId,
        sessionId,
      });
    });

    socket.on(SOCKET_EVENTS.SIGNAL_ICE_CANDIDATE, payload => {
      const parsed = WebRtcIceCandidatePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Malformed WebRTC ICE candidate payload',
          details: parsed.error.format(),
        });
        return;
      }

      const { matchId, candidate } = parsed.data;
      const sessionId = socket.data.sessionId;

      if (socket.data.currentMatchId && socket.data.currentMatchId !== matchId) {
        return; // Silently drop stale candidate
      }

      if (!sessionId || !matchManager.isAuthorizedParticipant(matchId, sessionId)) {
        return; // Silently drop unauthorized candidate
      }

      const roomKey = `match:${matchId}`;
      socket.to(roomKey).emit(SOCKET_EVENTS.SIGNAL_ICE_CANDIDATE, {
        matchId,
        candidate,
      });
    });

    // ==========================================
    // 8. Disconnect Handling
    // ==========================================
    socket.on('disconnect', () => {
      // Remove from matchmaking queues
      matchmakingQueue.dequeueBySocketId(socket.id);
      if (socket.data.sessionId) {
        matchmakingQueue.dequeue(socket.data.sessionId);
      }

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
