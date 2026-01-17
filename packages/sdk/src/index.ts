/**
 * @orkestra/sdk
 *
 * Developer-friendly workflow helpers for Orkestra.
 * This package provides high-level APIs for defining workflows,
 * tasks, and human-in-the-loop interactions.
 *
 * @packageDocumentation
 *
 * @example
 * // Basic workflow with human task
 * import { workflow, task, timeout } from '@orkestra/sdk';
 *
 * export const reviewWorkflow = workflow(
 *   'document-review',
 *   async (ctx, input: { documentId: string }) => {
 *     const result = await task(ctx, {
 *       title: 'Review document',
 *       form: {
 *         approved: { type: 'boolean', required: true },
 *         notes: { type: 'textarea' }
 *       },
 *       assignTo: { group: 'reviewers' },
 *       sla: timeout('1h')
 *     });
 *
 *     return { approved: result.data.approved };
 *   }
 * );
 *
 * @example
 * // Workflow with escalation chain
 * import { workflow, taskWithEscalation, escalationChain } from '@orkestra/sdk';
 *
 * export const supportWorkflow = workflow(
 *   'support-ticket',
 *   async (ctx, input: { ticketId: string }) => {
 *     const result = await taskWithEscalation(ctx, {
 *       title: 'Handle support ticket',
 *       form: {
 *         resolution: { type: 'textarea', required: true }
 *       },
 *       assignTo: { group: 'support-l1' },
 *       escalation: escalationChain()
 *         .notifyAfter('15m', 'Ticket needs attention')
 *         .escalateAfter('30m', { group: 'support-l2' })
 *         .escalateAfter('1h', { group: 'managers' })
 *         .build()
 *     });
 *
 *     return { resolvedBy: result.completedBy };
 *   }
 * );
 */

export const VERSION = '0.0.1';

// =============================================================================
// Duration Utilities
// =============================================================================

export {
  type Duration,
  parseDuration,
  formatDuration,
  isDuration,
  addDurations,
  toSeconds,
  toMinutes,
  toHours,
  DurationParseError,
} from './duration.js';

// =============================================================================
// Types
// =============================================================================

export type {
  // Form types
  FormFieldType,
  FormFieldOption,
  FormField,
  FormSchema,

  // Assignment types
  AssignmentTarget,

  // SLA types
  SLABreachAction,
  SLAOptions,

  // Task types
  TaskPriority,
  TaskOptions,
  TaskResult,

  // Escalation types
  EscalationAction,
  EscalationStep,
  EscalationChain,

  // Signal types
  SignalOptions,
  TaskCompletedSignalData,
  TaskCancelledSignalData,

  // Utility types
  Logger,
  JsonPrimitive,
  JsonArray,
  JsonObject,
  JsonValue,
} from './types.js';

// =============================================================================
// Workflow Context
// =============================================================================

export type { WorkflowContext } from './context.js';

export {
  createWorkflowContext,
  taskCompletedSignal as contextTaskCompletedSignal,
  taskCancelledSignal as contextTaskCancelledSignal,
  getStateQuery,
} from './context.js';

// =============================================================================
// Signals
// =============================================================================

export {
  // Signal definitions
  taskCompleted,
  taskCancelled,
  cancelRequested,
  resume,
  custom,

  // Signal utilities
  type WaitOptions,
  type SignalRaceResult,
  waitForCondition,
  waitForAnySignal,
  createSignalAccumulator,
  createSignalStateMachine,

  // Query definitions
  getState,
  getPendingTasks,
  isWaitingFor,
} from './signals.js';

// =============================================================================
// Timeout Utilities
// =============================================================================

export {
  timeout,
  timeoutWithEscalation,
  deadline,
  deadlineWithEscalation,
  timeoutWithWarning,
  calculateDeadline,
  isBreached,
  isInWarningPeriod,
  getTimeRemaining,

  // Tier-based SLA helpers
  type TierSLAConfig,
  tierBasedTimeout,
  tierBasedEscalation,
} from './timeout.js';

// =============================================================================
// Task Helpers
// =============================================================================

export {
  // Main task function
  task,

  // Task utilities
  cancelTask,
  reassignTask,
  notifyUrgent,

  // Multiple tasks
  type AllTasksOptions,
  allTasks,
  type AnyTaskOptions,
  anyTask,

  // Activity types (for implementation in @orkestra/core)
  type TaskActivities,
  type CreateTaskActivityInput,

  // Signals
  taskCompletedSignal,
  taskCancelledSignal,
} from './task.js';

// =============================================================================
// Escalation Helpers
// =============================================================================

export {
  // Main escalation function
  type TaskWithEscalationOptions,
  taskWithEscalation,

  // Escalation chain builder
  escalationChain,
  EscalationChainBuilder,

  // Predefined patterns
  type TieredSupportConfig,
  tieredSupport,
  type ApprovalEscalationConfig,
  approvalEscalation,
  simpleEscalation,
  notifyThenEscalate,
} from './escalation.js';

// =============================================================================
// Workflow Definition
// =============================================================================

export {
  // Types
  type WorkflowHandler,
  type WorkflowDefinition,
  type WorkflowOptions,

  // Main workflow function
  workflow,

  // Registry
  WorkflowRegistry,
  createRegistry,

  // State management
  type WorkflowState,
  createState,

  // Utilities
  parallel,
  withTimeout,
  retry,
} from './workflow.js';

// =============================================================================
// Namespace exports for organized access
// =============================================================================

import * as signals from './signals.js';
import * as duration from './duration.js';
import * as types from './types.js';

export { signals, duration, types };
