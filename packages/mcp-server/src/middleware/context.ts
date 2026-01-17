/**
 * Request Context Middleware
 *
 * Utilities for creating and managing request context.
 */

import type { TenantId, UserId } from '@orkestra/core';
import type { RequestContext } from '../types.js';

/**
 * Counter for generating unique request IDs within a process
 */
let requestCounter = 0;

/**
 * Generate a unique request ID
 *
 * Format: req_<timestamp>_<counter>_<random>
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const counter = (++requestCounter).toString(36).padStart(4, '0');
  const random = Math.random().toString(36).slice(2, 8);
  return `req_${timestamp}_${counter}_${random}`;
}

/**
 * Create a request context from validated auth info
 *
 * @param tenantId - The tenant ID from authentication
 * @param userId - Optional user ID from authentication
 * @param requestId - Optional custom request ID
 * @returns The request context
 */
export function createRequestContext(
  tenantId: string,
  userId?: string,
  requestId?: string
): RequestContext {
  return {
    tenantId: tenantId as TenantId,
    userId: userId as UserId | undefined,
    requestId: requestId ?? generateRequestId(),
    timestamp: new Date(),
  };
}

/**
 * Create a context for tenant operations
 * This is a helper for when you have a tenant ID but no authenticated user
 */
export function createTenantContext(
  tenantId: string,
  requestId?: string
): RequestContext {
  return createRequestContext(tenantId, undefined, requestId);
}

/**
 * Create a context for system operations
 * This is for internal operations that aren't tied to a specific tenant
 */
export function createSystemContext(requestId?: string): RequestContext {
  return {
    tenantId: 'system' as TenantId,
    requestId: requestId ?? generateRequestId(),
    timestamp: new Date(),
  };
}

/**
 * Extract context information from environment or headers
 *
 * This is useful for extracting context from MCP protocol metadata
 * or other request sources.
 */
export function extractContextFromEnv(): Partial<RequestContext> {
  const context: Partial<RequestContext> = {
    timestamp: new Date(),
  };

  // Extract tenant ID from environment
  const tenantId = process.env['ORKESTRA_TENANT_ID'];
  if (tenantId) {
    context.tenantId = tenantId as TenantId;
  }

  // Extract user ID from environment
  const userId = process.env['ORKESTRA_USER_ID'];
  if (userId) {
    context.userId = userId as UserId;
  }

  // Extract or generate request ID
  const requestId = process.env['ORKESTRA_REQUEST_ID'];
  context.requestId = requestId ?? generateRequestId();

  return context;
}

/**
 * Validate that a context has all required fields
 */
export function isCompleteContext(
  context: Partial<RequestContext>
): context is RequestContext {
  return (
    typeof context.tenantId === 'string' &&
    typeof context.requestId === 'string' &&
    context.timestamp instanceof Date
  );
}

/**
 * Create a child context for sub-operations
 * Preserves tenant/user but generates a new request ID with parent reference
 */
export function createChildContext(
  parent: RequestContext,
  operationName?: string
): RequestContext {
  const childId = generateRequestId();
  const requestId = operationName
    ? `${childId}:${operationName}`
    : childId;

  return {
    ...parent,
    requestId,
    timestamp: new Date(),
  };
}
