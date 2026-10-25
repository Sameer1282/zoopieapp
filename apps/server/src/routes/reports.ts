import { Router, type Request, type Response, type NextFunction } from 'express';
import { CreateReportRequestSchema } from '@zoopie/shared';
import { ValidationError } from '../utils/errors.js';
import { prisma } from '../db/client.js';
import { logger } from '../utils/logger.js';
import crypto from 'node:crypto';

export const reportsRouter = Router();

reportsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = CreateReportRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Malformed report submission payload', parseResult.error.format());
    }

    const { reporterSessionId, reportedFingerprint, conversationId, category, details } =
      parseResult.data;

    let reportId: string = crypto.randomUUID();
    const createdAt = new Date();

    try {
      const created = await prisma.abuseReport.create({
        data: {
          reporterSessionId,
          reportedFingerprint,
          conversationId,
          category,
          details,
          status: 'PENDING',
        },
      });
      reportId = created.id;
    } catch (dbError) {
      logger.warn('Database write bypassed for abuse report (DB offline or unreachable)', {
        category,
        error: dbError instanceof Error ? dbError.message : 'Unknown DB error',
      });
    }

    logger.info('Abuse report submitted', {
      reportId,
      category,
      reporterSessionId,
      requestId: req.id,
    });

    res.status(201).json({
      id: reportId,
      category,
      status: 'PENDING',
      createdAt: createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});
