/**
 * Conversation Tools
 *
 * MCP tools for conversation operations.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ConversationService } from '../types.js';

/**
 * Conversation tool definitions
 */
export const conversationTools: Tool[] = [
  {
    name: 'conversation_create',
    description: 'Create a new conversation for tracking interactions. Conversations can be linked to workflows.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Conversation title or subject',
        },
        channel: {
          type: 'string',
          enum: ['web', 'api', 'slack', 'email', 'sms', 'custom'],
          description: 'Channel through which the conversation is happening',
        },
        externalId: {
          type: 'string',
          description: 'External reference ID (e.g., ticket number, chat ID)',
        },
        participants: {
          type: 'array',
          description: 'Initial participants in the conversation',
          items: {
            type: 'object',
            properties: {
              userId: {
                type: 'string',
                description: 'User ID (null for external participants)',
              },
              role: {
                type: 'string',
                enum: ['user', 'assistant', 'system', 'human_operator'],
              },
              name: {
                type: 'string',
                description: 'Display name for the participant',
              },
            },
            required: ['role', 'name'],
          },
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization',
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata',
          additionalProperties: true,
        },
      },
      required: ['channel'],
    },
  },
  {
    name: 'conversation_get',
    description: 'Get a conversation by ID, optionally including all messages.',
    inputSchema: {
      type: 'object',
      properties: {
        conversationId: {
          type: 'string',
          description: 'The conversation ID to retrieve',
        },
        includeMessages: {
          type: 'boolean',
          description: 'Whether to include all messages (default: false)',
        },
        messageLimit: {
          type: 'number',
          description: 'Maximum number of messages to include (default: 50)',
        },
      },
      required: ['conversationId'],
    },
  },
  {
    name: 'conversation_list',
    description: 'List conversations with optional filtering. Returns paginated results.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'resolved', 'abandoned', 'archived'],
          description: 'Filter by conversation status',
        },
        channel: {
          type: 'string',
          enum: ['web', 'api', 'slack', 'email', 'sms', 'custom'],
          description: 'Filter by channel',
        },
        participantUserId: {
          type: 'string',
          description: 'Filter by participant user ID',
        },
        tag: {
          type: 'string',
          description: 'Filter by tag',
        },
        workflowId: {
          type: 'string',
          description: 'Filter by linked workflow',
        },
        search: {
          type: 'string',
          description: 'Search in title and summary',
        },
        createdAfter: {
          type: 'string',
          description: 'Filter conversations created after this ISO date',
        },
        createdBefore: {
          type: 'string',
          description: 'Filter conversations created before this ISO date',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 20, max: 100)',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor for next page',
        },
      },
    },
  },
  {
    name: 'conversation_append',
    description: 'Append a new message to an existing conversation.',
    inputSchema: {
      type: 'object',
      properties: {
        conversationId: {
          type: 'string',
          description: 'The conversation ID to append to',
        },
        role: {
          type: 'string',
          enum: ['user', 'assistant', 'system', 'human_operator'],
          description: 'Who is sending the message',
        },
        content: {
          type: 'string',
          description: 'Message content',
        },
        contentType: {
          type: 'string',
          enum: ['text', 'markdown', 'html', 'json'],
          description: 'Content format (default: text)',
        },
        userId: {
          type: 'string',
          description: 'User ID of sender (if applicable)',
        },
        senderName: {
          type: 'string',
          description: 'Display name of sender',
        },
        attachments: {
          type: 'array',
          description: 'File attachments',
          items: {
            type: 'object',
            properties: {
              fileName: { type: 'string' },
              mimeType: { type: 'string' },
              sizeBytes: { type: 'number' },
              url: { type: 'string' },
            },
          },
        },
        toolCalls: {
          type: 'array',
          description: 'Tool calls made in this message (for AI messages)',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              arguments: {},
              result: {},
            },
          },
        },
        tokenUsage: {
          type: 'object',
          description: 'Token usage for AI messages',
          properties: {
            input: { type: 'number' },
            output: { type: 'number' },
            total: { type: 'number' },
          },
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata',
          additionalProperties: true,
        },
      },
      required: ['conversationId', 'role', 'content'],
    },
  },
];

/**
 * Handle conversation tool calls
 */
export async function handleConversationTool(
  toolName: string,
  args: Record<string, unknown>,
  service?: ConversationService
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  // If no service is provided, return a mock response
  if (!service) {
    return createMockResponse(toolName, args);
  }

  try {
    let result: unknown;

    switch (toolName) {
      case 'conversation_create': {
        result = await service.create(args);
        break;
      }

      case 'conversation_get': {
        const { conversationId, includeMessages } = args as {
          conversationId: string;
          includeMessages?: boolean;
        };
        result = await service.get(conversationId, includeMessages);
        break;
      }

      case 'conversation_list': {
        result = await service.list(args);
        break;
      }

      case 'conversation_append': {
        const { conversationId, ...message } = args as { conversationId: string } & Record<string, unknown>;
        result = await service.append(conversationId, message);
        break;
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: `Unknown conversation tool: ${toolName}` }),
            },
          ],
          isError: true,
        };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, data: result }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Create mock response for when service is not available
 */
function createMockResponse(
  toolName: string,
  args: Record<string, unknown>
): { content: Array<{ type: 'text'; text: string }> } {
  const mockResponses: Record<string, unknown> = {
    conversation_create: {
      id: 'cnv_mock123',
      title: args['title'],
      channel: args['channel'],
      status: 'active',
      messageCount: 0,
      createdAt: new Date().toISOString(),
    },
    conversation_get: {
      id: args['conversationId'],
      title: 'Example Conversation',
      channel: 'web',
      status: 'active',
      messageCount: 5,
      messages: args['includeMessages'] ? [] : undefined,
      createdAt: new Date().toISOString(),
    },
    conversation_list: {
      items: [],
      nextCursor: null,
      hasMore: false,
    },
    conversation_append: {
      id: 'msg_mock123',
      conversationId: args['conversationId'],
      role: args['role'],
      content: args['content'],
      createdAt: new Date().toISOString(),
    },
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: mockResponses[toolName] ?? { message: 'Tool executed (mock mode)' },
          _mock: true,
        }),
      },
    ],
  };
}
