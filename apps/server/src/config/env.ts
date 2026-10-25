import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env if present
dotenv.config();

const EnvSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    CLIENT_ORIGIN: z.string().default('http://localhost:3000'),
    ALLOW_VERCEL_PREVIEWS: z
      .enum(['true', 'false'])
      .default('false')
      .transform(v => v === 'true'),
    DATABASE_URL: z
      .string()
      .default('postgresql://postgres:postgres@localhost:5432/zoopie_dev?schema=public'),
    DB_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
    REDIS_URL: z.string().optional(),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
    // WebRTC STUN / TURN Configuration
    STUN_SERVER_URL: z.string().default('stun:stun.l.google.com:19302'),
    TURN_SERVER_URL: z.string().optional(),
    TURN_SERVER_SECRET: z.string().optional(),
    TURN_SERVER_USERNAME: z.string().optional(),
    TURN_SERVER_CREDENTIAL: z.string().optional(),
    TURN_CREDENTIAL_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
    // Admin & Moderation Authentication
    ADMIN_SECRET_KEY: z
      .string()
      .min(16)
      .default('zoopie-moderator-secret-key-development-safe-placeholder-123'),
    ADMIN_TOKEN_EXPIRY_SECONDS: z.coerce.number().int().positive().default(28800), // 8 hours
  })
  .refine(
    data => {
      // Security: Wildcard CORS origin is strictly forbidden in production
      if (data.NODE_ENV === 'production' && data.CLIENT_ORIGIN.trim() === '*') {
        return false;
      }
      return true;
    },
    {
      message: 'CLIENT_ORIGIN cannot be wildcard "*" in production environment',
      path: ['CLIENT_ORIGIN'],
    }
  );

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`\x1b[31m[Zoopie Server] Environment validation failed:\n${errorDetails}\x1b[0m`);
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

export const env = loadEnv();
