import crypto from 'node:crypto';
import type { ReportCategory as PrismaReportCategory } from '@prisma/client';
import { prisma, withDbTimeout } from '../db/client.js';
import { matchManager } from '../socket/match-manager.js';
import { matchmakingQueue } from '../socket/matchmaking-queue.js';
import { logger } from '../utils/logger.js';
import {
  type CreateReportRequest,
  type ReportRecord,
  type ReportResponse,
  type TakeModerationActionRequest,
  type ModerationActionAudit,
  type AdminStatsResponse,
  type AdminReportListQuery,
} from '@zoopie/shared';
import { NotFoundError, ConflictError } from '../utils/errors.js';

class ModerationService {
  // In-memory fallback stores for test suite & single-instance reliability
  private reports = new Map<string, ReportRecord>();
  private auditLogs: ModerationActionAudit[] = [];
  private reportRateLimitCache = new Map<string, number>(); // "reporter:target" -> timestamp

  /**
   * Submit an abuse report
   */
  async submitReport(req: CreateReportRequest, requestId?: string): Promise<ReportResponse> {
    const targetKey =
      req.reportedSessionId || req.reportedFingerprint || req.conversationId || 'unknown';
    const rateLimitKey = `${req.reporterSessionId}:${targetKey}`;
    const now = Date.now();

    // Deduplication / anti-abuse check: Reject repeated identical report within 60s
    const lastReportTime = this.reportRateLimitCache.get(rateLimitKey);
    if (lastReportTime && now - lastReportTime < 60_000) {
      throw new ConflictError(
        'You have already submitted a report for this participant recently. Our trust and safety systems are processing it.'
      );
    }
    this.reportRateLimitCache.set(rateLimitKey, now);

    const reportId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const fingerprint =
      req.reportedFingerprint ||
      `fp_${crypto.createHash('sha256').update(targetKey).digest('hex').slice(0, 32)}`;

    const record: ReportRecord = {
      id: reportId,
      reporterSessionId: req.reporterSessionId,
      reportedSessionId: req.reportedSessionId,
      reportedFingerprint: fingerprint,
      conversationId: req.conversationId || null,
      category: req.category,
      details: req.details || null,
      status: 'PENDING',
      createdAt,
    };

    // Store in-memory
    this.reports.set(reportId, record);

    // If blockPeer was checked, immediately register block
    if (req.blockPeer && req.reportedSessionId) {
      matchmakingQueue.recordBlock(req.reporterSessionId, req.reportedSessionId);
    }

    // Attempt persistent write with bounded timeout
    try {
      const prismaCategory = [
        'INAPPROPRIATE_CONTENT',
        'HARASSMENT',
        'UNDERAGE_SUSPICION',
        'SPAM_OR_BOT',
        'HATE_SPEECH',
      ].includes(req.category)
        ? req.category
        : 'OTHER';

      await withDbTimeout(
        prisma.abuseReport.create({
          data: {
            id: reportId,
            reporterSessionId: req.reporterSessionId,
            reportedFingerprint: fingerprint,
            conversationId: req.conversationId,
            category: prismaCategory as PrismaReportCategory,
            details: req.details,
            status: 'PENDING',
          },
        })
      );
    } catch (dbError) {
      logger.warn('Database write bypassed for abuse report (DB offline or unreachable)', {
        reportId,
        category: req.category,
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
    }

    logger.info('Abuse report submitted and registered', {
      reportId,
      category: req.category,
      reporterSessionId: req.reporterSessionId,
      reportedSessionId: req.reportedSessionId,
      requestId,
    });

    return {
      id: reportId,
      category: req.category,
      status: 'PENDING',
      createdAt,
      message:
        'Report successfully submitted. Our automated trust and safety systems and moderation team have received this event.',
    };
  }

  /**
   * List reports for admin review with filtering
   */
  async listReports(
    query: AdminReportListQuery
  ): Promise<{ reports: ReportRecord[]; total: number }> {
    const all = Array.from(this.reports.values());

    const filtered = all.filter(r => {
      if (query.status && r.status !== query.status) return false;
      if (query.category && r.category !== query.category) return false;
      return true;
    });

    // Sort newest first
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const paginated = filtered.slice(query.offset, query.offset + query.limit);

    return {
      reports: paginated,
      total: filtered.length,
    };
  }

  /**
   * Get single report by ID
   */
  async getReport(reportId: string): Promise<ReportRecord> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new NotFoundError(`Report with ID ${reportId} not found`);
    }
    return report;
  }

  /**
   * Execute a moderation action on a report
   */
  async takeAction(
    reportId: string,
    actionReq: TakeModerationActionRequest,
    adminId: string,
    requestId?: string
  ): Promise<ModerationActionAudit> {
    const report = await this.getReport(reportId);

    const now = new Date();
    const actionId = crypto.randomUUID();
    let expiresAt: string | null = null;

    if (actionReq.banDurationHours) {
      const expDate = new Date(now.getTime() + actionReq.banDurationHours * 3600 * 1000);
      expiresAt = expDate.toISOString();
    }

    // 1. Update report status
    report.status = actionReq.actionType === 'DISMISS' ? 'DISMISSED' : 'RESOLVED';
    report.resolvedAt = now.toISOString();

    // 2. Enforce restriction if ban/session termination
    const targetSessionId = report.reportedSessionId;
    if (
      actionReq.actionType === 'TEMPORARY_BAN' ||
      actionReq.actionType === 'PERMANENT_BAN' ||
      actionReq.actionType === 'SESSION_TERMINATION'
    ) {
      if (targetSessionId) {
        // Immediately suspend from matchmaking
        matchmakingQueue.setSuspended(targetSessionId, true);

        // Terminate any active match session
        matchManager.leaveAnyActiveMatch(targetSessionId);
      }
    }

    // 3. Create audit record
    const auditRecord: ModerationActionAudit = {
      id: actionId,
      reportId: report.id,
      targetFingerprint: report.reportedFingerprint,
      actionType: actionReq.actionType,
      reason: actionReq.reason,
      adminId,
      createdAt: now.toISOString(),
      expiresAt,
    };

    this.auditLogs.unshift(auditRecord);

    // 4. Attempt DB audit record creation
    try {
      await withDbTimeout(
        prisma.moderationAction.create({
          data: {
            id: actionId,
            reportId: report.id,
            targetFingerprint: report.reportedFingerprint,
            actionType: actionReq.actionType,
            reason: actionReq.reason,
            adminId,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
        })
      );
    } catch (dbError) {
      logger.warn('Database write bypassed for moderation action audit', {
        actionId,
        actionType: actionReq.actionType,
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
    }

    logger.info('Moderation decision executed and audited', {
      actionId,
      reportId,
      actionType: actionReq.actionType,
      adminId,
      requestId,
    });

    return auditRecord;
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(limit = 50): Promise<ModerationActionAudit[]> {
    return this.auditLogs.slice(0, limit);
  }

  /**
   * Get admin dashboard statistics
   */
  async getStats(): Promise<AdminStatsResponse> {
    const all = Array.from(this.reports.values());
    let pending = 0;
    let underReview = 0;
    let resolved = 0;

    for (const r of all) {
      if (r.status === 'PENDING') pending++;
      else if (r.status === 'UNDER_REVIEW') underReview++;
      else if (r.status === 'RESOLVED' || r.status === 'DISMISSED' || r.status === 'ACTION_TAKEN')
        resolved++;
    }

    const activeBans = this.auditLogs.filter(
      a =>
        (a.actionType === 'TEMPORARY_BAN' || a.actionType === 'PERMANENT_BAN') &&
        (!a.expiresAt || new Date(a.expiresAt).getTime() > Date.now())
    ).length;

    return {
      pendingReports: pending,
      underReviewReports: underReview,
      resolvedReports: resolved,
      totalReports: all.length,
      activeBans,
    };
  }

  /**
   * Reset store for test suites
   */
  reset(): void {
    this.reports.clear();
    this.auditLogs = [];
    this.reportRateLimitCache.clear();
  }
}

export const moderationService = new ModerationService();
