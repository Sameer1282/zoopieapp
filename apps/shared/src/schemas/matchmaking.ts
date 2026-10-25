import { z } from 'zod';

export const MAX_INTEREST_TAGS = 10;
export const MAX_TAG_LENGTH = 30;
export const INTEREST_FALLBACK_DELAY_MS = 10_000; // 10s before expanding to general pool
export const QUEUE_TIMEOUT_MS = 60_000; // 60s max wait before queue expiry notification

export const QueueJoinPayloadSchema = z.object({
  sessionId: z.string().uuid({ message: 'Session ID must be a valid UUID' }),
  mode: z.enum(['text', 'video']),
  interests: z
    .array(
      z
        .string()
        .trim()
        .min(1, { message: 'Interest tag cannot be empty' })
        .max(MAX_TAG_LENGTH, {
          message: `Interest tag cannot exceed ${MAX_TAG_LENGTH} characters`,
        })
    )
    .max(MAX_INTEREST_TAGS, {
      message: `Cannot specify more than ${MAX_INTEREST_TAGS} interests`,
    })
    .default([]),
});

export const QueueCancelPayloadSchema = z.object({
  sessionId: z.string().uuid({ message: 'Session ID must be a valid UUID' }),
});

export const MatchSkipPayloadSchema = z.object({
  sessionId: z.string().uuid({ message: 'Session ID must be a valid UUID' }),
  currentMatchId: z.string().max(128).optional(),
  mode: z.enum(['text', 'video']),
  interests: z
    .array(z.string().trim().min(1).max(MAX_TAG_LENGTH))
    .max(MAX_INTEREST_TAGS)
    .default([]),
});

export const MatchStopPayloadSchema = z.object({
  sessionId: z.string().uuid({ message: 'Session ID must be a valid UUID' }),
  currentMatchId: z.string().max(128).optional(),
});

export const QueueStatusPayloadSchema = z.object({
  status: z.enum(['searching', 'waiting', 'idle', 'timeout', 'matched']),
  mode: z.enum(['text', 'video']),
  queuedAt: z.number().positive().optional(),
  fallbackEligibleAt: z.number().positive().optional(),
  message: z.string().optional(),
});

export const QueueTimeoutPayloadSchema = z.object({
  message: z.string(),
  mode: z.enum(['text', 'video']),
});

export const MatchFoundPayloadSchema = z.object({
  matchId: z.string(),
  mode: z.enum(['text', 'video']),
  role: z.enum(['initiator', 'receiver']),
  commonInterests: z.array(z.string()),
  matchedAt: z.number().positive(),
});

export type QueueJoinPayload = z.infer<typeof QueueJoinPayloadSchema>;
export type QueueCancelPayload = z.infer<typeof QueueCancelPayloadSchema>;
export type MatchSkipPayload = z.infer<typeof MatchSkipPayloadSchema>;
export type MatchStopPayload = z.infer<typeof MatchStopPayloadSchema>;
export type QueueStatusPayload = z.infer<typeof QueueStatusPayloadSchema>;
export type QueueTimeoutPayload = z.infer<typeof QueueTimeoutPayloadSchema>;
export type MatchFoundPayload = z.infer<typeof MatchFoundPayloadSchema>;
