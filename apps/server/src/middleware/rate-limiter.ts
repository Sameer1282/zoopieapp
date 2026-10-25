import rateLimit from 'express-rate-limit';
import { type Request, type Response } from 'express';
import { env } from '../config/env.js';

export const standardRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this client. Please slow down.',
        timestamp: new Date().toISOString(),
        requestId: req.id,
      },
    });
  },
});

export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 submissions per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests to this endpoint. Please try again later.',
        timestamp: new Date().toISOString(),
        requestId: req.id,
      },
    });
  },
});
