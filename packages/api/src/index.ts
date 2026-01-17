/**
 * @orkestra/api
 *
 * REST and tRPC API for Orkestra.
 * This package provides HTTP endpoints for external integrations
 * and the tRPC router for type-safe API access.
 *
 * @packageDocumentation
 */

export const VERSION = '0.0.1';

// ============================================================================
// Server
// ============================================================================

export {
  createServer,
  startServer,
  stopServer,
  createCaller,
  type ServerOptions,
} from './server.js';

// ============================================================================
// tRPC
// ============================================================================

// Router and procedures
export {
  router,
  middleware,
  mergeRouters,
  publicProcedure,
  authedProcedure,
  adminProcedure,
  managerProcedure,
} from './trpc/index.js';

// Context
export {
  createContext,
  createContextFactory,
  type Context,
  type CreateContextOptions,
  type AuthResult,
  type JWTPayload,
  type APIKeyPayload,
} from './trpc/context.js';

// Routers
export {
  appRouter,
  workflowRouter,
  taskRouter,
  conversationRouter,
  adminRouter,
  type AppRouter,
  type WorkflowRouter,
  type TaskRouter,
  type ConversationRouter,
  type AdminRouter,
} from './trpc/routers/index.js';

// ============================================================================
// Middleware
// ============================================================================

export {
  // Auth middleware
  createAuthMiddleware,
  generateToken,
  decodeToken,
  type AuthMiddlewareOptions,
  type AuthenticatedRequest,
  // Error handler
  createErrorHandler,
  asyncHandler,
  sendError,
  ErrorResponses,
  type ErrorResponse,
  type ErrorHandlerOptions,
} from './middleware/index.js';
