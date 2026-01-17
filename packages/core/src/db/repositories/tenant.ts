/**
 * Tenant repository
 *
 * Provides data access for tenant entities. Note that tenant
 * operations don't use tenant scoping since tenants are the
 * root of multi-tenancy.
 */

import type { PrismaClient, Tenant, TenantStatus, Prisma } from '@prisma/client';
import {
  BaseRepository,
  EntityNotFoundError,
  UniqueConstraintError,
  type PaginationOptions,
  type SortOptions,
  type PaginatedResult,
} from './base.js';

/**
 * Input for creating a tenant
 */
export interface CreateTenantInput {
  /** Tenant name */
  name: string;
  /** URL-friendly slug (must be unique) */
  slug: string;
  /** Initial status (default: pending) */
  status?: TenantStatus;
  /** Tenant configuration JSON */
  config?: Prisma.InputJsonValue;
  /** Resource limits JSON */
  limits?: Prisma.InputJsonValue;
  /** Additional metadata */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Input for updating a tenant
 */
export interface UpdateTenantInput {
  /** Updated name */
  name?: string;
  /** Updated status */
  status?: TenantStatus;
  /** Updated configuration */
  config?: Prisma.InputJsonValue;
  /** Updated limits */
  limits?: Prisma.InputJsonValue;
  /** Updated metadata */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Filter options for listing tenants
 */
export interface TenantFilterOptions {
  /** Filter by status */
  status?: TenantStatus | TenantStatus[];
  /** Search in name or slug */
  search?: string;
  /** Include soft-deleted tenants */
  includeSoftDeleted?: boolean;
}

/**
 * Sort fields for tenants
 */
export type TenantSortField = 'name' | 'slug' | 'status' | 'createdAt' | 'updatedAt';

/**
 * Repository for tenant data access
 *
 * Unlike other repositories, TenantRepository does not apply
 * tenant scoping since tenants are the root of multi-tenancy.
 */
export class TenantRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  /**
   * Create a new tenant
   *
   * @param input - Tenant creation input
   * @returns Created tenant
   * @throws UniqueConstraintError if slug already exists
   */
  async create(input: CreateTenantInput): Promise<Tenant> {
    try {
      return await this.prisma.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          status: input.status ?? 'pending',
          config: input.config ?? {},
          limits: input.limits ?? {},
          metadata: input.metadata ?? {},
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new UniqueConstraintError('Tenant', 'slug', input.slug);
      }
      throw error;
    }
  }

  /**
   * Find a tenant by ID
   *
   * @param id - Tenant ID
   * @param includeSoftDeleted - Include soft-deleted tenant
   * @returns Tenant or null if not found
   */
  async findById(id: string, includeSoftDeleted: boolean = false): Promise<Tenant | null> {
    return this.prisma.tenant.findFirst({
      where: {
        id,
        ...this.softDeleteScope(includeSoftDeleted),
      },
    });
  }

  /**
   * Find a tenant by ID, throwing if not found
   *
   * @param id - Tenant ID
   * @param includeSoftDeleted - Include soft-deleted tenant
   * @returns Tenant
   * @throws EntityNotFoundError if tenant not found
   */
  async findByIdOrThrow(id: string, includeSoftDeleted: boolean = false): Promise<Tenant> {
    const tenant = await this.findById(id, includeSoftDeleted);
    if (!tenant) {
      throw new EntityNotFoundError('Tenant', id);
    }
    return tenant;
  }

  /**
   * Find a tenant by slug
   *
   * @param slug - Tenant slug
   * @param includeSoftDeleted - Include soft-deleted tenant
   * @returns Tenant or null if not found
   */
  async findBySlug(slug: string, includeSoftDeleted: boolean = false): Promise<Tenant | null> {
    return this.prisma.tenant.findFirst({
      where: {
        slug,
        ...this.softDeleteScope(includeSoftDeleted),
      },
    });
  }

  /**
   * Find a tenant by slug, throwing if not found
   *
   * @param slug - Tenant slug
   * @param includeSoftDeleted - Include soft-deleted tenant
   * @returns Tenant
   * @throws EntityNotFoundError if tenant not found
   */
  async findBySlugOrThrow(slug: string, includeSoftDeleted: boolean = false): Promise<Tenant> {
    const tenant = await this.findBySlug(slug, includeSoftDeleted);
    if (!tenant) {
      throw new EntityNotFoundError('Tenant', slug);
    }
    return tenant;
  }

  /**
   * List tenants with filtering and pagination
   *
   * @param options - Filter, sort, and pagination options
   * @returns Paginated list of tenants
   */
  async findMany(options: {
    filter?: TenantFilterOptions;
    sort?: SortOptions<TenantSortField>;
    pagination?: PaginationOptions;
  } = {}): Promise<PaginatedResult<Tenant>> {
    const { filter, sort, pagination } = options;

    const where: Prisma.TenantWhereInput = {
      ...this.softDeleteScope(filter?.includeSoftDeleted),
    };

    // Apply status filter
    if (filter?.status) {
      where.status = Array.isArray(filter.status)
        ? { in: filter.status }
        : filter.status;
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
      this.prisma.tenant.count({ where }),
      this.prisma.tenant.findMany({
        where,
        orderBy: this.buildSort(sort) ?? { createdAt: 'desc' },
        ...this.buildPagination(pagination),
      }),
    ]);

    return this.createPaginatedResult(items, total, pagination);
  }

  /**
   * Update a tenant
   *
   * @param id - Tenant ID
   * @param input - Update input
   * @returns Updated tenant
   * @throws EntityNotFoundError if tenant not found
   */
  async update(id: string, input: UpdateTenantInput): Promise<Tenant> {
    // First verify tenant exists
    await this.findByIdOrThrow(id);

    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.config !== undefined && { config: input.config }),
        ...(input.limits !== undefined && { limits: input.limits }),
        ...(input.metadata !== undefined && { metadata: input.metadata }),
      },
    });
  }

  /**
   * Soft delete a tenant
   *
   * @param id - Tenant ID
   * @returns Soft-deleted tenant
   * @throws EntityNotFoundError if tenant not found
   */
  async softDelete(id: string): Promise<Tenant> {
    // First verify tenant exists and is not already deleted
    await this.findByIdOrThrow(id);

    return this.prisma.tenant.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'archived',
      },
    });
  }

  /**
   * Restore a soft-deleted tenant
   *
   * @param id - Tenant ID
   * @returns Restored tenant
   * @throws EntityNotFoundError if tenant not found
   */
  async restore(id: string): Promise<Tenant> {
    // First verify tenant exists (including soft-deleted)
    const tenant = await this.findById(id, true);
    if (!tenant) {
      throw new EntityNotFoundError('Tenant', id);
    }

    return this.prisma.tenant.update({
      where: { id },
      data: {
        deletedAt: null,
        status: 'active',
      },
    });
  }

  /**
   * Permanently delete a tenant
   *
   * WARNING: This will delete all associated data including
   * users, groups, tasks, conversations, etc.
   *
   * @param id - Tenant ID
   */
  async hardDelete(id: string): Promise<void> {
    await this.prisma.tenant.delete({
      where: { id },
    });
  }

  /**
   * Check if a slug is available
   *
   * @param slug - Slug to check
   * @param excludeId - Tenant ID to exclude (for updates)
   * @returns True if slug is available
   */
  async isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
    const existing = await this.prisma.tenant.findFirst({
      where: {
        slug,
        ...(excludeId && { NOT: { id: excludeId } }),
      },
      select: { id: true },
    });
    return !existing;
  }

  /**
   * Get tenant statistics
   *
   * @param id - Tenant ID
   * @returns Tenant statistics
   */
  async getStats(id: string): Promise<{
    userCount: number;
    groupCount: number;
    taskCount: number;
    activeTaskCount: number;
    conversationCount: number;
  }> {
    const [
      userCount,
      groupCount,
      taskCount,
      activeTaskCount,
      conversationCount,
    ] = await Promise.all([
      this.prisma.user.count({ where: { tenantId: id, deletedAt: null } }),
      this.prisma.group.count({ where: { tenantId: id, deletedAt: null } }),
      this.prisma.task.count({ where: { tenantId: id, deletedAt: null } }),
      this.prisma.task.count({
        where: {
          tenantId: id,
          deletedAt: null,
          status: { in: ['pending', 'assigned', 'in_progress'] },
        },
      }),
      this.prisma.conversation.count({ where: { tenantId: id, deletedAt: null } }),
    ]);

    return {
      userCount,
      groupCount,
      taskCount,
      activeTaskCount,
      conversationCount,
    };
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
