import { env } from '../config/env.js';

/**
 * Validates whether an incoming HTTP or WebSocket request origin
 * complies with the server's configured CORS policy.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  // Allow requests without Origin header (e.g. curl, health check probes, server-to-server)
  if (!origin) {
    return true;
  }

  // Allow wildcard in development/test only
  if (env.CLIENT_ORIGIN === '*' && env.NODE_ENV !== 'production') {
    return true;
  }

  // Check explicit comma-separated whitelist
  const allowedOrigins = env.CLIENT_ORIGIN.split(',').map(o => o.trim());
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Vercel Preview Deployments (e.g. https://zoopie-git-branch-team.vercel.app)
  if (env.ALLOW_VERCEL_PREVIEWS) {
    try {
      const parsed = new URL(origin);
      if (
        (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
        parsed.hostname.endsWith('.vercel.app')
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}
