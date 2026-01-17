/**
 * @module escalation
 *
 * Escalation patterns for human tasks with automatic escalation chains.
 * Provides advanced task management with multi-step escalation workflows.
 */

import * as workflow from '@temporalio/workflow';
import type { WorkflowContext } from './context.js';
import type { Duration } from './duration.js';
import { parseDuration } from './duration.js';
import type {
  TaskOptions,
  TaskResult,
  TaskCompletedSignalData,
  TaskCancelledSignalData,
  EscalationChain,
  EscalationStep,
  AssignmentTarget,
} from './types.js';
import { taskCompletedSignal, taskCancelledSignal, type TaskActivities, type CreateTaskActivityInput } from './task.js';

// =============================================================================
// Activity Proxy
// =============================================================================

const activities = workflow.proxyActivities<TaskActivities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    maximumInterval: '10 seconds',
    backoffCoefficient: 2,
  },
});

// =============================================================================
// Task with Escalation
// =============================================================================

/**
 * Options for creating a task with an escalation chain.
 */
export interface TaskWithEscalationOptions extends TaskOptions {
  /** Escalation chain configuration */
  escalation: EscalationChain;
}

/**
 * Create a task with an automatic escalation chain.
 *
 * This function:
 * 1. Creates the initial task
 * 2. Starts a timer for each escalation step
 * 3. Executes escalation actions if the task isn't completed in time
 * 4. Continues until task is completed or all escalations are exhausted
 *
 * @typeParam T - The type of the form data
 * @param ctx - Workflow context
 * @param options - Task options with escalation chain
 * @returns Promise resolving to the task result
 *
 * @example
 * // Basic escalation chain
 * const result = await taskWithEscalation(ctx, {
 *   title: 'Review document',
 *   form: {
 *     approved: { type: 'boolean', required: true },
 *     notes: { type: 'textarea' }
 *   },
 *   assignTo: { group: 'reviewers-l1' },
 *   escalation: {
 *     steps: [
 *       { after: '15m', action: 'notify', message: 'Task pending review' },
 *       { after: '30m', action: 'escalate', target: { group: 'reviewers-l2' } },
 *       { after: '1h', action: 'escalate', target: { group: 'managers' } }
 *     ]
 *   }
 * });
 *
 * @example
 * // Enterprise support with tiered escalation
 * const result = await taskWithEscalation(ctx, {
 *   title: 'Enterprise support request',
 *   form: {
 *     resolution: { type: 'textarea', required: true },
 *     followupNeeded: { type: 'boolean' }
 *   },
 *   assignTo: { group: 'enterprise-support-l1' },
 *   priority: 'urgent',
 *   escalation: {
 *     steps: [
 *       { after: '5m', action: 'notify', message: 'High priority ticket waiting' },
 *       { after: '10m', action: 'reassign', target: { group: 'enterprise-support-l2' } },
 *       { after: '20m', action: 'escalate', target: { group: 'support-leads' } },
 *       { after: '30m', action: 'escalate', target: { user: 'usr_support_director' } }
 *     ]
 *   }
 * });
 */
export async function taskWithEscalation<T extends Record<string, unknown> = Record<string, unknown>>(
  ctx: WorkflowContext,
  options: TaskWithEscalationOptions
): Promise<TaskResult<T>> {
  const { escalation, ...taskOptions } = options;

  ctx.log.info('Creating task with escalation chain', {
    title: options.title,
    escalationSteps: escalation.steps.length,
  });

  // Build the activity input
  const activityInput: CreateTaskActivityInput = {
    tenantId: ctx.tenantId,
    workflowId: ctx.workflowId,
    runId: ctx.runId,
    title: taskOptions.title,
    form: taskOptions.form,
    assignTo: taskOptions.assignTo,
  };

  // Add optional fields only if defined
  if (taskOptions.description !== undefined) {
    activityInput.description = taskOptions.description;
  }
  if (taskOptions.context !== undefined) {
    activityInput.context = taskOptions.context;
  }
  if (taskOptions.conversationId !== undefined) {
    activityInput.conversationId = taskOptions.conversationId;
  }
  if (taskOptions.priority !== undefined) {
    activityInput.priority = taskOptions.priority;
  }
  if (taskOptions.type !== undefined) {
    activityInput.type = taskOptions.type;
  }
  if (taskOptions.metadata !== undefined) {
    activityInput.metadata = taskOptions.metadata;
  }

  // Create initial task
  const taskId = await activities.createTask(activityInput);

  ctx.log.info('Task created, starting escalation chain', { taskId });

  // Track signals in mutable object to avoid TypeScript flow analysis issues
  interface EscalationSignalState {
    completedData: TaskCompletedSignalData<T> | null;
    cancelledData: TaskCancelledSignalData | null;
  }
  const state: EscalationSignalState = {
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

  // Condition checker
  const isResolved = () => state.completedData !== null || state.cancelledData !== null;

  // Process escalation steps
  let previousDelay = 0;

  for (let i = 0; i < escalation.steps.length; i++) {
    const step = escalation.steps[i];
    if (!step) continue;
    const stepDelayMs = parseDuration(step.after);

    // Calculate time to wait (relative to previous step)
    const waitTime = stepDelayMs - previousDelay;
    previousDelay = stepDelayMs;

    ctx.log.debug('Waiting for escalation step', {
      taskId,
      stepIndex: i,
      action: step.action,
      waitTime,
    });

    // Wait for completion or step timeout
    const resolved = await workflow.condition(isResolved, waitTime);

    // Check if resolved
    if (state.completedData !== null || state.cancelledData !== null) {
      break;
    }

    // Timeout reached - execute escalation step
    if (!resolved) {
      ctx.log.info('Executing escalation step', {
        taskId,
        stepIndex: i,
        action: step.action,
        target: step.target,
      });

      await executeEscalationStep(ctx, taskId, step);
    }
  }

  // If still not resolved after all escalations, wait indefinitely
  if (state.completedData === null && state.cancelledData === null) {
    ctx.log.info('All escalation steps exhausted, waiting indefinitely', { taskId });
    await workflow.condition(isResolved);
  }

  // Capture final state
  const { completedData, cancelledData } = state;

  // Check cancellation
  if (cancelledData !== null) {
    const reason = cancelledData.reason ?? 'No reason provided';
    throw new workflow.ApplicationFailure(
      `Task ${taskId} was cancelled: ${reason}`,
      'TASK_CANCELLED',
      true,
      [cancelledData]
    );
  }

  // Return result
  if (completedData !== null) {
    ctx.log.info('Task with escalation completed', {
      taskId,
      completedBy: completedData.completedBy,
    });

    return {
      taskId: completedData.taskId,
      data: completedData.data,
      completedBy: completedData.completedBy,
      completedAt: new Date(completedData.completedAt),
    };
  }

  throw new workflow.ApplicationFailure(
    `Task ${taskId} resolved without completion or cancellation`,
    'TASK_RESOLUTION_ERROR',
    true
  );
}

/**
 * Execute a single escalation step.
 */
async function executeEscalationStep(
  ctx: WorkflowContext,
  taskId: string,
  step: EscalationStep
): Promise<void> {
  switch (step.action) {
    case 'reassign':
      if (!step.target) {
        ctx.log.warn('Reassign step missing target', { taskId });
        return;
      }
      await activities.reassignTask(taskId, step.target);
      break;

    case 'notify':
      await activities.notifyTaskUrgent(taskId, step.message);
      break;

    case 'escalate':
      await activities.escalateTask(taskId, step.target);
      break;
  }
}

// =============================================================================
// Escalation Chain Builders
// =============================================================================

/**
 * Builder for creating escalation chains fluently.
 *
 * @example
 * const chain = escalationChain()
 *   .notifyAfter('15m', 'Please review this task')
 *   .escalateAfter('30m', { group: 'support-l2' })
 *   .escalateAfter('1h', { group: 'managers' })
 *   .build();
 */
export function escalationChain(): EscalationChainBuilder {
  return new EscalationChainBuilder();
}

/**
 * Fluent builder for escalation chains.
 */
export class EscalationChainBuilder {
  private steps: EscalationStep[] = [];

  /**
   * Add a notification step.
   *
   * @param after - Duration after which to send notification
   * @param message - Message to include in notification
   */
  notifyAfter(after: Duration, message?: string): this {
    const step: EscalationStep = {
      after,
      action: 'notify',
    };
    if (message !== undefined) {
      step.message = message;
    }
    this.steps.push(step);
    return this;
  }

  /**
   * Add a reassignment step.
   *
   * @param after - Duration after which to reassign
   * @param target - New assignment target
   */
  reassignAfter(after: Duration, target: AssignmentTarget): this {
    this.steps.push({
      after,
      action: 'reassign',
      target,
    });
    return this;
  }

  /**
   * Add an escalation step.
   *
   * @param after - Duration after which to escalate
   * @param target - Escalation target (optional)
   * @param message - Message to include (optional)
   */
  escalateAfter(after: Duration, target?: AssignmentTarget, message?: string): this {
    const step: EscalationStep = {
      after,
      action: 'escalate',
    };
    if (target !== undefined) {
      step.target = target;
    }
    if (message !== undefined) {
      step.message = message;
    }
    this.steps.push(step);
    return this;
  }

  /**
   * Build the escalation chain.
   */
  build(): EscalationChain {
    return { steps: [...this.steps] };
  }
}

// =============================================================================
// Predefined Escalation Patterns
// =============================================================================

/**
 * Configuration for a tiered support escalation pattern.
 */
export interface TieredSupportConfig {
  /** Array of support tiers (groups) in escalation order */
  tiers: string[];
  /** Time between each escalation level */
  escalationInterval: Duration;
  /** Send notification before first escalation? */
  notifyFirst?: boolean;
  /** Time for first notification (if notifyFirst is true) */
  notifyAfter?: Duration;
}

/**
 * Create a tiered support escalation chain.
 *
 * @param config - Tiered support configuration
 * @returns Escalation chain for tiered support
 *
 * @example
 * const chain = tieredSupport({
 *   tiers: ['support-l1', 'support-l2', 'support-l3', 'managers'],
 *   escalationInterval: '30m',
 *   notifyFirst: true,
 *   notifyAfter: '15m'
 * });
 *
 * // Creates chain:
 * // - 15m: notify
 * // - 30m: escalate to support-l2
 * // - 60m: escalate to support-l3
 * // - 90m: escalate to managers
 */
export function tieredSupport(config: TieredSupportConfig): EscalationChain {
  const { tiers, escalationInterval, notifyFirst, notifyAfter } = config;
  const intervalMs = parseDuration(escalationInterval);
  const steps: EscalationStep[] = [];

  // Add initial notification if configured
  if (notifyFirst && notifyAfter) {
    steps.push({
      after: notifyAfter,
      action: 'notify',
      message: 'Task requires attention',
    });
  }

  // Add escalation steps for each tier (starting from second tier)
  for (let i = 1; i < tiers.length; i++) {
    const afterMs = intervalMs * i;
    const tier = tiers[i];
    if (tier !== undefined) {
      steps.push({
        after: afterMs,
        action: 'escalate',
        target: { group: tier },
      });
    }
  }

  return { steps };
}

/**
 * Configuration for approval workflow escalation.
 */
export interface ApprovalEscalationConfig {
  /** Initial approver */
  initialApprover: AssignmentTarget;
  /** Fallback approver if initial doesn't respond */
  fallbackApprover: AssignmentTarget;
  /** Time to wait for initial approver */
  initialTimeout: Duration;
  /** Auto-approve after this time if no response? */
  autoApproveTimeout?: Duration;
  /** Default action if auto-approved */
  autoApproveAction?: 'approve' | 'reject';
}

/**
 * Create an approval escalation chain with fallback.
 *
 * @param config - Approval escalation configuration
 * @returns Escalation chain for approval workflow
 *
 * @example
 * const chain = approvalEscalation({
 *   initialApprover: { user: 'usr_manager' },
 *   fallbackApprover: { group: 'senior-managers' },
 *   initialTimeout: '2h',
 *   autoApproveTimeout: '4h'
 * });
 */
export function approvalEscalation(config: ApprovalEscalationConfig): EscalationChain {
  const steps: EscalationStep[] = [];

  // Notify before escalation
  const initialMs = parseDuration(config.initialTimeout);
  const notifyAfter = Math.floor(initialMs * 0.5); // Notify at 50% of timeout

  steps.push({
    after: notifyAfter,
    action: 'notify',
    message: 'Approval request awaiting your response',
  });

  // Escalate to fallback
  steps.push({
    after: config.initialTimeout,
    action: 'escalate',
    target: config.fallbackApprover,
    message: 'Escalated due to no response from initial approver',
  });

  return { steps };
}

/**
 * Create a simple two-tier escalation.
 *
 * @param timeout - Time before escalation
 * @param escalateTo - Target for escalation
 * @returns Simple escalation chain
 *
 * @example
 * const chain = simpleEscalation('30m', { group: 'managers' });
 */
export function simpleEscalation(
  timeout: Duration,
  escalateTo: AssignmentTarget
): EscalationChain {
  return {
    steps: [
      {
        after: timeout,
        action: 'escalate',
        target: escalateTo,
      },
    ],
  };
}

/**
 * Create an escalation chain with notification before escalation.
 *
 * @param notifyAfter - Time for notification
 * @param escalateAfter - Time for escalation
 * @param escalateTo - Target for escalation
 * @param notifyMessage - Optional notification message
 * @returns Escalation chain with notification
 *
 * @example
 * const chain = notifyThenEscalate(
 *   '15m',
 *   '30m',
 *   { group: 'support-l2' },
 *   'Task needs attention'
 * );
 */
export function notifyThenEscalate(
  notifyAfterDuration: Duration,
  escalateAfterDuration: Duration,
  escalateTo: AssignmentTarget,
  notifyMessage?: string
): EscalationChain {
  const notifyStep: EscalationStep = {
    after: notifyAfterDuration,
    action: 'notify',
    message: notifyMessage ?? 'Task requires attention',
  };
  const escalateStep: EscalationStep = {
    after: escalateAfterDuration,
    action: 'escalate',
    target: escalateTo,
  };
  return {
    steps: [notifyStep, escalateStep],
  };
}
