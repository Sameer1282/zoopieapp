import { z } from 'zod';

export const ApiErrorDetailSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

export const ApiErrorResponseSchema = z.object({
  status: z.literal('error').optional(),
  error: ApiErrorDetailSchema,
});

export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
