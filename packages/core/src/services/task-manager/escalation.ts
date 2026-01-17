/**
 * Escalation Logic Module
 *
 * Provides escalation handling for tasks that breach SLA
 * or need to be escalated manually.
 */

import type { PrismaClient, Task } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { RequestContext } from '../../context/index.js';
import type { EscalationStep, ReassignTarget, NotificationService } from './types.js';
import { parseDurationToMs, isBreached } from './sla.js';

/**
 * Escalation context for processing escalations
 */
export interface EscalationContext {
  /** Request context */
  ctx: RequestContext;
  /** Prisma client */
  prisma: PrismaClient;
  /** Optional notification service */
  notificationService?: NotificationService | undefined;
}

/**
 * Escalation result
 */
export interface EscalationResult {
  /** Whether escalation was performed */
  escalated: boolean;
  /** New assignment target */
  escalatedTo?: ReassignTarget | undefined;
  /** Reason for escalation */
  reason?: string | undefined;
  /** Whether this was the final escalation step */
  isFinalStep: boolean;
}

/**
 * Parse escalation config from JSON
 *
 * @param config - Escalation config from database (as JSON)
 * @returns Typed escalation steps or null
 */
export function parseEscalationConfig(config: unknown): EscalationStep[] | null {
  if (!config) {
    return null;
  }

  if (!Array.isArray(config)) {
    return null;
  }

  // Validate each step
  for (const step of config) {
    if (!step || typeof step !== 'object') {
      return null;
    }

    const s = step as Record<string, unknown>;
    const afterValue = s['after'];

    if (typeof afterValue !== 'string') {
      return null;
    }

    // Validate the duration format
    try {
      parseDurationToMs(afterValue);
    } catch {
      return null;
    }

    // At least one of toUserId or toGroupId should be present
    const toUserId = s['toUserId'];
    const toGroupId = s['toGroupId'];
    if (!toUserId && !toGroupId) {
      return null;
    }
  }

  return config as EscalationStep[];
}

/**
 * Get the applicable escalation step based on time elapsed
 *
 * @param escalationChain - Chain of escalation steps
 * @param taskCreatedAt - Task creation timestamp
 * @param executedSteps - Number of steps already executed
 * @returns The next applicable step or null
 */
export function getApplicableEscalationStep(
  escalationChain: EscalationStep[],
  taskCreatedAt: Date,
  executedSteps: number = 0
): { step: EscalationStep; stepIndex: number } | null {
  const now = Date.now();
  const elapsed = now - taskCreatedAt.getTime();

  // Find the latest step that should have triggered
  for (let i = escalationChain.length - 1; i >= executedSteps; i--) {
    const step = escalationChain[i];
    if (!step) continue;

    const stepMs = parseDurationToMs(step.after);
    if (elapsed >= stepMs) {
      return { step, stepIndex: i };
    }
  }

  return null;
}

/**
 * Determine escalation target from a step
 *
 * @param step - Escalation step
 * @returns Reassignment target
 */
export function getEscalationTarget(step: EscalationStep): ReassignTarget {
  return {
    userId: step.toUserId ?? null,
    groupId: step.toGroupId ?? null,
  };
}

/**
 * Check if a task should be escalated based on SLA breach
 *
 * @param task - Task to check
 * @returns Whether the task should be escalated
 */
export function shouldEscalateOnBreach(task: Task): boolean {
  // Check if task has a deadline and it's breached
  if (!task.dueAt) {
    return false;
  }

  if (!isBreached(task.dueAt)) {
    return false;
  }

  // Check if task is in an escalatable status
  const escalatableStatuses = ['pending', 'assigned', 'in_progress'];
  if (!escalatableStatuses.includes(task.status)) {
    return false;
  }

  return true;
}

/**
 * Get the default escalation target when no chain is defined
 *
 * For tasks without an escalation chain, we keep the same assignment
 * but mark the task as escalated.
 *
 * @param task - Task being escalated
 * @returns Default escalation target
 */
export function getDefaultEscalationTarget(task: Task): ReassignTarget {
  return {
    userId: task.assignedUserId,
    groupId: task.assignedGroupId,
  };
}

/**
 * Build an escalation reason message
 *
 * @param task - Task being escalated
 * @param step - Escalation step (if from chain)
 * @param isAutomatic - Whether this is an automatic escalation
 * @returns Reason string
 */
export function buildEscalationReason(
  task: Task,
  step?: EscalationStep,
  isAutomatic: boolean = true
): string {
  const parts: string[] = [];

  if (isAutomatic) {
    parts.push('Automatic escalation');
  } else {
    parts.push('Manual escalation');
  }

  if (task.dueAt && isBreached(task.dueAt)) {
    parts.push('due to SLA breach');
  }

  if (step?.message) {
    parts.push(`- ${step.message}`);
  }

  return parts.join(' ');
}

/**
 * Escalation processor for handling task escalations
 */
export class EscalationProcessor {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient, _notificationService?: NotificationService | undefined) {
    this.prisma = prisma;
  }

  /**
   * Process automatic escalation for a task
   *
   * @param _ctx - Request context (unused but kept for API consistency)
   * @param task - Task to process
   * @param executedSteps - Number of escalation steps already executed
   * @returns Escalation result
   */
  async processAutoEscalation(
    _ctx: RequestContext,
    task: Task,
    executedSteps: number = 0
  ): Promise<EscalationResult> {
    // Parse escalation config
    const escalationChain = parseEscalationConfig(task.escalationConfig);

    // If no escalation chain and task is breached, use default behavior
    if (!escalationChain || escalationChain.length === 0) {
      if (shouldEscalateOnBreach(task)) {
        const target = getDefaultEscalationTarget(task);
        const reason = buildEscalationReason(task, undefined, true);

        return {
          escalated: true,
          escalatedTo: target,
          reason,
          isFinalStep: true,
        };
      }

      return {
        escalated: false,
        isFinalStep: true,
      };
    }

    // Find the applicable escalation step
    const applicable = getApplicableEscalationStep(escalationChain, task.createdAt, executedSteps);

    if (!applicable) {
      return {
        escalated: false,
        isFinalStep: executedSteps >= escalationChain.length,
      };
    }

    const { step, stepIndex } = applicable;
    const target = getEscalationTarget(step);
    const reason = buildEscalationReason(task, step, true);
    const isFinalStep = stepIndex >= escalationChain.length - 1;

    return {
      escalated: true,
      escalatedTo: target,
      reason,
      isFinalStep,
    };
  }

  /**
   * Process manual escalation for a task
   *
   * @param _ctx - Request context (unused but kept for API consistency)
   * @param task - Task to escalate
   * @param target - Optional specific target
   * @param reason - Optional reason
   * @returns Escalation result
   */
  async processManualEscalation(
    _ctx: RequestContext,
    task: Task,
    target?: ReassignTarget,
    reason?: string
  ): Promise<EscalationResult> {
    // If no target specified, try to use the escalation chain
    let resolvedTarget = target;
    if (!resolvedTarget) {
      const escalationChain = parseEscalationConfig(task.escalationConfig);

      if (escalationChain && escalationChain.length > 0) {
        // Get the first step as the manual escalation target
        const firstStep = escalationChain[0];
        if (firstStep) {
          resolvedTarget = getEscalationTarget(firstStep);
        }
      }

      // If still no target, use default
      if (!resolvedTarget) {
        resolvedTarget = getDefaultEscalationTarget(task);
      }
    }

    return {
      escalated: true,
      escalatedTo: resolvedTarget,
      reason: reason ?? buildEscalationReason(task, undefined, false),
      isFinalStep: true,
    };
  }

  /**
   * Get tasks that need escalation processing
   *
   * @param ctx - Request context
   * @returns Array of tasks needing escalation
   */
  async getTasksNeedingEscalation(ctx: RequestContext): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        status: {
          in: ['pending', 'assigned', 'in_progress'],
        },
        dueAt: {
          lte: new Date(),
        },
        // Only get tasks with escalation config (not null)
        escalationConfig: {
          not: Prisma.JsonNull,
        },
      },
      orderBy: {
        dueAt: 'asc',
      },
    });
  }
}

/**
 * Create an escalation processor
 *
 * @param prisma - Prisma client
 * @param notificationService - Optional notification service
 * @returns Configured escalation processor
 */
export function createEscalationProcessor(
  prisma: PrismaClient,
  notificationService?: NotificationService | undefined
): EscalationProcessor {
  return new EscalationProcessor(prisma, notificationService);
}
