/**
 * Request context for handling request-scoped data
 *
 * Provides a way to pass request-specific information through
 * the application without explicitly threading it through every function.
 */

import type { TenantId, UserId } from '../types/common.js';

/**
 * Request context data
 */
export interface RequestContextData {
  /** Unique request ID for tracing */
  requestId: string;
  /** Tenant ID for multi-tenancy */
  tenantId: TenantId;
  /** Authenticated user ID (null for unauthenticated requests) */
  userId: UserId | null;
  /** Request timestamp */
  timestamp: Date;
  /** Request source (e.g., 'api', 'mcp', 'webhook') */
  source: string;
  /** Correlation ID for distributed tracing */
  correlationId?: string;
  /** User agent string */
  userAgent?: string;
  /** Client IP address */
  clientIp?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Request context class for managing request-scoped data
 *
 * Uses AsyncLocalStorage internally for automatic context propagation
 * across async boundaries.
 *
 * @example
 * ```typescript
 * const ctx = new RequestContext({
 *   requestId: 'req_123',
 *   tenantId: 'ten_abc' as TenantId,
 *   userId: null,
 *   timestamp: new Date(),
 *   source: 'api',
 * });
 *
 * // Access context data
 * console.log(ctx.requestId);
 * console.log(ctx.tenantId);
 * ```
 */
export class RequestContext {
  private readonly data: RequestContextData;

  constructor(data: RequestContextData) {
    this.data = Object.freeze({ ...data });
  }

  /** Unique request ID */
  get requestId(): string {
    return this.data.requestId;
  }

  /** Tenant ID */
  get tenantId(): TenantId {
    return this.data.tenantId;
  }

  /** User ID (null if not authenticated) */
  get userId(): UserId | null {
    return this.data.userId;
  }

  /** Request timestamp */
  get timestamp(): Date {
    return this.data.timestamp;
  }

  /** Request source */
  get source(): string {
    return this.data.source;
  }

  /** Correlation ID for distributed tracing */
  get correlationId(): string | undefined {
    return this.data.correlationId;
  }

  /** User agent string */
  get userAgent(): string | undefined {
    return this.data.userAgent;
  }

  /** Client IP address */
  get clientIp(): string | undefined {
    return this.data.clientIp;
  }

  /** Additional metadata */
  get metadata(): Record<string, unknown> | undefined {
    return this.data.metadata;
  }

  /**
   * Check if the request is authenticated
   */
  isAuthenticated(): this is RequestContext & { userId: UserId } {
    return this.data.userId !== null;
  }

  /**
   * Get a serializable representation of the context
   */
  toJSON(): RequestContextData {
    return { ...this.data };
  }

  /**
   * Create a new context with updated data
   */
  with(updates: Partial<RequestContextData>): RequestContext {
    return new RequestContext({
      ...this.data,
      ...updates,
    });
  }

  /**
   * Create a child context with a new request ID but same correlation
   */
  child(requestId: string): RequestContext {
    return new RequestContext({
      ...this.data,
      requestId,
      correlationId: this.data.correlationId ?? this.data.requestId,
    });
  }
}

/**
 * Input for creating a request context
 */
export type CreateRequestContextInput = Omit<RequestContextData, 'timestamp'> & {
  timestamp?: Date;
};

/**
 * Create a new request context
 *
 * @param input - Context input data
 * @returns New request context
 */
export function createRequestContext(input: CreateRequestContextInput): RequestContext {
  return new RequestContext({
    ...input,
    timestamp: input.timestamp ?? new Date(),
  });
}
