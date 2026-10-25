import { Router, type Request, type Response, type NextFunction } from 'express';
import { CreateReportRequestSchema } from '@zoopie/shared';
import { ValidationError } from '../utils/errors.js';
import { moderationService } from '../moderation/moderation-service.js';

export const reportsRouter = Router();

/**
 * POST /api/reports
 * Submit an abuse report with rate-limiting and validation
 */
reportsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = CreateReportRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Malformed report submission payload', parseResult.error.format());
    }

    const reportResponse = await moderationService.submitReport(parseResult.data, req.id);

    res.status(201).json(reportResponse);
  } catch (err) {
    next(err);
  }
});
