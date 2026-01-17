/**
 * Task Service
 *
 * Main service for managing human-in-the-loop tasks.
 * Provides CRUD operations, assignment, SLA management, and workflow integration.
 */

import type { PrismaClient, Task, TaskStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { Client as TemporalClient } from '@temporalio/client';
import type { RequestContext } from '../../context/index.js';
import { NotFoundError, ValidationError, InvalidStateError } from '../../errors/index.js';
import { generateTaskId } from '../../utils/id.js';

import type {
  CreateTaskOptions,
  TaskComment,
  ReassignTarget,
  TaskHistory,
  TaskWithHistory,
  NotificationService,
  TaskCompletionSignal,
  TaskCancellationSignal,
  TaskEscalationSignal,
} from './types.js';
import { NoOpNotificationService } from './types.js';
import { computeSLA, isBreached, getTimeRemaining, getSLAStatus } from './sla.js';
import { validateFormDataOrThrow, parseFormSchema, isValidFormSchema } from './form-validation.js';
import { AssignmentResolver, createAssignmentResolver } from './assignment.js';
import { EscalationProcessor, createEscalationProcessor } from './escalation.js';

/**
 * Task service configuration
 */
export interface TaskServiceConfig {
  /** Prisma client */
  prisma: PrismaClient;
  /** Optional Temporal client for workflow signaling */
  temporalClient?: TemporalClient | undefined;
  /** Optional notification service */
  notificationService?: NotificationService | undefined;
  /** Optional assignment resolver */
  assignmentResolver?: AssignmentResolver | undefined;
  /** Optional escalation processor */
  escalationProcessor?: EscalationProcessor | undefined;
  /** Signal name for task completion */
  taskCompletedSignal?: string | undefined;
  /** Signal name for task cancellation */
  taskCancelledSignal?: string | undefined;
  /** Signal name for task escalation */
  taskEscalatedSignal?: string | undefined;
}

/**
 * Task service for managing human-in-the-loop tasks
 */
export class TaskService {
  private prisma: PrismaClient;
  private temporalClient: TemporalClient | undefined;
  private notificationService: NotificationService;
  private assignmentResolver: AssignmentResolver;
  private escalationProcessor: EscalationProcessor;

  // Signal names for Temporal workflows
  private taskCompletedSignal: string;
  private taskCancelledSignal: string;
  private taskEscalatedSignal: string;

  constructor(config: TaskServiceConfig) {
    this.prisma = config.prisma;
    this.temporalClient = config.temporalClient;
    this.notificationService = config.notificationService ?? new NoOpNotificationService();
    this.assignmentResolver = config.assignmentResolver ?? createAssignmentResolver(config.prisma);
    this.escalationProcessor =
      config.escalationProcessor ?? createEscalationProcessor(config.prisma, this.notificationService);

    // Signal names
    this.taskCompletedSignal = config.taskCompletedSignal ?? 'taskCompleted';
    this.taskCancelledSignal = config.taskCancelledSignal ?? 'taskCancelled';
    this.taskEscalatedSignal = config.taskEscalatedSignal ?? 'taskEscalated';
  }

  // ============================================================================
  // Core Operations
  // ============================================================================

  /**
   * Create a new task
   *
   * @param ctx - Request context
   * @param options - Task creation options
   * @returns Created task
   */
  async create(ctx: RequestContext, options: CreateTaskOptions): Promise<Task> {
    // Validate form schema
    if (!isValidFormSchema(options.form)) {
      throw new ValidationError('Invalid form schema');
    }

    // Resolve assignment
    const assignment = await this.assignmentResolver.resolve(ctx, options.assignTo);

    // Compute SLA if provided
    let dueAt: Date | null = null;
    let warnAt: Date | null = null;
    let escalationConfig: Prisma.InputJsonValue | null = null;

    if (options.sla) {
      const computedSLA = computeSLA(options.sla);
      dueAt = computedSLA.dueAt;
      warnAt = computedSLA.warnAt;
      escalationConfig = computedSLA.escalationConfig as unknown as Prisma.InputJsonValue;
    }

    // Determine initial status
    const initialStatus: TaskStatus = assignment.userId || assignment.groupId ? 'assigned' : 'pending';

    // Build context data
    const contextData: Prisma.InputJsonValue = {
      ...(options.context ?? {}),
      conversationId: options.conversationId ?? null,
    };

    // Create the task
    const task = await this.prisma.task.create({
      data: {
        id: generateTaskId(),
        tenantId: ctx.tenantId,
        type: options.type ?? 'human_task',
        title: options.title,
        description: options.description ?? null,
        priority: options.priority ?? 'medium',
        status: initialStatus,
        formSchema: options.form as unknown as Prisma.InputJsonValue,
        context: contextData,
        assignedUserId: assignment.userId,
        assignedGroupId: assignment.groupId,
        dueAt,
        warnAt,
        escalationConfig: escalationConfig ?? Prisma.JsonNull,
        workflowId: options.workflowId,
        workflowRunId: options.workflowRunId,
        metadata: (options.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    // Record creation in history
    await this.addHistoryEntry(task.id, 'created', ctx.userId, {
      type: options.type ?? 'human_task',
      title: options.title,
      assignedUserId: assignment.userId,
      assignedGroupId: assignment.groupId,
      workflowId: options.workflowId,
    });

    // Send notification
    await this.notificationService.taskCreated(task);

    // If assigned to a specific user, notify them
    if (assignment.userId) {
      await this.notificationService.taskAssigned(task, assignment.userId);
    }

    return task;
  }

  /**
   * Claim a task (user takes ownership from a group assignment)
   *
   * @param ctx - Request context
   * @param taskId - Task ID
   * @returns Claimed task
   */
  async claim(ctx: RequestContext, taskId: string): Promise<Task> {
    const task = await this.findByIdOrThrow(ctx, taskId);

    // Verify user is authenticated
    if (!ctx.userId) {
      throw new ValidationError('User must be authenticated to claim a task');
    }

    // Check if task can be claimed
    if (task.claimedBy) {
      throw new InvalidStateError(`Task is already claimed by user ${task.claimedBy}`);
    }

    if (!task.assignedGroupId && task.assignedUserId !== ctx.userId) {
      throw new InvalidStateError('Task cannot be claimed - not assigned to your group');
    }

    // Check task status
    const claimableStatuses: TaskStatus[] = ['pending', 'assigned'];
    if (!claimableStatuses.includes(task.status)) {
      throw new InvalidStateError(`Cannot claim task with status ${task.status}`);
    }

    // Claim the task
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        claimedBy: ctx.userId,
        claimedAt: new Date(),
        status: 'in_progress',
      },
    });

    // Record in history
    await this.addHistoryEntry(taskId, 'claimed', ctx.userId, {
      claimedBy: ctx.userId,
    });

    return updatedTask;
  }

  /**
   * Complete a task with form data
   *
   * @param ctx - Request context
   * @param taskId - Task ID
   * @param formData - Form data submitted by the user
   * @returns Completed task
   */
  async complete(ctx: RequestContext, taskId: string, formData: Record<string, unknown>): Promise<Task> {
    const task = await this.findByIdOrThrow(ctx, taskId);

    // Verify user is authenticated
    if (!ctx.userId) {
      throw new ValidationError('User must be authenticated to complete a task');
    }

    // Check task status
    const completableStatuses: TaskStatus[] = ['pending', 'assigned', 'in_progress'];
    if (!completableStatuses.includes(task.status)) {
      throw new InvalidStateError(`Cannot complete task with status ${task.status}`);
    }

    // Parse and validate form schema
    const formSchema = parseFormSchema(task.formSchema);
    if (!formSchema) {
      throw new ValidationError('Task has invalid form schema');
    }

    // Validate form data
    const validatedData = validateFormDataOrThrow(formSchema, formData);

    // Complete the task
    const completedAt = new Date();
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        formData: validatedData as Prisma.InputJsonValue,
        completedBy: ctx.userId,
        completedAt,
      },
    });

    // Record in history
    await this.addHistoryEntry(taskId, 'completed', ctx.userId, {
      completedBy: ctx.userId,
    });

    // Send notification
    await this.notificationService.taskCompleted(updatedTask);

    // Signal workflow completion
    await this.signalWorkflowCompletion(updatedTask, validatedData, ctx.userId, completedAt);

    return updatedTask;
  }

  /**
   * Reassign a task to a different user or group
   *
   * @param ctx - Request context
   * @param taskId - Task ID
   * @param target - New assignment target
   * @returns Reassigned task
   */
  async reassign(ctx: RequestContext, taskId: string, target: ReassignTarget): Promise<Task> {
    const task = await this.findByIdOrThrow(ctx, taskId);

    // Check task status
    const reassignableStatuses: TaskStatus[] = ['pending', 'assigned', 'in_progress', 'escalated'];
    if (!reassignableStatuses.includes(task.status)) {
      throw new InvalidStateError(`Cannot reassign task with status ${task.status}`);
    }

    // Determine new status
    const newStatus: TaskStatus = target.userId || target.groupId ? 'assigned' : 'pending';

    // Reassign the task
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        assignedUserId: target.userId ?? null,
        assignedGroupId: target.groupId ?? null,
        status: newStatus,
        // Clear claim when reassigning
        claimedBy: null,
        claimedAt: null,
      },
    });

    // Record in history
    await this.addHistoryEntry(taskId, 'reassigned', ctx.userId, {
      previousAssignedUserId: task.assignedUserId,
      previousAssignedGroupId: task.assignedGroupId,
      newAssignedUserId: target.userId ?? null,
      newAssignedGroupId: target.groupId ?? null,
    });

    // Notify new assignee
    if (target.userId) {
      await this.notificationService.taskAssigned(updatedTask, target.userId);
    }

    return updatedTask;
  }

  /**
   * Escalate a task
   *
   * @param ctx - Request context
   * @param taskId - Task ID
   * @param reason - Optional escalation reason
   * @returns Escalated task
   */
  async escalate(ctx: RequestContext, taskId: string, reason?: string): Promise<Task> {
    const task = await this.findByIdOrThrow(ctx, taskId);

    // Check task status
    const escalatableStatuses: TaskStatus[] = ['pending', 'assigned', 'in_progress'];
    if (!escalatableStatuses.includes(task.status)) {
      throw new InvalidStateError(`Cannot escalate task with status ${task.status}`);
    }

    // Process escalation
    const escalationResult = await this.escalationProcessor.processManualEscalation(
      ctx,
      task,
      undefined,
      reason
    );

    // Update task
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'escalated',
        assignedUserId: escalationResult.escalatedTo?.userId ?? task.assignedUserId,
        assignedGroupId: escalationResult.escalatedTo?.groupId ?? task.assignedGroupId,
        // Clear claim when escalating
        claimedBy: null,
        claimedAt: null,
      },
    });

    // Record in history
    await this.addHistoryEntry(taskId, 'escalated', ctx.userId, {
      reason: escalationResult.reason ?? null,
      escalatedToUserId: escalationResult.escalatedTo?.userId ?? null,
      escalatedToGroupId: escalationResult.escalatedTo?.groupId ?? null,
    });

    // Send notification
    await this.notificationService.taskEscalated(updatedTask, escalationResult.reason);

    // Signal workflow
    await this.signalWorkflowEscalation(
      updatedTask,
      escalationResult.reason,
      escalationResult.escalatedTo
    );

    return updatedTask;
  }

  /**
   * Cancel a task
   *
   * @param ctx - Request context
   * @param taskId - Task ID
   * @param reason - Optional cancellation reason
   * @returns Cancelled task
   */
  async cancel(ctx: RequestContext, taskId: string, reason?: string): Promise<Task> {
    const task = await this.findByIdOrThrow(ctx, taskId);

    // Check task status
    const cancellableStatuses: TaskStatus[] = ['pending', 'assigned', 'in_progress', 'escalated'];
    if (!cancellableStatuses.includes(task.status)) {
      throw new InvalidStateError(`Cannot cancel task with status ${task.status}`);
    }

    // Cancel the task
    const cancelledAt = new Date();
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'cancelled',
      },
    });

    // Record in history
    await this.addHistoryEntry(taskId, 'cancelled', ctx.userId, {
      reason: reason ?? null,
    });

    // Signal workflow cancellation
    await this.signalWorkflowCancellation(updatedTask, reason, ctx.userId, cancelledAt);

    return updatedTask;
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  /**
   * Find a task by ID
   *
   * @param ctx - Request context
   * @param taskId - Task ID
   * @returns Task or null if not found
   */
  async findById(ctx: RequestContext, taskId: string): Promise<Task | null> {
    return this.prisma.task.findFirst({
      where: {
        id: taskId,
        tenantId: ctx.tenantId,
        deletedAt: null,
      },
    });
  }

  /**
   * Find a task by ID or throw
   *
   * @param ctx - Request context
   * @param taskId - Task ID
   * @returns Task
   * @throws NotFoundError if task not found
   */
  async findByIdOrThrow(ctx: RequestContext, taskId: string): Promise<Task> {
    const task = await this.findById(ctx, taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }
    return task;
  }

  /**
   * List pending tasks (not completed, cancelled, or expired)
   *
   * @param ctx - Request context
   * @returns List of pending tasks
   */
  async listPending(ctx: RequestContext): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        status: {
          in: ['pending', 'assigned', 'in_progress'],
        },
      },
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * List tasks by status
   *
   * @param ctx - Request context
   * @param status - Task status(es) to filter by
   * @returns List of tasks
   */
  async listByStatus(ctx: RequestContext, status: TaskStatus | TaskStatus[]): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        status: Array.isArray(status) ? { in: status } : status,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * List tasks assigned to a user
   *
   * @param ctx - Request context
   * @param userId - User ID
   * @param groupIds - Optional group IDs the user belongs to
   * @returns List of tasks
   */
  async listForUser(ctx: RequestContext, userId: string, groupIds: string[] = []): Promise<Task[]> {
    const activeStatuses: TaskStatus[] = ['pending', 'assigned', 'in_progress'];

    return this.prisma.task.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        status: { in: activeStatuses },
        OR: [
          // Tasks assigned directly to user
          { assignedUserId: userId },
          // Tasks claimed by user
          { claimedBy: userId },
          // Tasks assigned to user's groups (not yet claimed)
          ...(groupIds.length > 0
            ? [
                {
                  assignedGroupId: { in: groupIds },
                  claimedBy: null,
                },
              ]
            : []),
        ],
      },
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * List overdue tasks
   *
   * @param ctx - Request context
   * @returns List of overdue tasks
   */
  async listOverdue(ctx: RequestContext): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        status: { in: ['pending', 'assigned', 'in_progress'] },
        dueAt: { lt: new Date() },
      },
      orderBy: { dueAt: 'asc' },
    });
  }

  // ============================================================================
  // History and Comments
  // ============================================================================

  /**
   * Add a comment to a task
   *
   * @param ctx - Request context
   * @param taskId - Task ID
   * @param comment - Comment to add
   */
  async addComment(ctx: RequestContext, taskId: string, comment: TaskComment): Promise<void> {
    await this.findByIdOrThrow(ctx, taskId);

    await this.addHistoryEntry(taskId, 'commented', comment.userId ?? ctx.userId, {
      text: comment.text,
      internal: comment.internal ?? false,
    });
  }

  /**
   * Get task history
   *
   * @param ctx - Request context
   * @param taskId - Task ID
   * @returns Task history entries
   */
  async getHistory(ctx: RequestContext, taskId: string): Promise<TaskHistory[]> {
    await this.findByIdOrThrow(ctx, taskId);

    const history = await this.prisma.taskHistory.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });

    return history.map((h) => ({
      id: h.id,
      action: h.action,
      userId: h.userId,
      data: h.data,
      createdAt: h.createdAt,
    }));
  }

  /**
   * Get task with history
   *
   * @param ctx - Request context
   * @param taskId - Task ID
   * @returns Task with history
   */
  async findByIdWithHistory(ctx: RequestContext, taskId: string): Promise<TaskWithHistory | null> {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        tenantId: ctx.tenantId,
        deletedAt: null,
      },
      include: {
        history: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) {
      return null;
    }

    return {
      ...task,
      history: task.history.map((h) => ({
        id: h.id,
        action: h.action,
        userId: h.userId,
        data: h.data,
        createdAt: h.createdAt,
      })),
    };
  }

  // ============================================================================
  // SLA Utilities
  // ============================================================================

  /**
   * Check SLA status for a task
   *
   * @param task - Task to check
   * @returns SLA status or null if no SLA
   */
  getSLAStatus(task: Task) {
    if (!task.dueAt) {
      return null;
    }

    // Try to get warning threshold from metadata
    const metadata = task.metadata as Record<string, unknown> | null;
    const warnBefore = metadata?.['slaWarnBefore'] as string | undefined;

    return getSLAStatus(task.dueAt, warnBefore);
  }

  /**
   * Check if a task's SLA is breached
   *
   * @param task - Task to check
   * @returns True if SLA is breached
   */
  isSLABreached(task: Task): boolean {
    if (!task.dueAt) {
      return false;
    }
    return isBreached(task.dueAt);
  }

  /**
   * Get time remaining for a task's SLA
   *
   * @param task - Task to check
   * @returns Milliseconds remaining (negative if breached) or null if no SLA
   */
  getSLATimeRemaining(task: Task): number | null {
    if (!task.dueAt) {
      return null;
    }
    return getTimeRemaining(task.dueAt);
  }

  // ============================================================================
  // Workflow Signaling
  // ============================================================================

  /**
   * Signal workflow that a task was completed
   */
  private async signalWorkflowCompletion(
    task: Task,
    formData: Record<string, unknown>,
    completedBy: string,
    completedAt: Date
  ): Promise<void> {
    if (!this.temporalClient || !task.workflowId || !task.workflowRunId) {
      return;
    }

    try {
      const handle = this.temporalClient.workflow.getHandle(task.workflowId, task.workflowRunId);

      const signal: TaskCompletionSignal = {
        taskId: task.id,
        formData,
        completedBy,
        completedAt,
      };

      await handle.signal(this.taskCompletedSignal, signal);
    } catch (error) {
      // Log but don't fail - workflow may have completed
      console.error('Failed to signal workflow completion:', error);
    }
  }

  /**
   * Signal workflow that a task was cancelled
   */
  private async signalWorkflowCancellation(
    task: Task,
    reason: string | undefined,
    cancelledBy: string | null,
    cancelledAt: Date
  ): Promise<void> {
    if (!this.temporalClient || !task.workflowId || !task.workflowRunId) {
      return;
    }

    try {
      const handle = this.temporalClient.workflow.getHandle(task.workflowId, task.workflowRunId);

      const signal: TaskCancellationSignal = {
        taskId: task.id,
        reason,
        cancelledBy,
        cancelledAt,
      };

      await handle.signal(this.taskCancelledSignal, signal);
    } catch (error) {
      console.error('Failed to signal workflow cancellation:', error);
    }
  }

  /**
   * Signal workflow that a task was escalated
   */
  private async signalWorkflowEscalation(
    task: Task,
    reason: string | undefined,
    escalatedTo: ReassignTarget | undefined
  ): Promise<void> {
    if (!this.temporalClient || !task.workflowId || !task.workflowRunId) {
      return;
    }

    try {
      const handle = this.temporalClient.workflow.getHandle(task.workflowId, task.workflowRunId);

      const signal: TaskEscalationSignal = {
        taskId: task.id,
        reason,
        escalatedTo: escalatedTo ?? { userId: null, groupId: null },
        escalatedAt: new Date(),
      };

      await handle.signal(this.taskEscalatedSignal, signal);
    } catch (error) {
      console.error('Failed to signal workflow escalation:', error);
    }
  }

  // ============================================================================
  // Internal Helpers
  // ============================================================================

  /**
   * Add a history entry for a task
   */
  private async addHistoryEntry(
    taskId: string,
    action: string,
    userId: string | null,
    data: Record<string, unknown>
  ): Promise<void> {
    await this.prisma.taskHistory.create({
      data: {
        taskId,
        action,
        userId,
        data: data as Prisma.InputJsonValue,
      },
    });
  }
}

/**
 * Create a task service
 *
 * @param config - Service configuration
 * @returns Configured task service
 */
export function createTaskService(config: TaskServiceConfig): TaskService {
  return new TaskService(config);
}
