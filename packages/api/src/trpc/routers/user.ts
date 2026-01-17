/**
 * User Router
 *
 * tRPC router for user CRUD operations.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcrypt';
import { router, managerProcedure, adminProcedure } from '../index.js';

/**
 * User status enum for validation
 */
const userStatusSchema = z.enum(['active', 'inactive']);

/**
 * User role enum for validation (dashboard uses agent instead of operator)
 */
const userRoleSchema = z.enum(['admin', 'manager', 'agent']);

/**
 * User router with CRUD operations
 */
export const userManagementRouter = router({
  /**
   * List users with pagination and filtering
   */
  list: managerProcedure
    .input(
      z.object({
        search: z.string().optional(),
        role: userRoleSchema.optional(),
        status: userStatusSchema.optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const { repositories, requestContext } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      const result = await repositories.user.findMany(requestContext, {
        filter: {
          ...(input.search && { search: input.search }),
          ...(input.role && { role: input.role === 'agent' ? 'operator' : input.role }),
          ...(input.status && { status: input.status }),
        },
        pagination: {
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        },
        sort: {
          field: 'createdAt',
          direction: 'desc',
        },
      });

      // Transform users: map 'operator' to 'agent', add empty groups array
      const transformedUsers = result.items.map((user: any) => ({
        ...user,
        role: user.role === 'operator' ? 'agent' : user.role,
        groups: [],
      }));

      return {
        users: transformedUsers,
        total: result.total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(result.total / input.limit),
      };
    }),

  /**
   * Get single user by ID
   */
  get: managerProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { repositories, requestContext } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      const user = await repositories.user.findByIdWithGroups(requestContext, input.id);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Transform: map 'operator' to 'agent', extract groups
      const transformedUser = {
        ...user,
        role: user.role === 'operator' ? 'agent' : user.role,
        groups:
          (user as any).groupMemberships?.map((gm: any) => ({
            id: gm.group.id,
            name: gm.group.name,
          })) || [],
      };

      return transformedUser;
    }),

  /**
   * Create new user
   */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        email: z.string().email(),
        role: userRoleSchema,
        groupIds: z.array(z.string()).optional(),
        password: z.string().min(8),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { repositories, requestContext } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      // Map 'agent' to 'operator' for the database
      const repoRole = input.role === 'agent' ? 'operator' : input.role;

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Create user
      const user = await repositories.user.create(requestContext, {
        name: input.name,
        email: input.email,
        role: repoRole,
        password: hashedPassword,
        status: 'active',
      });

      // Assign to groups if provided
      if (input.groupIds && input.groupIds.length > 0) {
        for (const groupId of input.groupIds) {
          await repositories.group.addMembers(requestContext, groupId, [user.id]);
        }
      }

      // Transform for response
      const transformedUser = {
        ...user,
        role: user.role === 'operator' ? 'agent' : user.role,
        groups:
          input.groupIds && input.groupIds.length > 0
            ? await repositories.user
                .getGroupIds(requestContext, user.id)
                .then((ids) => ids.map((id) => ({ id, name: '' })))
            : [],
      };

      return transformedUser;
    }),

  /**
   * Update user
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).max(100).optional(),
        email: z.string().email().optional(),
        role: userRoleSchema.optional(),
        groupIds: z.array(z.string()).optional(),
        status: userStatusSchema.optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { repositories, requestContext, auth } = ctx;
      const { id, groupIds, ...updateData } = input;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      // Check if user exists
      const existing = await repositories.user.findById(requestContext, id);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Prevent self-deactivation
      if (id === auth.userId && updateData.status === 'inactive') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot deactivate yourself',
        });
      }

      // Map 'agent' to 'operator' for the database
      const finalUpdateData: any = { ...updateData };
      if (finalUpdateData.role) {
        finalUpdateData.role = finalUpdateData.role === 'agent' ? 'operator' : finalUpdateData.role;
      }

      // Update user
      await repositories.user.update(requestContext, id, finalUpdateData);

      // Update group assignments if provided
      if (groupIds !== undefined) {
        // Get old group IDs
        const userWithGroups = await repositories.user.findByIdWithGroups(requestContext, id);
        const oldGroupIds =
          (userWithGroups as any).groupMemberships?.map((gm: any) => gm.group.id) || [];

        // Remove from old groups
        for (const groupId of oldGroupIds) {
          await repositories.group.removeMembers(requestContext, groupId, [id]);
        }

        // Add to new groups
        for (const groupId of groupIds) {
          await repositories.group.addMembers(requestContext, groupId, [id]);
        }
      }

      // Get updated groups
      const updatedUser = await repositories.user.findByIdWithGroups(requestContext, id);

      // Transform for response
      const transformedUser = {
        ...updatedUser,
        role: (updatedUser as any).role === 'operator' ? 'agent' : (updatedUser as any).role,
        groups:
          (updatedUser as any).groupMemberships?.map((gm: any) => ({
            id: gm.group.id,
            name: gm.group.name,
          })) || [],
      };

      return transformedUser;
    }),

  /**
   * Delete user (soft delete)
   */
  deleteUser: adminProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { repositories, requestContext, auth } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      // Check if user exists
      const user = await repositories.user.findById(requestContext, input.id);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Prevent self-deletion
      if (user.id === auth.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete yourself',
        });
      }

      // Soft delete user
      await repositories.user.softDelete(requestContext, input.id);

      return { success: true };
    }),
});

export type UserRouter = typeof userManagementRouter;
