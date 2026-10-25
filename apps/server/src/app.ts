import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { standardRateLimiter, strictRateLimiter } from './middleware/rate-limiter.js';
import { errorHandler } from './middleware/error-handler.js';
import { NotFoundError } from './utils/errors.js';
import { healthRouter } from './routes/health.js';
import { reportsRouter } from './routes/reports.js';
import { blocksRouter } from './routes/blocks.js';
import { sessionsRouter } from './routes/sessions.js';
import { webrtcRouter } from './routes/webrtc.js';
import { adminRouter } from './routes/admin.js';

export function createApp(): Application {
  const app = express();

  // 1. Request tracing middleware
  app.use(requestIdMiddleware);

  // 2. Security Headers (Helmet with documented Content Security Policy)
  const allowedOrigins = env.CLIENT_ORIGIN.split(',').map(o => o.trim());

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", ...allowedOrigins, 'ws:', 'wss:'],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      hidePoweredBy: true,
      xFrameOptions: { action: 'deny' },
      xContentTypeOptions: true,
      strictTransportSecurity:
        env.NODE_ENV === 'production'
          ? { maxAge: 31536000, includeSubDomains: true, preload: true }
          : false,
    })
  );

  // 3. Explicit CORS configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);

        if (env.CLIENT_ORIGIN === '*') {
          return callback(null, true);
        }

        const origins = env.CLIENT_ORIGIN.split(',').map(o => o.trim());
        if (origins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`CORS origin '${origin}' is not allowed`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    })
  );

  // 4. Request size limiting (prevent JSON payload flood attacks)
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // 5. Baseline rate limiting
  app.use(standardRateLimiter);

  // 6. Routes
  app.use(healthRouter);
  app.use(sessionsRouter);
  app.use(blocksRouter);
  app.use(webrtcRouter);
  app.use(adminRouter);
  app.use('/api/reports', strictRateLimiter, reportsRouter);

  // 7. 404 handler
  app.use((_req: Request, _res: Response) => {
    throw new NotFoundError('The requested endpoint does not exist');
  });

  // 8. Centralized safe error handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
