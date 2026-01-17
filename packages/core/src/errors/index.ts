/**
 * Error module for Orkestra
 *
 * Provides typed error classes with proper HTTP status codes
 * and serialization support.
 */

export {
  OrkestraError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  InvalidStateError,
  LimitExceededError,
  isOrkestraError,
  wrapError,
} from './base-error.js';

export type {
  ErrorCode,
  ErrorDetails,
  SerializedError,
} from './base-error.js';
