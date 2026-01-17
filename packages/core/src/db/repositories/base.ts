/**
 * Base repository with tenant scoping
 *
 * Provides a foundation for all repositories with built-in
 * multi-tenancy support and common CRUD operations.
 */

import type { PrismaClient } from '@prisma/client';
import type { RequestContext } from '../../context/index.js';

/**
 * Pagination options for listing queries
 */
export interface PaginationOptions {
  /** Number of records to skip */
  skip?: number;
  /** Number of records to take */
  take?: number;
  /** Cursor for cursor-based pagination */
  cursor?: string;
}

/**
 * Sort options for listing queries
 */
export interface SortOptions<T extends string = string> {
  /** Field to sort by */
  field: T;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Common query options for listing queries
 */
export interface QueryOptions<TSortField extends string = string> {
  /** Pagination options */
  pagination?: PaginationOptions;
  /** Sort options */
  sort?: SortOptions<TSortField>;
  /** Include soft-deleted records */
  includeSoftDeleted?: boolean;
}

/**
 * Paginated result container
 */
export interface PaginatedResult<T> {
  /** List of items */
  items: T[];
  /** Total count of items (without pagination) */
  total: number;
  /** Whether there are more items */
  hasMore: boolean;
  /** Cursor for the next page (if cursor-based pagination) */
  nextCursor?: string | undefined;
}

/**
 * Base repository class with tenant scoping
 *
 * All repositories should extend this class to ensure
 * proper multi-tenant data isolation.
 *
 * @typeParam TModel - The Prisma model type
 * @typeParam TCreateInput - Input type for creating records
 * @typeParam TUpdateInput - Input type for updating records
 *
 * @example
 * ```typescript
 * class UserRepository extends BaseRepository {
 *   async findByEmail(ctx: RequestContext, email: string) {
 *     return this.prisma.user.findFirst({
 *       where: {
 *         ...this.tenantScope(ctx),
 *         email,
 *       },
 *     });
 *   }
 * }
 * ```
 */
export abstract class BaseRepository {
  constructor(protected readonly prisma: PrismaClient) {}

  /**
   * Get tenant scope filter for queries
   *
   * Returns a filter object that restricts queries to the
   * current tenant based on the request context.
   *
   * @param ctx - Request context containing tenant ID
   * @returns Filter object with tenantId
   */
  protected tenantScope(ctx: RequestContext): { tenantId: string } {
    return { tenantId: ctx.tenantId };
  }

  /**
   * Add tenant ID to input data
   *
   * Merges the tenant ID from the request context into
   * the provided data object.
   *
   * @param ctx - Request context containing tenant ID
   * @param data - Data object to extend
   * @returns Data object with tenantId added
   */
  protected withTenant<T extends object>(
    ctx: RequestContext,
    data: T
  ): T & { tenantId: string } {
    return {
      ...data,
      tenantId: ctx.tenantId,
    };
  }

  /**
   * Get soft delete filter
   *
   * Returns a filter to exclude soft-deleted records unless
   * explicitly requested.
   *
   * @param includeSoftDeleted - Whether to include soft-deleted records
   * @returns Filter object for deletedAt
   */
  protected softDeleteScope(includeSoftDeleted: boolean = false): { deletedAt?: null } {
    if (includeSoftDeleted) {
      return {};
    }
    return { deletedAt: null };
  }

  /**
   * Combine tenant scope with additional filters
   *
   * Convenience method to merge tenant scope with other
   * query filters.
   *
   * @param ctx - Request context
   * @param filters - Additional filters
   * @param options - Query options
   * @returns Combined filter object
   */
  protected scopedFilters<T extends object>(
    ctx: RequestContext,
    filters: T,
    options: { includeSoftDeleted?: boolean } = {}
  ): T & { tenantId: string; deletedAt?: null } {
    return {
      ...this.tenantScope(ctx),
      ...this.softDeleteScope(options.includeSoftDeleted),
      ...filters,
    };
  }

  /**
   * Build pagination arguments for Prisma queries
   *
   * @param options - Pagination options
   * @returns Prisma pagination arguments
   */
  protected buildPagination(options?: PaginationOptions): {
    skip?: number;
    take?: number;
    cursor?: { id: string };
  } {
    if (!options) {
      return {};
    }

    const result: { skip?: number; take?: number; cursor?: { id: string } } = {};

    if (options.cursor) {
      result.cursor = { id: options.cursor };
      result.skip = 1; // Skip the cursor item itself
    } else if (options.skip !== undefined) {
      result.skip = options.skip;
    }

    if (options.take !== undefined) {
      result.take = options.take;
    }

    return result;
  }

  /**
   * Build sort arguments for Prisma queries
   *
   * @param options - Sort options
   * @returns Prisma orderBy argument
   */
  protected buildSort<T extends string>(
    options?: SortOptions<T>
  ): { [key: string]: 'asc' | 'desc' } | undefined {
    if (!options) {
      return undefined;
    }

    return { [options.field]: options.direction };
  }

  /**
   * Create a paginated result from items and count
   *
   * @param items - List of items
   * @param total - Total count
   * @param options - Pagination options used
   * @returns Paginated result object
   */
  protected createPaginatedResult<T extends { id: string }>(
    items: T[],
    total: number,
    options?: PaginationOptions
  ): PaginatedResult<T> {
    const take = options?.take;
    const hasMore = take !== undefined ? items.length === take && total > (options?.skip ?? 0) + take : false;
    const lastItem = items[items.length - 1];

    return {
      items,
      total,
      hasMore,
      nextCursor: hasMore && lastItem ? lastItem.id : undefined,
    };
  }
}

/**
 * Error thrown when an entity is not found
 */
export class EntityNotFoundError extends Error {
  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly tenantId?: string
  ) {
    super(
      `${entityType} with ID '${entityId}' not found${tenantId ? ` in tenant '${tenantId}'` : ''}`
    );
    this.name = 'EntityNotFoundError';
  }
}

/**
 * Error thrown when a unique constraint is violated
 */
export class UniqueConstraintError extends Error {
  constructor(
    public readonly entityType: string,
    public readonly field: string,
    public readonly value: string
  ) {
    super(`${entityType} with ${field} '${value}' already exists`);
    this.name = 'UniqueConstraintError';
  }
}
