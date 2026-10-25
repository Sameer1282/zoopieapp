import { z } from 'zod';

export const ReportCategorySchema = z.enum([
  'INAPPROPRIATE_CONTENT',
  'HARASSMENT',
  'UNDERAGE_SUSPICION',
  'SPAM_OR_BOT',
  'HATE_SPEECH',
  'OTHER',
]);

export const ReportStatusSchema = z.enum(['PENDING', 'UNDER_REVIEW', 'DISMISSED', 'ACTION_TAKEN']);

export const CreateReportRequestSchema = z.object({
  reporterSessionId: z.string().uuid({ message: 'Reporter session must be a valid UUID' }),
  reportedFingerprint: z
    .string()
    .min(16, { message: 'Fingerprint must be at least 16 characters' })
    .max(128, { message: 'Fingerprint cannot exceed 128 characters' }),
  conversationId: z.string().uuid().optional(),
  category: ReportCategorySchema,
  details: z.string().max(1000).optional(),
});

export const ReportResponseSchema = z.object({
  id: z.string().uuid(),
  category: ReportCategorySchema,
  status: ReportStatusSchema,
  createdAt: z.string(),
});

export type ReportCategory = z.infer<typeof ReportCategorySchema>;
export type ReportStatus = z.infer<typeof ReportStatusSchema>;
export type CreateReportRequest = z.infer<typeof CreateReportRequestSchema>;
export type ReportResponse = z.infer<typeof ReportResponseSchema>;
