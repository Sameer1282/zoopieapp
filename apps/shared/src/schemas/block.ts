import { z } from 'zod';

export const CreateBlockRequestSchema = z.object({
  blockerSessionId: z.string().uuid({ message: 'Blocker session must be a valid UUID' }),
  blockedFingerprint: z
    .string()
    .min(16, { message: 'Fingerprint must be at least 16 characters' })
    .max(128, { message: 'Fingerprint cannot exceed 128 characters' }),
  reason: z.string().max(255).optional(),
});

export const BlockResponseSchema = z.object({
  id: z.string().uuid(),
  blockerSessionId: z.string().uuid(),
  blockedFingerprint: z.string(),
  createdAt: z.string(),
});

export type CreateBlockRequest = z.infer<typeof CreateBlockRequestSchema>;
export type BlockResponse = z.infer<typeof BlockResponseSchema>;
