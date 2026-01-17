/**
 * Task repository
 *
 * Provides data access for task entities with tenant scoping
 * and special methods for task lifecycle management.
 */

import { Prisma, type PrismaClient, type Task, type TaskStatus, type TaskPriority } from '@prisma/client';
import type { RequestContext } from '../../context/index.js';
import {
  BaseRepository,
  EntityNotFoundError,
  type PaginationOptions,
  type SortOptions,
  type PaginatedResult,
} from './base.js';

/**
 * Input for creating a task
 */
export interface CreateTaskInput {
  /** Task type identifier */
  type: string;
  /** Task title */
  title: string;
  /** Task description */
  description?: string | null;
  /** Task priority */
  priority?: TaskPriority;
  /** Form schema for task completion */
  formSchema: Prisma.InputJsonValue;
  /** Task context data */
  context?: Prisma.InputJsonValue;
  /** Assigned user ID */
  assignedUserId?: string | null;
  /** Assigned group ID */
  assignedGroupId?: string | null;
  /** Due date/time */
  dueAt?: Date | null;
  /** Warning date/time */
  warnAt?: Date | null;
  /** Escalation configuration */
  escalationConfig?: Prisma.InputJsonValue | null;
  /** Related workflow ID */
  workflowId?: string | null;
  /** Related workflow run ID */
  workflowRunId?: string | null;
  /** Additional metadata */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Input for updating a task
 */
export interface UpdateTaskInput {
  /** Updated title */
  title?: string;
  /** Updated description */
  description?: string | null;
  /** Updated priority */
  priority?: TaskPriority;
  /** Updated assigned user ID */
  assignedUserId?: string | null;
  /** Updated assigned group ID */
  assignedGroupId?: string | null;
  /** Updated due date */
  dueAt?: Date | null;
  /** Updated warn date */
  warnAt?: Date | null;
  /** Updated escalation config */
  escalationConfig?: Prisma.InputJsonValue | null;
  /** Updated metadata */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Filter options for listing tasks
 */
export interface TaskFilterOptions {
  /** Filter by status */
  status?: TaskStatus | TaskStatus[];
  /** Filter by priority */
  priority?: TaskPriority | TaskPriority[];
  /** Filter by type */
  type?: string | string[];
  /** Filter by assigned user ID */
  assignedUserId?: string;
  /** Filter by assigned group ID */
  assignedGroupId?: string;
  /** Filter by claimed user ID */
  claimedBy?: string;
  /** Filter by workflow ID */
  workflowId?: string;
  /** Filter by workflow run ID */
  workflowRunId?: string;
  /** Filter tasks due before date */
  dueBefore?: Date;
  /** Filter tasks due after date */
  dueAfter?: Date;
  /** Search in title or description */
  search?: string;
  /** Include soft-deleted tasks */
  includeSoftDeleted?: boolean;
}

/**
 * Sort fields for tasks
 */
export type TaskSortField = 'title' | 'type' | 'status' | 'priority' | 'dueAt' | 'createdAt' | 'updatedAt';

/**
 * Task with history
 */
export interface TaskWithHistory extends Task {
  history: Array<{
    id: string;
    action: string;
    userId: string | null;
    data: unknown;
    createdAt: Date;
  }>;
}

/**
 * Repository for task data access
 */
export class TaskRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  /**
   * Create a new task
   *
   * @param ctx - Request context
   * @param input - Task creation input
   * @returns Created task
   */
  async create(ctx: RequestContext, input: CreateTaskInput): Promise<Task> {
    const task = await this.prisma.task.create({
      data: {
        ...this.tenantScope(ctx),
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? 'medium',
        formSchema: input.formSchema,
        context: input.context ?? {},
        assignedUserId: input.assignedUserId ?? null,
        assignedGroupId: input.assignedGroupId ?? null,
        dueAt: input.dueAt ?? null,
        warnAt: input.warnAt ?? null,
        escalationConfig: input.escalationConfig ?? Prisma.JsonNull,
        workflowId: input.workflowId ?? null,
        workflowRunId: input.workflowRunId ?? null,
        metadata: input.metadata ?? {},
        status: input.assignedUserId || input.assignedGroupId ? 'assigned' : 'pending',
      },
    });

    // Record creation in history
    await this.addHistory(task.id, 'created', ctx.userId, {
      type: input.type,
      title: input.title,
      assignedUserId: input.assignedUserId,
      assignedGroupId: input.assignedGroupId,
    });

    return task;
  }

  /**
   * Find a task by ID within tenant
   *
   * @param ctx - Request context
   * @param id - Task ID
   * @param includeSoftDeleted - Include soft-deleted task
   * @returns Task or null if not found
   */
  async findById(
    ctx: RequestContext,
    id: string,
    includeSoftDeleted: boolean = false
  ): Promise<Task | null> {
    return this.prisma.task.findFirst({
      where: this.scopedFilters(ctx, { id }, { includeSoftDeleted }),
    });
  }

  /**
   * Find a task by ID within tenant, throwing if not found
   *
   * @param ctx - Request context
   * @param id - Task ID
   * @param includeSoftDeleted - Include soft-deleted task
   * @returns Task
   * @throws EntityNotFoundError if task not found
   */
  async findByIdOrThrow(
    ctx: RequestContext,
    id: string,
    includeSoftDeleted: boolean = false
  ): Promise<Task> {
    const task = await this.findById(ctx, id, includeSoftDeleted);
    if (!task) {
      throw new EntityNotFoundError('Task', id, ctx.tenantId);
    }
    return task;
  }

  /**
   * Find a task by ID with history
   *
   * @param ctx - Request context
   * @param id - Task ID
   * @returns Task with history or null if not found
   */
  async findByIdWithHistory(
    ctx: RequestContext,
    id: string
  ): Promise<TaskWithHistory | null> {
    return this.prisma.task.findFirst({
      where: this.scopedFilters(ctx, { id }),
      include: {
        history: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * List tasks with filtering and pagination
   *
   * @param ctx - Request context
   * @param options - Filter, sort, and pagination options
   * @returns Paginated list of tasks
   */
  async findMany(
    ctx: RequestContext,
    options: {
      filter?: TaskFilterOptions;
      sort?: SortOptions<TaskSortField>;
      pagination?: PaginationOptions;
    } = {}
  ): Promise<PaginatedResult<Task>> {
    const { filter, sort, pagination } = options;
    const where = this.buildTaskWhere(ctx, filter);

    // Execute count and find in parallel
    const [total, items] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        orderBy: this.buildSort(sort) ?? { createdAt: 'desc' },
        ...this.buildPagination(pagination),
      }),
    ]);

    return this.createPaginatedResult(items, total, pagination);
  }

  /**
   * Find pending tasks for a user (assigned directly or via groups)
   *
   * @param ctx - Request context
   * @param userId - User ID
   * @param groupIds - User's group IDs
   * @returns List of pending tasks
   */
  async findPendingForUser(
    ctx: RequestContext,
    userId: string,
    groupIds: string[]
  ): Promise<Task[]> {
    const activeStatuses: TaskStatus[] = ['pending', 'assigned', 'in_progress'];

    return this.prisma.task.findMany({
      where: {
        ...this.tenantScope(ctx),
        deletedAt: null,
        status: { in: activeStatuses },
        OR: [
          // Tasks assigned directly to user
          { assignedUserId: userId },
          // Tasks claimed by user
          { claimedBy: userId },
          // Tasks assigned to user's groups (not yet claimed)
          {
            assignedGroupId: { in: groupIds },
            claimedBy: null,
          },
        ],
      },
      orderBy: [
        { priority: 'desc' },
        { dueAt: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  /**
   * Find overdue tasks
   *
   * @param ctx - Request context
   * @returns List of overdue tasks
   */
  async findOverdue(ctx: RequestContext): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        ...this.tenantScope(ctx),
        deletedAt: null,
        status: { in: ['pending', 'assigned', 'in_progress'] },
        dueAt: { lt: new Date() },
      },
      orderBy: { dueAt: 'asc' },
    });
  }

  /**
   * Find tasks that need warning notification
   *
   * @param ctx - Request context
   * @returns List of tasks needing warning
   */
  async findNeedingWarning(ctx: RequestContext): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        ...this.tenantScope(ctx),
        deletedAt: null,
        status: { in: ['pending', 'assigned', 'in_progress'] },
        warnAt: { lte: new Date() },
        dueAt: { gt: new Date() },
      },
      orderBy: { warnAt: 'asc' },
    });
  }

  /**
   * Update a task
   *
   * @param ctx - Request context
   * @param id - Task ID
   * @param input - Update input
   * @returns Updated task
   * @throws EntityNotFoundError if task not found
   */
  async update(
    ctx: RequestContext,
    id: string,
    input: UpdateTaskInput
  ): Promise<Task> {
    await this.findByIdOrThrow(ctx, id);

    const data: Prisma.TaskUpdateInput = {};

    if (input.title !== undefined) {
      data.title = input.title;
    }
    if (input.description !== undefined) {
      data.description = input.description;
    }
    if (input.priority !== undefined) {
      data.priority = input.priority;
    }
    if (input.assignedUserId !== undefined) {
      data.assignedUser = input.assignedUserId
        ? { connect: { id: input.assignedUserId } }
        : { disconnect: true };
    }
    if (input.assignedGroupId !== undefined) {
      data.assignedGroup = input.assignedGroupId
        ? { connect: { id: input.assignedGroupId } }
        : { disconnect: true };
    }
    if (input.dueAt !== undefined) {
      data.dueAt = input.dueAt;
    }
    if (input.warnAt !== undefined) {
      data.warnAt = input.warnAt;
    }
    if (input.escalationConfig !== undefined) {
      data.escalationConfig = input.escalationConfig ?? Prisma.JsonNull;
    }
    if (input.metadata !== undefined) {
      data.metadata = input.metadata;
    }

    const task = await this.prisma.task.update({
      where: { id },
      data,
    });

    await this.addHistory(id, 'updated', ctx.userId, input as Prisma.InputJsonValue);

    return task;
  }

  /**
   * Claim a task (user takes ownership from a group assignment)
   *
   * @param ctx - Request context
   * @param id - Task ID
   * @param userId - User ID claiming the task
   * @returns Claimed task
   * @throws EntityNotFoundError if task not found
   * @throws Error if task is already claimed or not assignable
   */
  async claim(ctx: RequestContext, id: string, userId: string): Promise<Task> {
    const task = await this.findByIdOrThrow(ctx, id);

    if (task.claimedBy) {
      throw new Error(`Task is already claimed by user ${task.claimedBy}`);
    }

    if (!task.assignedGroupId && !task.assignedUserId) {
      throw new Error('Task is not assigned and cannot be claimed');
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        claimedBy: userId,
        claimedAt: new Date(),
        status: 'in_progress',
      },
    });

    await this.addHistory(id, 'claimed', userId, { claimedBy: userId });

    return updatedTask;
  }

  /**
   * Unclaim a task (user releases the task back to the group)
   *
   * @param ctx - Request context
   * @param id - Task ID
   * @param userId - User ID unclaiming the task
   * @returns Unclaimed task
   * @throws EntityNotFoundError if task not found
   * @throws Error if task is not claimed by the user
   */
  async unclaim(ctx: RequestContext, id: string, userId: string): Promise<Task> {
    const task = await this.findByIdOrThrow(ctx, id);

    if (task.claimedBy !== userId) {
      throw new Error('Task is not claimed by this user');
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        claimedBy: null,
        claimedAt: null,
        status: 'assigned',
      },
    });

    await this.addHistory(id, 'unclaimed', userId, { unclaimedBy: userId });

    return updatedTask;
  }

  /**
   * Start working on a task (transition to in_progress)
   *
   * @param ctx - Request context
   * @param id - Task ID
   * @returns Started task
   */
  async start(ctx: RequestContext, id: string): Promise<Task> {
    const task = await this.findByIdOrThrow(ctx, id);

    if (task.status === 'in_progress') {
      return task;
    }

    if (!['pending', 'assigned'].includes(task.status)) {
      throw new Error(`Cannot start task with status ${task.status}`);
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        status: 'in_progress',
      },
    });

    await this.addHistory(id, 'started', ctx.userId, {});

    return updatedTask;
  }

  /**
   * Complete a task
   *
   * @param ctx - Request context
   * @param id - Task ID
   * @param formData - Form data submitted by the user
   * @param completedBy - User ID who completed the task
   * @returns Completed task
   * @throws EntityNotFoundError if task not found
   * @throws Error if task cannot be completed
   */
  async complete(
    ctx: RequestContext,
    id: string,
    formData: Prisma.InputJsonValue,
    completedBy: string
  ): Promise<Task> {
    const task = await this.findByIdOrThrow(ctx, id);

    const completableStatuses: TaskStatus[] = ['pending', 'assigned', 'in_progress'];
    if (!completableStatuses.includes(task.status)) {
      throw new Error(`Cannot complete task with status ${task.status}`);
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        status: 'completed',
        formData,
        completedBy,
        completedAt: new Date(),
      },
    });

    await this.addHistory(id, 'completed', completedBy, {
      formData,
      completedBy,
    });

    return updatedTask;
  }

  /**
   * Cancel a task
   *
   * @param ctx - Request context
   * @param id - Task ID
   * @param reason - Cancellation reason
   * @returns Cancelled task
   */
  async cancel(ctx: RequestContext, id: string, reason?: string): Promise<Task> {
    const task = await this.findByIdOrThrow(ctx, id);

    const cancellableStatuses: TaskStatus[] = ['pending', 'assigned', 'in_progress'];
    if (!cancellableStatuses.includes(task.status)) {
      throw new Error(`Cannot cancel task with status ${task.status}`);
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        status: 'cancelled',
      },
    });

    await this.addHistory(id, 'cancelled', ctx.userId, { reason });

    return updatedTask;
  }

  /**
   * Expire a task (mark as expired due to SLA timeout)
   *
   * @param ctx - Request context
   * @param id - Task ID
   * @returns Expired task
   */
  async expire(ctx: RequestContext, id: string): Promise<Task> {
    const task = await this.findByIdOrThrow(ctx, id);

    const expirableStatuses: TaskStatus[] = ['pending', 'assigned', 'in_progress'];
    if (!expirableStatuses.includes(task.status)) {
      throw new Error(`Cannot expire task with status ${task.status}`);
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        status: 'expired',
      },
    });

    await this.addHistory(id, 'expired', null, {});

    return updatedTask;
  }

  /**
   * Escalate a task
   *
   * @param ctx - Request context
   * @param id - Task ID
   * @param escalateTo - Optional user or group to escalate to
   * @returns Escalated task
   */
  async escalate(
    ctx: RequestContext,
    id: string,
    escalateTo?: { userId?: string; groupId?: string }
  ): Promise<Task> {
    const task = await this.findByIdOrThrow(ctx, id);

    const escalatableStatuses: TaskStatus[] = ['pending', 'assigned', 'in_progress'];
    if (!escalatableStatuses.includes(task.status)) {
      throw new Error(`Cannot escalate task with status ${task.status}`);
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        status: 'escalated',
        ...(escalateTo?.userId && { assignedUserId: escalateTo.userId }),
        ...(escalateTo?.groupId && { assignedGroupId: escalateTo.groupId }),
        // Clear claim when escalating
        claimedBy: null,
        claimedAt: null,
      },
    });

    await this.addHistory(id, 'escalated', ctx.userId, {
      escalatedTo: escalateTo,
      previousAssignedUserId: task.assignedUserId,
      previousAssignedGroupId: task.assignedGroupId,
    });

    return updatedTask;
  }

  /**
   * Reassign a task to a different user or group
   *
   * @param ctx - Request context
   * @param id - Task ID
   * @param assignTo - User or group to assign to
   * @returns Reassigned task
   */
  async reassign(
    ctx: RequestContext,
    id: string,
    assignTo: { userId?: string | null; groupId?: string | null }
  ): Promise<Task> {
    const task = await this.findByIdOrThrow(ctx, id);

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        assignedUserId: assignTo.userId ?? null,
        assignedGroupId: assignTo.groupId ?? null,
        status: assignTo.userId || assignTo.groupId ? 'assigned' : 'pending',
        // Clear claim when reassigning
        claimedBy: null,
        claimedAt: null,
      },
    });

    await this.addHistory(id, 'reassigned', ctx.userId, {
      assignedUserId: assignTo.userId,
      assignedGroupId: assignTo.groupId,
      previousAssignedUserId: task.assignedUserId,
      previousAssignedGroupId: task.assignedGroupId,
    });

    return updatedTask;
  }

  /**
   * Soft delete a task
   *
   * @param ctx - Request context
   * @param id - Task ID
   * @returns Soft-deleted task
   */
  async softDelete(ctx: RequestContext, id: string): Promise<Task> {
    await this.findByIdOrThrow(ctx, id);

    return this.prisma.task.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Restore a soft-deleted task
   *
   * @param ctx - Request context
   * @param id - Task ID
   * @returns Restored task
   */
  async restore(ctx: RequestContext, id: string): Promise<Task> {
    const task = await this.findById(ctx, id, true);
    if (!task) {
      throw new EntityNotFoundError('Task', id, ctx.tenantId);
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        deletedAt: null,
      },
    });
  }

  /**
   * Permanently delete a task
   *
   * @param ctx - Request context
   * @param id - Task ID
   */
  async hardDelete(ctx: RequestContext, id: string): Promise<void> {
    await this.findByIdOrThrow(ctx, id, true);

    await this.prisma.task.delete({
      where: { id },
    });
  }

  /**
   * Count tasks in tenant
   *
   * @param ctx - Request context
   * @param filter - Filter options
   * @returns Task count
   */
  async count(
    ctx: RequestContext,
    filter?: Omit<TaskFilterOptions, 'search'>
  ): Promise<number> {
    const where = this.buildTaskWhere(ctx, filter);
    return this.prisma.task.count({ where });
  }

  /**
   * Get task statistics for a tenant
   *
   * @param ctx - Request context
   * @returns Task statistics
   */
  async getStats(ctx: RequestContext): Promise<{
    total: number;
    pending: number;
    assigned: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    expired: number;
    escalated: number;
    overdue: number;
  }> {
    const baseWhere = {
      ...this.tenantScope(ctx),
      deletedAt: null,
    };

    const [
      total,
      pending,
      assigned,
      inProgress,
      completed,
      cancelled,
      expired,
      escalated,
      overdue,
    ] = await Promise.all([
      this.prisma.task.count({ where: baseWhere }),
      this.prisma.task.count({ where: { ...baseWhere, status: 'pending' } }),
      this.prisma.task.count({ where: { ...baseWhere, status: 'assigned' } }),
      this.prisma.task.count({ where: { ...baseWhere, status: 'in_progress' } }),
      this.prisma.task.count({ where: { ...baseWhere, status: 'completed' } }),
      this.prisma.task.count({ where: { ...baseWhere, status: 'cancelled' } }),
      this.prisma.task.count({ where: { ...baseWhere, status: 'expired' } }),
      this.prisma.task.count({ where: { ...baseWhere, status: 'escalated' } }),
      this.prisma.task.count({
        where: {
          ...baseWhere,
          status: { in: ['pending', 'assigned', 'in_progress'] },
          dueAt: { lt: new Date() },
        },
      }),
    ]);

    return {
      total,
      pending,
      assigned,
      inProgress,
      completed,
      cancelled,
      expired,
      escalated,
      overdue,
    };
  }

  /**
   * Add history entry for a task
   */
  private async addHistory(
    taskId: string,
    action: string,
    userId: string | null,
    historyData: Prisma.InputJsonValue
  ): Promise<void> {
    await this.prisma.taskHistory.create({
      data: {
        taskId,
        action,
        userId,
        data: historyData,
      },
    });
  }

  /**
   * Build Prisma where clause for task queries
   */
  private buildTaskWhere(
    ctx: RequestContext,
    filter?: TaskFilterOptions
  ): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = {
      ...this.tenantScope(ctx),
      ...this.softDeleteScope(filter?.includeSoftDeleted),
    };

    if (filter?.status) {
      where.status = Array.isArray(filter.status)
        ? { in: filter.status }
        : filter.status;
    }

    if (filter?.priority) {
      where.priority = Array.isArray(filter.priority)
        ? { in: filter.priority }
        : filter.priority;
    }

    if (filter?.type) {
      where.type = Array.isArray(filter.type)
        ? { in: filter.type }
        : filter.type;
    }

    if (filter?.assignedUserId) {
      where.assignedUserId = filter.assignedUserId;
    }

    if (filter?.assignedGroupId) {
      where.assignedGroupId = filter.assignedGroupId;
    }

    if (filter?.claimedBy) {
      where.claimedBy = filter.claimedBy;
    }

    if (filter?.workflowId) {
      where.workflowId = filter.workflowId;
    }

    if (filter?.workflowRunId) {
      where.workflowRunId = filter.workflowRunId;
    }

    if (filter?.dueBefore || filter?.dueAfter) {
      where.dueAt = {
        ...(filter.dueBefore && { lte: filter.dueBefore }),
        ...(filter.dueAfter && { gte: filter.dueAfter }),
      };
    }

    if (filter?.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
