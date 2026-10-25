import { type Request, type Response, type NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.id;
  const isAppError = err instanceof AppError;
  const errorWithStatus = err as Error & { statusCode?: number; status?: number };

  const statusCode = isAppError
    ? err.statusCode
    : errorWithStatus.statusCode || errorWithStatus.status || 500;

  const code = isAppError
    ? err.code
    : statusCode === 413
      ? 'PAYLOAD_TOO_LARGE'
      : 'INTERNAL_SERVER_ERROR';

  // In production, mask internal error details to prevent reconnaissance
  const isProduction = env.NODE_ENV === 'production';
  const clientMessage =
    isAppError || statusCode === 413
      ? err.message
      : isProduction
        ? 'An unexpected internal server error occurred.'
        : err.message;

  // Log full error details securely on server side
  logger.error('API Error Encountered', {
    requestId,
    url: req.originalUrl,
    method: req.method,
    statusCode,
    code,
    message: err.message,
    stack: isProduction ? undefined : err.stack,
  });

  res.status(statusCode).json({
    status: 'error',
    error: {
      code,
      message: clientMessage,
      details: isAppError ? err.details : undefined,
      timestamp: new Date().toISOString(),
      requestId,
    },
  });
}
