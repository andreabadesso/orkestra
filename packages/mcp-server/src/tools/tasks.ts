/**
 * Task Tools
 *
 * MCP tools for human task operations.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { TaskService } from '../types.js';

/**
 * Task tool definitions
 */
export const taskTools: Tool[] = [
  {
    name: 'task_create',
    description: 'Create a new human task. Tasks are assigned to users or groups for completion.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Task type identifier for categorization',
        },
        title: {
          type: 'string',
          description: 'Short, descriptive task title',
        },
        description: {
          type: 'string',
          description: 'Detailed instructions for completing the task',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Task priority level (default: medium)',
        },
        form: {
          type: 'object',
          description: 'Form schema defining the data to collect',
          properties: {
            fields: {
              type: 'object',
              description: 'Field definitions keyed by field name',
              additionalProperties: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['text', 'textarea', 'number', 'email', 'url', 'date', 'datetime', 'time', 'select', 'multiselect', 'radio', 'checkbox', 'file', 'json'],
                  },
                  label: { type: 'string' },
                  placeholder: { type: 'string' },
                  helpText: { type: 'string' },
                  options: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        value: { type: 'string' },
                        label: { type: 'string' },
                      },
                    },
                  },
                  validation: {
                    type: 'object',
                    properties: {
                      required: { type: 'boolean' },
                      minLength: { type: 'number' },
                      maxLength: { type: 'number' },
                      min: { type: 'number' },
                      max: { type: 'number' },
                      pattern: { type: 'string' },
                    },
                  },
                },
              },
            },
            fieldOrder: {
              type: 'array',
              items: { type: 'string' },
              description: 'Order in which fields should be displayed',
            },
          },
          required: ['fields'],
        },
        assignment: {
          type: 'object',
          description: 'Who the task is assigned to',
          properties: {
            userId: {
              type: 'string',
              description: 'Assign to a specific user',
            },
            groupId: {
              type: 'string',
              description: 'Assign to a group (any member can claim)',
            },
          },
        },
        sla: {
          type: 'object',
          description: 'SLA (Service Level Agreement) configuration',
          properties: {
            dueAt: {
              type: 'string',
              description: 'Due date/time (ISO 8601)',
            },
            warnBeforeMinutes: {
              type: 'number',
              description: 'Minutes before due to send warning',
            },
            escalation: {
              type: 'object',
              properties: {
                afterMinutes: {
                  type: 'number',
                  description: 'Minutes past due before escalation',
                },
                toGroupId: { type: 'string' },
                toUserId: { type: 'string' },
              },
            },
          },
        },
        context: {
          type: 'object',
          description: 'Context data for the task',
          properties: {
            conversationId: { type: 'string' },
            relatedEntity: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                id: { type: 'string' },
              },
            },
            data: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata',
          additionalProperties: true,
        },
      },
      required: ['type', 'title', 'form', 'assignment'],
    },
  },
  {
    name: 'task_get',
    description: 'Get details of a specific task by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to retrieve',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'task_list',
    description: 'List tasks with optional filtering. Returns paginated results.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'expired', 'escalated'],
          description: 'Filter by task status',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Filter by priority',
        },
        assignedToUserId: {
          type: 'string',
          description: 'Filter by assigned user',
        },
        assignedToGroupId: {
          type: 'string',
          description: 'Filter by assigned group',
        },
        workflowId: {
          type: 'string',
          description: 'Filter by parent workflow',
        },
        type: {
          type: 'string',
          description: 'Filter by task type',
        },
        dueBefore: {
          type: 'string',
          description: 'Filter tasks due before this ISO date',
        },
        dueAfter: {
          type: 'string',
          description: 'Filter tasks due after this ISO date',
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
    name: 'task_complete',
    description: 'Complete a task by submitting the form data. The task status will change to completed.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to complete',
        },
        result: {
          type: 'object',
          description: 'Form data submitted by the user (must match form schema)',
          additionalProperties: true,
        },
      },
      required: ['taskId', 'result'],
    },
  },
  {
    name: 'task_reassign',
    description: 'Reassign a task to a different user or group.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to reassign',
        },
        userId: {
          type: 'string',
          description: 'New assigned user ID',
        },
        groupId: {
          type: 'string',
          description: 'New assigned group ID',
        },
        reason: {
          type: 'string',
          description: 'Reason for reassignment (for audit logging)',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'task_add_comment',
    description: 'Add a comment to a task. Comments provide additional context or updates.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to comment on',
        },
        content: {
          type: 'string',
          description: 'Comment text content',
        },
        userId: {
          type: 'string',
          description: 'User ID of the commenter (optional)',
        },
      },
      required: ['taskId', 'content'],
    },
  },
];

/**
 * Handle task tool calls
 */
export async function handleTaskTool(
  toolName: string,
  args: Record<string, unknown>,
  service?: TaskService
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  // If no service is provided, return a mock response
  if (!service) {
    return createMockResponse(toolName, args);
  }

  try {
    let result: unknown;

    switch (toolName) {
      case 'task_create': {
        result = await service.create(args);
        break;
      }

      case 'task_get': {
        const { taskId } = args as { taskId: string };
        result = await service.get(taskId);
        break;
      }

      case 'task_list': {
        result = await service.list(args);
        break;
      }

      case 'task_complete': {
        const { taskId, result: taskResult } = args as { taskId: string; result: unknown };
        result = await service.complete(taskId, taskResult);
        break;
      }

      case 'task_reassign': {
        const { taskId, userId, groupId } = args as {
          taskId: string;
          userId?: string;
          groupId?: string;
          reason?: string;
        };
        result = await service.reassign(taskId, { userId, groupId });
        break;
      }

      case 'task_add_comment': {
        const { taskId, content, userId } = args as {
          taskId: string;
          content: string;
          userId?: string;
        };
        const commentInput: { content: string; userId?: string } = { content };
        if (userId !== undefined) {
          commentInput.userId = userId;
        }
        result = await service.addComment(taskId, commentInput);
        break;
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: `Unknown task tool: ${toolName}` }),
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
    task_create: {
      id: 'tsk_mock123',
      type: args['type'],
      title: args['title'],
      status: 'pending',
      priority: args['priority'] ?? 'medium',
      createdAt: new Date().toISOString(),
    },
    task_get: {
      id: args['taskId'],
      type: 'example-task',
      title: 'Example Task',
      status: 'assigned',
      priority: 'medium',
      createdAt: new Date().toISOString(),
    },
    task_list: {
      items: [],
      nextCursor: null,
      hasMore: false,
    },
    task_complete: {
      id: args['taskId'],
      status: 'completed',
      completedAt: new Date().toISOString(),
    },
    task_reassign: {
      id: args['taskId'],
      assignment: {
        userId: args['userId'],
        groupId: args['groupId'],
      },
    },
    task_add_comment: {
      taskId: args['taskId'],
      commentId: 'cmt_mock123',
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
