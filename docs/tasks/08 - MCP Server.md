# Task 08: MCP Server Implementation

## Overview

Implement the `@orkestra/mcp-server` package that exposes Orkestra functionality via Model Context Protocol for AI agents.

## Phase

🟡 **Phase 3: Interfaces**

## Priority

🔴 **Critical** - Primary AI integration interface

## Estimated Effort

8-10 hours

## Description

The MCP Server is how AI agents interact with Orkestra. It exposes workflows, tasks, conversations, and tenant operations as MCP tools and resources.

## Requirements

### Package Structure

```
packages/mcp-server/
├── src/
│   ├── index.ts
│   ├── server.ts              # MCP server setup
│   ├── tools/
│   │   ├── index.ts
│   │   ├── workflows.ts       # Workflow tools
│   │   ├── tasks.ts           # Task tools
│   │   ├── conversations.ts   # Conversation tools
│   │   └── users.ts           # User/group tools
│   ├── resources/
│   │   ├── index.ts
│   │   ├── workflows.ts
│   │   ├── tasks.ts
│   │   └── tenant.ts
│   └── middleware/
│       ├── index.ts
│       ├── auth.ts            # API key validation
│       └── tenant.ts          # Tenant context
├── package.json
└── tsconfig.json
```

### MCP Server Setup

```typescript
// server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TaskService, WorkflowService } from '@orkestra/core';

export interface OrkestraMCPServerOptions {
  taskService: TaskService;
  workflowService: WorkflowService;
  conversationService: ConversationService;
  userService: UserService;
}

export function createMCPServer(options: OrkestraMCPServerOptions): Server {
  const server = new Server(
    {
      name: 'orkestra',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register all tools
  registerWorkflowTools(server, options);
  registerTaskTools(server, options);
  registerConversationTools(server, options);
  registerUserTools(server, options);

  // Register all resources
  registerResources(server, options);

  return server;
}

export async function runMCPServer(server: Server): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

### Workflow Tools

```typescript
// tools/workflows.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { z } from 'zod';

export function registerWorkflowTools(
  server: Server,
  options: OrkestraMCPServerOptions
): void {
  const { workflowService } = options;

  // workflow_start
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name !== 'workflow_start') return;

    const schema = z.object({
      name: z.string().describe('Workflow name to start'),
      input: z.record(z.unknown()).describe('Input parameters for the workflow'),
      workflowId: z.string().optional().describe('Custom workflow ID'),
    });

    const args = schema.parse(request.params.arguments);
    const ctx = getRequestContext(request); // From middleware

    const handle = await workflowService.start(ctx, {
      name: args.name,
      input: args.input,
      workflowId: args.workflowId,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            workflowId: handle.workflowId,
            runId: handle.firstExecutionRunId,
            status: 'started',
          }),
        },
      ],
    };
  });

  // workflow_get
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name !== 'workflow_get') return;

    const schema = z.object({
      workflowId: z.string().describe('Workflow ID to retrieve'),
    });

    const args = schema.parse(request.params.arguments);
    const ctx = getRequestContext(request);

    const workflow = await workflowService.get(ctx, args.workflowId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(workflow),
        },
      ],
    };
  });

  // workflow_list
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name !== 'workflow_list') return;

    const schema = z.object({
      status: z.enum(['running', 'completed', 'failed']).optional(),
      limit: z.number().default(20),
    });

    const args = schema.parse(request.params.arguments);
    const ctx = getRequestContext(request);

    const workflows = await workflowService.list(ctx, args);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(workflows),
        },
      ],
    };
  });

  // workflow_signal
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name !== 'workflow_signal') return;

    const schema = z.object({
      workflowId: z.string(),
      signalName: z.string(),
      data: z.record(z.unknown()).optional(),
    });

    const args = schema.parse(request.params.arguments);
    const ctx = getRequestContext(request);

    await workflowService.signal(ctx, args.workflowId, args.signalName, args.data);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true }),
        },
      ],
    };
  });

  // workflow_cancel
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name !== 'workflow_cancel') return;

    const schema = z.object({
      workflowId: z.string(),
      reason: z.string().optional(),
    });

    const args = schema.parse(request.params.arguments);
    const ctx = getRequestContext(request);

    await workflowService.cancel(ctx, args.workflowId, args.reason);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true }),
        },
      ],
    };
  });
}
```

### Task Tools

```typescript
// tools/tasks.ts
export function registerTaskTools(
  server: Server,
  options: OrkestraMCPServerOptions
): void {
  const { taskService } = options;

  // task_create
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name !== 'task_create') return;

    const schema = z.object({
      title: z.string().describe('Task title'),
      form: z.record(z.unknown()).describe('Form schema'),
      assignTo: z.object({
        userId: z.string().optional(),
        groupId: z.string().optional(),
      }).describe('Assignment target'),
      context: z.record(z.unknown()).optional(),
      conversationId: z.string().optional(),
      sla: z.object({
        deadline: z.string(),
        onBreach: z.enum(['escalate', 'notify', 'cancel']).optional(),
      }).optional(),
      workflowId: z.string(),
      workflowRunId: z.string(),
    });

    const args = schema.parse(request.params.arguments);
    const ctx = getRequestContext(request);

    const task = await taskService.create(ctx, args);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            taskId: task.id,
            status: task.status,
          }),
        },
      ],
    };
  });

  // task_get
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name !== 'task_get') return;

    const schema = z.object({
      taskId: z.string(),
    });

    const args = schema.parse(request.params.arguments);
    const ctx = getRequestContext(request);

    const task = await taskService.get(ctx, args.taskId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(task),
        },
      ],
    };
  });

  // task_list
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name !== 'task_list') return;

    const schema = z.object({
      status: z.enum(['pending', 'completed', 'all']).default('pending'),
      assignedTo: z.string().optional(),
      limit: z.number().default(20),
    });

    const args = schema.parse(request.params.arguments);
    const ctx = getRequestContext(request);

    const tasks = await taskService.list(ctx, args);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(tasks),
        },
      ],
    };
  });

  // task_complete
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name !== 'task_complete') return;

    const schema = z.object({
      taskId: z.string(),
      formData: z.record(z.unknown()),
    });

    const args = schema.parse(request.params.arguments);
    const ctx = getRequestContext(request);

    const task = await taskService.complete(ctx, args.taskId, args.formData);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            taskId: task.id,
            status: task.status,
            completedAt: task.completedAt,
          }),
        },
      ],
    };
  });

  // task_reassign
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name !== 'task_reassign') return;

    const schema = z.object({
      taskId: z.string(),
      assignTo: z.object({
        userId: z.string().optional(),
        groupId: z.string().optional(),
      }),
    });

    const args = schema.parse(request.params.arguments);
    const ctx = getRequestContext(request);

    await taskService.reassign(ctx, args.taskId, args.assignTo);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true }),
        },
      ],
    };
  });

  // task_add_comment
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name !== 'task_add_comment') return;

    const schema = z.object({
      taskId: z.string(),
      comment: z.string(),
    });

    const args = schema.parse(request.params.arguments);
    const ctx = getRequestContext(request);

    await taskService.addComment(ctx, args.taskId, args.comment);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true }),
        },
      ],
    };
  });
}
```

### Conversation Tools

```typescript
// tools/conversations.ts
export function registerConversationTools(
  server: Server,
  options: OrkestraMCPServerOptions
): void {
  const { conversationService } = options;

  // conversation_create
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name !== 'conversation_create') return;

    const schema = z.object({
      participant: z.object({
        id: z.string(),
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
      }),
      channel: z.string().optional(),
      externalId: z.string().optional(),
    });

    const args = schema.parse(request.params.arguments);
    const ctx = getRequestContext(request);

    const conversation = await conversationService.create(ctx, args);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            conversationId: conversation.id,
          }),
        },
      ],
    };
  });

  // conversation_get
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name !== 'conversation_get') return;

    const schema = z.object({
      conversationId: z.string(),
    });

    const args = schema.parse(request.params.arguments);
    const ctx = getRequestContext(request);

    const conversation = await conversationService.get(ctx, args.conversationId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(conversation),
        },
      ],
    };
  });

  // conversation_append
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name !== 'conversation_append') return;

    const schema = z.object({
      conversationId: z.string(),
      message: z.object({
        role: z.enum(['user', 'assistant', 'system', 'human']),
        content: z.string(),
        metadata: z.record(z.unknown()).optional(),
      }),
    });

    const args = schema.parse(request.params.arguments);
    const ctx = getRequestContext(request);

    await conversationService.appendMessage(ctx, args.conversationId, args.message);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true }),
        },
      ],
    };
  });

  // conversation_list
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name !== 'conversation_list') return;

    const schema = z.object({
      status: z.enum(['active', 'closed', 'all']).default('active'),
      channel: z.string().optional(),
      limit: z.number().default(20),
    });

    const args = schema.parse(request.params.arguments);
    const ctx = getRequestContext(request);

    const conversations = await conversationService.list(ctx, args);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(conversations),
        },
      ],
    };
  });
}
```

### MCP Resources

```typescript
// resources/index.ts
export function registerResources(
  server: Server,
  options: OrkestraMCPServerOptions
): void {
  // orkestra://workflows - List available workflow definitions
  server.setRequestHandler('resources/list', async () => {
    return {
      resources: [
        {
          uri: 'orkestra://workflows',
          name: 'Workflow Definitions',
          description: 'Available workflow types',
          mimeType: 'application/json',
        },
        {
          uri: 'orkestra://tasks/pending',
          name: 'Pending Tasks',
          description: 'Tasks awaiting completion',
          mimeType: 'application/json',
        },
        {
          uri: 'orkestra://tenant/config',
          name: 'Tenant Configuration',
          description: 'Current tenant settings',
          mimeType: 'application/json',
        },
      ],
    };
  });

  // Resource content handlers
  server.setRequestHandler('resources/read', async (request) => {
    const uri = request.params.uri;
    const ctx = getRequestContext(request);

    if (uri === 'orkestra://workflows') {
      const workflows = await options.workflowService.listDefinitions(ctx);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(workflows),
          },
        ],
      };
    }

    if (uri === 'orkestra://tasks/pending') {
      const tasks = await options.taskService.listPending(ctx);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(tasks),
          },
        ],
      };
    }

    if (uri === 'orkestra://tenant/config') {
      const config = await options.tenantService.getConfig(ctx);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(config),
          },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });
}
```

### Tool Definitions Export

```typescript
// tools/index.ts
export const toolDefinitions = [
  // Workflows
  {
    name: 'workflow_start',
    description: 'Start a new workflow instance',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Workflow name' },
        input: { type: 'object', description: 'Workflow input' },
        workflowId: { type: 'string', description: 'Optional custom ID' },
      },
      required: ['name', 'input'],
    },
  },
  {
    name: 'workflow_get',
    description: 'Get workflow status and details',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string' },
      },
      required: ['workflowId'],
    },
  },
  // ... all other tools
];
```

## Acceptance Criteria

- [ ] MCP server starts and accepts connections
- [ ] All workflow tools implemented and working
- [ ] All task tools implemented and working
- [ ] All conversation tools implemented and working
- [ ] User/group tools implemented
- [ ] Resources return correct data
- [ ] Authentication middleware validates API keys
- [ ] Tenant context properly extracted and passed
- [ ] Error handling returns proper MCP errors
- [ ] Tool definitions exported for documentation
- [ ] Unit tests for all tools
- [ ] Integration test with Claude Desktop

## Dependencies

- [[01 - Initialize Monorepo]]
- [[03 - Core Package Setup]]
- [[05 - Database Schema]]
- [[06 - Task Manager]]

## Blocked By

- [[06 - Task Manager]]

## Blocks

- [[14 - Integration Testing]]
- [[17 - Example Project]]

## Technical Notes

### MCP SDK

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

### Authentication

API key should be passed in the MCP context or environment:

```typescript
function getRequestContext(request: Request): RequestContext {
  const apiKey = process.env.ORKESTRA_API_KEY;
  // Validate API key and extract tenant/user context
  return validateAndExtract(apiKey);
}
```

### Running as Standalone

The MCP server can run as a standalone process:

```bash
# Start MCP server
ORKESTRA_API_KEY=xxx ORKESTRA_DATABASE_URL=xxx npx @orkestra/mcp-server
```

Or integrated into a larger application.

## References

- [MCP SDK Documentation](https://modelcontextprotocol.io/docs)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [[Architecture]] - Tool definitions

## Tags

#orkestra #task #mcp #ai-integration #tools
