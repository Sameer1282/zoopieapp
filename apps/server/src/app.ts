import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';

export function createApp(): Application {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN === '*' ? '*' : env.CLIENT_ORIGIN.split(','),
      credentials: true,
    })
  );
  app.use(express.json());

  // Routes
  app.use(healthRouter);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      status: 'error',
      message: 'Resource not found',
    });
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Zoopie Server Error]:', err);
    res.status(500).json({
      status: 'error',
      message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
  });

  return app;
}

export const app = createApp();
