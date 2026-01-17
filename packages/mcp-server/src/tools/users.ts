/**
 * User Tools
 *
 * MCP tools for user and group operations.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { UserService } from '../types.js';

/**
 * User and group tool definitions
 */
export const userTools: Tool[] = [
  {
    name: 'user_list',
    description: 'List users with optional filtering. Returns paginated results.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'pending', 'suspended'],
          description: 'Filter by user status',
        },
        role: {
          type: 'string',
          enum: ['admin', 'manager', 'operator', 'viewer'],
          description: 'Filter by user role',
        },
        groupId: {
          type: 'string',
          description: 'Filter by group membership',
        },
        search: {
          type: 'string',
          description: 'Search in name and email',
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
    name: 'group_list',
    description: 'List groups with optional filtering. Returns paginated results.',
    inputSchema: {
      type: 'object',
      properties: {
        isAssignable: {
          type: 'boolean',
          description: 'Filter by whether group can receive task assignments',
        },
        search: {
          type: 'string',
          description: 'Search in name and description',
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
];

/**
 * Handle user/group tool calls
 */
export async function handleUserTool(
  toolName: string,
  args: Record<string, unknown>,
  service?: UserService
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  // If no service is provided, return a mock response
  if (!service) {
    return createMockResponse(toolName, args);
  }

  try {
    let result: unknown;

    switch (toolName) {
      case 'user_list': {
        result = await service.listUsers(args);
        break;
      }

      case 'group_list': {
        result = await service.listGroups(args);
        break;
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: `Unknown user tool: ${toolName}` }),
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
  _args: Record<string, unknown>
): { content: Array<{ type: 'text'; text: string }> } {
  const mockResponses: Record<string, unknown> = {
    user_list: {
      items: [],
      nextCursor: null,
      hasMore: false,
    },
    group_list: {
      items: [],
      nextCursor: null,
      hasMore: false,
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
