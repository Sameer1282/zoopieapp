import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env if present
dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1024).max(65535).default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_ORIGIN: z.string().default('http://localhost:3000'),
});

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
