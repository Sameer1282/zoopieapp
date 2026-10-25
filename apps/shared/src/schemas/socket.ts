import { z } from 'zod';

export const PingPayloadSchema = z.object({
  clientTimestamp: z.number().positive(),
  nonce: z.string().optional(),
});

export const PongPayloadSchema = z.object({
  clientTimestamp: z.number().positive(),
  serverTimestamp: z.number().positive(),
  message: z.string().optional(),
});

export type PingPayload = z.infer<typeof PingPayloadSchema>;
export type PongPayload = z.infer<typeof PongPayloadSchema>;
