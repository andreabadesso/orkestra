/**
 * Middleware Module
 *
 * Exports HTTP middleware for authentication and error handling.
 */

export {
  createAuthMiddleware,
  generateToken,
  decodeToken,
  type AuthMiddlewareOptions,
  type AuthenticatedRequest,
} from './auth.js';

export {
  createErrorHandler,
  asyncHandler,
  sendError,
  ErrorResponses,
  type ErrorResponse,
  type ErrorHandlerOptions,
} from './error-handler.js';
