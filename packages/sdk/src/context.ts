/**
 * @module context
 *
 * WorkflowContext provides access to workflow metadata and Temporal primitives
 * in a type-safe, ergonomic way.
 */

import * as workflow from '@temporalio/workflow';
import type { Duration } from './duration.js';
import { parseDuration } from './duration.js';
import type { Logger, SignalOptions } from './types.js';

/**
 * Workflow context providing access to workflow metadata and Temporal primitives.
 *
 * This context is passed to workflow handlers and provides:
 * - Tenant and workflow identification
 * - Deterministic time operations
 * - Signal waiting capabilities
 * - Logging
 *
 * @example
 * const myWorkflow = workflow('my-workflow', async (ctx, input) => {
 *   ctx.log.info('Starting workflow', { input });
 *
 *   // Sleep for 5 minutes
 *   await ctx.sleep('5m');
 *
 *   // Wait for a signal
 *   const result = await ctx.waitForSignal('approval');
 *
 *   return result;
 * });
 */
export interface WorkflowContext {
  /**
   * Tenant ID for multi-tenancy support.
   * All tasks and resources created by this workflow will be scoped to this tenant.
   */
  tenantId: string;

  /**
   * Unique workflow identifier.
   * This is the ID used to reference this workflow execution.
   */
  workflowId: string;

  /**
   * Temporal run ID.
   * This changes on each retry/continuation of the workflow.
   */
  runId: string;

  /**
   * Logger for workflow logging.
   * Uses Temporal's deterministic logging to ensure replay safety.
   */
  log: Logger;

  /**
   * Get the current workflow time (deterministic).
   * This returns the same time on replay for determinism.
   *
   * @returns The current deterministic time
   *
   * @example
   * const startTime = ctx.now();
   * // ... do work ...
   * const elapsed = ctx.now().getTime() - startTime.getTime();
   */
  now(): Date;

  /**
   * Sleep for a specified duration (Temporal timer).
   * This is deterministic and will resume at the correct time on replay.
   *
   * @param duration - Duration to sleep (string like "10m" or milliseconds)
   * @returns Promise that resolves after the duration
   *
   * @example
   * await ctx.sleep('30m');  // Sleep for 30 minutes
   * await ctx.sleep(5000);   // Sleep for 5 seconds
   */
  sleep(duration: Duration): Promise<void>;

  /**
   * Wait for a signal to be received.
   *
   * @typeParam T - The expected type of the signal data
   * @param name - The signal name to wait for
   * @param options - Optional timeout and filter options
   * @returns Promise that resolves with the signal data
   * @throws {workflow.CancelledFailure} If the workflow is cancelled while waiting
   *
   * @example
   * // Wait for any 'approval' signal
   * const approval = await ctx.waitForSignal<{ approved: boolean }>('approval');
   *
   * // Wait with timeout
   * const result = await ctx.waitForSignal('response', { timeout: '5m' });
   *
   * // Wait with filter
   * const specific = await ctx.waitForSignal<TaskResult>('taskCompleted', {
   *   filter: (data) => data.taskId === expectedTaskId
   * });
   */
  waitForSignal<T = unknown>(name: string, options?: SignalOptions<T>): Promise<T>;
}

/**
 * Internal implementation of WorkflowContext.
 * Creates a context from Temporal workflow info and the provided tenant ID.
 */
export function createWorkflowContext(tenantId: string): WorkflowContext {
  const info = workflow.workflowInfo();

  // Create the logger wrapper
  const log: Logger = {
    debug(message: string, attrs?: Record<string, unknown>): void {
      workflow.log.debug(message, attrs);
    },
    info(message: string, attrs?: Record<string, unknown>): void {
      workflow.log.info(message, attrs);
    },
    warn(message: string, attrs?: Record<string, unknown>): void {
      workflow.log.warn(message, attrs);
    },
    error(message: string, attrs?: Record<string, unknown>): void {
      workflow.log.error(message, attrs);
    },
  };

  // Signal handlers map for waitForSignal
  interface SignalHandler {
    resolve: (value: unknown) => void;
    filter: ((data: unknown) => boolean) | undefined;
  }
  const signalHandlers = new Map<string, SignalHandler[]>();

  // Helper to wait for a specific signal
  async function waitForSignal<T = unknown>(
    name: string,
    options?: SignalOptions<T>
  ): Promise<T> {
    const { timeout: timeoutDuration, filter } = options ?? {};

    // Create a promise that resolves when the signal is received
    const signalPromise = new Promise<T>((resolve) => {
      // Get or create the handlers array for this signal
      let handlers = signalHandlers.get(name);
      if (!handlers) {
        handlers = [];
        signalHandlers.set(name, handlers);

        // Define the signal handler if not already defined
        workflow.setHandler(workflow.defineSignal<[T]>(name), (data: T) => {
          const currentHandlers = signalHandlers.get(name) ?? [];
          // Find and resolve matching handlers
          for (let i = currentHandlers.length - 1; i >= 0; i--) {
            const handler = currentHandlers[i];
            if (handler && (!handler.filter || handler.filter(data))) {
              currentHandlers.splice(i, 1);
              handler.resolve(data);
              break; // Only resolve one handler per signal
            }
          }
        });
      }

      // Add this handler
      const newHandler: SignalHandler = {
        resolve: resolve as (value: unknown) => void,
        filter: filter as ((data: unknown) => boolean) | undefined,
      };
      handlers.push(newHandler);
    });

    // If no timeout, just wait for the signal
    if (!timeoutDuration) {
      return signalPromise;
    }

    // Race between signal and timeout
    const timeoutMs = parseDuration(timeoutDuration);
    const result = await Promise.race([
      signalPromise,
      workflow.sleep(timeoutMs).then(() => {
        throw new workflow.CancelledFailure('Signal timeout');
      }),
    ]);

    return result;
  }

  return {
    tenantId,
    workflowId: info.workflowId,
    runId: info.runId,
    log,
    now(): Date {
      // Use Temporal's deterministic "now" for replay safety
      return new Date();
    },
    async sleep(duration: Duration): Promise<void> {
      const ms = parseDuration(duration);
      await workflow.sleep(ms);
    },
    waitForSignal,
  };
}

/**
 * Signal definition for task completion
 */
export const taskCompletedSignal = workflow.defineSignal<[{
  taskId: string;
  data: Record<string, unknown>;
  completedBy: string;
  completedAt: string;
}]>('taskCompleted');

/**
 * Signal definition for task cancellation
 */
export const taskCancelledSignal = workflow.defineSignal<[{
  taskId: string;
  reason?: string;
  cancelledBy?: string;
}]>('taskCancelled');

/**
 * Query definition for getting workflow state
 */
export const getStateQuery = workflow.defineQuery<Record<string, unknown>>('getState');
