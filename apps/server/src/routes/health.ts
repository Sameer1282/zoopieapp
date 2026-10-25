import { Router, type Request, type Response } from 'express';
import { HealthCheckResponseSchema, type HealthCheckResponse } from '@zoopie/shared';
import { env } from '../config/env.js';
import { prisma, withDbTimeout } from '../db/client.js';

export const healthRouter = Router();

const startTime = Date.now();
let isShuttingDown = false;

export function setShuttingDown(val: boolean): void {
  isShuttingDown = val;
}

export function getShuttingDown(): boolean {
  return isShuttingDown;
}

/**
 * GET /health (Liveness Probe)
 * Returns 200 OK as long as the process is alive and responding to HTTP requests.
 */
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

/**
 * GET /health/ready or /ready (Readiness Probe)
 * Returns 200 OK if server is ready to accept traffic; returns 503 during shutdown or fatal unreadiness.
 */
healthRouter.get(['/health/ready', '/ready'], async (_req: Request, res: Response) => {
  if (isShuttingDown) {
    res.status(503).json({
      status: 'shutting_down',
      ready: false,
      message: 'Server is currently terminating connections and draining traffic',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Database reachability check
  let dbStatus = 'healthy';
  try {
    await withDbTimeout(prisma.$queryRaw`SELECT 1` as Promise<unknown>, 500);
  } catch {
    dbStatus = 'degraded_or_offline';
  }

  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);

  res.status(200).json({
    status: 'ok',
    ready: true,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    database: dbStatus,
    memory: {
      heapUsedMb,
      rssMb: Math.round(mem.rss / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  });
});
