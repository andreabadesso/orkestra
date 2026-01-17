/**
 * Group repository
 *
 * Provides data access for group entities with tenant scoping.
 */

import type { PrismaClient, Group, AssignmentStrategy, Prisma } from '@prisma/client';
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
 * Input for creating a group
 */
export interface CreateGroupInput {
  /** Group name */
  name: string;
  /** URL-friendly slug (unique within tenant) */
  slug: string;
  /** Group description */
  description?: string | null;
  /** Whether group can receive task assignments */
  isAssignable?: boolean;
  /** Assignment strategy for the group */
  assignmentStrategy?: AssignmentStrategy;
  /** Additional metadata */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Input for updating a group
 */
export interface UpdateGroupInput {
  /** Updated name */
  name?: string;
  /** Updated description */
  description?: string | null;
  /** Updated assignable status */
  isAssignable?: boolean;
  /** Updated assignment strategy */
  assignmentStrategy?: AssignmentStrategy;
  /** Updated metadata */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Filter options for listing groups
 */
export interface GroupFilterOptions {
  /** Filter by assignable status */
  isAssignable?: boolean;
  /** Search in name or slug */
  search?: string;
  /** Include soft-deleted groups */
  includeSoftDeleted?: boolean;
}

/**
 * Sort fields for groups
 */
export type GroupSortField = 'name' | 'slug' | 'memberCount' | 'createdAt' | 'updatedAt';

/**
 * Group with member information
 */
export interface GroupWithMembers extends Group {
  members: Array<{
    user: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
    joinedAt: Date;
  }>;
}

/**
 * Repository for group data access
 */
export class GroupRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  /**
   * Create a new group
   *
   * @param ctx - Request context
   * @param input - Group creation input
   * @returns Created group
   * @throws UniqueConstraintError if slug already exists in tenant
   */
  async create(ctx: RequestContext, input: CreateGroupInput): Promise<Group> {
    try {
      return await this.prisma.group.create({
        data: {
          ...this.tenantScope(ctx),
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          isAssignable: input.isAssignable ?? true,
          assignmentStrategy: input.assignmentStrategy ?? 'round_robin',
          metadata: input.metadata ?? {},
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new UniqueConstraintError('Group', 'slug', input.slug);
      }
      throw error;
    }
  }

  /**
   * Find a group by ID within tenant
   *
   * @param ctx - Request context
   * @param id - Group ID
   * @param includeSoftDeleted - Include soft-deleted group
   * @returns Group or null if not found
   */
  async findById(
    ctx: RequestContext,
    id: string,
    includeSoftDeleted: boolean = false
  ): Promise<Group | null> {
    return this.prisma.group.findFirst({
      where: this.scopedFilters(ctx, { id }, { includeSoftDeleted }),
    });
  }

  /**
   * Find a group by ID within tenant, throwing if not found
   *
   * @param ctx - Request context
   * @param id - Group ID
   * @param includeSoftDeleted - Include soft-deleted group
   * @returns Group
   * @throws EntityNotFoundError if group not found
   */
  async findByIdOrThrow(
    ctx: RequestContext,
    id: string,
    includeSoftDeleted: boolean = false
  ): Promise<Group> {
    const group = await this.findById(ctx, id, includeSoftDeleted);
    if (!group) {
      throw new EntityNotFoundError('Group', id, ctx.tenantId);
    }
    return group;
  }

  /**
   * Find a group by ID with member information
   *
   * @param ctx - Request context
   * @param id - Group ID
   * @returns Group with members or null if not found
   */
  async findByIdWithMembers(
    ctx: RequestContext,
    id: string
  ): Promise<GroupWithMembers | null> {
    return this.prisma.group.findFirst({
      where: this.scopedFilters(ctx, { id }),
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            joinedAt: 'desc',
          },
        },
      },
    });
  }

  /**
   * Find a group by slug within tenant
   *
   * @param ctx - Request context
   * @param slug - Group slug
   * @param includeSoftDeleted - Include soft-deleted group
   * @returns Group or null if not found
   */
  async findBySlug(
    ctx: RequestContext,
    slug: string,
    includeSoftDeleted: boolean = false
  ): Promise<Group | null> {
    return this.prisma.group.findFirst({
      where: this.scopedFilters(ctx, { slug }, { includeSoftDeleted }),
    });
  }

  /**
   * List groups with filtering and pagination
   *
   * @param ctx - Request context
   * @param options - Filter, sort, and pagination options
   * @returns Paginated list of groups
   */
  async findMany(
    ctx: RequestContext,
    options: {
      filter?: GroupFilterOptions;
      sort?: SortOptions<GroupSortField>;
      pagination?: PaginationOptions;
    } = {}
  ): Promise<PaginatedResult<Group>> {
    const { filter, sort, pagination } = options;

    const where: Prisma.GroupWhereInput = {
      ...this.tenantScope(ctx),
      ...this.softDeleteScope(filter?.includeSoftDeleted),
    };

    // Apply assignable filter
    if (filter?.isAssignable !== undefined) {
      where.isAssignable = filter.isAssignable;
    }

    // Apply search filter
    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { slug: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    // Execute count and find in parallel
    const [total, items] = await Promise.all([
      this.prisma.group.count({ where }),
      this.prisma.group.findMany({
        where,
        orderBy: this.buildSort(sort) ?? { name: 'asc' },
        ...this.buildPagination(pagination),
      }),
    ]);

    return this.createPaginatedResult(items, total, pagination);
  }

  /**
   * Find groups by IDs within tenant
   *
   * @param ctx - Request context
   * @param ids - Group IDs
   * @returns List of groups
   */
  async findByIds(ctx: RequestContext, ids: string[]): Promise<Group[]> {
    return this.prisma.group.findMany({
      where: this.scopedFilters(ctx, { id: { in: ids } }),
    });
  }

  /**
   * Find assignable groups within tenant
   *
   * @param ctx - Request context
   * @returns List of assignable groups
   */
  async findAssignable(ctx: RequestContext): Promise<Group[]> {
    return this.prisma.group.findMany({
      where: this.scopedFilters(ctx, { isAssignable: true }),
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Update a group
   *
   * @param ctx - Request context
   * @param id - Group ID
   * @param input - Update input
   * @returns Updated group
   * @throws EntityNotFoundError if group not found
   */
  async update(
    ctx: RequestContext,
    id: string,
    input: UpdateGroupInput
  ): Promise<Group> {
    await this.findByIdOrThrow(ctx, id);

    return this.prisma.group.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.isAssignable !== undefined && { isAssignable: input.isAssignable }),
        ...(input.assignmentStrategy !== undefined && { assignmentStrategy: input.assignmentStrategy }),
        ...(input.metadata !== undefined && { metadata: input.metadata }),
      },
    });
  }

  /**
   * Soft delete a group
   *
   * @param ctx - Request context
   * @param id - Group ID
   * @returns Soft-deleted group
   * @throws EntityNotFoundError if group not found
   */
  async softDelete(ctx: RequestContext, id: string): Promise<Group> {
    await this.findByIdOrThrow(ctx, id);

    return this.prisma.group.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isAssignable: false,
      },
    });
  }

  /**
   * Restore a soft-deleted group
   *
   * @param ctx - Request context
   * @param id - Group ID
   * @returns Restored group
   * @throws EntityNotFoundError if group not found
   */
  async restore(ctx: RequestContext, id: string): Promise<Group> {
    const group = await this.findById(ctx, id, true);
    if (!group) {
      throw new EntityNotFoundError('Group', id, ctx.tenantId);
    }

    return this.prisma.group.update({
      where: { id },
      data: {
        deletedAt: null,
        isAssignable: true,
      },
    });
  }

  /**
   * Permanently delete a group
   *
   * @param ctx - Request context
   * @param id - Group ID
   */
  async hardDelete(ctx: RequestContext, id: string): Promise<void> {
    await this.findByIdOrThrow(ctx, id, true);

    await this.prisma.group.delete({
      where: { id },
    });
  }

  /**
   * Check if a slug is available within tenant
   *
   * @param ctx - Request context
   * @param slug - Slug to check
   * @param excludeId - Group ID to exclude (for updates)
   * @returns True if slug is available
   */
  async isSlugAvailable(
    ctx: RequestContext,
    slug: string,
    excludeId?: string
  ): Promise<boolean> {
    const existing = await this.prisma.group.findFirst({
      where: {
        ...this.tenantScope(ctx),
        slug,
        ...(excludeId && { NOT: { id: excludeId } }),
      },
      select: { id: true },
    });
    return !existing;
  }

  /**
   * Add members to a group
   *
   * @param ctx - Request context
   * @param groupId - Group ID
   * @param userIds - User IDs to add
   */
  async addMembers(
    ctx: RequestContext,
    groupId: string,
    userIds: string[]
  ): Promise<void> {
    await this.findByIdOrThrow(ctx, groupId);

    const created = await this.prisma.groupMember.createMany({
      data: userIds.map((userId) => ({
        groupId,
        userId,
      })),
      skipDuplicates: true,
    });

    // Update member count
    await this.prisma.group.update({
      where: { id: groupId },
      data: {
        memberCount: {
          increment: created.count,
        },
      },
    });
  }

  /**
   * Remove members from a group
   *
   * @param ctx - Request context
   * @param groupId - Group ID
   * @param userIds - User IDs to remove
   */
  async removeMembers(
    ctx: RequestContext,
    groupId: string,
    userIds: string[]
  ): Promise<void> {
    await this.findByIdOrThrow(ctx, groupId);

    const deleted = await this.prisma.groupMember.deleteMany({
      where: {
        groupId,
        userId: { in: userIds },
      },
    });

    // Update member count
    await this.prisma.group.update({
      where: { id: groupId },
      data: {
        memberCount: {
          decrement: deleted.count,
        },
      },
    });
  }

  /**
   * Get member IDs for a group
   *
   * @param ctx - Request context
   * @param groupId - Group ID
   * @returns Array of user IDs
   */
  async getMemberIds(ctx: RequestContext, groupId: string): Promise<string[]> {
    const members = await this.prisma.groupMember.findMany({
      where: {
        groupId,
        group: this.scopedFilters(ctx, {}),
        user: {
          deletedAt: null,
        },
      },
      select: { userId: true },
    });

    return members.map((m) => m.userId);
  }

  /**
   * Count groups in tenant
   *
   * @param ctx - Request context
   * @param filter - Filter options
   * @returns Group count
   */
  async count(
    ctx: RequestContext,
    filter?: Omit<GroupFilterOptions, 'search'>
  ): Promise<number> {
    const where: Prisma.GroupWhereInput = {
      ...this.tenantScope(ctx),
      ...this.softDeleteScope(filter?.includeSoftDeleted),
    };

    if (filter?.isAssignable !== undefined) {
      where.isAssignable = filter.isAssignable;
    }

    return this.prisma.group.count({ where });
  }

  /**
   * Check if error is a unique constraint violation
   */
  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    );
  }
}
