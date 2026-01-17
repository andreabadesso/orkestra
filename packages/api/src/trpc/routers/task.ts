/**
 * Task Router
 *
 * tRPC router for task operations.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authedProcedure, managerProcedure } from '../index.js';
import {
  isOrkestraError,
  NotFoundError,
  ValidationError,
  type TaskFilterOptions,
  type CreateTaskRepoInput,
  type JsonObject,
} from '@orkestra/core';

// Helper type for Prisma InputJsonValue compatibility - excludes null
type InputJsonObject = JsonObject;

/**
 * Task status enum for validation
 */
const taskStatusSchema = z.enum([
  'pending',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
  'expired',
  'escalated',
]);

/**
 * Task priority enum for validation
 */
const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

/**
 * Form field type schema
 */
const formFieldTypeSchema = z.enum([
  'text',
  'textarea',
  'number',
  'email',
  'url',
  'date',
  'datetime',
  'time',
  'select',
  'multiselect',
  'radio',
  'checkbox',
  'file',
  'json',
]);

/**
 * Form field option schema
 */
const formFieldOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  disabled: z.boolean().optional(),
});

/**
 * Form field validation schema
 */
const formFieldValidationSchema = z.object({
  required: z.boolean().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().optional(),
  errorMessage: z.string().optional(),
});

/**
 * Form field schema
 */
const formFieldSchema = z.object({
  type: formFieldTypeSchema,
  label: z.string(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  defaultValue: z.unknown().optional(),
  options: z.array(formFieldOptionSchema).optional(),
  validation: formFieldValidationSchema.optional(),
  disabled: z.boolean().optional(),
  hidden: z.boolean().optional(),
  showWhen: z.object({
    field: z.string(),
    equals: z.unknown(),
  }).optional(),
});

/**
 * Task form schema
 */
const taskFormSchemaSchema = z.object({
  fields: z.record(z.string(), formFieldSchema),
  fieldOrder: z.array(z.string()).optional(),
  settings: z.object({
    submitLabel: z.string().optional(),
    cancelLabel: z.string().optional(),
    confirmSubmit: z.boolean().optional(),
    confirmMessage: z.string().optional(),
  }).optional(),
});

/**
 * Task assignment schema
 */
const taskAssignmentSchema = z.object({
  userId: z.string().optional(),
  groupId: z.string().optional(),
}).refine(
  (data) => data.userId || data.groupId,
  'Either userId or groupId must be provided'
);

/**
 * Task SLA schema
 */
const taskSlaSchema = z.object({
  dueAt: z.string().datetime(),
  warnBeforeMinutes: z.number().positive().optional(),
  escalation: z.object({
    afterMinutes: z.number().positive(),
    toGroupId: z.string().optional(),
    toUserId: z.string().optional(),
  }).optional(),
});

/**
 * Task context schema
 */
const taskContextSchema = z.object({
  conversationId: z.string().optional(),
  relatedEntity: z.object({
    type: z.string(),
    id: z.string(),
  }).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Task filter schema
 */
const taskFilterSchema = z.object({
  status: z.union([
    taskStatusSchema,
    z.array(taskStatusSchema),
  ]).optional(),
  priority: z.union([
    taskPrioritySchema,
    z.array(taskPrioritySchema),
  ]).optional(),
  type: z.union([
    z.string(),
    z.array(z.string()),
  ]).optional(),
  assignedUserId: z.string().optional(),
  assignedGroupId: z.string().optional(),
  claimedBy: z.string().optional(),
  workflowId: z.string().optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  search: z.string().optional(),
});

/**
 * Pagination schema (skip/take based for repository compatibility)
 */
const paginationSchema = z.object({
  skip: z.number().int().nonnegative().default(0),
  take: z.number().int().positive().max(100).default(20),
});

/**
 * Sort schema
 */
const sortSchema = z.object({
  field: z.enum(['title', 'type', 'status', 'priority', 'dueAt', 'createdAt', 'updatedAt']),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Task router
 */
export const taskRouter = router({
  /**
   * Create a new task
   */
  create: authedProcedure
    .input(z.object({
      type: z.string().min(1, 'Task type is required'),
      title: z.string().min(1, 'Task title is required'),
      description: z.string().optional(),
      priority: taskPrioritySchema.default('medium'),
      form: taskFormSchemaSchema,
      assignment: taskAssignmentSchema,
      sla: taskSlaSchema.optional(),
      context: taskContextSchema.optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      workflowId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { repositories, requestContext } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      // Convert form schema and SLA to repository format
      const dueAt = input.sla?.dueAt ? new Date(input.sla.dueAt) : null;
      const warnAt = input.sla?.warnBeforeMinutes && dueAt
        ? new Date(dueAt.getTime() - input.sla.warnBeforeMinutes * 60 * 1000)
        : null;

      const createInput: CreateTaskRepoInput = {
        type: input.type,
        title: input.title,
        formSchema: input.form as unknown as InputJsonObject,
      };

      // Add optional fields only if defined
      if (input.description !== undefined) {
        createInput.description = input.description;
      }
      if (input.priority !== undefined) {
        createInput.priority = input.priority;
      }
      if (input.assignment.userId !== undefined) {
        createInput.assignedUserId = input.assignment.userId;
      }
      if (input.assignment.groupId !== undefined) {
        createInput.assignedGroupId = input.assignment.groupId;
      }
      if (dueAt) {
        createInput.dueAt = dueAt;
      }
      if (warnAt) {
        createInput.warnAt = warnAt;
      }
      if (input.workflowId !== undefined) {
        createInput.workflowId = input.workflowId;
      }
      if (input.context !== undefined) {
        createInput.context = input.context as unknown as InputJsonObject;
      }
      if (input.sla?.escalation !== undefined) {
        createInput.escalationConfig = input.sla.escalation as unknown as InputJsonObject;
      }
      if (input.metadata !== undefined) {
        createInput.metadata = input.metadata as unknown as InputJsonObject;
      }

      const task = await repositories.task.create(requestContext, createInput);

      return task;
    }),

  /**
   * Get a task by ID
   */
  get: authedProcedure
    .input(z.object({
      id: z.string().min(1, 'Task ID is required'),
      includeHistory: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const { repositories, requestContext } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      if (input.includeHistory) {
        const task = await repositories.task.findByIdWithHistory(
          requestContext,
          input.id
        );

        if (!task) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Task ${input.id} not found`,
            cause: new NotFoundError('Task', input.id),
          });
        }

        return task;
      }

      const task = await repositories.task.findById(requestContext, input.id);

      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Task ${input.id} not found`,
          cause: new NotFoundError('Task', input.id),
        });
      }

      return task;
    }),

  /**
   * List tasks with filtering and pagination
   */
  list: authedProcedure
    .input(z.object({
      filter: taskFilterSchema.optional(),
      sort: sortSchema.optional(),
      pagination: paginationSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { repositories, requestContext } = ctx;
      const { filter, sort, pagination } = input;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      // Build filter with proper type handling
      let repoFilter: TaskFilterOptions | undefined;
      if (filter) {
        repoFilter = {
          ...(filter.status !== undefined && { status: filter.status }),
          ...(filter.priority !== undefined && { priority: filter.priority }),
          ...(filter.type !== undefined && { type: filter.type }),
          ...(filter.assignedUserId !== undefined && { assignedUserId: filter.assignedUserId }),
          ...(filter.assignedGroupId !== undefined && { assignedGroupId: filter.assignedGroupId }),
          ...(filter.claimedBy !== undefined && { claimedBy: filter.claimedBy }),
          ...(filter.workflowId !== undefined && { workflowId: filter.workflowId }),
          ...(filter.dueBefore !== undefined && { dueBefore: new Date(filter.dueBefore) }),
          ...(filter.dueAfter !== undefined && { dueAfter: new Date(filter.dueAfter) }),
          ...(filter.search !== undefined && { search: filter.search }),
        };
      }

      const result = await repositories.task.findMany(requestContext, {
        ...(repoFilter && { filter: repoFilter }),
        ...(sort && { sort }),
        ...(pagination && { pagination }),
      });

      return result;
    }),

  /**
   * Get pending tasks for the current user
   */
  pending: authedProcedure
    .input(z.object({
      includeGroupTasks: z.boolean().default(true),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { repositories, requestContext, auth } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      if (!auth.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User ID required for pending tasks query',
          cause: new ValidationError('User ID required'),
        });
      }

      // Get user's groups if including group tasks
      let groupIds: string[] = [];
      if (input?.includeGroupTasks) {
        groupIds = await repositories.user.getGroupIds(requestContext, auth.userId);
      }

      const tasks = await repositories.task.findPendingForUser(
        requestContext,
        auth.userId,
        groupIds
      );

      return {
        items: tasks,
        total: tasks.length,
      };
    }),

  /**
   * Claim a task (take ownership from a group)
   */
  claim: authedProcedure
    .input(z.object({
      id: z.string().min(1, 'Task ID is required'),
    }))
    .mutation(async ({ ctx, input }) => {
      const { repositories, requestContext, auth } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      if (!auth.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User ID required to claim task',
          cause: new ValidationError('User ID required'),
        });
      }

      try {
        const task = await repositories.task.claim(
          requestContext,
          input.id,
          auth.userId
        );
        return task;
      } catch (error) {
        if (isOrkestraError(error)) {
          throw new TRPCError({
            code: error.statusCode === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),

  /**
   * Unclaim a task (release back to group)
   */
  unclaim: authedProcedure
    .input(z.object({
      id: z.string().min(1, 'Task ID is required'),
    }))
    .mutation(async ({ ctx, input }) => {
      const { repositories, requestContext, auth } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      if (!auth.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User ID required to unclaim task',
          cause: new ValidationError('User ID required'),
        });
      }

      try {
        const task = await repositories.task.unclaim(
          requestContext,
          input.id,
          auth.userId
        );
        return task;
      } catch (error) {
        if (isOrkestraError(error)) {
          throw new TRPCError({
            code: error.statusCode === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),

  /**
   * Complete a task
   */
  complete: authedProcedure
    .input(z.object({
      id: z.string().min(1, 'Task ID is required'),
      result: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      const { repositories, requestContext, auth } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      if (!auth.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User ID required to complete task',
          cause: new ValidationError('User ID required'),
        });
      }

      try {
        const task = await repositories.task.complete(
          requestContext,
          input.id,
          input.result as unknown as InputJsonObject,
          auth.userId
        );
        return task;
      } catch (error) {
        if (isOrkestraError(error)) {
          throw new TRPCError({
            code: error.statusCode === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),

  /**
   * Reassign a task to a different user or group
   */
  reassign: managerProcedure
    .input(z.object({
      id: z.string().min(1, 'Task ID is required'),
      assignTo: z.object({
        userId: z.string().nullable().optional(),
        groupId: z.string().nullable().optional(),
      }).refine(
        (data) => data.userId !== undefined || data.groupId !== undefined,
        'Either userId or groupId must be provided'
      ),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { repositories, requestContext } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      try {
        const task = await repositories.task.reassign(
          requestContext,
          input.id,
          {
            userId: input.assignTo.userId ?? null,
            groupId: input.assignTo.groupId ?? null,
          }
        );
        return task;
      } catch (error) {
        if (isOrkestraError(error)) {
          throw new TRPCError({
            code: error.statusCode === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),

  /**
   * Cancel a task
   */
  cancel: managerProcedure
    .input(z.object({
      id: z.string().min(1, 'Task ID is required'),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { repositories, requestContext } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      try {
        const task = await repositories.task.cancel(
          requestContext,
          input.id,
          input.reason
        );
        return task;
      } catch (error) {
        if (isOrkestraError(error)) {
          throw new TRPCError({
            code: error.statusCode === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),

  /**
   * Add a comment to a task
   * Note: This creates a history entry with comment data
   */
  addComment: authedProcedure
    .input(z.object({
      id: z.string().min(1, 'Task ID is required'),
      content: z.string().min(1, 'Comment content is required'),
    }))
    .mutation(async ({ ctx, input }) => {
      const { repositories, requestContext, auth } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      // Verify task exists
      const task = await repositories.task.findById(requestContext, input.id);
      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Task ${input.id} not found`,
          cause: new NotFoundError('Task', input.id),
        });
      }

      // Add comment via audit log
      await repositories.audit.logTaskEvent(
        requestContext,
        'task_updated',
        input.id,
        `Comment added: ${input.content.substring(0, 100)}${input.content.length > 100 ? '...' : ''}`,
        { content: input.content }
      );

      return {
        taskId: input.id,
        content: input.content,
        createdBy: auth.userId,
        createdAt: new Date().toISOString(),
      };
    }),

  /**
   * Get task statistics
   */
  stats: authedProcedure
    .query(async ({ ctx }) => {
      const { repositories, requestContext } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      return repositories.task.getStats(requestContext);
    }),
});

export type TaskRouter = typeof taskRouter;
