import { z } from 'zod';

export const ReportCategorySchema = z.enum([
  'INAPPROPRIATE_CONTENT',
  'HARASSMENT',
  'UNDERAGE_SUSPICION',
  'SPAM_OR_BOT',
  'HATE_SPEECH',
  'THREATS_OR_VIOLENCE',
  'IMPERSONATION',
  'OTHER',
]);

export const ReportStatusSchema = z.enum([
  'PENDING',
  'UNDER_REVIEW',
  'RESOLVED',
  'DISMISSED',
  'ACTION_TAKEN',
]);

export const CreateReportRequestSchema = z.object({
  reporterSessionId: z.string().uuid({ message: 'Reporter session must be a valid UUID' }),
  reportedSessionId: z.string().uuid().optional(),
  reportedFingerprint: z
    .string()
    .min(16, { message: 'Fingerprint must be at least 16 characters' })
    .max(128, { message: 'Fingerprint cannot exceed 128 characters' })
    .optional(),
  conversationId: z.string().max(128).optional(),
  category: ReportCategorySchema,
  details: z.string().max(1000).optional(),
  blockPeer: z.boolean().default(false),
});

export const ReportRecordSchema = z.object({
  id: z.string(),
  reporterSessionId: z.string(),
  reportedSessionId: z.string().optional(),
  reportedFingerprint: z.string(),
  conversationId: z.string().nullable().optional(),
  category: ReportCategorySchema,
  details: z.string().nullable().optional(),
  status: ReportStatusSchema,
  createdAt: z.string(),
  resolvedAt: z.string().nullable().optional(),
});

export const ReportResponseSchema = z.object({
  id: z.string(),
  category: ReportCategorySchema,
  status: ReportStatusSchema,
  createdAt: z.string(),
  message: z.string(),
});

export type ReportCategory = z.infer<typeof ReportCategorySchema>;
export type ReportStatus = z.infer<typeof ReportStatusSchema>;
export type CreateReportRequest = z.infer<typeof CreateReportRequestSchema>;
export type ReportRecord = z.infer<typeof ReportRecordSchema>;
export type ReportResponse = z.infer<typeof ReportResponseSchema>;
