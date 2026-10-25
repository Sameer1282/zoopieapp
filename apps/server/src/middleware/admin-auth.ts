import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import type { AdminRole } from '@zoopie/shared';

export interface AdminTokenPayload {
  adminId: string;
  email?: string;
  role: AdminRole;
  exp: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload;
    }
  }
}

/**
 * Generate a signed HMAC-SHA256 admin token
 */
export function generateAdminToken(payload: {
  adminId: string;
  email?: string;
  role: AdminRole;
  expiresInSeconds?: number;
}): { token: string; expiresAt: number } {
  const ttl = payload.expiresInSeconds || env.ADMIN_TOKEN_EXPIRY_SECONDS || 28800;
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      adminId: payload.adminId,
      email: payload.email,
      role: payload.role,
      exp: expiresAt,
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', env.ADMIN_SECRET_KEY)
    .update(`${header}.${body}`)
    .digest('base64url');

  return {
    token: `${header}.${body}.${signature}`,
    expiresAt,
  };
}

/**
 * Cryptographically verify an admin token
 */
export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', env.ADMIN_SECRET_KEY)
      .update(`${header}.${body}`)
      .digest('base64url');

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf-8')
    ) as AdminTokenPayload;

    if (Date.now() / 1000 > payload.exp) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Express middleware requiring a valid administrator JWT token
 */
export function requireAdminAuth(allowedRoles?: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Administrator authentication token required');
    }

    const token = authHeader.slice(7).trim();
    const payload = verifyAdminToken(token);

    if (!payload) {
      throw new UnauthorizedError('Invalid or expired administrator authentication token');
    }

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
      throw new ForbiddenError(
        `Insufficient administrative privileges for role ${payload.role}. Required: ${allowedRoles.join(', ')}`
      );
    }

    req.admin = payload;
    next();
  };
}
