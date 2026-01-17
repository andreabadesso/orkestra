/**
 * @module task
 *
 * Human task creation and management helpers.
 * The task() function is the primary way to create human tasks in workflows.
 */

import * as workflow from '@temporalio/workflow';
import type { WorkflowContext } from './context.js';
import { parseDuration } from './duration.js';
import type {
  TaskOptions,
  TaskResult,
  TaskCompletedSignalData,
  TaskCancelledSignalData,
  SLAOptions,
  AssignmentTarget,
} from './types.js';

// =============================================================================
// Activity Types (to be implemented in @orkestra/core)
// =============================================================================

/**
 * Activity interface for task operations.
 * These activities should be implemented in @orkestra/core.
 */
export interface TaskActivities {
  /**
   * Create a new human task
   */
  createTask(input: CreateTaskActivityInput): Promise<string>;

  /**
   * Update task assignment
   */
  reassignTask(taskId: string, target: AssignmentTarget): Promise<void>;

  /**
   * Send urgent notification for a task
   */
  notifyTaskUrgent(taskId: string, message?: string): Promise<void>;

  /**
   * Escalate a task to a new target
   */
  escalateTask(taskId: string, target?: AssignmentTarget): Promise<void>;

  /**
   * Cancel a task
   */
  cancelTask(taskId: string, reason?: string): Promise<void>;

  /**
   * Mark task as expired
   */
  expireTask(taskId: string): Promise<void>;
}

/**
 * Input for createTask activity
 */
export interface CreateTaskActivityInput {
  tenantId: string;
  workflowId: string;
  runId: string;
  title: string;
  description?: string;
  form: TaskOptions['form'];
  assignTo: TaskOptions['assignTo'];
  context?: TaskOptions['context'];
  conversationId?: string;
  sla?: {
    dueAt: string;
    warnBeforeMinutes?: number;
  };
  priority?: TaskOptions['priority'];
  type?: string;
  metadata?: TaskOptions['metadata'];
}

// =============================================================================
// Task Signals
// =============================================================================

/**
 * Signal definition for task completion
 */
export const taskCompletedSignal = workflow.defineSignal<[TaskCompletedSignalData]>('taskCompleted');

/**
 * Signal definition for task cancellation
 */
export const taskCancelledSignal = workflow.defineSignal<[TaskCancelledSignalData]>('taskCancelled');

// =============================================================================
// Task Creation Helper
// =============================================================================

/**
 * Proxy activities with default timeout.
 * Note: Activities must be registered with Temporal worker from @orkestra/core
 */
const activities = workflow.proxyActivities<TaskActivities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    maximumInterval: '10 seconds',
    backoffCoefficient: 2,
  },
});

/**
 * Create a human task and wait for completion.
 *
 * This function:
 * 1. Creates a task via activity
 * 2. Sets up signal handlers for completion/cancellation
 * 3. Optionally handles SLA timeout and breach actions
 * 4. Returns the result when the task is completed
 *
 * @typeParam T - The type of the form data (inferred from form schema)
 * @param ctx - Workflow context
 * @param options - Task configuration options
 * @returns Promise resolving to the task result
 *
 * @example
 * // Simple task
 * const result = await task<{ answer: string }>(ctx, {
 *   title: 'Review request',
 *   form: {
 *     answer: { type: 'textarea', required: true }
 *   },
 *   assignTo: { group: 'reviewers' }
 * });
 *
 * // Task with SLA
 * const result = await task(ctx, {
 *   title: 'Urgent approval needed',
 *   form: {
 *     approved: { type: 'boolean', required: true },
 *     notes: { type: 'textarea' }
 *   },
 *   assignTo: { group: 'approvers' },
 *   sla: {
 *     deadline: '30m',
 *     onBreach: 'escalate',
 *     escalateTo: { group: 'managers' }
 *   }
 * });
 */
export async function task<T extends Record<string, unknown> = Record<string, unknown>>(
  ctx: WorkflowContext,
  options: TaskOptions
): Promise<TaskResult<T>> {
  const { sla, ...taskConfig } = options;

  // Calculate due date if SLA is provided
  const dueAt = sla
    ? new Date(Date.now() + parseDuration(sla.deadline)).toISOString()
    : undefined;

  // Create task via activity
  ctx.log.info('Creating human task', { title: options.title });

  // Build the activity input
  const activityInput: CreateTaskActivityInput = {
    tenantId: ctx.tenantId,
    workflowId: ctx.workflowId,
    runId: ctx.runId,
    title: taskConfig.title,
    form: taskConfig.form,
    assignTo: taskConfig.assignTo,
  };

  // Add optional fields only if defined
  if (taskConfig.description !== undefined) {
    activityInput.description = taskConfig.description;
  }
  if (taskConfig.context !== undefined) {
    activityInput.context = taskConfig.context;
  }
  if (taskConfig.conversationId !== undefined) {
    activityInput.conversationId = taskConfig.conversationId;
  }
  if (dueAt !== undefined && sla !== undefined) {
    const slaConfig: { dueAt: string; warnBeforeMinutes?: number } = { dueAt };
    if (sla.warnBefore !== undefined) {
      slaConfig.warnBeforeMinutes = Math.floor(parseDuration(sla.warnBefore) / 60000);
    }
    activityInput.sla = slaConfig;
  }
  if (taskConfig.priority !== undefined) {
    activityInput.priority = taskConfig.priority;
  }
  if (taskConfig.type !== undefined) {
    activityInput.type = taskConfig.type;
  }
  if (taskConfig.metadata !== undefined) {
    activityInput.metadata = taskConfig.metadata;
  }

  const taskId = await activities.createTask(activityInput);

  ctx.log.info('Task created', { taskId });

  // Wait for task completion
  const result = await waitForTaskCompletion<T>(ctx, taskId, sla);

  ctx.log.info('Task completed', { taskId, completedBy: result.completedBy });

  return result;
}

/**
 * Signal state holder to avoid TypeScript flow analysis issues.
 */
interface SignalState<T> {
  completedData: TaskCompletedSignalData<T> | null;
  cancelledData: TaskCancelledSignalData | null;
}

/**
 * Internal: Wait for task completion signal with optional SLA handling.
 */
async function waitForTaskCompletion<T extends Record<string, unknown>>(
  ctx: WorkflowContext,
  taskId: string,
  sla?: SLAOptions
): Promise<TaskResult<T>> {
  // Track received signals in a mutable object to avoid flow analysis issues
  const state: SignalState<T> = {
    completedData: null,
    cancelledData: null,
  };

  // Set up signal handlers
  workflow.setHandler(taskCompletedSignal, (data) => {
    if (data.taskId === taskId) {
      state.completedData = data as TaskCompletedSignalData<T>;
    }
  });

  workflow.setHandler(taskCancelledSignal, (data) => {
    if (data.taskId === taskId) {
      state.cancelledData = data;
    }
  });

  // Create condition for completion or cancellation
  const isResolved = () => state.completedData !== null || state.cancelledData !== null;

  if (!sla) {
    // No SLA - wait indefinitely for completion
    await workflow.condition(isResolved);
  } else {
    // With SLA - handle timeout
    const deadlineMs = parseDuration(sla.deadline);
    const completed = await workflow.condition(isResolved, deadlineMs);

    if (!completed) {
      // SLA breached
      ctx.log.warn('Task SLA breached', { taskId, action: sla.onBreach });
      await handleSLABreach(ctx, taskId, sla);

      // Continue waiting after breach handling
      await workflow.condition(isResolved);
    }
  }

  // Capture state at this point
  const { completedData, cancelledData } = state;

  // Check if cancelled
  if (cancelledData !== null) {
    const reason = cancelledData.reason ?? 'No reason provided';
    throw new workflow.ApplicationFailure(
      `Task ${taskId} was cancelled: ${reason}`,
      'TASK_CANCELLED',
      true,
      [cancelledData]
    );
  }

  // Return completed result
  if (completedData !== null) {
    return {
      taskId: completedData.taskId,
      data: completedData.data,
      completedBy: completedData.completedBy,
      completedAt: new Date(completedData.completedAt),
    };
  }

  // This should never happen
  throw new workflow.ApplicationFailure(
    `Task ${taskId} resolved without completion or cancellation`,
    'TASK_RESOLUTION_ERROR',
    true
  );
}

/**
 * Internal: Handle SLA breach based on configured action.
 */
async function handleSLABreach(
  ctx: WorkflowContext,
  taskId: string,
  sla: SLAOptions
): Promise<void> {
  const action = sla.onBreach ?? 'escalate';

  switch (action) {
    case 'escalate':
      if (sla.escalateTo) {
        ctx.log.info('Escalating task', { taskId, target: sla.escalateTo });
        await activities.escalateTask(taskId, sla.escalateTo);
      } else {
        ctx.log.info('Escalating task (no target)', { taskId });
        await activities.escalateTask(taskId);
      }
      break;

    case 'notify':
      ctx.log.info('Sending urgent notification', { taskId });
      await activities.notifyTaskUrgent(taskId, 'Task SLA has been breached');
      break;

    case 'cancel':
      ctx.log.info('Cancelling task due to SLA breach', { taskId });
      await activities.cancelTask(taskId, 'SLA breached');
      throw new workflow.ApplicationFailure(
        `Task ${taskId} cancelled due to SLA breach`,
        'SLA_BREACH_CANCEL',
        true
      );
  }
}

// =============================================================================
// Task Utilities
// =============================================================================

/**
 * Cancel an existing task.
 *
 * @param taskId - ID of the task to cancel
 * @param reason - Optional reason for cancellation
 *
 * @example
 * await cancelTask(myTaskId, 'No longer needed');
 */
export async function cancelTask(taskId: string, reason?: string): Promise<void> {
  await activities.cancelTask(taskId, reason);
}

/**
 * Reassign a task to a new target.
 *
 * @param taskId - ID of the task to reassign
 * @param target - New assignment target
 *
 * @example
 * await reassignTask(myTaskId, { group: 'escalation-team' });
 */
export async function reassignTask(taskId: string, target: AssignmentTarget): Promise<void> {
  await activities.reassignTask(taskId, target);
}

/**
 * Send an urgent notification for a task.
 *
 * @param taskId - ID of the task
 * @param message - Optional message to include
 *
 * @example
 * await notifyUrgent(myTaskId, 'Please complete ASAP');
 */
export async function notifyUrgent(taskId: string, message?: string): Promise<void> {
  await activities.notifyTaskUrgent(taskId, message);
}

// =============================================================================
// Multiple Tasks Helpers
// =============================================================================

/**
 * Options for creating multiple tasks that must all be completed.
 */
export interface AllTasksOptions {
  /** Array of task configurations */
  tasks: TaskOptions[];
  /** Global SLA for all tasks (can be overridden per-task) */
  sla?: SLAOptions;
}

/**
 * Create multiple tasks and wait for ALL to complete.
 *
 * @param ctx - Workflow context
 * @param options - Configuration for all tasks
 * @returns Array of task results in the same order as input
 *
 * @example
 * const results = await allTasks(ctx, {
 *   tasks: [
 *     { title: 'Legal review', form: {...}, assignTo: { group: 'legal' } },
 *     { title: 'Finance review', form: {...}, assignTo: { group: 'finance' } }
 *   ],
 *   sla: { deadline: '2h' }
 * });
 */
export async function allTasks<T extends Record<string, unknown> = Record<string, unknown>>(
  ctx: WorkflowContext,
  options: AllTasksOptions
): Promise<TaskResult<T>[]> {
  const { tasks: taskConfigs, sla: globalSla } = options;

  // Create all tasks in parallel
  const taskPromises = taskConfigs.map((taskConfig) => {
    const effectiveSla = taskConfig.sla ?? globalSla;
    const taskOptions: TaskOptions = { ...taskConfig };
    if (effectiveSla !== undefined) {
      taskOptions.sla = effectiveSla;
    }
    return task<T>(ctx, taskOptions);
  });

  // Wait for all to complete
  return Promise.all(taskPromises);
}

/**
 * Options for creating multiple tasks where any one completing is sufficient.
 */
export interface AnyTaskOptions {
  /** Array of task configurations */
  tasks: TaskOptions[];
  /** Global SLA for all tasks */
  sla?: SLAOptions;
  /** Whether to cancel remaining tasks when one completes */
  cancelRemaining?: boolean;
}

/**
 * Create multiple tasks and wait for ANY one to complete.
 * Optionally cancels remaining tasks when one completes.
 *
 * @param ctx - Workflow context
 * @param options - Configuration for tasks
 * @returns The first task result
 *
 * @example
 * // Get approval from any approver
 * const result = await anyTask(ctx, {
 *   tasks: [
 *     { title: 'Manager A approval', form: {...}, assignTo: { user: 'usr_a' } },
 *     { title: 'Manager B approval', form: {...}, assignTo: { user: 'usr_b' } }
 *   ],
 *   cancelRemaining: true
 * });
 */
export async function anyTask<T extends Record<string, unknown> = Record<string, unknown>>(
  ctx: WorkflowContext,
  options: AnyTaskOptions
): Promise<TaskResult<T>> {
  const { tasks: taskConfigs, sla: globalSla, cancelRemaining = false } = options;

  // Create all tasks and track their IDs
  const taskIds: string[] = [];
  const taskPromises = taskConfigs.map(async (taskConfig) => {
    const effectiveSla = taskConfig.sla ?? globalSla;
    const taskOptions: TaskOptions = { ...taskConfig };
    if (effectiveSla !== undefined) {
      taskOptions.sla = effectiveSla;
    }
    const result = await task<T>(ctx, taskOptions);
    return result;
  });

  // Wait for first to complete
  const result = await Promise.race(taskPromises);

  // Cancel remaining if requested
  if (cancelRemaining) {
    for (const taskId of taskIds) {
      if (taskId !== result.taskId) {
        try {
          await activities.cancelTask(taskId, 'Another task completed first');
        } catch {
          // Ignore errors cancelling other tasks
        }
      }
    }
  }

  return result;
}
