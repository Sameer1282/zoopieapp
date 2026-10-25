import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ||
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

/**
 * Wraps a Prisma call with an aggressive timeout when DB might be offline,
 * avoiding long TCP socket hangs in development/test environments.
 */
export async function withDbTimeout<T>(promise: Promise<T>, timeoutMs = 600): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Database operation timed out')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await withDbTimeout(prisma.$queryRaw`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}
