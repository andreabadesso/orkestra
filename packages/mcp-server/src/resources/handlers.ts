/**
 * Resource Handlers
 *
 * MCP resources for Orkestra.
 */

import type { Resource, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type { OrkestraServices } from '../types.js';

/**
 * Available resource definitions
 */
export const resources: Resource[] = [
  {
    uri: 'orkestra://workflows',
    name: 'Available Workflow Definitions',
    description: 'List of all registered workflow definitions that can be started',
    mimeType: 'application/json',
  },
  {
    uri: 'orkestra://tasks/pending',
    name: 'Pending Tasks',
    description: 'List of pending tasks that need human attention',
    mimeType: 'application/json',
  },
  {
    uri: 'orkestra://tenant/config',
    name: 'Tenant Configuration',
    description: 'Current tenant configuration and settings',
    mimeType: 'application/json',
  },
];

/**
 * Handle resource read requests
 */
export async function handleResourceRead(
  uri: string,
  services?: OrkestraServices
): Promise<ReadResourceResult> {
  switch (uri) {
    case 'orkestra://workflows':
      return handleWorkflowsResource(services);

    case 'orkestra://tasks/pending':
      return handlePendingTasksResource(services);

    case 'orkestra://tenant/config':
      return handleTenantConfigResource(services);

    default:
      throw new Error(`Unknown resource URI: ${uri}`);
  }
}

/**
 * Handle workflows resource
 */
async function handleWorkflowsResource(
  services?: OrkestraServices
): Promise<ReadResourceResult> {
  // If services are available, fetch real data
  // For now, return mock data showing the expected structure
  const mockWorkflowDefinitions = [
    {
      name: 'customer-support',
      version: '1.0.0',
      description: 'Handle customer support requests with human escalation',
      inputSchema: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          customerId: { type: 'string' },
          channel: { type: 'string' },
        },
        required: ['question'],
      },
    },
    {
      name: 'document-review',
      version: '1.0.0',
      description: 'Review and approve documents with human oversight',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string' },
          documentType: { type: 'string' },
          reviewerGroup: { type: 'string' },
        },
        required: ['documentId'],
      },
    },
    {
      name: 'approval-workflow',
      version: '1.0.0',
      description: 'Multi-stage approval process with configurable approvers',
      inputSchema: {
        type: 'object',
        properties: {
          requestType: { type: 'string' },
          amount: { type: 'number' },
          requesterId: { type: 'string' },
        },
        required: ['requestType'],
      },
    },
  ];

  return {
    contents: [
      {
        uri: 'orkestra://workflows',
        mimeType: 'application/json',
        text: JSON.stringify(
          {
            workflows: mockWorkflowDefinitions,
            _note: 'These are example workflow definitions. Configure real workflows in your Orkestra setup.',
            _mock: !services,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Handle pending tasks resource
 */
async function handlePendingTasksResource(
  services?: OrkestraServices
): Promise<ReadResourceResult> {
  // If services are available, fetch real pending tasks
  if (services?.tasks) {
    try {
      const pendingTasks = await services.tasks.list({ status: 'pending' });
      return {
        contents: [
          {
            uri: 'orkestra://tasks/pending',
            mimeType: 'application/json',
            text: JSON.stringify(pendingTasks, null, 2),
          },
        ],
      };
    } catch {
      // Fall through to mock data
    }
  }

  // Return mock data
  const mockPendingTasks = {
    items: [],
    nextCursor: null,
    hasMore: false,
    _note: 'No pending tasks. Tasks will appear here when workflows create human tasks.',
    _mock: true,
  };

  return {
    contents: [
      {
        uri: 'orkestra://tasks/pending',
        mimeType: 'application/json',
        text: JSON.stringify(mockPendingTasks, null, 2),
      },
    ],
  };
}

/**
 * Handle tenant config resource
 */
async function handleTenantConfigResource(
  _services?: OrkestraServices
): Promise<ReadResourceResult> {
  // Return tenant configuration
  // In a real implementation, this would fetch the actual tenant config
  const mockTenantConfig = {
    tenant: {
      id: 'ten_example',
      name: 'Example Tenant',
      status: 'active',
    },
    config: {
      timezone: 'UTC',
      locale: 'en-US',
      features: {
        workflows: true,
        tasks: true,
        conversations: true,
      },
    },
    limits: {
      maxWorkflowsPerDay: 1000,
      maxTasksPerWorkflow: 100,
      maxUsersPerTenant: 100,
    },
    _note: 'This is example tenant configuration. Configure your tenant in Orkestra.',
    _mock: true,
  };

  return {
    contents: [
      {
        uri: 'orkestra://tenant/config',
        mimeType: 'application/json',
        text: JSON.stringify(mockTenantConfig, null, 2),
      },
    ],
  };
}
