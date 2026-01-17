/**
 * Temporal Interceptors
 *
 * This module provides interceptors for Temporal workflows and activities
 * that handle cross-cutting concerns like multi-tenancy and observability.
 */

// Tenant interceptor
export {
  TENANT_ID_HEADER,
  TENANT_ID_MEMO_KEY,
  createTenantClientInterceptor,
  createTenantWorkflowInterceptor,
  createTenantActivityInterceptor,
  getWorkflowTenantId,
  getWorkflowTenantIdOrUndefined,
  getActivityTenantId,
  getActivityTenantIdOrUndefined,
  withTenantContext,
} from './tenant.js';

export type { TenantInterceptorOptions, TenantAwareInput } from './tenant.js';

// Tracing interceptor
export {
  TRACE_ID_HEADER,
  PARENT_SPAN_ID_HEADER,
  createTracingClientInterceptor,
  createTracingWorkflowInterceptor,
  createTracingActivityInterceptor,
  createTracingInterceptors,
  getWorkflowTrace,
  getWorkflowSpan,
  getActivityTrace,
  getActivitySpan,
  createActivityChildSpan,
} from './tracing.js';

export type {
  TracingInterceptorOptions,
  CreateTracingInterceptorsOptions,
  LangfuseClient,
  LangfuseTrace,
  LangfuseSpan,
  LangfuseSpanOptions,
  LangfuseTraceUpdateOptions,
  LangfuseSpanEndOptions,
} from './tracing.js';
