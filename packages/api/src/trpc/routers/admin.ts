/**
 * Admin Router
 *
 * tRPC router for administrative operations (tenant, users, groups).
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, adminProcedure, managerProcedure } from '../index.js';
import {
  isOrkestraError,
  NotFoundError,
  type UserFilterOptions,
  type GroupFilterOptions,
  type CreateUserRepoInput,
  type CreateGroupRepoInput,
  type JsonObject,
} from '@orkestra/core';

// Helper type for Prisma InputJsonValue compatibility - excludes null
type InputJsonObject = JsonObject;

/**
 * User status enum for validation
 */
const userStatusSchema = z.enum(['active', 'inactive', 'pending', 'suspended']);

/**
 * User role enum for validation
 */
const userRoleSchema = z.enum(['admin', 'manager', 'operator', 'viewer']);

/**
 * Tenant status enum for validation
 */
const tenantStatusSchema = z.enum(['active', 'suspended', 'pending', 'archived']);

/**
 * User preferences schema
 */
const userPreferencesSchema = z.object({
  timezone: z.string().optional(),
  locale: z.string().optional(),
  notifications: z.object({
    taskAssigned: z.boolean().optional(),
    taskDueSoon: z.boolean().optional(),
    taskOverdue: z.boolean().optional(),
    workflowComplete: z.boolean().optional(),
  }).optional(),
  ui: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    compactView: z.boolean().optional(),
  }).optional(),
});

/**
 * Tenant config schema
 */
const tenantConfigSchema = z.object({
  timezone: z.string().optional(),
  locale: z.string().optional(),
  features: z.record(z.string(), z.boolean()).optional(),
  branding: z.object({
    primaryColor: z.string().optional(),
    logoUrl: z.string().url().optional(),
    faviconUrl: z.string().url().optional(),
  }).optional(),
  webhooks: z.object({
    taskEvents: z.string().url().optional(),
    workflowEvents: z.string().url().optional(),
    secret: z.string().optional(),
  }).optional(),
});

/**
 * Tenant limits schema
 */
const tenantLimitsSchema = z.object({
  maxUsers: z.number().int().positive().optional(),
  maxConcurrentWorkflows: z.number().int().positive().optional(),
  maxTasksPerMonth: z.number().int().positive().optional(),
  maxApiRequestsPerMinute: z.number().int().positive().optional(),
  maxStorageBytes: z.number().int().positive().optional(),
});

/**
 * Pagination schema (skip/take based for repository compatibility)
 */
const paginationSchema = z.object({
  skip: z.number().int().nonnegative().default(0),
  take: z.number().int().positive().max(100).default(20),
});

/**
 * Admin router
 */
export const adminRouter = router({
  // =========================================================================
  // Tenant operations
  // =========================================================================

  /**
   * Get current tenant info
   */
  getTenant: adminProcedure
    .query(async ({ ctx }) => {
      const { repositories, auth } = ctx;

      if (!repositories) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      const tenant = await repositories.tenant.findById(auth.tenantId!);

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Tenant ${auth.tenantId} not found`,
          cause: new NotFoundError('Tenant', auth.tenantId!),
        });
      }

      return tenant;
    }),

  /**
   * Update current tenant
   */
  updateTenant: adminProcedure
    .input(z.object({
      name: z.string().min(1).optional(),
      status: tenantStatusSchema.optional(),
      config: tenantConfigSchema.optional(),
      limits: tenantLimitsSchema.optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { repositories, auth } = ctx;

      if (!repositories) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      try {
        // Build update data with proper type handling
        const updateData: Record<string, unknown> = {};
        if (input.name !== undefined) {
          updateData['name'] = input.name;
        }
        if (input.status !== undefined) {
          updateData['status'] = input.status;
        }
        if (input.config !== undefined) {
          updateData['config'] = input.config;
        }
        if (input.limits !== undefined) {
          updateData['limits'] = input.limits;
        }
        if (input.metadata !== undefined) {
          updateData['metadata'] = input.metadata;
        }

        const tenant = await repositories.tenant.update(auth.tenantId!, updateData);
        return tenant;
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

  // =========================================================================
  // User operations
  // =========================================================================

  /**
   * List users in tenant
   */
  listUsers: managerProcedure
    .input(z.object({
      filter: z.object({
        status: z.union([userStatusSchema, z.array(userStatusSchema)]).optional(),
        role: z.union([userRoleSchema, z.array(userRoleSchema)]).optional(),
        groupId: z.string().optional(),
        search: z.string().optional(),
      }).optional(),
      sort: z.object({
        field: z.enum(['name', 'email', 'role', 'status', 'createdAt', 'lastLoginAt']),
        direction: z.enum(['asc', 'desc']).default('asc'),
      }).optional(),
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
      let repoFilter: UserFilterOptions | undefined;
      if (filter) {
        repoFilter = {
          ...(filter.status !== undefined && { status: filter.status }),
          ...(filter.role !== undefined && { role: filter.role }),
          ...(filter.groupId !== undefined && { groupId: filter.groupId }),
          ...(filter.search !== undefined && { search: filter.search }),
        };
      }

      const result = await repositories.user.findMany(requestContext, {
        ...(repoFilter && { filter: repoFilter }),
        ...(sort && { sort }),
        ...(pagination && { pagination }),
      });

      return result;
    }),

  /**
   * Get a user by ID
   */
  getUser: managerProcedure
    .input(z.object({
      id: z.string().min(1, 'User ID is required'),
      includeGroups: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const { repositories, requestContext } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      if (input.includeGroups) {
        const user = await repositories.user.findByIdWithGroups(
          requestContext,
          input.id
        );

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `User ${input.id} not found`,
            cause: new NotFoundError('User', input.id),
          });
        }

        return user;
      }

      const user = await repositories.user.findById(requestContext, input.id);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `User ${input.id} not found`,
          cause: new NotFoundError('User', input.id),
        });
      }

      return user;
    }),

  /**
   * Create a new user
   */
  createUser: adminProcedure
    .input(z.object({
      email: z.string().email('Invalid email address'),
      name: z.string().min(1, 'Name is required'),
      role: userRoleSchema,
      preferences: userPreferencesSchema.optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
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
        const createInput: CreateUserRepoInput = {
          email: input.email,
          name: input.name,
          role: input.role,
        };

        // Add optional fields only if defined
        if (input.preferences !== undefined) {
          createInput.preferences = input.preferences as unknown as InputJsonObject;
        }
        if (input.metadata !== undefined) {
          createInput.metadata = input.metadata as unknown as InputJsonObject;
        }

        const user = await repositories.user.create(requestContext, createInput);
        return user;
      } catch (error) {
        if (isOrkestraError(error)) {
          throw new TRPCError({
            code: error.statusCode === 409 ? 'CONFLICT' : 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),

  /**
   * Update a user
   */
  updateUser: adminProcedure
    .input(z.object({
      id: z.string().min(1, 'User ID is required'),
      email: z.string().email().optional(),
      name: z.string().min(1).optional(),
      avatarUrl: z.string().url().nullable().optional(),
      status: userStatusSchema.optional(),
      role: userRoleSchema.optional(),
      preferences: userPreferencesSchema.optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { repositories, requestContext } = ctx;
      const { id, ...updateFields } = input;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      try {
        // Build update data with proper type handling
        const updateData: Record<string, unknown> = {};
        if (updateFields.email !== undefined) {
          updateData['email'] = updateFields.email;
        }
        if (updateFields.name !== undefined) {
          updateData['name'] = updateFields.name;
        }
        if (updateFields.avatarUrl !== undefined) {
          updateData['avatarUrl'] = updateFields.avatarUrl;
        }
        if (updateFields.status !== undefined) {
          updateData['status'] = updateFields.status;
        }
        if (updateFields.role !== undefined) {
          updateData['role'] = updateFields.role;
        }
        if (updateFields.preferences !== undefined) {
          updateData['preferences'] = updateFields.preferences as unknown as InputJsonObject;
        }
        if (updateFields.metadata !== undefined) {
          updateData['metadata'] = updateFields.metadata as unknown as InputJsonObject;
        }

        const user = await repositories.user.update(requestContext, id, updateData);
        return user;
      } catch (error) {
        if (isOrkestraError(error)) {
          throw new TRPCError({
            code: error.statusCode === 404 ? 'NOT_FOUND' :
                  error.statusCode === 409 ? 'CONFLICT' : 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),

  /**
   * Delete a user (soft delete)
   */
  deleteUser: adminProcedure
    .input(z.object({
      id: z.string().min(1, 'User ID is required'),
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
        await repositories.user.softDelete(requestContext, input.id);
        return { success: true, id: input.id };
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

  // =========================================================================
  // Group operations
  // =========================================================================

  /**
   * List groups in tenant
   */
  listGroups: managerProcedure
    .input(z.object({
      filter: z.object({
        isAssignable: z.boolean().optional(),
        search: z.string().optional(),
      }).optional(),
      sort: z.object({
        field: z.enum(['name', 'memberCount', 'createdAt', 'updatedAt']),
        direction: z.enum(['asc', 'desc']).default('asc'),
      }).optional(),
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
      let repoFilter: GroupFilterOptions | undefined;
      if (filter) {
        repoFilter = {
          ...(filter.isAssignable !== undefined && { isAssignable: filter.isAssignable }),
          ...(filter.search !== undefined && { search: filter.search }),
        };
      }

      const result = await repositories.group.findMany(requestContext, {
        ...(repoFilter && { filter: repoFilter }),
        ...(sort && { sort }),
        ...(pagination && { pagination }),
      });

      return result;
    }),

  /**
   * Get a group by ID
   */
  getGroup: managerProcedure
    .input(z.object({
      id: z.string().min(1, 'Group ID is required'),
      includeMembers: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const { repositories, requestContext } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      if (input.includeMembers) {
        const group = await repositories.group.findByIdWithMembers(
          requestContext,
          input.id
        );

        if (!group) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Group ${input.id} not found`,
            cause: new NotFoundError('Group', input.id),
          });
        }

        return group;
      }

      const group = await repositories.group.findById(requestContext, input.id);

      if (!group) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Group ${input.id} not found`,
          cause: new NotFoundError('Group', input.id),
        });
      }

      return group;
    }),

  /**
   * Create a new group
   */
  createGroup: adminProcedure
    .input(z.object({
      name: z.string().min(1, 'Group name is required'),
      slug: z.string().min(1, 'Group slug is required'),
      description: z.string().optional(),
      isAssignable: z.boolean().default(true),
      metadata: z.record(z.string(), z.unknown()).optional(),
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
        const createInput: CreateGroupRepoInput = {
          name: input.name,
          slug: input.slug,
          isAssignable: input.isAssignable,
        };

        // Add optional fields only if defined
        if (input.description !== undefined) {
          createInput.description = input.description;
        }
        if (input.metadata !== undefined) {
          createInput.metadata = input.metadata as unknown as InputJsonObject;
        }

        const group = await repositories.group.create(requestContext, createInput);
        return group;
      } catch (error) {
        if (isOrkestraError(error)) {
          throw new TRPCError({
            code: error.statusCode === 409 ? 'CONFLICT' : 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),

  /**
   * Update a group
   */
  updateGroup: adminProcedure
    .input(z.object({
      id: z.string().min(1, 'Group ID is required'),
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      isAssignable: z.boolean().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { repositories, requestContext } = ctx;
      const { id, ...updateFields } = input;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      try {
        // Build update data with proper type handling
        const updateData: Record<string, unknown> = {};
        if (updateFields.name !== undefined) {
          updateData['name'] = updateFields.name;
        }
        if (updateFields.description !== undefined) {
          updateData['description'] = updateFields.description;
        }
        if (updateFields.isAssignable !== undefined) {
          updateData['isAssignable'] = updateFields.isAssignable;
        }
        if (updateFields.metadata !== undefined) {
          updateData['metadata'] = updateFields.metadata as unknown as InputJsonObject;
        }

        const group = await repositories.group.update(requestContext, id, updateData);
        return group;
      } catch (error) {
        if (isOrkestraError(error)) {
          throw new TRPCError({
            code: error.statusCode === 404 ? 'NOT_FOUND' :
                  error.statusCode === 409 ? 'CONFLICT' : 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),

  /**
   * Update group members (add multiple)
   */
  updateGroupMembers: adminProcedure
    .input(z.object({
      id: z.string().min(1, 'Group ID is required'),
      memberIds: z.array(z.string()),
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
        // First get current members
        const currentMembers = await repositories.group.getMemberIds(
          requestContext,
          input.id
        );

        // Calculate members to add and remove
        const toAdd = input.memberIds.filter(id => !currentMembers.includes(id));
        const toRemove = currentMembers.filter(id => !input.memberIds.includes(id));

        // Add new members
        if (toAdd.length > 0) {
          await repositories.group.addMembers(requestContext, input.id, toAdd);
        }

        // Remove old members
        if (toRemove.length > 0) {
          await repositories.group.removeMembers(requestContext, input.id, toRemove);
        }

        // Get updated group
        const group = await repositories.group.findByIdWithMembers(
          requestContext,
          input.id
        );

        return group;
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
   * Add a member to a group
   */
  addGroupMember: adminProcedure
    .input(z.object({
      groupId: z.string().min(1, 'Group ID is required'),
      userId: z.string().min(1, 'User ID is required'),
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
        await repositories.group.addMembers(
          requestContext,
          input.groupId,
          [input.userId]
        );
        const group = await repositories.group.findByIdWithMembers(
          requestContext,
          input.groupId
        );
        return group;
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
   * Remove a member from a group
   */
  removeGroupMember: adminProcedure
    .input(z.object({
      groupId: z.string().min(1, 'Group ID is required'),
      userId: z.string().min(1, 'User ID is required'),
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
        await repositories.group.removeMembers(
          requestContext,
          input.groupId,
          [input.userId]
        );
        const group = await repositories.group.findByIdWithMembers(
          requestContext,
          input.groupId
        );
        return group;
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
   * Delete a group (soft delete)
   */
  deleteGroup: adminProcedure
    .input(z.object({
      id: z.string().min(1, 'Group ID is required'),
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
        await repositories.group.softDelete(requestContext, input.id);
        return { success: true, id: input.id };
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
});

export type AdminRouter = typeof adminRouter;
