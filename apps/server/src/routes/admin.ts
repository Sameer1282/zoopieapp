import { Router, type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { requireAdminAuth, generateAdminToken } from '../middleware/admin-auth.js';
import { moderationService } from '../moderation/moderation-service.js';
import {
  AdminKeyLoginRequestSchema,
  AdminReportListQuerySchema,
  TakeModerationActionRequestSchema,
} from '@zoopie/shared';
import { ValidationError, UnauthorizedError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const adminRouter = Router();

/**
 * POST /api/admin/login
 * Authenticates an administrator or moderator using the provisioned admin security key.
 * Never exposes default production credentials.
 */
adminRouter.post('/api/admin/login', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = AdminKeyLoginRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid admin authentication payload', parseResult.error.format());
    }

    const { adminKey, role } = parseResult.data;

    // Constant-time key comparison to prevent timing side-channel attacks
    const keyBuf = Buffer.from(adminKey);
    const expectedBuf = Buffer.from(env.ADMIN_SECRET_KEY);

    const isMatch =
      keyBuf.length === expectedBuf.length && crypto.timingSafeEqual(keyBuf, expectedBuf);

    if (!isMatch) {
      logger.warn('Failed admin login attempt', { requestId: req.id });
      throw new UnauthorizedError('Invalid administrator credentials');
    }

    const adminId = `admin_${crypto.randomUUID().slice(0, 8)}`;
    const { token, expiresAt } = generateAdminToken({
      adminId,
      role,
    });

    logger.info('Admin login successful', {
      adminId,
      role,
      requestId: req.id,
    });

    res.status(200).json({
      adminId,
      role,
      token,
      expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/reports
 * Lists abuse reports with status and category filtering
 * Enforces least-privilege role check: SUPERADMIN, MODERATOR, AUDITOR
 */
adminRouter.get(
  '/api/admin/reports',
  requireAdminAuth(['SUPERADMIN', 'MODERATOR', 'AUDITOR']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queryResult = AdminReportListQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        throw new ValidationError('Invalid report query parameters', queryResult.error.format());
      }

      const data = await moderationService.listReports(queryResult.data);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/admin/reports/:id
 * Fetches full metadata and context for a specific report
 */
adminRouter.get(
  '/api/admin/reports/:id',
  requireAdminAuth(['SUPERADMIN', 'MODERATOR', 'AUDITOR']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await moderationService.getReport(String(req.params.id));
      res.status(200).json(report);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/reports/:id/action
 * Executes an auditable moderation decision (Warning, Ban, Session Termination, Dismiss).
 * Enforces least-privilege: AUDITOR role CANNOT take actions (read-only).
 */
adminRouter.post(
  '/api/admin/reports/:id/action',
  requireAdminAuth(['SUPERADMIN', 'MODERATOR']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = TakeModerationActionRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError('Invalid moderation action payload', parseResult.error.format());
      }

      const auditRecord = await moderationService.takeAction(
        String(req.params.id),
        parseResult.data,
        req.admin!.adminId,
        req.id
      );

      res.status(200).json(auditRecord);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/admin/audit-logs
 * Accesses immutable moderation decision audit trail.
 */
adminRouter.get(
  '/api/admin/audit-logs',
  requireAdminAuth(['SUPERADMIN', 'AUDITOR']),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const logs = await moderationService.getAuditLogs();
      res.status(200).json({ auditLogs: logs });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/admin/stats
 * Overview counts for the moderation dashboard
 */
adminRouter.get(
  '/api/admin/stats',
  requireAdminAuth(['SUPERADMIN', 'MODERATOR', 'AUDITOR']),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await moderationService.getStats();
      res.status(200).json(stats);
    } catch (err) {
      next(err);
    }
  }
);
