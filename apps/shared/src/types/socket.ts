import type { PingPayload, PongPayload } from '../schemas/socket.js';
import type {
  JoinMatchPayload,
  MatchJoinedPayload,
  PeerJoinedPayload,
  PeerLeftPayload,
  SendMessagePayload,
  ReceiveMessagePayload,
  MessageAckPayload,
  TypingIndicatorPayload,
  PeerTypingPayload,
  LeaveMatchPayload,
  MatchEndedPayload,
} from '../schemas/chat.js';
import type {
  QueueJoinPayload,
  QueueCancelPayload,
  MatchSkipPayload,
  MatchStopPayload,
  QueueStatusPayload,
  QueueTimeoutPayload,
  MatchFoundPayload,
} from '../schemas/matchmaking.js';

export interface ServerToClientEvents {
  pong: (payload: PongPayload) => void;
  error: (error: { code: string; message: string; details?: unknown }) => void;

  // Match lifecycle
  'match:joined': (payload: MatchJoinedPayload) => void;
  'peer:joined': (payload: PeerJoinedPayload) => void;
  'peer:left': (payload: PeerLeftPayload) => void;
  'match:ended': (payload: MatchEndedPayload) => void;

  // Real-time text chat
  'chat:message': (payload: ReceiveMessagePayload) => void;
  'chat:ack': (payload: MessageAckPayload) => void;
  'peer:typing': (payload: PeerTypingPayload) => void;

  // Server-authoritative matchmaking
  'matchmaking:status': (payload: QueueStatusPayload) => void;
  'matchmaking:found': (payload: MatchFoundPayload) => void;
  'matchmaking:timeout': (payload: QueueTimeoutPayload) => void;
}

export interface ClientToServerEvents {
  ping: (payload: PingPayload) => void;

  // Match lifecycle
  'match:join': (payload: JoinMatchPayload) => void;
  'match:leave': (payload: LeaveMatchPayload) => void;

  // Real-time text chat
  'chat:send': (payload: SendMessagePayload) => void;
  'chat:typing': (payload: TypingIndicatorPayload) => void;

  // Server-authoritative matchmaking
  'matchmaking:join': (payload: QueueJoinPayload) => void;
  'matchmaking:cancel': (payload: QueueCancelPayload) => void;
  'matchmaking:skip': (payload: MatchSkipPayload) => void;
  'matchmaking:stop': (payload: MatchStopPayload) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  sessionId?: string;
  currentMatchId?: string;
  connectedAt: number;
  messageTimestamps?: number[];
}
