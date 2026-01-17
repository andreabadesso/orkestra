/**
 * Conversation Router
 *
 * tRPC router for conversation operations.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authedProcedure } from '../index.js';
import {
  isOrkestraError,
  NotFoundError,
  type ConversationFilterOptions,
  type CreateConversationRepoInput,
  type CreateMessageRepoInput,
  type JsonObject,
} from '@orkestra/core';

// Helper type for Prisma InputJsonValue compatibility - excludes null
type InputJsonObject = JsonObject;

/**
 * Conversation status enum for validation
 */
const conversationStatusSchema = z.enum([
  'active',
  'resolved',
  'abandoned',
  'archived',
]);

/**
 * Conversation channel enum for validation
 */
const conversationChannelSchema = z.enum([
  'web',
  'api',
  'slack',
  'email',
  'sms',
  'custom',
]);

/**
 * Message role enum for validation
 */
const messageRoleSchema = z.enum([
  'user',
  'assistant',
  'system',
  'human_operator',
]);

/**
 * Message content type enum for validation
 */
const messageContentTypeSchema = z.enum([
  'text',
  'markdown',
  'html',
  'json',
]);

/**
 * Participant schema
 */
const participantSchema = z.object({
  userId: z.string().nullable(),
  role: messageRoleSchema,
  name: z.string(),
});

/**
 * Conversation filter schema
 */
const conversationFilterSchema = z.object({
  status: z.union([
    conversationStatusSchema,
    z.array(conversationStatusSchema),
  ]).optional(),
  channel: z.union([
    conversationChannelSchema,
    z.array(conversationChannelSchema),
  ]).optional(),
  participantUserId: z.string().optional(),
  tag: z.string().optional(),
  workflowId: z.string().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
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
  field: z.enum(['title', 'status', 'messageCount', 'createdAt', 'updatedAt']),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Message attachment schema
 */
const attachmentSchema = z.object({
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().positive(),
  url: z.string().url(),
});

/**
 * Tool call schema (for AI messages)
 */
const toolCallSchema = z.object({
  name: z.string(),
  arguments: z.unknown(),
  result: z.unknown().optional(),
});

/**
 * Token usage schema
 */
const tokenUsageSchema = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

/**
 * Conversation router
 */
export const conversationRouter = router({
  /**
   * Create a new conversation
   */
  create: authedProcedure
    .input(z.object({
      title: z.string().optional(),
      channel: conversationChannelSchema,
      externalId: z.string().optional(),
      participants: z.array(participantSchema).optional(),
      tags: z.array(z.string()).optional(),
      workflowId: z.string().optional(),
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

      const createInput: CreateConversationRepoInput = {
        channel: input.channel,
      };

      // Add optional fields only if defined
      if (input.title !== undefined) {
        createInput.title = input.title;
      }
      if (input.externalId !== undefined) {
        createInput.externalId = input.externalId;
      }
      if (input.participants !== undefined) {
        createInput.participants = input.participants as unknown as InputJsonObject;
      }
      if (input.tags !== undefined) {
        createInput.tags = input.tags;
      }
      if (input.workflowId !== undefined) {
        createInput.workflowId = input.workflowId;
      }
      if (input.metadata !== undefined) {
        createInput.metadata = input.metadata as unknown as InputJsonObject;
      }

      const conversation = await repositories.conversation.create(requestContext, createInput);

      return conversation;
    }),

  /**
   * Get a conversation by ID
   */
  get: authedProcedure
    .input(z.object({
      id: z.string().min(1, 'Conversation ID is required'),
      includeMessages: z.boolean().default(false),
      messageLimit: z.number().int().positive().max(1000).default(100),
    }))
    .query(async ({ ctx, input }) => {
      const { repositories, requestContext } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      if (input.includeMessages) {
        const conversation = await repositories.conversation.findByIdWithMessages(
          requestContext,
          input.id,
          input.messageLimit
        );

        if (!conversation) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Conversation ${input.id} not found`,
            cause: new NotFoundError('Conversation', input.id),
          });
        }

        return conversation;
      }

      const conversation = await repositories.conversation.findById(
        requestContext,
        input.id
      );

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Conversation ${input.id} not found`,
          cause: new NotFoundError('Conversation', input.id),
        });
      }

      return conversation;
    }),

  /**
   * Get a conversation by external ID
   */
  getByExternalId: authedProcedure
    .input(z.object({
      externalId: z.string().min(1, 'External ID is required'),
    }))
    .query(async ({ ctx, input }) => {
      const { repositories, requestContext } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      const conversation = await repositories.conversation.findByExternalId(
        requestContext,
        input.externalId
      );

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Conversation with external ID ${input.externalId} not found`,
          cause: new NotFoundError('Conversation', input.externalId),
        });
      }

      return conversation;
    }),

  /**
   * List conversations with filtering and pagination
   */
  list: authedProcedure
    .input(z.object({
      filter: conversationFilterSchema.optional(),
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
      let repoFilter: ConversationFilterOptions | undefined;
      if (filter) {
        repoFilter = {
          ...(filter.status !== undefined && { status: filter.status }),
          ...(filter.channel !== undefined && { channel: filter.channel }),
          ...(filter.tag !== undefined && { tag: filter.tag }),
          ...(filter.workflowId !== undefined && { workflowId: filter.workflowId }),
          ...(filter.createdAfter !== undefined && { createdAfter: new Date(filter.createdAfter) }),
          ...(filter.createdBefore !== undefined && { createdBefore: new Date(filter.createdBefore) }),
          ...(filter.search !== undefined && { search: filter.search }),
        };
      }

      const result = await repositories.conversation.findMany(requestContext, {
        ...(repoFilter && { filter: repoFilter }),
        ...(sort && { sort }),
        ...(pagination && { pagination }),
      });

      return result;
    }),

  /**
   * Update a conversation
   */
  update: authedProcedure
    .input(z.object({
      id: z.string().min(1, 'Conversation ID is required'),
      title: z.string().nullable().optional(),
      status: conversationStatusSchema.optional(),
      summary: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
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
        // Build update data with proper type handling - only include defined fields
        const updateData: Record<string, unknown> = {};
        if (updateFields.title !== undefined) {
          updateData['title'] = updateFields.title;
        }
        if (updateFields.status !== undefined) {
          updateData['status'] = updateFields.status;
        }
        if (updateFields.summary !== undefined) {
          updateData['summary'] = updateFields.summary;
        }
        if (updateFields.tags !== undefined) {
          updateData['tags'] = updateFields.tags;
        }
        if (updateFields.metadata !== undefined) {
          updateData['metadata'] = updateFields.metadata;
        }

        const conversation = await repositories.conversation.update(
          requestContext,
          id,
          updateData
        );
        return conversation;
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
   * Append a message to a conversation
   */
  append: authedProcedure
    .input(z.object({
      conversationId: z.string().min(1, 'Conversation ID is required'),
      role: messageRoleSchema,
      content: z.string().min(1, 'Message content is required'),
      contentType: messageContentTypeSchema.default('text'),
      senderName: z.string().optional(),
      attachments: z.array(attachmentSchema).optional(),
      toolCalls: z.array(toolCallSchema).optional(),
      tokenUsage: tokenUsageSchema.optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { repositories, requestContext, auth } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      // Determine sender name
      let senderName = input.senderName;
      if (!senderName) {
        if (auth.userId) {
          // Try to get user's name
          const user = await repositories.user.findById(requestContext, auth.userId);
          senderName = user?.name ?? auth.email ?? 'Unknown';
        } else if (input.role === 'system') {
          senderName = 'System';
        } else if (input.role === 'assistant') {
          senderName = 'Assistant';
        } else {
          senderName = 'Unknown';
        }
      }

      try {
        const messageInput: CreateMessageRepoInput = {
          role: input.role,
          senderName,
          content: input.content,
        };

        // Add optional fields only if defined
        if (auth.userId !== undefined) {
          messageInput.userId = auth.userId;
        }
        if (input.contentType !== undefined) {
          messageInput.contentType = input.contentType;
        }
        if (input.attachments !== undefined) {
          messageInput.attachments = input.attachments as unknown as InputJsonObject;
        }
        if (input.toolCalls !== undefined) {
          messageInput.toolCalls = input.toolCalls as unknown as InputJsonObject;
        }
        if (input.tokenUsage !== undefined) {
          messageInput.tokenUsage = input.tokenUsage as unknown as InputJsonObject;
        }
        if (input.metadata !== undefined) {
          messageInput.metadata = input.metadata as unknown as InputJsonObject;
        }

        const message = await repositories.conversation.addMessage(
          requestContext,
          input.conversationId,
          messageInput
        );
        return message;
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
   * Get messages from a conversation
   */
  messages: authedProcedure
    .input(z.object({
      conversationId: z.string().min(1, 'Conversation ID is required'),
      pagination: paginationSchema.optional(),
      orderDirection: z.enum(['asc', 'desc']).default('asc'),
    }))
    .query(async ({ ctx, input }) => {
      const { repositories, requestContext } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      try {
        const options: { pagination?: { skip: number; take: number }; orderDirection?: 'asc' | 'desc' } = {};
        if (input.pagination) {
          options.pagination = input.pagination;
        }
        options.orderDirection = input.orderDirection;

        const result = await repositories.conversation.getMessages(
          requestContext,
          input.conversationId,
          options
        );

        return result;
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
   * Get the last N messages from a conversation
   */
  lastMessages: authedProcedure
    .input(z.object({
      conversationId: z.string().min(1, 'Conversation ID is required'),
      count: z.number().int().positive().max(100).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const { repositories, requestContext } = ctx;

      if (!repositories || !requestContext) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Repository not available',
        });
      }

      try {
        const messages = await repositories.conversation.getLastMessages(
          requestContext,
          input.conversationId,
          input.count
        );
        return { items: messages };
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
   * Resolve a conversation
   */
  resolve: authedProcedure
    .input(z.object({
      id: z.string().min(1, 'Conversation ID is required'),
      summary: z.string().optional(),
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
        const conversation = await repositories.conversation.resolve(
          requestContext,
          input.id,
          input.summary
        );
        return conversation;
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
   * Archive a conversation
   */
  archive: authedProcedure
    .input(z.object({
      id: z.string().min(1, 'Conversation ID is required'),
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
        const conversation = await repositories.conversation.archive(
          requestContext,
          input.id
        );
        return conversation;
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
   * Get conversation statistics
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

      return repositories.conversation.getStats(requestContext);
    }),
});

export type ConversationRouter = typeof conversationRouter;
