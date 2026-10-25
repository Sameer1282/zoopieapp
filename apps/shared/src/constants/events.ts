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
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
