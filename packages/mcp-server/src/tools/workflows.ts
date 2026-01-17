/**
 * Workflow Tools
 *
 * MCP tools for workflow operations.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WorkflowService } from '../types.js';

/**
 * Workflow tool definitions
 */
export const workflowTools: Tool[] = [
  {
    name: 'workflow_start',
    description: 'Start a new workflow instance. Returns the created workflow with its ID and initial status.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'The workflow type name (must match a registered workflow definition)',
        },
        input: {
          type: 'object',
          description: 'Input data for the workflow',
          additionalProperties: true,
        },
        options: {
          type: 'object',
          description: 'Optional execution options',
          properties: {
            workflowId: {
              type: 'string',
              description: 'Custom workflow ID (auto-generated if not provided)',
            },
            taskQueue: {
              type: 'string',
              description: 'Task queue to run on',
            },
            executionTimeoutSeconds: {
              type: 'number',
              description: 'Execution timeout in seconds',
            },
          },
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata to attach to the workflow',
          additionalProperties: true,
        },
      },
      required: ['type', 'input'],
    },
  },
  {
    name: 'workflow_get',
    description: 'Get details of a specific workflow by its ID. Returns workflow status, input, output, and metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'The workflow ID to retrieve',
        },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'workflow_list',
    description: 'List workflows with optional filtering. Returns paginated results.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Filter by workflow type',
        },
        status: {
          type: 'string',
          enum: ['pending', 'running', 'paused', 'completed', 'failed', 'cancelled', 'timed_out'],
          description: 'Filter by workflow status',
        },
        startedAfter: {
          type: 'string',
          description: 'Filter workflows started after this ISO date',
        },
        startedBefore: {
          type: 'string',
          description: 'Filter workflows started before this ISO date',
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
    name: 'workflow_signal',
    description: 'Send a signal to a running workflow. Signals can trigger workflow state changes or pass data.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'The workflow ID to signal',
        },
        signalName: {
          type: 'string',
          description: 'Name of the signal to send',
        },
        args: {
          type: 'array',
          description: 'Arguments to pass with the signal',
          items: {},
        },
      },
      required: ['workflowId', 'signalName'],
    },
  },
  {
    name: 'workflow_cancel',
    description: 'Cancel a running workflow. The workflow will be marked as cancelled and stop execution.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'The workflow ID to cancel',
        },
        reason: {
          type: 'string',
          description: 'Reason for cancellation (for audit logging)',
        },
      },
      required: ['workflowId'],
    },
  },
];

/**
 * Handle workflow tool calls
 */
export async function handleWorkflowTool(
  toolName: string,
  args: Record<string, unknown>,
  service?: WorkflowService
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  // If no service is provided, return a mock response indicating the tool would work
  if (!service) {
    return createMockResponse(toolName, args);
  }

  try {
    let result: unknown;

    switch (toolName) {
      case 'workflow_start': {
        const { type, input, options } = args as {
          type: string;
          input: unknown;
          options?: unknown;
          metadata?: unknown;
        };
        result = await service.start({ type, input, options });
        break;
      }

      case 'workflow_get': {
        const { workflowId } = args as { workflowId: string };
        result = await service.get(workflowId);
        break;
      }

      case 'workflow_list': {
        result = await service.list(args);
        break;
      }

      case 'workflow_signal': {
        const { workflowId, signalName, args: signalArgs } = args as {
          workflowId: string;
          signalName: string;
          args?: unknown[];
        };
        const signalInput: { name: string; args?: unknown[] } = { name: signalName };
        if (signalArgs !== undefined) {
          signalInput.args = signalArgs;
        }
        await service.signal(workflowId, signalInput);
        result = { success: true, message: `Signal '${signalName}' sent to workflow ${workflowId}` };
        break;
      }

      case 'workflow_cancel': {
        const { workflowId, reason } = args as { workflowId: string; reason?: string };
        await service.cancel(workflowId, reason);
        result = { success: true, message: `Workflow ${workflowId} cancelled` };
        break;
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: `Unknown workflow tool: ${toolName}` }),
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
    workflow_start: {
      id: 'wfl_mock123',
      type: args['type'],
      status: 'pending',
      input: args['input'],
      createdAt: new Date().toISOString(),
    },
    workflow_get: {
      id: args['workflowId'],
      type: 'example-workflow',
      status: 'running',
      input: {},
      output: null,
      createdAt: new Date().toISOString(),
    },
    workflow_list: {
      items: [],
      nextCursor: null,
      hasMore: false,
    },
    workflow_signal: {
      success: true,
      message: `Signal sent to workflow ${args['workflowId']}`,
    },
    workflow_cancel: {
      success: true,
      message: `Workflow ${args['workflowId']} cancelled`,
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
