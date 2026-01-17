/**
 * User repository
 *
 * Provides data access for user entities with tenant scoping.
 */

import type { PrismaClient, User, UserStatus, UserRole, Prisma } from '@prisma/client';
import type { RequestContext } from '../../context/index.js';
import {
  BaseRepository,
  EntityNotFoundError,
  UniqueConstraintError,
  type PaginationOptions,
  type SortOptions,
  type PaginatedResult,
} from './base.js';

/**
 * Input for creating a user
 */
export interface CreateUserInput {
  /** User email (unique within tenant) */
  email: string;
  /** User display name */
  name: string;
  /** User role */
  role?: UserRole;
  /** Initial status */
  status?: UserStatus;
  /** Avatar URL */
  avatarUrl?: string | null;
  /** User preferences */
  preferences?: Prisma.InputJsonValue;
  /** Additional metadata */
  metadata?: Prisma.InputJsonValue;
  /** Password (will be hashed if provided) */
  password?: string;
}

/**
 * Input for updating a user
 */
export interface UpdateUserInput {
  /** Updated email */
  email?: string;
  /** Updated name */
  name?: string;
  /** Updated role */
  role?: UserRole;
  /** Updated status */
  status?: UserStatus;
  /** Updated avatar URL */
  avatarUrl?: string | null;
  /** Updated preferences */
  preferences?: Prisma.InputJsonValue;
  /** Updated metadata */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Filter options for listing users
 */
export interface UserFilterOptions {
  /** Filter by status */
  status?: UserStatus | UserStatus[];
  /** Filter by role */
  role?: UserRole | UserRole[];
  /** Filter by group ID */
  groupId?: string;
  /** Search in name or email */
  search?: string;
  /** Include soft-deleted users */
  includeSoftDeleted?: boolean;
}

/**
 * Sort fields for users
 */
export type UserSortField = 'name' | 'email' | 'role' | 'status' | 'createdAt' | 'lastLoginAt';

/**
 * User with group information
 */
export interface UserWithGroups extends User {
  groupMemberships: Array<{
    group: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
}

/**
 * Repository for user data access
 */
export class UserRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  /**
   * Create a new user
   *
   * @param ctx - Request context
   * @param input - User creation input
   * @returns Created user
   * @throws UniqueConstraintError if email already exists in tenant
   */
  async create(ctx: RequestContext, input: CreateUserInput): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          ...this.tenantScope(ctx),
          email: input.email,
          name: input.name,
          role: input.role ?? 'operator',
          status: input.status ?? 'pending',
          avatarUrl: input.avatarUrl ?? null,
          preferences: input.preferences ?? {},
          metadata: input.metadata ?? {},
          ...(input.password !== undefined && { password: input.password }),
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new UniqueConstraintError('User', 'email', input.email);
      }
      throw error;
    }
  }

  /**
   * Find a user by ID within tenant
   *
   * @param ctx - Request context
   * @param id - User ID
   * @param includeSoftDeleted - Include soft-deleted user
   * @returns User or null if not found
   */
  async findById(
    ctx: RequestContext,
    id: string,
    includeSoftDeleted: boolean = false
  ): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: this.scopedFilters(ctx, { id }, { includeSoftDeleted }),
    });
  }

  /**
   * Find a user by ID within tenant, throwing if not found
   *
   * @param ctx - Request context
   * @param id - User ID
   * @param includeSoftDeleted - Include soft-deleted user
   * @returns User
   * @throws EntityNotFoundError if user not found
   */
  async findByIdOrThrow(
    ctx: RequestContext,
    id: string,
    includeSoftDeleted: boolean = false
  ): Promise<User> {
    const user = await this.findById(ctx, id, includeSoftDeleted);
    if (!user) {
      throw new EntityNotFoundError('User', id, ctx.tenantId);
    }
    return user;
  }

  /**
   * Find a user by ID with group information
   *
   * @param ctx - Request context
   * @param id - User ID
   * @returns User with groups or null if not found
   */
  async findByIdWithGroups(ctx: RequestContext, id: string): Promise<UserWithGroups | null> {
    return this.prisma.user.findFirst({
      where: this.scopedFilters(ctx, { id }),
      include: {
        groupMemberships: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find a user by email within tenant
   *
   * @param ctx - Request context
   * @param email - User email
   * @param includeSoftDeleted - Include soft-deleted user
   * @returns User or null if not found
   */
  async findByEmail(
    ctx: RequestContext,
    email: string,
    includeSoftDeleted: boolean = false
  ): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: this.scopedFilters(ctx, { email }, { includeSoftDeleted }),
    });
  }

  /**
   * List users with filtering and pagination
   *
   * @param ctx - Request context
   * @param options - Filter, sort, and pagination options
   * @returns Paginated list of users
   */
  async findMany(
    ctx: RequestContext,
    options: {
      filter?: UserFilterOptions;
      sort?: SortOptions<UserSortField>;
      pagination?: PaginationOptions;
    } = {}
  ): Promise<PaginatedResult<User>> {
    const { filter, sort, pagination } = options;

    const where: Prisma.UserWhereInput = {
      ...this.tenantScope(ctx),
      ...this.softDeleteScope(filter?.includeSoftDeleted),
    };

    // Apply status filter
    if (filter?.status) {
      where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
    }

    // Apply role filter
    if (filter?.role) {
      where.role = Array.isArray(filter.role) ? { in: filter.role } : filter.role;
    }

    // Apply group filter
    if (filter?.groupId) {
      where.groupMemberships = {
        some: {
          groupId: filter.groupId,
        },
      };
    }

    // Apply search filter
    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    // Execute count and find in parallel
    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: this.buildSort(sort) ?? { createdAt: 'desc' },
        ...this.buildPagination(pagination),
      }),
    ]);

    return this.createPaginatedResult(items, total, pagination);
  }

  /**
   * Find users by IDs within tenant
   *
   * @param ctx - Request context
   * @param ids - User IDs
   * @returns List of users
   */
  async findByIds(ctx: RequestContext, ids: string[]): Promise<User[]> {
    return this.prisma.user.findMany({
      where: this.scopedFilters(ctx, { id: { in: ids } }),
    });
  }

  /**
   * Update a user
   *
   * @param ctx - Request context
   * @param id - User ID
   * @param input - Update input
   * @returns Updated user
   * @throws EntityNotFoundError if user not found
   * @throws UniqueConstraintError if email already exists
   */
  async update(ctx: RequestContext, id: string, input: UpdateUserInput): Promise<User> {
    // First verify user exists in tenant
    await this.findByIdOrThrow(ctx, id);

    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...(input.email !== undefined && { email: input.email }),
          ...(input.name !== undefined && { name: input.name }),
          ...(input.role !== undefined && { role: input.role }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
          ...(input.preferences !== undefined && { preferences: input.preferences }),
          ...(input.metadata !== undefined && { metadata: input.metadata }),
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error) && input.email) {
        throw new UniqueConstraintError('User', 'email', input.email);
      }
      throw error;
    }
  }

  /**
   * Update user's last login timestamp
   *
   * @param ctx - Request context
   * @param id - User ID
   * @returns Updated user
   */
  async updateLastLogin(ctx: RequestContext, id: string): Promise<User> {
    await this.findByIdOrThrow(ctx, id);

    return this.prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
      },
    });
  }

  /**
   * Soft delete a user
   *
   * @param ctx - Request context
   * @param id - User ID
   * @returns Soft-deleted user
   * @throws EntityNotFoundError if user not found
   */
  async softDelete(ctx: RequestContext, id: string): Promise<User> {
    await this.findByIdOrThrow(ctx, id);

    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'inactive',
      },
    });
  }

  /**
   * Restore a soft-deleted user
   *
   * @param ctx - Request context
   * @param id - User ID
   * @returns Restored user
   * @throws EntityNotFoundError if user not found
   */
  async restore(ctx: RequestContext, id: string): Promise<User> {
    const user = await this.findById(ctx, id, true);
    if (!user) {
      throw new EntityNotFoundError('User', id, ctx.tenantId);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: null,
        status: 'active',
      },
    });
  }

  /**
   * Permanently delete a user
   *
   * @param ctx - Request context
   * @param id - User ID
   */
  async hardDelete(ctx: RequestContext, id: string): Promise<void> {
    await this.findByIdOrThrow(ctx, id, true);

    await this.prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Check if an email is available within tenant
   *
   * @param ctx - Request context
   * @param email - Email to check
   * @param excludeId - User ID to exclude (for updates)
   * @returns True if email is available
   */
  async isEmailAvailable(ctx: RequestContext, email: string, excludeId?: string): Promise<boolean> {
    const existing = await this.prisma.user.findFirst({
      where: {
        ...this.tenantScope(ctx),
        email,
        ...(excludeId && { NOT: { id: excludeId } }),
      },
      select: { id: true },
    });
    return !existing;
  }

  /**
   * Add user to groups
   *
   * @param ctx - Request context
   * @param userId - User ID
   * @param groupIds - Group IDs to add
   */
  async addToGroups(ctx: RequestContext, userId: string, groupIds: string[]): Promise<void> {
    await this.findByIdOrThrow(ctx, userId);

    await this.prisma.groupMember.createMany({
      data: groupIds.map((groupId) => ({
        userId,
        groupId,
      })),
      skipDuplicates: true,
    });

    // Update member counts
    await this.prisma.group.updateMany({
      where: { id: { in: groupIds } },
      data: {
        memberCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Remove user from groups
   *
   * @param ctx - Request context
   * @param userId - User ID
   * @param groupIds - Group IDs to remove
   */
  async removeFromGroups(ctx: RequestContext, userId: string, groupIds: string[]): Promise<void> {
    await this.findByIdOrThrow(ctx, userId);

    await this.prisma.groupMember.deleteMany({
      where: {
        userId,
        groupId: { in: groupIds },
      },
    });

    // Update member counts
    await this.prisma.group.updateMany({
      where: { id: { in: groupIds } },
      data: {
        memberCount: {
          decrement: 1,
        },
      },
    });
  }

  /**
   * Get user's group IDs
   *
   * @param ctx - Request context
   * @param userId - User ID
   * @returns Array of group IDs
   */
  async getGroupIds(ctx: RequestContext, userId: string): Promise<string[]> {
    const memberships = await this.prisma.groupMember.findMany({
      where: {
        userId,
        group: {
          ...this.tenantScope(ctx),
          deletedAt: null,
        },
      },
      select: { groupId: true },
    });

    return memberships.map((m) => m.groupId);
  }

  /**
   * Count users in tenant
   *
   * @param ctx - Request context
   * @param filter - Filter options
   * @returns User count
   */
  async count(ctx: RequestContext, filter?: Omit<UserFilterOptions, 'search'>): Promise<number> {
    const where: Prisma.UserWhereInput = {
      ...this.tenantScope(ctx),
      ...this.softDeleteScope(filter?.includeSoftDeleted),
    };

    if (filter?.status) {
      where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
    }

    if (filter?.role) {
      where.role = Array.isArray(filter.role) ? { in: filter.role } : filter.role;
    }

    return this.prisma.user.count({ where });
  }

  /**
   * Check if error is a unique constraint violation
   */
  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2002'
    );
  }
}
