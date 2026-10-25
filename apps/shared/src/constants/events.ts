export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error',

  // Match lifecycle events
  JOIN_MATCH: 'match:join',
  MATCH_JOINED: 'match:joined',
  PEER_JOINED: 'peer:joined',
  PEER_LEFT: 'peer:left',
  LEAVE_MATCH: 'match:leave',
  MATCH_ENDED: 'match:ended',

  // Real-time text chat events
  SEND_MESSAGE: 'chat:send',
  RECEIVE_MESSAGE: 'chat:message',
  MESSAGE_ACK: 'chat:ack',
  TYPING_INDICATOR: 'chat:typing',
  PEER_TYPING: 'peer:typing',

  // Server-authoritative matchmaking events
  QUEUE_JOIN: 'matchmaking:join',
  QUEUE_CANCEL: 'matchmaking:cancel',
  QUEUE_STATUS: 'matchmaking:status',
  QUEUE_TIMEOUT: 'matchmaking:timeout',
  MATCH_FOUND: 'matchmaking:found',
  MATCH_SKIP: 'matchmaking:skip',
  MATCH_STOP: 'matchmaking:stop',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
