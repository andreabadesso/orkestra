/**
 * Custom error classes for Orkestra
 *
 * Provides a hierarchy of typed errors with proper HTTP status codes
 * and serialization support.
 */

import type { JsonObject } from '../types/common.js';

/**
 * Error codes for Orkestra errors
 */
export type ErrorCode =
  // General errors
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  // Domain-specific errors
  | 'TENANT_NOT_FOUND'
  | 'TENANT_SUSPENDED'
  | 'USER_NOT_FOUND'
  | 'USER_INACTIVE'
  | 'GROUP_NOT_FOUND'
  | 'TASK_NOT_FOUND'
  | 'TASK_ALREADY_CLAIMED'
  | 'TASK_ALREADY_COMPLETED'
  | 'TASK_EXPIRED'
  | 'WORKFLOW_NOT_FOUND'
  | 'WORKFLOW_ALREADY_RUNNING'
  | 'WORKFLOW_NOT_RUNNING'
  | 'CONVERSATION_NOT_FOUND'
  | 'LIMIT_EXCEEDED'
  | 'INVALID_STATE_TRANSITION';

/**
 * Error details for additional context
 */
export type ErrorDetails = JsonObject;

/**
 * Serialized error format
 */
export interface SerializedError {
  name: string;
  message: string;
  code: ErrorCode;
  statusCode: number;
  details?: ErrorDetails | undefined;
  stack?: string | undefined;
}

/**
 * Options for creating an OrkestraError
 */
interface OrkestraErrorOptions {
  code?: ErrorCode | undefined;
  statusCode?: number | undefined;
  details?: ErrorDetails | undefined;
  isOperational?: boolean | undefined;
  cause?: Error | undefined;
}

/**
 * Base error class for all Orkestra errors
 *
 * All custom errors extend this class and provide:
 * - HTTP status code for API responses
 * - Error code for programmatic handling
 * - Optional details for additional context
 * - Proper serialization support
 *
 * @example
 * ```typescript
 * throw new OrkestraError('Something went wrong', {
 *   code: 'INTERNAL_ERROR',
 *   statusCode: 500,
 *   details: { context: 'database operation' },
 * });
 * ```
 */
export class OrkestraError extends Error {
  /** Error code for programmatic handling */
  readonly code: ErrorCode;
  /** HTTP status code */
  readonly statusCode: number;
  /** Additional error details */
  readonly details: ErrorDetails | undefined;
  /** Whether this error is operational (expected) vs programming error */
  readonly isOperational: boolean;

  constructor(message: string, options: OrkestraErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'OrkestraError';
    this.code = options.code ?? 'INTERNAL_ERROR';
    this.statusCode = options.statusCode ?? 500;
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serialize the error for API responses
   */
  toJSON(): SerializedError {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }

  /**
   * Create a string representation
   */
  override toString(): string {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
}

/**
 * Options for NotFoundError
 */
interface NotFoundErrorOptions {
  code?: ErrorCode | undefined;
  details?: ErrorDetails | undefined;
}

/**
 * Error for resource not found (404)
 *
 * @example
 * ```typescript
 * throw new NotFoundError('Task', 'tsk_123');
 * ```
 */
export class NotFoundError extends OrkestraError {
  constructor(
    resource: string,
    identifier?: string | undefined,
    options: NotFoundErrorOptions = {}
  ) {
    const message = identifier
      ? `${resource} not found: ${identifier}`
      : `${resource} not found`;

    const details = options.details ?? (identifier ? { resource, identifier } : { resource });

    super(message, {
      code: options.code ?? 'NOT_FOUND',
      statusCode: 404,
      details,
    });
    this.name = 'NotFoundError';
  }
}

/**
 * Options for UnauthorizedError
 */
interface UnauthorizedErrorOptions {
  details?: ErrorDetails | undefined;
}

/**
 * Error for unauthorized access (401)
 *
 * @example
 * ```typescript
 * throw new UnauthorizedError('Invalid API key');
 * ```
 */
export class UnauthorizedError extends OrkestraError {
  constructor(
    message: string = 'Authentication required',
    options: UnauthorizedErrorOptions = {}
  ) {
    super(message, {
      code: 'UNAUTHORIZED',
      statusCode: 401,
      details: options.details,
    });
    this.name = 'UnauthorizedError';
  }
}

/**
 * Options for ForbiddenError
 */
interface ForbiddenErrorOptions {
  details?: ErrorDetails | undefined;
}

/**
 * Error for forbidden access (403)
 *
 * @example
 * ```typescript
 * throw new ForbiddenError('You do not have permission to access this resource');
 * ```
 */
export class ForbiddenError extends OrkestraError {
  constructor(
    message: string = 'Access forbidden',
    options: ForbiddenErrorOptions = {}
  ) {
    super(message, {
      code: 'FORBIDDEN',
      statusCode: 403,
      details: options.details,
    });
    this.name = 'ForbiddenError';
  }
}

/**
 * Options for ValidationError
 */
interface ValidationErrorOptions {
  details?: ErrorDetails | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
}

/**
 * Error for validation failures (400)
 *
 * @example
 * ```typescript
 * throw new ValidationError('Invalid input', {
 *   details: {
 *     field: 'email',
 *     message: 'Must be a valid email address',
 *   },
 * });
 * ```
 */
export class ValidationError extends OrkestraError {
  /** Validation errors by field */
  readonly fieldErrors: Record<string, string[]> | undefined;

  constructor(message: string, options: ValidationErrorOptions = {}) {
    const details = options.details ?? (options.fieldErrors ? { fieldErrors: options.fieldErrors } : undefined);
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details,
    });
    this.name = 'ValidationError';
    this.fieldErrors = options.fieldErrors;
  }

  /**
   * Create a validation error from Zod errors
   */
  static fromZodError(error: { errors: Array<{ path: (string | number)[]; message: string }> }): ValidationError {
    const fieldErrors: Record<string, string[]> = {};
    for (const e of error.errors) {
      const path = e.path.join('.');
      const existing = fieldErrors[path];
      if (existing) {
        existing.push(e.message);
      } else {
        fieldErrors[path] = [e.message];
      }
    }
    return new ValidationError('Validation failed', { fieldErrors });
  }
}

/**
 * Options for ConflictError
 */
interface ConflictErrorOptions {
  code?: ErrorCode | undefined;
  details?: ErrorDetails | undefined;
}

/**
 * Error for resource conflicts (409)
 *
 * @example
 * ```typescript
 * throw new ConflictError('Task is already claimed', {
 *   details: { taskId: 'tsk_123', claimedBy: 'usr_456' },
 * });
 * ```
 */
export class ConflictError extends OrkestraError {
  constructor(message: string, options: ConflictErrorOptions = {}) {
    super(message, {
      code: options.code ?? 'CONFLICT',
      statusCode: 409,
      details: options.details,
    });
    this.name = 'ConflictError';
  }
}

/**
 * Options for RateLimitError
 */
interface RateLimitErrorOptions {
  details?: ErrorDetails | undefined;
  retryAfterSeconds?: number | undefined;
}

/**
 * Error for rate limiting (429)
 *
 * @example
 * ```typescript
 * throw new RateLimitError('Too many requests', {
 *   retryAfterSeconds: 60,
 * });
 * ```
 */
export class RateLimitError extends OrkestraError {
  /** Seconds until rate limit resets */
  readonly retryAfterSeconds: number | undefined;

  constructor(
    message: string = 'Rate limit exceeded',
    options: RateLimitErrorOptions = {}
  ) {
    const details = options.details ?? (options.retryAfterSeconds !== undefined ? { retryAfterSeconds: options.retryAfterSeconds } : undefined);
    super(message, {
      code: 'RATE_LIMITED',
      statusCode: 429,
      details,
    });
    this.name = 'RateLimitError';
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

/**
 * Options for ServiceUnavailableError
 */
interface ServiceUnavailableErrorOptions {
  details?: ErrorDetails | undefined;
  cause?: Error | undefined;
}

/**
 * Error for service unavailable (503)
 *
 * @example
 * ```typescript
 * throw new ServiceUnavailableError('Database connection failed');
 * ```
 */
export class ServiceUnavailableError extends OrkestraError {
  constructor(
    message: string = 'Service temporarily unavailable',
    options: ServiceUnavailableErrorOptions = {}
  ) {
    super(message, {
      code: 'SERVICE_UNAVAILABLE',
      statusCode: 503,
      details: options.details,
      cause: options.cause,
    });
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Options for InvalidStateError
 */
interface InvalidStateErrorOptions {
  details?: ErrorDetails | undefined;
}

/**
 * Error for invalid state transitions
 *
 * @example
 * ```typescript
 * throw new InvalidStateError('Cannot cancel a completed task', {
 *   details: { currentState: 'completed', attemptedState: 'cancelled' },
 * });
 * ```
 */
export class InvalidStateError extends OrkestraError {
  constructor(message: string, options: InvalidStateErrorOptions = {}) {
    super(message, {
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 400,
      details: options.details,
    });
    this.name = 'InvalidStateError';
  }
}

/**
 * Options for LimitExceededError
 */
interface LimitExceededErrorOptions {
  details?: ErrorDetails | undefined;
}

/**
 * Error for exceeded limits
 *
 * @example
 * ```typescript
 * throw new LimitExceededError('Maximum user limit reached', {
 *   details: { limit: 10, current: 10 },
 * });
 * ```
 */
export class LimitExceededError extends OrkestraError {
  constructor(message: string, options: LimitExceededErrorOptions = {}) {
    super(message, {
      code: 'LIMIT_EXCEEDED',
      statusCode: 402, // Payment Required - upgrade plan
      details: options.details,
    });
    this.name = 'LimitExceededError';
  }
}

/**
 * Check if an error is an OrkestraError
 */
export function isOrkestraError(error: unknown): error is OrkestraError {
  return error instanceof OrkestraError;
}

/**
 * Wrap an unknown error as an OrkestraError
 */
export function wrapError(error: unknown): OrkestraError {
  if (isOrkestraError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new OrkestraError(error.message, {
      cause: error,
      isOperational: false,
    });
  }

  return new OrkestraError(String(error), {
    isOperational: false,
  });
}
