/**
 * Conversation repository
 *
 * Provides data access for conversation and message entities
 * with tenant scoping.
 */

import {
  Prisma,
  type PrismaClient,
  type Conversation,
  type Message,
  type ConversationStatus,
  type ConversationChannel,
  type MessageRole,
  type MessageContentType,
} from '@prisma/client';
import type { RequestContext } from '../../context/index.js';
import {
  BaseRepository,
  EntityNotFoundError,
  type PaginationOptions,
  type SortOptions,
  type PaginatedResult,
} from './base.js';

/**
 * Input for creating a conversation
 */
export interface CreateConversationInput {
  /** Conversation title */
  title?: string | null;
  /** Channel type */
  channel: ConversationChannel;
  /** External ID */
  externalId?: string | null;
  /** Participants */
  participants?: Prisma.InputJsonValue;
  /** Tags */
  tags?: string[];
  /** Related workflow ID */
  workflowId?: string | null;
  /** Additional metadata */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Input for updating a conversation
 */
export interface UpdateConversationInput {
  /** Updated title */
  title?: string | null;
  /** Updated status */
  status?: ConversationStatus;
  /** Updated summary */
  summary?: string | null;
  /** Updated tags */
  tags?: string[];
  /** Updated metadata */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Input for creating a message
 */
export interface CreateMessageInput {
  /** Message role */
  role: MessageRole;
  /** User ID (if from a user) */
  userId?: string | null;
  /** Sender display name */
  senderName: string;
  /** Content type */
  contentType?: MessageContentType;
  /** Message content */
  content: string;
  /** Attachments */
  attachments?: Prisma.InputJsonValue;
  /** Tool calls (for AI messages) */
  toolCalls?: Prisma.InputJsonValue | null;
  /** Token usage (for AI messages) */
  tokenUsage?: Prisma.InputJsonValue | null;
  /** Additional metadata */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Filter options for listing conversations
 */
export interface ConversationFilterOptions {
  /** Filter by status */
  status?: ConversationStatus | ConversationStatus[];
  /** Filter by channel */
  channel?: ConversationChannel | ConversationChannel[];
  /** Filter by workflow ID */
  workflowId?: string;
  /** Filter by tag */
  tag?: string;
  /** Search in title or summary */
  search?: string;
  /** Filter by creation date (from) */
  createdAfter?: Date;
  /** Filter by creation date (to) */
  createdBefore?: Date;
  /** Include soft-deleted conversations */
  includeSoftDeleted?: boolean;
}

/**
 * Sort fields for conversations
 */
export type ConversationSortField = 'title' | 'status' | 'messageCount' | 'createdAt' | 'updatedAt';

/**
 * Conversation with messages
 */
export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

/**
 * Repository for conversation data access
 */
export class ConversationRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  /**
   * Create a new conversation
   *
   * @param ctx - Request context
   * @param input - Conversation creation input
   * @returns Created conversation
   */
  async create(ctx: RequestContext, input: CreateConversationInput): Promise<Conversation> {
    return this.prisma.conversation.create({
      data: {
        ...this.tenantScope(ctx),
        title: input.title ?? null,
        channel: input.channel,
        externalId: input.externalId ?? null,
        participants: input.participants ?? [],
        tags: input.tags ?? [],
        workflowId: input.workflowId ?? null,
        metadata: input.metadata ?? {},
      },
    });
  }

  /**
   * Find a conversation by ID within tenant
   *
   * @param ctx - Request context
   * @param id - Conversation ID
   * @param includeSoftDeleted - Include soft-deleted conversation
   * @returns Conversation or null if not found
   */
  async findById(
    ctx: RequestContext,
    id: string,
    includeSoftDeleted: boolean = false
  ): Promise<Conversation | null> {
    return this.prisma.conversation.findFirst({
      where: this.scopedFilters(ctx, { id }, { includeSoftDeleted }),
    });
  }

  /**
   * Find a conversation by ID within tenant, throwing if not found
   *
   * @param ctx - Request context
   * @param id - Conversation ID
   * @param includeSoftDeleted - Include soft-deleted conversation
   * @returns Conversation
   * @throws EntityNotFoundError if conversation not found
   */
  async findByIdOrThrow(
    ctx: RequestContext,
    id: string,
    includeSoftDeleted: boolean = false
  ): Promise<Conversation> {
    const conversation = await this.findById(ctx, id, includeSoftDeleted);
    if (!conversation) {
      throw new EntityNotFoundError('Conversation', id, ctx.tenantId);
    }
    return conversation;
  }

  /**
   * Find a conversation by ID with messages
   *
   * @param ctx - Request context
   * @param id - Conversation ID
   * @param messageLimit - Maximum number of messages to include
   * @returns Conversation with messages or null if not found
   */
  async findByIdWithMessages(
    ctx: RequestContext,
    id: string,
    messageLimit: number = 100
  ): Promise<ConversationWithMessages | null> {
    return this.prisma.conversation.findFirst({
      where: this.scopedFilters(ctx, { id }),
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: messageLimit,
        },
      },
    });
  }

  /**
   * Find a conversation by external ID
   *
   * @param ctx - Request context
   * @param externalId - External ID
   * @returns Conversation or null if not found
   */
  async findByExternalId(
    ctx: RequestContext,
    externalId: string
  ): Promise<Conversation | null> {
    return this.prisma.conversation.findFirst({
      where: this.scopedFilters(ctx, { externalId }),
    });
  }

  /**
   * List conversations with filtering and pagination
   *
   * @param ctx - Request context
   * @param options - Filter, sort, and pagination options
   * @returns Paginated list of conversations
   */
  async findMany(
    ctx: RequestContext,
    options: {
      filter?: ConversationFilterOptions;
      sort?: SortOptions<ConversationSortField>;
      pagination?: PaginationOptions;
    } = {}
  ): Promise<PaginatedResult<Conversation>> {
    const { filter, sort, pagination } = options;
    const where = this.buildConversationWhere(ctx, filter);

    // Execute count and find in parallel
    const [total, items] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        orderBy: this.buildSort(sort) ?? { createdAt: 'desc' },
        ...this.buildPagination(pagination),
      }),
    ]);

    return this.createPaginatedResult(items, total, pagination);
  }

  /**
   * Update a conversation
   *
   * @param ctx - Request context
   * @param id - Conversation ID
   * @param input - Update input
   * @returns Updated conversation
   * @throws EntityNotFoundError if conversation not found
   */
  async update(
    ctx: RequestContext,
    id: string,
    input: UpdateConversationInput
  ): Promise<Conversation> {
    await this.findByIdOrThrow(ctx, id);

    return this.prisma.conversation.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.summary !== undefined && { summary: input.summary }),
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.metadata !== undefined && { metadata: input.metadata }),
      },
    });
  }

  /**
   * Resolve a conversation
   *
   * @param ctx - Request context
   * @param id - Conversation ID
   * @param summary - Optional resolution summary
   * @returns Resolved conversation
   */
  async resolve(
    ctx: RequestContext,
    id: string,
    summary?: string
  ): Promise<Conversation> {
    await this.findByIdOrThrow(ctx, id);

    return this.prisma.conversation.update({
      where: { id },
      data: {
        status: 'resolved',
        ...(summary && { summary }),
      },
    });
  }

  /**
   * Archive a conversation
   *
   * @param ctx - Request context
   * @param id - Conversation ID
   * @returns Archived conversation
   */
  async archive(ctx: RequestContext, id: string): Promise<Conversation> {
    await this.findByIdOrThrow(ctx, id);

    return this.prisma.conversation.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  /**
   * Soft delete a conversation
   *
   * @param ctx - Request context
   * @param id - Conversation ID
   * @returns Soft-deleted conversation
   */
  async softDelete(ctx: RequestContext, id: string): Promise<Conversation> {
    await this.findByIdOrThrow(ctx, id);

    return this.prisma.conversation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft-deleted conversation
   *
   * @param ctx - Request context
   * @param id - Conversation ID
   * @returns Restored conversation
   */
  async restore(ctx: RequestContext, id: string): Promise<Conversation> {
    const conversation = await this.findById(ctx, id, true);
    if (!conversation) {
      throw new EntityNotFoundError('Conversation', id, ctx.tenantId);
    }

    return this.prisma.conversation.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  /**
   * Permanently delete a conversation
   *
   * @param ctx - Request context
   * @param id - Conversation ID
   */
  async hardDelete(ctx: RequestContext, id: string): Promise<void> {
    await this.findByIdOrThrow(ctx, id, true);

    await this.prisma.conversation.delete({
      where: { id },
    });
  }

  // =========================================================================
  // Message operations
  // =========================================================================

  /**
   * Add a message to a conversation
   *
   * @param ctx - Request context
   * @param conversationId - Conversation ID
   * @param input - Message creation input
   * @returns Created message
   */
  async addMessage(
    ctx: RequestContext,
    conversationId: string,
    input: CreateMessageInput
  ): Promise<Message> {
    await this.findByIdOrThrow(ctx, conversationId);

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          ...this.tenantScope(ctx),
          role: input.role,
          userId: input.userId ?? null,
          senderName: input.senderName,
          contentType: input.contentType ?? 'text',
          content: input.content,
          attachments: input.attachments ?? [],
          toolCalls: input.toolCalls ?? Prisma.JsonNull,
          tokenUsage: input.tokenUsage ?? Prisma.JsonNull,
          metadata: input.metadata ?? {},
        },
      }),
      // Increment message count
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { messageCount: { increment: 1 } },
      }),
    ]);

    return message;
  }

  /**
   * Get messages for a conversation
   *
   * @param ctx - Request context
   * @param conversationId - Conversation ID
   * @param options - Pagination options
   * @returns Paginated list of messages
   */
  async getMessages(
    ctx: RequestContext,
    conversationId: string,
    options: {
      pagination?: PaginationOptions;
      orderDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<PaginatedResult<Message>> {
    await this.findByIdOrThrow(ctx, conversationId);

    const where: Prisma.MessageWhereInput = {
      conversationId,
      ...this.tenantScope(ctx),
    };

    const [total, items] = await Promise.all([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: options.orderDirection ?? 'asc' },
        ...this.buildPagination(options.pagination),
      }),
    ]);

    return this.createPaginatedResult(items, total, options.pagination);
  }

  /**
   * Get the last N messages from a conversation
   *
   * @param ctx - Request context
   * @param conversationId - Conversation ID
   * @param count - Number of messages to get
   * @returns List of messages (oldest first)
   */
  async getLastMessages(
    ctx: RequestContext,
    conversationId: string,
    count: number
  ): Promise<Message[]> {
    await this.findByIdOrThrow(ctx, conversationId);

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...this.tenantScope(ctx),
      },
      orderBy: { createdAt: 'desc' },
      take: count,
    });

    // Return in chronological order
    return messages.reverse();
  }

  /**
   * Find a message by ID
   *
   * @param ctx - Request context
   * @param messageId - Message ID
   * @returns Message or null if not found
   */
  async findMessageById(
    ctx: RequestContext,
    messageId: string
  ): Promise<Message | null> {
    return this.prisma.message.findFirst({
      where: {
        id: messageId,
        ...this.tenantScope(ctx),
      },
    });
  }

  /**
   * Count conversations in tenant
   *
   * @param ctx - Request context
   * @param filter - Filter options
   * @returns Conversation count
   */
  async count(
    ctx: RequestContext,
    filter?: Omit<ConversationFilterOptions, 'search'>
  ): Promise<number> {
    const where = this.buildConversationWhere(ctx, filter);
    return this.prisma.conversation.count({ where });
  }

  /**
   * Get conversation statistics
   *
   * @param ctx - Request context
   * @returns Conversation statistics
   */
  async getStats(ctx: RequestContext): Promise<{
    total: number;
    active: number;
    resolved: number;
    abandoned: number;
    archived: number;
    totalMessages: number;
    avgMessagesPerConversation: number;
  }> {
    const baseWhere = {
      ...this.tenantScope(ctx),
      deletedAt: null,
    };

    const [
      total,
      active,
      resolved,
      abandoned,
      archived,
      messageStats,
    ] = await Promise.all([
      this.prisma.conversation.count({ where: baseWhere }),
      this.prisma.conversation.count({ where: { ...baseWhere, status: 'active' } }),
      this.prisma.conversation.count({ where: { ...baseWhere, status: 'resolved' } }),
      this.prisma.conversation.count({ where: { ...baseWhere, status: 'abandoned' } }),
      this.prisma.conversation.count({ where: { ...baseWhere, status: 'archived' } }),
      this.prisma.conversation.aggregate({
        where: baseWhere,
        _sum: { messageCount: true },
        _avg: { messageCount: true },
      }),
    ]);

    return {
      total,
      active,
      resolved,
      abandoned,
      archived,
      totalMessages: messageStats._sum.messageCount ?? 0,
      avgMessagesPerConversation: Math.round((messageStats._avg.messageCount ?? 0) * 100) / 100,
    };
  }

  /**
   * Build Prisma where clause for conversation queries
   */
  private buildConversationWhere(
    ctx: RequestContext,
    filter?: ConversationFilterOptions
  ): Prisma.ConversationWhereInput {
    const where: Prisma.ConversationWhereInput = {
      ...this.tenantScope(ctx),
      ...this.softDeleteScope(filter?.includeSoftDeleted),
    };

    if (filter?.status) {
      where.status = Array.isArray(filter.status)
        ? { in: filter.status }
        : filter.status;
    }

    if (filter?.channel) {
      where.channel = Array.isArray(filter.channel)
        ? { in: filter.channel }
        : filter.channel;
    }

    if (filter?.workflowId) {
      where.workflowId = filter.workflowId;
    }

    if (filter?.tag) {
      where.tags = { has: filter.tag };
    }

    if (filter?.createdAfter || filter?.createdBefore) {
      where.createdAt = {
        ...(filter.createdAfter && { gte: filter.createdAfter }),
        ...(filter.createdBefore && { lte: filter.createdBefore }),
      };
    }

    if (filter?.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { summary: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
