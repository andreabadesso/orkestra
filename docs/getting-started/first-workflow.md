# Your First Workflow

This tutorial walks you through creating a complete workflow with human tasks, from start to finish.

## What We'll Build

A customer support escalation workflow that:
1. Receives a customer question
2. Creates a human task for support agents
3. Enforces SLA with escalation
4. Returns the agent's response

## Prerequisites

Complete the [Quick Start](./quick-start.md) guide first.

## Step 1: Generate the Workflow

```bash
pnpm generate workflow customer-support --with-task
```

This creates `src/workflows/customer-support.ts` with a template.

## Step 2: Define the Workflow

Edit `src/workflows/customer-support.ts`:

```typescript
import { workflow, task, timeout, taskWithEscalation, escalationChain } from '@orkestra/sdk';

// Define input/output types
interface SupportInput {
  customerId: string;
  question: string;
  conversationId?: string;
  customerTier: 'basic' | 'premium' | 'enterprise';
}

interface SupportOutput {
  answer: string;
  handledBy: string;
  escalated: boolean;
  responseTime: number;
}

// Define the workflow
export const customerSupport = workflow<SupportInput, SupportOutput>(
  'customer-support',
  async (ctx, input) => {
    const startTime = Date.now();

    ctx.log.info('Support workflow started', {
      customerId: input.customerId,
      tier: input.customerTier,
    });

    // Determine SLA based on customer tier
    const slaMinutes = {
      basic: 60,
      premium: 30,
      enterprise: 10,
    }[input.customerTier];

    // Create task with escalation chain
    const result = await taskWithEscalation(ctx, {
      title: 'Customer Support Request',
      description: `Customer ${input.customerId} needs help:\n\n${input.question}`,
      form: {
        answer: {
          type: 'textarea',
          label: 'Your Response',
          required: true,
          placeholder: 'Type your response to the customer...',
        },
        category: {
          type: 'select',
          label: 'Category',
          required: true,
          options: [
            { value: 'billing', label: 'Billing' },
            { value: 'technical', label: 'Technical' },
            { value: 'general', label: 'General Inquiry' },
            { value: 'complaint', label: 'Complaint' },
          ],
        },
        needsFollowUp: {
          type: 'boolean',
          label: 'Needs Follow-up?',
          default: false,
        },
      },
      assignTo: { group: 'support-l1' },
      context: {
        customerId: input.customerId,
        customerTier: input.customerTier,
        conversationId: input.conversationId,
      },
      priority: input.customerTier === 'enterprise' ? 'urgent' : 'medium',

      // Escalation chain
      escalation: escalationChain()
        .notifyAfter(`${Math.floor(slaMinutes / 2)}m`, 'Task approaching SLA deadline')
        .escalateAfter(`${slaMinutes}m`, { group: 'support-l2' })
        .escalateAfter(`${slaMinutes * 2}m`, { group: 'support-managers' })
        .build(),
    });

    const responseTime = Date.now() - startTime;

    ctx.log.info('Support workflow completed', {
      taskId: result.taskId,
      handledBy: result.completedBy,
      responseTimeMs: responseTime,
    });

    return {
      answer: result.data.answer as string,
      handledBy: result.completedBy,
      escalated: false, // Would be true if escalation occurred
      responseTime,
    };
  }
);
```

## Step 3: Export the Workflow

Add to `src/workflows/index.ts`:

```typescript
export * from './customer-support.js';
```

## Step 4: Test the Workflow

Rebuild and restart the worker:

```bash
pnpm build
pnpm dev
```

Start a workflow instance:

```bash
curl -X POST http://localhost:3000/api/workflows/start \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: default" \
  -H "X-API-Key: dev-key" \
  -d '{
    "type": "customer-support",
    "input": {
      "customerId": "cust_123",
      "question": "How do I reset my password?",
      "customerTier": "premium"
    }
  }'
```

Response:

```json
{
  "workflowId": "wfl_abc123",
  "status": "running"
}
```

## Step 5: Complete the Task

The workflow is now waiting for a human to complete the task.

### View the Task

```bash
curl http://localhost:3000/api/tasks \
  -H "X-Tenant-ID: default" \
  -H "X-API-Key: dev-key"
```

### Complete the Task

```bash
curl -X POST http://localhost:3000/api/tasks/TASK_ID/complete \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: default" \
  -H "X-API-Key: dev-key" \
  -H "X-User-ID: user_001" \
  -d '{
    "result": {
      "answer": "To reset your password, go to Settings > Security > Reset Password.",
      "category": "technical",
      "needsFollowUp": false
    }
  }'
```

## Step 6: Check Workflow Result

```bash
curl http://localhost:3000/api/workflows/WORKFLOW_ID \
  -H "X-Tenant-ID: default" \
  -H "X-API-Key: dev-key"
```

Response:

```json
{
  "workflowId": "wfl_abc123",
  "status": "completed",
  "output": {
    "answer": "To reset your password, go to Settings > Security > Reset Password.",
    "handledBy": "user_001",
    "escalated": false,
    "responseTime": 45000
  }
}
```

## Understanding the Code

### Workflow Definition

```typescript
export const customerSupport = workflow<SupportInput, SupportOutput>(
  'customer-support',  // Workflow name (unique identifier)
  async (ctx, input) => { ... }  // Handler function
);
```

- `ctx`: Workflow context with logging, tenant info, and Temporal primitives
- `input`: Typed input data
- Returns: Typed output data

### Creating Tasks

```typescript
const result = await task(ctx, {
  title: 'Task Title',
  form: { /* field definitions */ },
  assignTo: { group: 'team-name' },
  sla: timeout('30m'),
});
```

The `task()` function:
1. Creates a task record in the database
2. Waits for a signal that the task is completed
3. Returns the form data and completion info

### Escalation Chains

```typescript
escalationChain()
  .notifyAfter('15m', 'Reminder message')
  .escalateAfter('30m', { group: 'level-2' })
  .escalateAfter('1h', { group: 'managers' })
  .build()
```

Each step triggers after the specified time if the task isn't completed.

## Common Patterns

### Multiple Approvers

```typescript
const results = await allTasks(ctx, {
  tasks: [
    { title: 'Legal Review', form: {...}, assignTo: { group: 'legal' } },
    { title: 'Finance Review', form: {...}, assignTo: { group: 'finance' } },
  ],
});
// Waits for ALL tasks to complete
```

### First Response Wins

```typescript
const result = await anyTask(ctx, {
  tasks: [
    { title: 'Approver A', form: {...}, assignTo: { user: 'user_a' } },
    { title: 'Approver B', form: {...}, assignTo: { user: 'user_b' } },
  ],
  cancelRemaining: true,
});
// Returns when ANY task completes, cancels others
```

### Conditional Branching

```typescript
const review = await task(ctx, {
  title: 'Initial Review',
  form: {
    decision: {
      type: 'select',
      options: [
        { value: 'approve', label: 'Approve' },
        { value: 'reject', label: 'Reject' },
        { value: 'escalate', label: 'Escalate' },
      ],
    },
  },
  assignTo: { group: 'reviewers' },
});

if (review.data.decision === 'escalate') {
  // Create another task for managers
  const managerReview = await task(ctx, {
    title: 'Manager Review',
    form: {...},
    assignTo: { group: 'managers' },
  });
}
```

## Next Steps

- [Workflow Concepts](../concepts/workflows.md) - Deep dive into workflows
- [Task Concepts](../concepts/tasks.md) - Understanding the task lifecycle
- [Form Schemas](../guides/form-schemas.md) - Advanced form configurations
- [SDK Reference](../api-reference/sdk-reference.md) - Complete API documentation
