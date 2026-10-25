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

export interface ServerToClientEvents {
  pong: (payload: PongPayload) => void;
  error: (error: { code: string; message: string; details?: unknown }) => void;

  // Match lifecycle
  'match:joined': (payload: MatchJoinedPayload) => void;
  'peer:joined': (payload: PeerJoinedPayload) => void;
  'peer:left': (payload: PeerLeftPayload) => void;
  'match:ended': (payload: MatchEndedPayload) => void;

  // Text chat
  'chat:message': (payload: ReceiveMessagePayload) => void;
  'chat:ack': (payload: MessageAckPayload) => void;
  'peer:typing': (payload: PeerTypingPayload) => void;
}

export interface ClientToServerEvents {
  ping: (payload: PingPayload) => void;

  // Match lifecycle
  'match:join': (payload: JoinMatchPayload) => void;
  'match:leave': (payload: LeaveMatchPayload) => void;

  // Text chat
  'chat:send': (payload: SendMessagePayload) => void;
  'chat:typing': (payload: TypingIndicatorPayload) => void;
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
