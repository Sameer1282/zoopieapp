import { z } from 'zod';

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

export const AdminLoginResponseSchema = z.object({
  adminId: z.string().uuid(),
  email: z.string().email(),
  role: AdminRoleSchema,
  token: z.string(),
});

export type ModerationActionType = z.infer<typeof ModerationActionTypeSchema>;
export type AdminRole = z.infer<typeof AdminRoleSchema>;
export type AdminLoginRequest = z.infer<typeof AdminLoginRequestSchema>;
export type AdminLoginResponse = z.infer<typeof AdminLoginResponseSchema>;
