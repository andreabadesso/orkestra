/**
 * Error Handler Middleware
 *
 * Provides HTTP-level error handling and formatting for API responses.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { isOrkestraError } from '@orkestra/core';

/**
 * Error response format
 */
export interface ErrorResponse {
  /** Error flag */
  error: true;
  /** HTTP status code */
  status: number;
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Additional error details */
  details?: unknown;
  /** Request ID for tracing */
  requestId?: string;
  /** Timestamp */
  timestamp: string;
}

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
  /** Include stack traces in development */
  includeStackTrace?: boolean;
  /** Custom error logger */
  logger?: (error: Error, req: IncomingMessage) => void;
  /** Custom error transformer */
  transform?: (error: Error, req: IncomingMessage) => ErrorResponse;
}

/**
 * Map error to HTTP status code
 */
function getHttpStatus(error: Error): number {
  if (isOrkestraError(error)) {
    return error.statusCode;
  }

  // Common error name to status code mapping
  const statusMap: Record<string, number> = {
    ValidationError: 400,
    BadRequestError: 400,
    UnauthorizedError: 401,
    ForbiddenError: 403,
    NotFoundError: 404,
    ConflictError: 409,
    RateLimitError: 429,
    InternalError: 500,
    ServiceUnavailableError: 503,
  };

  return statusMap[error.name] ?? 500;
}

/**
 * Map error to error code
 */
function getErrorCode(error: Error): string {
  if (isOrkestraError(error)) {
    return error.code;
  }

  // Convert error name to error code
  // e.g., ValidationError -> VALIDATION_ERROR
  return error.name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase()
    .replace(/_ERROR$/, '');
}

/**
 * Format error for response
 */
function formatError(
  error: Error,
  requestId?: string,
  includeStackTrace: boolean = false
): ErrorResponse {
  const response: ErrorResponse = {
    error: true,
    status: getHttpStatus(error),
    code: getErrorCode(error),
    message: error.message,
    timestamp: new Date().toISOString(),
  };

  if (requestId) {
    response.requestId = requestId;
  }

  if (isOrkestraError(error) && error.details) {
    response.details = error.details;
  }

  if (includeStackTrace && error.stack) {
    (response as ErrorResponse & { stack?: string }).stack = error.stack;
  }

  return response;
}

/**
 * Create error handling middleware
 */
export function createErrorHandler(options: ErrorHandlerOptions = {}) {
  const {
    includeStackTrace = process.env['NODE_ENV'] !== 'production',
    logger,
    transform,
  } = options;

  return (
    error: Error,
    req: IncomingMessage,
    res: ServerResponse
  ): void => {
    // Log the error
    if (logger) {
      logger(error, req);
    } else {
      console.error('[API Error]', error);
    }

    // Transform or format the error
    const requestId = (req as { requestId?: string }).requestId;
    const errorResponse = transform
      ? transform(error, req)
      : formatError(error, requestId, includeStackTrace);

    // Send response
    res.statusCode = errorResponse.status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(errorResponse));
  };
}

/**
 * Wrap async handler to catch errors
 */
export function asyncHandler<T extends IncomingMessage, R extends ServerResponse>(
  handler: (req: T, res: R) => Promise<void>,
  errorHandler: (error: Error, req: T, res: R) => void
): (req: T, res: R) => void {
  return (req: T, res: R) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      errorHandler(error, req, res);
    });
  };
}

/**
 * Create a simple error response helper
 */
export function sendError(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
  details?: unknown
): void {
  const response: ErrorResponse = {
    error: true,
    status,
    code,
    message,
    timestamp: new Date().toISOString(),
  };

  if (details) {
    response.details = details;
  }

  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(response));
}

/**
 * Common error response helpers
 */
export const ErrorResponses = {
  badRequest: (res: ServerResponse, message = 'Bad request', details?: unknown) =>
    sendError(res, 400, 'BAD_REQUEST', message, details),

  unauthorized: (res: ServerResponse, message = 'Unauthorized') =>
    sendError(res, 401, 'UNAUTHORIZED', message),

  forbidden: (res: ServerResponse, message = 'Forbidden') =>
    sendError(res, 403, 'FORBIDDEN', message),

  notFound: (res: ServerResponse, message = 'Not found') =>
    sendError(res, 404, 'NOT_FOUND', message),

  conflict: (res: ServerResponse, message = 'Conflict', details?: unknown) =>
    sendError(res, 409, 'CONFLICT', message, details),

  rateLimited: (res: ServerResponse, message = 'Rate limit exceeded') =>
    sendError(res, 429, 'RATE_LIMITED', message),

  internal: (res: ServerResponse, message = 'Internal server error') =>
    sendError(res, 500, 'INTERNAL_ERROR', message),

  serviceUnavailable: (res: ServerResponse, message = 'Service unavailable') =>
    sendError(res, 503, 'SERVICE_UNAVAILABLE', message),
};
