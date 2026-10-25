import { z } from 'zod';

export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_MESSAGES_PER_WINDOW = 5;
export const RATE_LIMIT_WINDOW_SECONDS = 2;

export const JoinMatchPayloadSchema = z.object({
  matchId: z.string().min(1).max(128),
  sessionId: z.string().uuid({ message: 'Session ID must be a valid UUID' }),
  participantToken: z.string().max(256).optional(),
});

export const MatchJoinedPayloadSchema = z.object({
  matchId: z.string(),
  role: z.enum(['initiator', 'receiver']),
  peerConnected: z.boolean(),
  mode: z.enum(['text', 'video']),
});

export const PeerJoinedPayloadSchema = z.object({
  matchId: z.string(),
});

export const PeerLeftPayloadSchema = z.object({
  matchId: z.string(),
  reason: z.string(),
});

export const SendMessagePayloadSchema = z.object({
  matchId: z.string().min(1).max(128),
  messageId: z.string().min(1).max(64),
  content: z
    .string()
    .trim()
    .min(1, { message: 'Message content cannot be empty' })
    .max(MAX_MESSAGE_LENGTH, {
      message: `Message content exceeds maximum allowed length of ${MAX_MESSAGE_LENGTH} characters`,
    }),
  clientTimestamp: z.number().positive(),
});

export const ReceiveMessagePayloadSchema = z.object({
  matchId: z.string(),
  messageId: z.string(),
  content: z.string().max(MAX_MESSAGE_LENGTH),
  timestamp: z.number().positive(),
  sender: z.literal('peer'),
});

export const MessageAckPayloadSchema = z.object({
  messageId: z.string(),
  status: z.enum(['delivered', 'failed']),
  error: z.string().optional(),
});

export const TypingIndicatorPayloadSchema = z.object({
  matchId: z.string().min(1).max(128),
  isTyping: z.boolean(),
});

export const PeerTypingPayloadSchema = z.object({
  matchId: z.string(),
  isTyping: z.boolean(),
});

export const LeaveMatchPayloadSchema = z.object({
  matchId: z.string().min(1).max(128),
  reason: z.string().max(100).optional(),
});

export const MatchEndedPayloadSchema = z.object({
  matchId: z.string(),
  reason: z.enum([
    'peer_disconnected',
    'peer_left',
    'match_expired',
    'reported',
    'timeout',
    'manual',
  ]),
});

export type JoinMatchPayload = z.infer<typeof JoinMatchPayloadSchema>;
export type MatchJoinedPayload = z.infer<typeof MatchJoinedPayloadSchema>;
export type PeerJoinedPayload = z.infer<typeof PeerJoinedPayloadSchema>;
export type PeerLeftPayload = z.infer<typeof PeerLeftPayloadSchema>;
export type SendMessagePayload = z.infer<typeof SendMessagePayloadSchema>;
export type ReceiveMessagePayload = z.infer<typeof ReceiveMessagePayloadSchema>;
export type MessageAckPayload = z.infer<typeof MessageAckPayloadSchema>;
export type TypingIndicatorPayload = z.infer<typeof TypingIndicatorPayloadSchema>;
export type PeerTypingPayload = z.infer<typeof PeerTypingPayloadSchema>;
export type LeaveMatchPayload = z.infer<typeof LeaveMatchPayloadSchema>;
export type MatchEndedPayload = z.infer<typeof MatchEndedPayloadSchema>;
