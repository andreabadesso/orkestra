/**
 * tRPC Setup
 *
 * Initializes tRPC with context, procedures, and middleware.
 */

import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context.js';
import {
  UnauthorizedError,
  ForbiddenError,
  isOrkestraError,
} from '@orkestra/core';

/**
 * Initialize tRPC with our context
 */
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    // Extract additional error details for Orkestra errors
    const cause = error.cause;
    let orkestraError: { code?: string; details?: unknown } | undefined;

    if (cause && isOrkestraError(cause)) {
      orkestraError = {
        code: cause.code,
        details: cause.details,
      };
    }

    return {
      ...shape,
      data: {
        ...shape.data,
        orkestraError,
      },
    };
  },
});

/**
 * Export router and procedure factories
 */
export const router = t.router;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;

/**
 * Public procedure - no authentication required
 */
export const publicProcedure = t.procedure;

/**
 * Middleware to check authentication
 */
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.auth.authenticated) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      cause: new UnauthorizedError('Authentication required'),
    });
  }

  if (!ctx.requestContext) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid authentication context',
      cause: new UnauthorizedError('Invalid authentication context'),
    });
  }

  if (!ctx.repositories) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database not configured',
    });
  }

  return next({
    ctx: {
      ...ctx,
      // Narrow the types - we know these are defined now
      auth: ctx.auth as Required<typeof ctx.auth>,
      requestContext: ctx.requestContext,
      repositories: ctx.repositories,
    },
  });
});

/**
 * Middleware to check admin role
 */
const isAdmin = middleware(async ({ ctx, next }) => {
  // Must be authenticated first
  if (!ctx.auth.authenticated) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      cause: new UnauthorizedError('Authentication required'),
    });
  }

  // Check for admin role (JWT auth) or admin permission (API key auth)
  const isAdminRole = ctx.auth.role === 'admin';
  const hasAdminPermission = ctx.auth.permissions?.includes('admin') ?? false;

  if (!isAdminRole && !hasAdminPermission) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
      cause: new ForbiddenError('Admin access required'),
    });
  }

  if (!ctx.requestContext) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid authentication context',
      cause: new UnauthorizedError('Invalid authentication context'),
    });
  }

  if (!ctx.repositories) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database not configured',
    });
  }

  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth as Required<typeof ctx.auth>,
      requestContext: ctx.requestContext,
      repositories: ctx.repositories,
    },
  });
});

/**
 * Middleware to check manager or admin role
 */
const isManagerOrAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.auth.authenticated) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      cause: new UnauthorizedError('Authentication required'),
    });
  }

  const isAdminOrManager =
    ctx.auth.role === 'admin' ||
    ctx.auth.role === 'manager' ||
    ctx.auth.permissions?.includes('admin') ||
    ctx.auth.permissions?.includes('manager');

  if (!isAdminOrManager) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Manager or admin access required',
      cause: new ForbiddenError('Manager or admin access required'),
    });
  }

  if (!ctx.requestContext) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid authentication context',
      cause: new UnauthorizedError('Invalid authentication context'),
    });
  }

  if (!ctx.repositories) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database not configured',
    });
  }

  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth as Required<typeof ctx.auth>,
      requestContext: ctx.requestContext,
      repositories: ctx.repositories,
    },
  });
});

/**
 * Authenticated procedure - requires valid authentication
 */
export const authedProcedure = t.procedure.use(isAuthed);

/**
 * Admin procedure - requires admin role
 */
export const adminProcedure = t.procedure.use(isAdmin);

/**
 * Manager procedure - requires manager or admin role
 */
export const managerProcedure = t.procedure.use(isManagerOrAdmin);

// Re-export context types
export type { Context, CreateContextOptions, AuthResult } from './context.js';
export { createContext, createContextFactory } from './context.js';
