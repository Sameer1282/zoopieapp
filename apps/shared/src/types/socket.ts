import type { PingPayload, PongPayload } from '../schemas/socket.js';

export interface ServerToClientEvents {
  pong: (payload: PongPayload) => void;
  error: (error: { code: string; message: string }) => void;
}

export interface ClientToServerEvents {
  ping: (payload: PingPayload) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  sessionId?: string;
  connectedAt: number;
}
