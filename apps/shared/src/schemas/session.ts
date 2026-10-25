import { z } from 'zod';

export const SessionStatusSchema = z.enum(['ACTIVE', 'DISCONNECTED', 'BANNED']);

export const CreateSessionRequestSchema = z.object({
  clientCapabilities: z
    .object({
      hasVideo: z.boolean().optional(),
      hasAudio: z.boolean().optional(),
    })
    .optional(),
});

export const SessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  status: SessionStatusSchema,
  createdAt: z.string(),
});

export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
