import { z } from 'zod';
import { ReportCategorySchema, ReportStatusSchema } from './report.js';

export const ModerationActionTypeSchema = z.enum([
  'WARNING',
  'TEMPORARY_BAN',
  'PERMANENT_BAN',
  'SESSION_TERMINATION',
  'DISMISS',
]);

export const AdminRoleSchema = z.enum(['SUPERADMIN', 'MODERATOR', 'AUDITOR']);

export const AdminLoginRequestSchema = z.object({
  email: z.string().email({ message: 'Must be a valid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
});

export const AdminKeyLoginRequestSchema = z.object({
  adminKey: z.string().min(16, { message: 'Admin security key must be at least 16 characters' }),
  role: AdminRoleSchema.default('MODERATOR'),
});

export const AdminLoginResponseSchema = z.object({
  adminId: z.string(),
  email: z.string().optional(),
  role: AdminRoleSchema,
  token: z.string(),
  expiresAt: z.number(),
});

export const TakeModerationActionRequestSchema = z.object({
  actionType: ModerationActionTypeSchema,
  reason: z
    .string()
    .trim()
    .min(3, { message: 'Reason must be at least 3 characters' })
    .max(500, { message: 'Reason cannot exceed 500 characters' }),
  banDurationHours: z.coerce.number().positive().max(8760).optional(), // Up to 1 year
});

export const ModerationActionAuditSchema = z.object({
  id: z.string(),
  reportId: z.string().nullable().optional(),
  targetFingerprint: z.string(),
  actionType: ModerationActionTypeSchema,
  reason: z.string(),
  adminId: z.string(),
  createdAt: z.string(),
  expiresAt: z.string().nullable().optional(),
});

export const AdminReportListQuerySchema = z.object({
  status: ReportStatusSchema.optional(),
  category: ReportCategorySchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const AdminStatsResponseSchema = z.object({
  pendingReports: z.number(),
  underReviewReports: z.number(),
  resolvedReports: z.number(),
  totalReports: z.number(),
  activeBans: z.number(),
});

export type ModerationActionType = z.infer<typeof ModerationActionTypeSchema>;
export type AdminRole = z.infer<typeof AdminRoleSchema>;
export type AdminLoginRequest = z.infer<typeof AdminLoginRequestSchema>;
export type AdminKeyLoginRequest = z.infer<typeof AdminKeyLoginRequestSchema>;
export type AdminLoginResponse = z.infer<typeof AdminLoginResponseSchema>;
export type TakeModerationActionRequest = z.infer<typeof TakeModerationActionRequestSchema>;
export type ModerationActionAudit = z.infer<typeof ModerationActionAuditSchema>;
export type AdminReportListQuery = z.infer<typeof AdminReportListQuerySchema>;
export type AdminStatsResponse = z.infer<typeof AdminStatsResponseSchema>;
