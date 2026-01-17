/**
 * Langfuse Tracing Interceptor
 *
 * Provides observability for Temporal workflows and activities
 * through Langfuse integration. Traces are created for workflow
 * executions and activity calls.
 */

import type {
  WorkflowClientInterceptor,
  Next,
  Headers,
  WorkflowStartInput,
} from '@temporalio/client';
import type {
  ActivityInterceptorsFactory,
  ActivityInboundCallsInterceptor,
  ActivityExecuteInput,
} from '@temporalio/worker';
import type { Context as ActivityContext } from '@temporalio/activity';
import type {
  WorkflowInterceptorsFactory,
  WorkflowInboundCallsInterceptor,
  WorkflowExecuteInput,
} from '@temporalio/workflow';
import type { LangfuseConfig } from '../../config/index.js';
import { TENANT_ID_HEADER } from './tenant.js';

/**
 * Header key for trace ID
 */
export const TRACE_ID_HEADER = 'x-trace-id';

/**
 * Header key for parent span ID
 */
export const PARENT_SPAN_ID_HEADER = 'x-parent-span-id';

/**
 * Langfuse trace interface (subset for our needs)
 * This avoids requiring the langfuse package as a direct dependency
 */
export interface LangfuseTrace {
  /** Trace ID */
  id: string;
  /** Create a span within this trace */
  span(options: LangfuseSpanOptions): LangfuseSpan;
  /** Update the trace */
  update(options: LangfuseTraceUpdateOptions): void;
}

export interface LangfuseSpan {
  /** Span ID */
  id: string;
  /** Create a nested span */
  span(options: LangfuseSpanOptions): LangfuseSpan;
  /** Mark span as ended */
  end(options?: LangfuseSpanEndOptions): void;
  /** Update the span */
  update(options?: LangfuseSpanEndOptions): void;
}

export interface LangfuseSpanOptions {
  name: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
}

export interface LangfuseTraceUpdateOptions {
  output?: unknown;
  metadata?: Record<string, unknown>;
}

export interface LangfuseSpanEndOptions {
  output?: unknown;
  metadata?: Record<string, unknown>;
  level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
  statusMessage?: string;
}

/**
 * Langfuse client interface
 */
export interface LangfuseClient {
  /** Create a new trace */
  trace(options: { name: string; id?: string; metadata?: Record<string, unknown>; input?: unknown }): LangfuseTrace;
  /** Get an existing trace */
  getTrace?(id: string): LangfuseTrace | undefined;
  /** Flush pending events */
  flush(): Promise<void>;
  /** Shutdown the client */
  shutdown(): Promise<void>;
}

/**
 * Options for tracing interceptor
 */
export interface TracingInterceptorOptions {
  /** Langfuse configuration */
  langfuseConfig?: LangfuseConfig;
  /** Langfuse client instance */
  langfuseClient?: LangfuseClient;
  /** Whether to trace workflows */
  traceWorkflows?: boolean;
  /** Whether to trace activities */
  traceActivities?: boolean;
  /** Custom trace name prefix */
  traceNamePrefix?: string;
  /** Additional metadata to include in traces */
  defaultMetadata?: Record<string, unknown>;
}

/**
 * Generate a unique trace ID
 */
function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Check if tracing is enabled
 */
function isTracingEnabled(options: TracingInterceptorOptions): boolean {
  return !!(options.langfuseConfig?.enabled && options.langfuseClient);
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
 * Create a client-side tracing interceptor
 *
 * Adds trace context to workflow starts for distributed tracing.
 *
 * @example
 * ```typescript
 * const client = await createTemporalClient({
 *   config,
 *   interceptors: {
 *     workflow: [
 *       createTracingClientInterceptor({
 *         langfuseConfig: config.langfuse,
 *         langfuseClient: langfuse,
 *       }),
 *     ],
 *   },
 * });
 * ```
 */
export function createTracingClientInterceptor(
  options: TracingInterceptorOptions
): WorkflowClientInterceptor {
  const { langfuseClient, traceNamePrefix = 'workflow' } = options;

  if (!isTracingEnabled(options)) {
    // Return no-op interceptor
    return {};
  }

  return {
    async start(
      input: WorkflowStartInput,
      next: Next<WorkflowClientInterceptor, 'start'>
    ): Promise<string> {
      // Generate or use existing trace ID
      const traceId = generateTraceId();

      // Create trace for workflow start
      const trace = langfuseClient!.trace({
        name: `${traceNamePrefix}.${input.workflowType}`,
        id: traceId,
        input: {
          workflowType: input.workflowType,
        },
        metadata: {
          ...options.defaultMetadata,
          workflowType: input.workflowType,
          taskQueue: input.options.taskQueue,
          tenantId: decodeHeaderValue(input.headers?.[TENANT_ID_HEADER]),
        },
      });

      // Add trace ID to headers for propagation
      const headers: Headers = {
        ...input.headers,
        [TRACE_ID_HEADER]: encodeHeaderValue(traceId),
      };

      try {
        // The start method returns the runId as a string
        const runId = await next({
          ...input,
          headers,
        });

        // Update trace with result
        trace.update({
          output: { runId },
          metadata: {
            status: 'started',
          },
        });

        return runId;
      } catch (error) {
        trace.update({
          output: { error: error instanceof Error ? error.message : String(error) },
          metadata: {
            status: 'failed',
          },
        });
        throw error;
      }
    },
  };
}

/**
 * Current trace context for workflow
 */
let currentWorkflowTrace: LangfuseTrace | undefined;
let currentWorkflowSpan: LangfuseSpan | undefined;

/**
 * Get the current trace in a workflow context
 */
export function getWorkflowTrace(): LangfuseTrace | undefined {
  return currentWorkflowTrace;
}

/**
 * Get the current span in a workflow context
 */
export function getWorkflowSpan(): LangfuseSpan | undefined {
  return currentWorkflowSpan;
}

/**
 * Create a workflow-side tracing interceptor
 *
 * Traces workflow execution and creates spans for activities.
 *
 * @param options - Tracing options
 * @returns Workflow interceptors factory
 */
export function createTracingWorkflowInterceptor(
  options: TracingInterceptorOptions
): WorkflowInterceptorsFactory {
  const {
    traceWorkflows = true,
    traceNamePrefix = 'workflow',
  } = options;

  if (!isTracingEnabled(options) || !traceWorkflows) {
    return () => ({});
  }

  const inboundInterceptor: WorkflowInboundCallsInterceptor = {
    async execute(
      input: WorkflowExecuteInput,
      next: Next<WorkflowInboundCallsInterceptor, 'execute'>
    ): Promise<unknown> {
      // Get trace ID from headers
      const traceId = decodeHeaderValue(input.headers?.[TRACE_ID_HEADER]);

      if (!traceId || !options.langfuseClient) {
        return next(input);
      }

      // Create or get trace
      const trace = options.langfuseClient.trace({
        name: `${traceNamePrefix}.execute`,
        id: traceId,
        metadata: {
          ...options.defaultMetadata,
          phase: 'execute',
        },
      });

      // Create span for this execution
      const span = trace.span({
        name: 'workflow.run',
        input: input.args,
        metadata: {
          tenantId: decodeHeaderValue(input.headers?.[TENANT_ID_HEADER]),
        },
      });

      // Set current context
      const previousTrace = currentWorkflowTrace;
      const previousSpan = currentWorkflowSpan;
      currentWorkflowTrace = trace;
      currentWorkflowSpan = span;

      try {
        const result = await next(input);
        span.end({
          output: result,
          level: 'DEFAULT',
        });
        return result;
      } catch (error) {
        span.end({
          output: { error: error instanceof Error ? error.message : String(error) },
          level: 'ERROR',
          statusMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        currentWorkflowTrace = previousTrace;
        currentWorkflowSpan = previousSpan;
      }
    },
  };

  return () => ({
    inbound: [inboundInterceptor],
  });
}

/**
 * Current trace context for activity
 */
let currentActivityTrace: LangfuseTrace | undefined;
let currentActivitySpan: LangfuseSpan | undefined;

/**
 * Get the current trace in an activity context
 */
export function getActivityTrace(): LangfuseTrace | undefined {
  return currentActivityTrace;
}

/**
 * Get the current span in an activity context
 */
export function getActivitySpan(): LangfuseSpan | undefined {
  return currentActivitySpan;
}

/**
 * Create an activity-side tracing interceptor
 *
 * Traces activity execution with input/output and timing.
 *
 * @param options - Tracing options
 * @returns Activity interceptors factory
 */
export function createTracingActivityInterceptor(
  options: TracingInterceptorOptions
): ActivityInterceptorsFactory {
  const {
    traceActivities = true,
    traceNamePrefix = 'activity',
  } = options;

  if (!isTracingEnabled(options) || !traceActivities) {
    return () => ({});
  }

  return (ctx: ActivityContext) => {
    const inboundInterceptor: ActivityInboundCallsInterceptor = {
      async execute(
        input: ActivityExecuteInput,
        next: Next<ActivityInboundCallsInterceptor, 'execute'>
      ): Promise<unknown> {
        // Get trace ID from headers
        const traceId = decodeHeaderValue(input.headers[TRACE_ID_HEADER]);

        if (!traceId || !options.langfuseClient) {
          return next(input);
        }

        // Get or create trace
        const trace = options.langfuseClient.trace({
          name: `${traceNamePrefix}.${ctx.info.activityType}`,
          id: traceId,
          metadata: {
            ...options.defaultMetadata,
            activityType: ctx.info.activityType,
          },
        });

        // Create span for this activity
        const span = trace.span({
          name: `${traceNamePrefix}.${ctx.info.activityType}`,
          input: input.args,
          metadata: {
            attempt: ctx.info.attempt,
            taskQueue: ctx.info.taskQueue,
            workflowId: ctx.info.workflowExecution.workflowId,
            runId: ctx.info.workflowExecution.runId,
            tenantId: decodeHeaderValue(input.headers[TENANT_ID_HEADER]),
          },
        });

        // Set current context
        const previousTrace = currentActivityTrace;
        const previousSpan = currentActivitySpan;
        currentActivityTrace = trace;
        currentActivitySpan = span;

        const startTime = Date.now();

        try {
          const result = await next(input);
          span.end({
            output: result,
            level: 'DEFAULT',
            metadata: {
              durationMs: Date.now() - startTime,
            },
          });
          return result;
        } catch (error) {
          span.end({
            output: { error: error instanceof Error ? error.message : String(error) },
            level: 'ERROR',
            statusMessage: error instanceof Error ? error.message : String(error),
            metadata: {
              durationMs: Date.now() - startTime,
              errorType: error instanceof Error ? error.name : 'Unknown',
            },
          });
          throw error;
        } finally {
          currentActivityTrace = previousTrace;
          currentActivitySpan = previousSpan;
        }
      },
    };

    return {
      inbound: inboundInterceptor,
    };
  };
}

/**
 * Create a span within the current activity trace
 *
 * Useful for tracing sub-operations within an activity.
 *
 * @example
 * ```typescript
 * async function myActivity(input: Input) {
 *   const span = createActivityChildSpan('database-query');
 *   try {
 *     const result = await db.query(...);
 *     span?.end({ output: result });
 *     return result;
 *   } catch (error) {
 *     span?.end({ level: 'ERROR', statusMessage: error.message });
 *     throw error;
 *   }
 * }
 * ```
 */
export function createActivityChildSpan(
  name: string,
  options?: Omit<LangfuseSpanOptions, 'name'>
): LangfuseSpan | undefined {
  if (!currentActivitySpan) {
    return undefined;
  }

  return currentActivitySpan.span({
    name,
    ...options,
  });
}

/**
 * Combined tracing options for all interceptors
 */
export interface CreateTracingInterceptorsOptions extends TracingInterceptorOptions {
  /** Include client interceptor */
  includeClient?: boolean;
  /** Include workflow interceptor */
  includeWorkflow?: boolean;
  /** Include activity interceptor */
  includeActivity?: boolean;
}

/**
 * Create all tracing interceptors at once
 *
 * @example
 * ```typescript
 * const interceptors = createTracingInterceptors({
 *   langfuseConfig: config.langfuse,
 *   langfuseClient: langfuse,
 * });
 *
 * // Use in client
 * const client = await createTemporalClient({
 *   config,
 *   interceptors: { workflow: [interceptors.client] },
 * });
 *
 * // Use in worker
 * const worker = await createWorker({
 *   config,
 *   interceptors: {
 *     workflow: [interceptors.workflow],
 *     activity: [interceptors.activity],
 *   },
 * });
 * ```
 */
export function createTracingInterceptors(options: CreateTracingInterceptorsOptions): {
  client: WorkflowClientInterceptor;
  workflow: WorkflowInterceptorsFactory;
  activity: ActivityInterceptorsFactory;
} {
  return {
    client: options.includeClient !== false
      ? createTracingClientInterceptor(options)
      : {},
    workflow: options.includeWorkflow !== false
      ? createTracingWorkflowInterceptor(options)
      : () => ({}),
    activity: options.includeActivity !== false
      ? createTracingActivityInterceptor(options)
      : () => ({}),
  };
}
