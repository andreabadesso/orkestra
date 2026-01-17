/**
 * Tenant Context Interceptor
 *
 * Extracts and enforces tenant context in Temporal workflows and activities.
 * Ensures multi-tenancy is properly enforced throughout the execution.
 */

import type {
  WorkflowClientInterceptor,
  Next,
  Headers,
  WorkflowStartInput,
  WorkflowSignalInput,
  WorkflowQueryInput,
} from '@temporalio/client';
import type {
  ActivityInterceptorsFactory,
  ActivityInboundCallsInterceptor,
  ActivityExecuteInput,
} from '@temporalio/worker';
import type {
  WorkflowInterceptorsFactory,
  WorkflowInboundCallsInterceptor,
  WorkflowExecuteInput,
} from '@temporalio/workflow';
import type { TenantId } from '../../types/common.js';

/**
 * Header key for tenant ID
 */
export const TENANT_ID_HEADER = 'x-tenant-id';

/**
 * Memo key for tenant ID (used as fallback)
 */
export const TENANT_ID_MEMO_KEY = 'tenantId';

/**
 * Options for tenant interceptor
 */
export interface TenantInterceptorOptions {
  /** Default tenant ID to use when none is provided */
  defaultTenantId?: TenantId;
  /** Whether to require tenant ID (throws if missing and no default) */
  requireTenantId?: boolean;
  /** Custom header key for tenant ID */
  headerKey?: string;
  /** Custom memo key for tenant ID */
  memoKey?: string;
}

/**
 * Extract tenant ID from workflow input
 */
function extractTenantFromInput(input: unknown): TenantId | undefined {
  if (
    input &&
    typeof input === 'object' &&
    'tenantId' in input &&
    typeof (input as { tenantId: unknown }).tenantId === 'string'
  ) {
    return (input as { tenantId: string }).tenantId as TenantId;
  }
  return undefined;
}

/**
 * Encode a string value to a Payload-like structure for headers
 */
function encodeHeaderValue(value: string): { data: Uint8Array } {
  return { data: new TextEncoder().encode(value) };
}

/**
 * Decode a header value from Payload structure
 */
function decodeHeaderValue(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const data = (payload as { data: unknown }).data;
    if (data instanceof Uint8Array) {
      return new TextDecoder().decode(data);
    }
    if (typeof data === 'string') {
      return data;
    }
  }
  return undefined;
}

/**
 * Client-side interceptor for adding tenant context to workflows
 *
 * Attaches tenant ID to workflow headers and memo for propagation.
 *
 * @example
 * ```typescript
 * const client = await createTemporalClient({
 *   config,
 *   interceptors: {
 *     workflow: [createTenantClientInterceptor({ tenantId })],
 *   },
 * });
 * ```
 */
export function createTenantClientInterceptor(
  tenantId: TenantId,
  options: TenantInterceptorOptions = {}
): WorkflowClientInterceptor {
  const headerKey = options.headerKey ?? TENANT_ID_HEADER;
  const memoKey = options.memoKey ?? TENANT_ID_MEMO_KEY;

  return {
    async start(
      input: WorkflowStartInput,
      next: Next<WorkflowClientInterceptor, 'start'>
    ) {
      // Add tenant ID to headers as encoded payload
      const headers: Headers = {
        ...input.headers,
        [headerKey]: encodeHeaderValue(tenantId),
      };

      // Also add to memo for persistence
      const memo: Record<string, unknown> = {
        ...input.options.memo,
        [memoKey]: tenantId,
      };

      return next({
        ...input,
        headers,
        options: {
          ...input.options,
          memo,
        },
      });
    },

    async signal(
      input: WorkflowSignalInput,
      next: Next<WorkflowClientInterceptor, 'signal'>
    ) {
      // Add tenant ID to signal headers
      const headers: Headers = {
        ...input.headers,
        [headerKey]: encodeHeaderValue(tenantId),
      };

      return next({
        ...input,
        headers,
      });
    },

    async query(
      input: WorkflowQueryInput,
      next: Next<WorkflowClientInterceptor, 'query'>
    ) {
      // Add tenant ID to query headers
      const headers: Headers = {
        ...input.headers,
        [headerKey]: encodeHeaderValue(tenantId),
      };

      return next({
        ...input,
        headers,
      });
    },
  };
}

/**
 * Current tenant context for workflow execution
 */
let currentWorkflowTenantId: TenantId | undefined;

/**
 * Get the current tenant ID in a workflow context
 *
 * @returns The current tenant ID
 * @throws Error if no tenant context is available
 */
export function getWorkflowTenantId(): TenantId {
  if (!currentWorkflowTenantId) {
    throw new Error('No tenant context available in workflow');
  }
  return currentWorkflowTenantId;
}

/**
 * Get the current tenant ID or undefined if not available
 */
export function getWorkflowTenantIdOrUndefined(): TenantId | undefined {
  return currentWorkflowTenantId;
}

/**
 * Create workflow-side tenant interceptor
 *
 * Extracts tenant ID from headers/memo and makes it available
 * during workflow execution.
 *
 * @param options - Interceptor options
 * @returns Workflow interceptors factory
 */
export function createTenantWorkflowInterceptor(
  options: TenantInterceptorOptions = {}
): WorkflowInterceptorsFactory {
  const headerKey = options.headerKey ?? TENANT_ID_HEADER;

  const inboundInterceptor: WorkflowInboundCallsInterceptor = {
    async execute(
      input: WorkflowExecuteInput,
      next: Next<WorkflowInboundCallsInterceptor, 'execute'>
    ): Promise<unknown> {
      // Try to get tenant ID from headers first
      let tenantId: TenantId | undefined;

      if (input.headers?.[headerKey]) {
        const decoded = decodeHeaderValue(input.headers[headerKey]);
        if (decoded) {
          tenantId = decoded as TenantId;
        }
      }

      // Fall back to first workflow argument if it has tenantId
      if (!tenantId && input.args.length > 0) {
        tenantId = extractTenantFromInput(input.args[0]);
      }

      // Use default if configured
      if (!tenantId && options.defaultTenantId) {
        tenantId = options.defaultTenantId;
      }

      // Enforce requirement
      if (!tenantId && options.requireTenantId) {
        throw new Error(
          'Tenant ID is required but not found in headers or workflow input'
        );
      }

      // Set current tenant context
      const previousTenantId = currentWorkflowTenantId;
      currentWorkflowTenantId = tenantId;

      try {
        return await next(input);
      } finally {
        currentWorkflowTenantId = previousTenantId;
      }
    },
  };

  return () => ({
    inbound: [inboundInterceptor],
  });
}

/**
 * Current tenant context for activity execution
 */
let currentActivityTenantId: TenantId | undefined;

/**
 * Get the current tenant ID in an activity context
 *
 * @returns The current tenant ID
 * @throws Error if no tenant context is available
 */
export function getActivityTenantId(): TenantId {
  if (!currentActivityTenantId) {
    throw new Error('No tenant context available in activity');
  }
  return currentActivityTenantId;
}

/**
 * Get the current tenant ID or undefined if not available
 */
export function getActivityTenantIdOrUndefined(): TenantId | undefined {
  return currentActivityTenantId;
}

/**
 * Create activity-side tenant interceptor
 *
 * Extracts tenant ID from headers and makes it available
 * during activity execution.
 *
 * @param options - Interceptor options
 * @returns Activity interceptors factory
 */
export function createTenantActivityInterceptor(
  options: TenantInterceptorOptions = {}
): ActivityInterceptorsFactory {
  const headerKey = options.headerKey ?? TENANT_ID_HEADER;

  const inboundInterceptor: ActivityInboundCallsInterceptor = {
    async execute(
      input: ActivityExecuteInput,
      next: Next<ActivityInboundCallsInterceptor, 'execute'>
    ): Promise<unknown> {
      // Get tenant ID from headers
      let tenantId: TenantId | undefined;

      if (input.headers[headerKey]) {
        const decoded = decodeHeaderValue(input.headers[headerKey]);
        if (decoded) {
          tenantId = decoded as TenantId;
        }
      }

      // Try first argument if it has tenantId
      if (!tenantId && input.args.length > 0) {
        tenantId = extractTenantFromInput(input.args[0]);
      }

      // Use default if configured
      if (!tenantId && options.defaultTenantId) {
        tenantId = options.defaultTenantId;
      }

      // Enforce requirement
      if (!tenantId && options.requireTenantId) {
        throw new Error(
          'Tenant ID is required but not found in headers or activity input'
        );
      }

      // Set current tenant context
      const previousTenantId = currentActivityTenantId;
      currentActivityTenantId = tenantId;

      try {
        return await next(input);
      } finally {
        currentActivityTenantId = previousTenantId;
      }
    },
  };

  return () => ({
    inbound: inboundInterceptor,
  });
}

/**
 * Tenant-aware workflow input base type
 *
 * Extend this for workflow inputs that include tenant context.
 */
export interface TenantAwareInput {
  /** Tenant ID for multi-tenancy */
  tenantId: TenantId;
}

/**
 * Create a tenant-aware wrapper for activities
 *
 * Ensures activities receive tenant context from the activity interceptor.
 *
 * @example
 * ```typescript
 * const activities = withTenantContext({
 *   async sendEmail({ to, subject, body }) {
 *     const tenantId = getActivityTenantId();
 *     // Use tenantId for tenant-specific logic
 *   },
 * });
 * ```
 */
export function withTenantContext<T extends Record<string, unknown>>(
  activities: T
): T {
  // Activities are automatically wrapped by the activity interceptor
  // This is a type-safe helper for documentation purposes
  return activities;
}
