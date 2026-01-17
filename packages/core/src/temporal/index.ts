/**
 * Temporal Integration
 *
 * This module provides Temporal SDK integration for Orkestra,
 * including client factories, worker configuration, and interceptors
 * for multi-tenancy and observability.
 *
 * @example
 * ```typescript
 * import {
 *   createTemporalClient,
 *   createWorker,
 *   TemporalConnectionManager,
 *   checkTemporalHealth,
 * } from '@orkestra/core';
 *
 * // Create a managed client
 * const connectionManager = new TemporalConnectionManager({ config });
 * const client = await createTemporalClient({
 *   config,
 *   connectionManager,
 * });
 *
 * // Check health
 * const health = await checkTemporalHealth(client);
 *
 * // Create a worker
 * const worker = await createWorker({
 *   config,
 *   taskQueue: 'my-queue',
 *   workflowsPath: require.resolve('./workflows'),
 *   activities,
 * });
 *
 * // Run the worker
 * await worker.run();
 * ```
 *
 * @packageDocumentation
 */

// Connection management
export {
  TemporalConnectionManager,
  createTemporalConnection,
} from './connection.js';

export type {
  TemporalConnectionOptions,
  HealthCheckResult,
} from './connection.js';

// Client factory
export {
  createTemporalClient,
  checkTemporalHealth,
  ManagedTemporalClient,
} from './client.js';

export type {
  CreateTemporalClientOptions,
  TemporalHealthCheckResult,
  ManagedTemporalClientOptions,
} from './client.js';

// Worker factory
export { createWorker, WorkerRunner } from './worker.js';

export type {
  CreateWorkerOptions,
  ActivityDefinition,
  ActivityMap,
  WorkerHealthCheckResult,
} from './worker.js';

// Interceptors
export {
  // Tenant interceptor
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
  // Tracing interceptor
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
} from './interceptors/index.js';

export type {
  TenantInterceptorOptions,
  TenantAwareInput,
  TracingInterceptorOptions,
  CreateTracingInterceptorsOptions,
  LangfuseClient,
  LangfuseTrace,
  LangfuseSpan,
  LangfuseSpanOptions,
  LangfuseTraceUpdateOptions,
  LangfuseSpanEndOptions,
} from './interceptors/index.js';
