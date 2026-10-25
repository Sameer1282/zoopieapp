import { Router, type Request, type Response } from 'express';
import { HealthCheckResponseSchema, type HealthCheckResponse } from '@zoopie/shared';
import { env } from '../config/env.js';

export const healthRouter = Router();

const startTime = Date.now();

healthRouter.get('/health', (_req: Request, res: Response) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  const payload: HealthCheckResponse = {
    status: 'ok',
    uptime: uptimeSeconds,
    timestamp: new Date().toISOString(),
    service: 'zoopie-server',
    version: '0.1.0',
    environment: env.NODE_ENV,
  };

  // Validate outgoing payload against shared contract
  const validated = HealthCheckResponseSchema.safeParse(payload);
  if (!validated.success) {
    res.status(500).json({
      status: 'error',
      message: 'Internal contract validation failed',
      errors: validated.error.format(),
    });
    return;
  }

  res.status(200).json(validated.data);
});
