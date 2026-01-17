/**
 * @module workflow
 *
 * Workflow definition helpers for creating Temporal workflows with Orkestra patterns.
 * Provides an opinionated, ergonomic API for writing workflows.
 */

import * as temporalWorkflow from '@temporalio/workflow';
import { type WorkflowContext, createWorkflowContext } from './context.js';

// =============================================================================
// Workflow Definition Types
// =============================================================================

/**
 * Workflow handler function type.
 *
 * @typeParam TInput - Input type for the workflow
 * @typeParam TOutput - Output type for the workflow
 */
export type WorkflowHandler<TInput, TOutput> = (
  ctx: WorkflowContext,
  input: TInput
) => Promise<TOutput>;

/**
 * A workflow definition created by the workflow() helper.
 *
 * @typeParam TInput - Input type for the workflow
 * @typeParam TOutput - Output type for the workflow
 */
export interface WorkflowDefinition<TInput, TOutput> {
  /** Workflow name (used as Temporal workflow type) */
  name: string;
  /** The workflow handler function */
  handler: WorkflowHandler<TInput, TOutput>;
  /** Execute the workflow (for use with Temporal) */
  execute: (input: TInput & { tenantId: string }) => Promise<TOutput>;
}

/**
 * Options for workflow definition.
 */
export interface WorkflowOptions {
  /** Default task queue for the workflow */
  taskQueue?: string;
  /** Description for documentation */
  description?: string;
  /** Tags for categorization */
  tags?: string[];
}

// =============================================================================
// Workflow Definition Helper
// =============================================================================

/**
 * Define a new Orkestra workflow.
 *
 * This helper creates a workflow definition that:
 * - Automatically extracts tenant ID from input
 * - Creates a WorkflowContext with Temporal primitives
 * - Provides logging, signals, and time utilities
 *
 * @typeParam TInput - Input type for the workflow
 * @typeParam TOutput - Output type for the workflow
 * @param name - Unique workflow name (used as Temporal workflow type)
 * @param handler - Async function implementing the workflow logic
 * @returns A workflow definition that can be registered with Temporal
 *
 * @example
 * // Basic workflow definition
 * export const myWorkflow = workflow(
 *   'my-workflow',
 *   async (ctx, input: { data: string }) => {
 *     ctx.log.info('Starting workflow', { data: input.data });
 *
 *     // Create a human task
 *     const result = await task(ctx, {
 *       title: 'Review',
 *       form: { approved: { type: 'boolean' } },
 *       assignTo: { group: 'reviewers' }
 *     });
 *
 *     return { approved: result.data.approved };
 *   }
 * );
 *
 * @example
 * // Customer support workflow
 * interface SupportInput {
 *   question: string;
 *   conversationId: string;
 *   customerTier: 'basic' | 'premium' | 'enterprise';
 * }
 *
 * interface SupportOutput {
 *   answer: string;
 *   resolvedBy: 'ai' | 'human';
 *   handledBy?: string;
 * }
 *
 * export const customerSupport = workflow<SupportInput, SupportOutput>(
 *   'customer-support',
 *   async (ctx, input) => {
 *     const { question, conversationId, customerTier } = input;
 *
 *     // Tier-based SLA
 *     const slaMinutes = {
 *       basic: 60,
 *       premium: 30,
 *       enterprise: 10,
 *     }[customerTier];
 *
 *     const result = await task(ctx, {
 *       title: 'Customer Question',
 *       description: `Customer asked: ${question}`,
 *       form: {
 *         answer: { type: 'textarea', required: true }
 *       },
 *       assignTo: { group: 'support-l1' },
 *       context: { conversationId, customerTier },
 *       sla: timeout(`${slaMinutes}m`)
 *     });
 *
 *     return {
 *       answer: result.data.answer,
 *       resolvedBy: 'human',
 *       handledBy: result.completedBy,
 *     };
 *   }
 * );
 */
export function workflow<TInput, TOutput>(
  name: string,
  handler: WorkflowHandler<TInput, TOutput>
): WorkflowDefinition<TInput, TOutput> {
  // Create the execute function that wraps the handler
  const execute = async (input: TInput & { tenantId: string }): Promise<TOutput> => {
    // Extract tenant ID and create context
    const { tenantId, ...workflowInput } = input;
    const ctx = createWorkflowContext(tenantId);

    ctx.log.info('Workflow started', { workflow: name, tenantId });

    try {
      const result = await handler(ctx, workflowInput as TInput);
      ctx.log.info('Workflow completed successfully', { workflow: name });
      return result;
    } catch (error) {
      ctx.log.error('Workflow failed', {
        workflow: name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  return {
    name,
    handler,
    execute,
  };
}

// =============================================================================
// Workflow Registration Helpers
// =============================================================================

/**
 * Registry of workflow definitions for batch registration.
 */
export class WorkflowRegistry {
  private workflows = new Map<string, WorkflowDefinition<unknown, unknown>>();

  /**
   * Register a workflow definition.
   *
   * @param definition - The workflow definition to register
   */
  register<TInput, TOutput>(definition: WorkflowDefinition<TInput, TOutput>): this {
    if (this.workflows.has(definition.name)) {
      throw new Error(`Workflow '${definition.name}' is already registered`);
    }
    this.workflows.set(
      definition.name,
      definition as unknown as WorkflowDefinition<unknown, unknown>
    );
    return this;
  }

  /**
   * Get a registered workflow by name.
   *
   * @param name - The workflow name
   * @returns The workflow definition or undefined
   */
  get(name: string): WorkflowDefinition<unknown, unknown> | undefined {
    return this.workflows.get(name);
  }

  /**
   * Get all registered workflows.
   *
   * @returns Array of all workflow definitions
   */
  all(): WorkflowDefinition<unknown, unknown>[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Get workflow names.
   *
   * @returns Array of all workflow names
   */
  names(): string[] {
    return Array.from(this.workflows.keys());
  }

  /**
   * Check if a workflow is registered.
   *
   * @param name - The workflow name
   * @returns True if registered
   */
  has(name: string): boolean {
    return this.workflows.has(name);
  }

  /**
   * Export workflows as a map for Temporal worker registration.
   *
   * @returns Map of workflow name to execute function
   */
  toTemporalWorkflows(): Record<string, (...args: unknown[]) => Promise<unknown>> {
    const workflows: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
    for (const [name, def] of this.workflows) {
      workflows[name] = def.execute as (...args: unknown[]) => Promise<unknown>;
    }
    return workflows;
  }
}

/**
 * Create a new workflow registry.
 *
 * @returns A new WorkflowRegistry instance
 *
 * @example
 * const registry = createRegistry()
 *   .register(customerSupport)
 *   .register(orderProcessing)
 *   .register(documentReview);
 *
 * // Get workflow names for worker
 * console.log(registry.names());
 */
export function createRegistry(): WorkflowRegistry {
  return new WorkflowRegistry();
}

// =============================================================================
// Workflow State Management
// =============================================================================

/**
 * State container for workflow state management.
 *
 * @typeParam T - The type of the state
 */
export interface WorkflowState<T> {
  /** Get the current state */
  get(): T;
  /** Set a new state value */
  set(value: T): void;
  /** Update state using a function */
  update(updater: (current: T) => T): void;
}

/**
 * Create a workflow state container with query handler.
 *
 * @typeParam T - The type of the state
 * @param initialState - The initial state value
 * @param queryName - Name of the query to expose state (default: 'getState')
 * @returns A state container
 *
 * @example
 * const state = createState<{ step: number; items: string[] }>({
 *   step: 0,
 *   items: []
 * });
 *
 * state.set({ step: 1, items: ['item1'] });
 * state.update(s => ({ ...s, step: s.step + 1 }));
 *
 * // State is queryable from outside the workflow
 */
export function createState<T extends Record<string, unknown>>(
  initialState: T,
  queryName = 'getState'
): WorkflowState<T> {
  let state: T = { ...initialState };

  // Set up query handler
  const query = temporalWorkflow.defineQuery<T>(queryName);
  temporalWorkflow.setHandler(query, () => state);

  return {
    get: () => ({ ...state }),
    set: (value: T) => {
      state = { ...value };
    },
    update: (updater: (current: T) => T) => {
      state = { ...updater(state) };
    },
  };
}

// =============================================================================
// Workflow Utilities
// =============================================================================

/**
 * Run multiple async operations in parallel within a workflow.
 *
 * @param operations - Array of async operations
 * @returns Array of results in the same order
 *
 * @example
 * const [userData, settings, history] = await parallel([
 *   activities.getUserData(userId),
 *   activities.getSettings(userId),
 *   activities.getHistory(userId)
 * ]);
 */
export async function parallel<T extends readonly unknown[] | []>(
  operations: { [K in keyof T]: Promise<T[K]> }
): Promise<T> {
  return Promise.all(operations) as Promise<T>;
}

/**
 * Run an operation with a timeout, throwing if it exceeds the limit.
 *
 * @typeParam T - The return type of the operation
 * @param operation - The async operation to run
 * @param timeoutMs - Timeout in milliseconds
 * @param message - Error message if timeout occurs
 * @returns The operation result
 * @throws {Error} If the operation times out
 *
 * @example
 * const result = await withTimeout(
 *   activities.processDocument(docId),
 *   30000,
 *   'Document processing timed out'
 * );
 */
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message = 'Operation timed out'
): Promise<T> {
  const result = await Promise.race([
    operation,
    temporalWorkflow.sleep(timeoutMs).then(() => {
      throw new temporalWorkflow.ApplicationFailure(message, 'TIMEOUT', true);
    }),
  ]);
  return result;
}

/**
 * Retry an operation with exponential backoff.
 *
 * @typeParam T - The return type of the operation
 * @param operation - Function that returns a promise
 * @param options - Retry options
 * @returns The operation result
 * @throws {Error} If all retries fail
 *
 * @example
 * const result = await retry(
 *   () => riskyOperation(),
 *   { maxAttempts: 3, initialDelay: 1000 }
 * );
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        await temporalWorkflow.sleep(delay);
        delay = Math.min(delay * backoffFactor, maxDelay);
      }
    }
  }

  throw new temporalWorkflow.ApplicationFailure(
    `Operation failed after ${maxAttempts} attempts: ${lastError?.message}`,
    'RETRY_EXHAUSTED',
    true,
    [lastError]
  );
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export { type WorkflowContext } from './context.js';
export { task, cancelTask, reassignTask, notifyUrgent, allTasks, anyTask } from './task.js';
export { taskWithEscalation, escalationChain } from './escalation.js';
export { timeout, deadline, timeoutWithEscalation, timeoutWithWarning } from './timeout.js';
export { parseDuration, formatDuration, type Duration } from './duration.js';
export * as signals from './signals.js';
