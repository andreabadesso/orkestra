/**
 * Audit repository
 *
 * Provides data access for audit events with tenant scoping.
 * Audit events are immutable and cannot be updated or deleted.
 */

import { Prisma, type PrismaClient, type AuditEvent, type AuditEventType } from '@prisma/client';
import type { RequestContext } from '../../context/index.js';
import {
  BaseRepository,
  type PaginationOptions,
  type SortOptions,
  type PaginatedResult,
} from './base.js';

/**
 * Input for creating an audit event
 */
export interface CreateAuditEventInput {
  /** Event type */
  eventType: AuditEventType;
  /** Entity type (e.g., 'task', 'user', 'tenant') */
  entityType: string;
  /** Entity ID */
  entityId: string;
  /** User who performed the action (null for system events) */
  userId?: string | null;
  /** Action description */
  action: string;
  /** Changes made (before/after values) */
  changes?: Prisma.InputJsonValue | null;
  /** Additional metadata */
  metadata?: Prisma.InputJsonValue;
  /** Client IP address */
  ipAddress?: string | null;
  /** User agent string */
  userAgent?: string | null;
}

/**
 * Filter options for listing audit events
 */
export interface AuditEventFilterOptions {
  /** Filter by event type */
  eventType?: AuditEventType | AuditEventType[];
  /** Filter by entity type */
  entityType?: string | string[];
  /** Filter by entity ID */
  entityId?: string;
  /** Filter by user ID */
  userId?: string;
  /** Filter by creation date (from) */
  createdAfter?: Date;
  /** Filter by creation date (to) */
  createdBefore?: Date;
  /** Filter by action (partial match) */
  action?: string;
}

/**
 * Sort fields for audit events
 */
export type AuditEventSortField = 'eventType' | 'entityType' | 'action' | 'createdAt';

/**
 * Repository for audit event data access
 *
 * Audit events are append-only and cannot be modified or deleted.
 */
export class AuditRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  /**
   * Create a new audit event
   *
   * @param ctx - Request context
   * @param input - Audit event creation input
   * @returns Created audit event
   */
  async create(ctx: RequestContext, input: CreateAuditEventInput): Promise<AuditEvent> {
    return this.prisma.auditEvent.create({
      data: {
        ...this.tenantScope(ctx),
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId ?? null,
        action: input.action,
        changes: input.changes ?? Prisma.JsonNull,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  /**
   * Create multiple audit events in a batch
   *
   * @param ctx - Request context
   * @param inputs - Array of audit event creation inputs
   * @returns Number of created events
   */
  async createMany(
    ctx: RequestContext,
    inputs: CreateAuditEventInput[]
  ): Promise<number> {
    const result = await this.prisma.auditEvent.createMany({
      data: inputs.map((input) => ({
        ...this.tenantScope(ctx),
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId ?? null,
        action: input.action,
        changes: input.changes ?? Prisma.JsonNull,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      })),
    });

    return result.count;
  }

  /**
   * Find an audit event by ID within tenant
   *
   * @param ctx - Request context
   * @param id - Audit event ID
   * @returns Audit event or null if not found
   */
  async findById(ctx: RequestContext, id: string): Promise<AuditEvent | null> {
    return this.prisma.auditEvent.findFirst({
      where: {
        id,
        ...this.tenantScope(ctx),
      },
    });
  }

  /**
   * List audit events with filtering and pagination
   *
   * @param ctx - Request context
   * @param options - Filter, sort, and pagination options
   * @returns Paginated list of audit events
   */
  async findMany(
    ctx: RequestContext,
    options: {
      filter?: AuditEventFilterOptions;
      sort?: SortOptions<AuditEventSortField>;
      pagination?: PaginationOptions;
    } = {}
  ): Promise<PaginatedResult<AuditEvent>> {
    const { filter, sort, pagination } = options;
    const where = this.buildAuditWhere(ctx, filter);

    // Execute count and find in parallel
    const [total, items] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        orderBy: this.buildSort(sort) ?? { createdAt: 'desc' },
        ...this.buildPagination(pagination),
      }),
    ]);

    return this.createPaginatedResult(items, total, pagination);
  }

  /**
   * Get audit events for a specific entity
   *
   * @param ctx - Request context
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @param options - Pagination options
   * @returns Paginated list of audit events
   */
  async findByEntity(
    ctx: RequestContext,
    entityType: string,
    entityId: string,
    options: { pagination?: PaginationOptions } = {}
  ): Promise<PaginatedResult<AuditEvent>> {
    const where: Prisma.AuditEventWhereInput = {
      ...this.tenantScope(ctx),
      entityType,
      entityId,
    };

    const [total, items] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...this.buildPagination(options.pagination),
      }),
    ]);

    return this.createPaginatedResult(items, total, options.pagination);
  }

  /**
   * Get audit events for a specific user
   *
   * @param ctx - Request context
   * @param userId - User ID
   * @param options - Pagination options
   * @returns Paginated list of audit events
   */
  async findByUser(
    ctx: RequestContext,
    userId: string,
    options: { pagination?: PaginationOptions } = {}
  ): Promise<PaginatedResult<AuditEvent>> {
    const where: Prisma.AuditEventWhereInput = {
      ...this.tenantScope(ctx),
      userId,
    };

    const [total, items] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...this.buildPagination(options.pagination),
      }),
    ]);

    return this.createPaginatedResult(items, total, options.pagination);
  }

  /**
   * Get recent audit events of a specific type
   *
   * @param ctx - Request context
   * @param eventType - Event type
   * @param limit - Maximum number of events to return
   * @returns List of audit events
   */
  async findRecentByType(
    ctx: RequestContext,
    eventType: AuditEventType,
    limit: number = 50
  ): Promise<AuditEvent[]> {
    return this.prisma.auditEvent.findMany({
      where: {
        ...this.tenantScope(ctx),
        eventType,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Count audit events in tenant
   *
   * @param ctx - Request context
   * @param filter - Filter options
   * @returns Audit event count
   */
  async count(
    ctx: RequestContext,
    filter?: AuditEventFilterOptions
  ): Promise<number> {
    const where = this.buildAuditWhere(ctx, filter);
    return this.prisma.auditEvent.count({ where });
  }

  /**
   * Get audit event statistics
   *
   * @param ctx - Request context
   * @param options - Time range options
   * @returns Audit event statistics
   */
  async getStats(
    ctx: RequestContext,
    options: { since?: Date } = {}
  ): Promise<{
    total: number;
    byEventType: Record<string, number>;
    byEntityType: Record<string, number>;
    uniqueUsers: number;
  }> {
    const where: Prisma.AuditEventWhereInput = {
      ...this.tenantScope(ctx),
      ...(options.since && { createdAt: { gte: options.since } }),
    };

    const [total, byEventType, byEntityType, uniqueUsers] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.groupBy({
        by: ['eventType'],
        where,
        _count: true,
      }),
      this.prisma.auditEvent.groupBy({
        by: ['entityType'],
        where,
        _count: true,
      }),
      this.prisma.auditEvent.groupBy({
        by: ['userId'],
        where: { ...where, userId: { not: null } },
      }),
    ]);

    const eventTypeStats: Record<string, number> = {};
    for (const group of byEventType) {
      eventTypeStats[group.eventType] = group._count;
    }

    const entityTypeStats: Record<string, number> = {};
    for (const group of byEntityType) {
      entityTypeStats[group.entityType] = group._count;
    }

    return {
      total,
      byEventType: eventTypeStats,
      byEntityType: entityTypeStats,
      uniqueUsers: uniqueUsers.length,
    };
  }

  /**
   * Get audit trail for a specific entity (timeline format)
   *
   * @param ctx - Request context
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @returns Audit timeline
   */
  async getEntityTimeline(
    ctx: RequestContext,
    entityType: string,
    entityId: string
  ): Promise<Array<{
    timestamp: Date;
    action: string;
    userId: string | null;
    changes: unknown;
  }>> {
    const events = await this.prisma.auditEvent.findMany({
      where: {
        ...this.tenantScope(ctx),
        entityType,
        entityId,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        createdAt: true,
        action: true,
        userId: true,
        changes: true,
      },
    });

    return events.map((event) => ({
      timestamp: event.createdAt,
      action: event.action,
      userId: event.userId,
      changes: event.changes,
    }));
  }

  // =========================================================================
  // Convenience methods for common audit events
  // =========================================================================

  /**
   * Log a task-related audit event
   */
  async logTaskEvent(
    ctx: RequestContext,
    eventType: AuditEventType,
    taskId: string,
    action: string,
    changes?: Prisma.InputJsonValue
  ): Promise<AuditEvent> {
    return this.create(ctx, {
      eventType,
      entityType: 'task',
      entityId: taskId,
      userId: ctx.userId,
      action,
      changes: changes ?? null,
      ipAddress: ctx.clientIp ?? null,
      userAgent: ctx.userAgent ?? null,
    });
  }

  /**
   * Log a user-related audit event
   */
  async logUserEvent(
    ctx: RequestContext,
    eventType: AuditEventType,
    userId: string,
    action: string,
    changes?: Prisma.InputJsonValue
  ): Promise<AuditEvent> {
    return this.create(ctx, {
      eventType,
      entityType: 'user',
      entityId: userId,
      userId: ctx.userId,
      action,
      changes: changes ?? null,
      ipAddress: ctx.clientIp ?? null,
      userAgent: ctx.userAgent ?? null,
    });
  }

  /**
   * Log a workflow-related audit event
   */
  async logWorkflowEvent(
    ctx: RequestContext,
    eventType: AuditEventType,
    workflowId: string,
    action: string,
    changes?: Prisma.InputJsonValue
  ): Promise<AuditEvent> {
    return this.create(ctx, {
      eventType,
      entityType: 'workflow',
      entityId: workflowId,
      userId: ctx.userId,
      action,
      changes: changes ?? null,
      ipAddress: ctx.clientIp ?? null,
      userAgent: ctx.userAgent ?? null,
    });
  }

  /**
   * Build Prisma where clause for audit queries
   */
  private buildAuditWhere(
    ctx: RequestContext,
    filter?: AuditEventFilterOptions
  ): Prisma.AuditEventWhereInput {
    const where: Prisma.AuditEventWhereInput = {
      ...this.tenantScope(ctx),
    };

    if (filter?.eventType) {
      where.eventType = Array.isArray(filter.eventType)
        ? { in: filter.eventType }
        : filter.eventType;
    }

    if (filter?.entityType) {
      where.entityType = Array.isArray(filter.entityType)
        ? { in: filter.entityType }
        : filter.entityType;
    }

    if (filter?.entityId) {
      where.entityId = filter.entityId;
    }

    if (filter?.userId) {
      where.userId = filter.userId;
    }

    if (filter?.action) {
      where.action = { contains: filter.action, mode: 'insensitive' };
    }

    if (filter?.createdAfter || filter?.createdBefore) {
      where.createdAt = {
        ...(filter.createdAfter && { gte: filter.createdAfter }),
        ...(filter.createdBefore && { lte: filter.createdBefore }),
      };
    }

    return where;
  }
}
