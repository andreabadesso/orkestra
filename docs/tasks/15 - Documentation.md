# Task 15: Documentation

## Overview

Create comprehensive documentation for Orkestra: getting started guide, API reference, and architecture docs.

## Phase

🔴 **Phase 5: Developer Experience**

## Priority

🟡 **High** - Essential for adoption

## Estimated Effort

8-10 hours

## Description

Write clear, comprehensive documentation that enables developers to understand, install, and use Orkestra effectively.

## Requirements

### Documentation Structure

```
docs/
├── README.md                    # Overview and quick links
├── getting-started/
│   ├── installation.md
│   ├── quick-start.md
│   ├── first-workflow.md
│   └── first-task.md
├── concepts/
│   ├── architecture.md
│   ├── workflows.md
│   ├── tasks.md
│   ├── multi-tenancy.md
│   └── sla-escalation.md
├── guides/
│   ├── writing-workflows.md
│   ├── form-schemas.md
│   ├── assignment-strategies.md
│   ├── notifications.md
│   └── deployment.md
├── api-reference/
│   ├── mcp-tools.md
│   ├── rest-api.md
│   ├── sdk-reference.md
│   └── cli-reference.md
├── examples/
│   ├── support-bot.md
│   ├── approval-workflow.md
│   └── sales-pipeline.md
└── contributing.md
```

### Getting Started: Quick Start

```markdown
# Quick Start

Get Orkestra running in under 5 minutes.

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- pnpm (recommended) or npm

## Create a New Project

\`\`\`bash
npx create-orkestra my-app
cd my-app
\`\`\`

## Start Development Environment

\`\`\`bash
npx orkestra dev
\`\`\`

This starts:
- PostgreSQL on `localhost:5432`
- Temporal on `localhost:7233`
- Temporal UI on `localhost:8080`
- Orkestra API on `localhost:3000`
- Dashboard on `localhost:3001`

## Create Your First Workflow

\`\`\`bash
npx orkestra generate workflow hello-world --with-task
\`\`\`

This creates `src/workflows/hello-world.ts`:

\`\`\`typescript
import { workflow, task, timeout } from '@orkestra/sdk';

export const helloWorld = workflow('hello-world', async (ctx, input) => {
  const result = await task(ctx, {
    title: 'Say Hello',
    form: {
      greeting: { type: 'text', label: 'Your greeting', required: true },
    },
    assignTo: { group: 'default' },
  });

  return { greeting: result.data.greeting };
});
\`\`\`

## Start the Workflow

Using the MCP server (for AI agents):

\`\`\`typescript
// In your AI agent
const result = await mcp.callTool({
  name: 'workflow_start',
  arguments: {
    name: 'hello-world',
    input: {},
  },
});
\`\`\`

Or using the REST API:

\`\`\`bash
curl -X POST http://localhost:3000/trpc/workflow.start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name": "hello-world", "input": {}}'
\`\`\`

## Complete the Task

1. Open the Dashboard at `http://localhost:3001`
2. Log in with the default credentials
3. Find your task in the inbox
4. Fill in the form and submit

The workflow will automatically resume and complete!

## Next Steps

- [Writing Workflows](./first-workflow.md)
- [Form Schemas](../guides/form-schemas.md)
- [Deployment Guide](../guides/deployment.md)
```

### Concepts: Tasks

```markdown
# Tasks

Tasks are the bridge between AI agents and human decision-makers.

## What is a Task?

A Task is a unit of work that requires human input. When an AI agent encounters
something it can't handle autonomously, it creates a Task and waits for a human
to complete it.

## Task Lifecycle

\`\`\`
CREATED → ASSIGNED → CLAIMED → COMPLETED
            ↓          ↓
       ESCALATED   EXPIRED
\`\`\`

### States

| State | Description |
|-------|-------------|
| CREATED | Task created but not yet assigned |
| ASSIGNED | Task assigned to user or group |
| CLAIMED | User has taken ownership |
| COMPLETED | Task finished with response |
| ESCALATED | Task moved to higher priority |
| EXPIRED | SLA breached without completion |

## Creating Tasks

Tasks are typically created from within workflows:

\`\`\`typescript
import { task, timeout } from '@orkestra/sdk';

const result = await task(ctx, {
  title: 'Review Customer Request',
  description: 'Customer needs help with their order',
  form: {
    response: {
      type: 'textarea',
      label: 'Your response',
      required: true,
    },
    escalate: {
      type: 'boolean',
      label: 'Needs manager review?',
      default: false,
    },
  },
  assignTo: { group: 'support' },
  context: { orderId: '12345', customerId: 'cust_abc' },
  conversationId: 'conv_xyz',
  sla: timeout('30m'),
});
\`\`\`

## Form Schemas

Tasks use form schemas to define what input is needed:

### Field Types

| Type | Description | Example |
|------|-------------|---------|
| `text` | Single-line text | Name, email |
| `textarea` | Multi-line text | Responses, notes |
| `boolean` | Checkbox | Yes/no questions |
| `select` | Dropdown | Categories, options |
| `number` | Numeric input | Quantities, ratings |
| `date` | Date picker | Deadlines, dates |

### Example Schema

\`\`\`typescript
{
  customerSentiment: {
    type: 'select',
    label: 'Customer Sentiment',
    options: [
      { value: 'positive', label: 'Positive' },
      { value: 'neutral', label: 'Neutral' },
      { value: 'negative', label: 'Negative' },
    ],
    required: true,
  },
  notes: {
    type: 'textarea',
    label: 'Additional Notes',
  },
  prioritize: {
    type: 'boolean',
    label: 'Mark as priority?',
    default: false,
  },
}
\`\`\`

## Assignment

Tasks can be assigned to:

### Individual Users

\`\`\`typescript
assignTo: { userId: 'user_123' }
\`\`\`

### Groups

\`\`\`typescript
assignTo: { group: 'support-l1' }
\`\`\`

When assigned to a group, the task appears in all group members' inboxes.
A user must **claim** the task before completing it.

### Assignment Strategies

Groups support different assignment strategies:

| Strategy | Description |
|----------|-------------|
| `round-robin` | Rotate through members |
| `load-balanced` | Assign to least-busy member |
| `manual` | Let members self-assign |

## SLA and Escalation

Tasks can have Service Level Agreements:

\`\`\`typescript
sla: {
  deadline: '30m',      // 30 minutes
  onBreach: 'escalate', // What to do on breach
  escalateTo: { group: 'support-l2' },
}
\`\`\`

### Escalation Chains

For complex escalation:

\`\`\`typescript
import { taskWithEscalation } from '@orkestra/sdk';

await taskWithEscalation(ctx, {
  // ... task options
  escalation: {
    steps: [
      { after: '15m', action: 'notify' },
      { after: '30m', action: 'reassign', target: { group: 'support-l2' } },
      { after: '1h', action: 'escalate', target: { group: 'managers' } },
    ],
  },
});
\`\`\`

## Context

Tasks can include context that helps humans understand what they're reviewing:

\`\`\`typescript
context: {
  orderId: '12345',
  customerName: 'John Doe',
  orderTotal: '$150.00',
  issueType: 'refund-request',
}
\`\`\`

This context is displayed in the Dashboard alongside the form.

## Conversation Context

For tasks related to conversations, link them:

\`\`\`typescript
conversationId: 'conv_xyz'
\`\`\`

The Dashboard will display the full conversation history, helping humans
understand the context before responding.
```

### API Reference: MCP Tools

```markdown
# MCP Tools Reference

Orkestra exposes its functionality via Model Context Protocol tools.

## Workflow Tools

### workflow_start

Start a new workflow instance.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Workflow name |
| input | object | Yes | Workflow input |
| workflowId | string | No | Custom workflow ID |

**Response:**
\`\`\`json
{
  "workflowId": "wfl_abc123",
  "runId": "run_xyz789"
}
\`\`\`

### workflow_get

Get workflow status and details.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| workflowId | string | Yes | Workflow ID |

**Response:**
\`\`\`json
{
  "workflowId": "wfl_abc123",
  "status": "RUNNING",
  "startTime": "2024-01-15T10:00:00Z",
  "input": { ... }
}
\`\`\`

### workflow_list

List workflows with optional filters.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| status | string | No | Filter by status |
| limit | number | No | Max results (default: 20) |

### workflow_signal

Send a signal to a running workflow.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| workflowId | string | Yes | Workflow ID |
| signalName | string | Yes | Signal name |
| data | object | No | Signal data |

### workflow_cancel

Cancel a running workflow.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| workflowId | string | Yes | Workflow ID |
| reason | string | No | Cancellation reason |

## Task Tools

### task_create

Create a new human task.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| title | string | Yes | Task title |
| form | object | Yes | Form schema |
| assignTo | object | Yes | Assignment target |
| description | string | No | Task description |
| context | object | No | Additional context |
| conversationId | string | No | Linked conversation |
| sla | object | No | SLA configuration |
| workflowId | string | Yes | Parent workflow |
| workflowRunId | string | Yes | Parent run |

### task_get

Get task details.

### task_list

List tasks with filters.

### task_complete

Complete a task with form data.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| taskId | string | Yes | Task ID |
| formData | object | Yes | Completed form |

### task_reassign

Reassign a task.

### task_add_comment

Add a comment to a task.

## Resources

### orkestra://workflows

List available workflow definitions.

### orkestra://tasks/pending

Get pending tasks for current user.

### orkestra://tenant/config

Get current tenant configuration.
```

## Acceptance Criteria

- [ ] Getting started guide complete
- [ ] All concepts documented
- [ ] All guides written
- [ ] MCP tools reference complete
- [ ] REST API reference complete
- [ ] SDK reference complete
- [ ] CLI reference complete
- [ ] Examples documented
- [ ] Contributing guide written
- [ ] Documentation builds without errors
- [ ] All code samples tested

## Dependencies

- [[07 - SDK Workflow Helpers]]
- [[08 - MCP Server]]
- [[09 - REST API]]
- [[13 - CLI Tool]]
- [[14 - Integration Testing]]

## Blocked By

- [[14 - Integration Testing]] - Need working examples

## Blocks

- [[16 - Release Preparation]]

## Technical Notes

### Documentation Framework

Use VitePress or Docusaurus:

```bash
pnpm add -D vitepress
```

### Configuration

```typescript
// docs/.vitepress/config.ts
export default defineConfig({
  title: 'Orkestra',
  description: 'AI-native workflow orchestration',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/getting-started/' },
      { text: 'API', link: '/api-reference/' },
    ],
    sidebar: { ... },
  },
});
```

## References

- [VitePress](https://vitepress.dev/)
- [Docusaurus](https://docusaurus.io/)

## Tags

#orkestra #task #documentation #developer-experience
