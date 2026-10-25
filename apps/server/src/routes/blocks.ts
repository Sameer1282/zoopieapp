import { Router, type Request, type Response, type NextFunction } from 'express';
import { CreateBlockRequestSchema } from '@zoopie/shared';
import { ValidationError } from '../utils/errors.js';
import { prisma, withDbTimeout } from '../db/client.js';
import { matchmakingQueue } from '../socket/matchmaking-queue.js';
import { logger } from '../utils/logger.js';
import crypto from 'node:crypto';

export const blocksRouter = Router();

blocksRouter.post('/api/blocks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = CreateBlockRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Malformed block submission payload', parseResult.error.format());
    }

    const { blockerSessionId, blockedFingerprint, reason } = parseResult.data;

    // Immediately record block in active matchmaking memory
    matchmakingQueue.recordBlock(blockerSessionId, blockedFingerprint);

    let blockId: string = crypto.randomUUID();
    const createdAt = new Date();

    try {
      const created = await withDbTimeout(
        prisma.userBlock.create({
          data: {
            blockerSessionId,
            blockedFingerprint,
            reason,
          },
        })
      );
      blockId = created.id;
    } catch (dbError) {
      logger.warn('Database write bypassed for user block (DB offline or unreachable)', {
        blockerSessionId,
        error: dbError instanceof Error ? dbError.message : 'Unknown DB error',
      });
    }

    logger.info('User block recorded', {
      blockId,
      blockerSessionId,
      requestId: req.id,
    });

    res.status(201).json({
      id: blockId,
      blockerSessionId,
      blockedFingerprint,
      createdAt: createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});
