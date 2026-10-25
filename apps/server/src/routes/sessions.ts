import { Router, type Request, type Response, type NextFunction } from 'express';
import { CreateSessionRequestSchema } from '@zoopie/shared';
import { ValidationError } from '../utils/errors.js';
import { prisma, withDbTimeout } from '../db/client.js';
import { logger } from '../utils/logger.js';
import crypto from 'node:crypto';

export const sessionsRouter = Router();

sessionsRouter.post('/api/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = CreateSessionRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Malformed session creation payload', parseResult.error.format());
    }

    // Generate opaque session ID and hash fingerprint from IP + User Agent
    const sessionId = crypto.randomUUID();
    const rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const fingerprintHash = crypto
      .createHash('sha256')
      .update(`${rawIp}:${userAgent}:zoopie_pepper`)
      .digest('hex');

    const createdAt = new Date();

    try {
      await withDbTimeout(
        prisma.userSession.create({
          data: {
            id: sessionId,
            fingerprintHash,
            status: 'ACTIVE',
          },
        })
      );
    } catch (dbError) {
      logger.warn('Database write bypassed for user session (DB offline or unreachable)', {
        error: dbError instanceof Error ? dbError.message : 'Unknown DB error',
      });
    }

    logger.info('New opaque user session initialized', {
      sessionId,
      requestId: req.id,
    });

    res.status(201).json({
      sessionId,
      status: 'ACTIVE',
      createdAt: createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});
