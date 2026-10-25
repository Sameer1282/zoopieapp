import { z } from 'zod';

export const HealthStatusSchema = z.enum(['ok', 'degraded', 'error']);

export const HealthCheckResponseSchema = z.object({
  status: HealthStatusSchema,
  uptime: z.number().nonnegative(),
  timestamp: z.string(),
  service: z.string(),
  version: z.string(),
  environment: z.string().optional(),
  turnConfigured: z.boolean().optional(),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
