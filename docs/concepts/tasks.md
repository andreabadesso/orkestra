# Tasks

Tasks are the bridge between AI agents and human decision-makers.

## What is a Task?

A Task is a unit of work that requires human input. When an AI agent encounters something it can't handle autonomously, it creates a Task and waits for a human to complete it.

**Key Characteristics:**

- **Structured Input**: Defined by form schemas with validation
- **Assignability**: Can be assigned to users or groups
- **Time-Bound**: Optional SLAs and escalation policies
- **Context-Aware**: Include metadata, conversation history, and custom data
- **Auditable**: Complete history of state changes and actions

## Task Lifecycle

```
CREATED → ASSIGNED → CLAIMED → COMPLETED
            ↓          ↓
       ESCALATED   EXPIRED
```

### States

| State     | Description                       |
| --------- | --------------------------------- |
| CREATED   | Task created but not yet assigned |
| ASSIGNED  | Task assigned to user or group    |
| CLAIMED   | User has taken ownership          |
| COMPLETED | Task finished with response       |
| ESCALATED | Task moved to higher priority     |
| EXPIRED   | SLA breached without completion   |

## Creating Tasks

Tasks are typically created from within workflows:

```typescript
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
```

## Form Schemas

Tasks use form schemas to define what input is needed:

### Field Types

| Type       | Description      | Example             |
| ---------- | ---------------- | ------------------- |
| `text`     | Single-line text | Name, email         |
| `textarea` | Multi-line text  | Responses, notes    |
| `boolean`  | Checkbox         | Yes/no questions    |
| `select`   | Dropdown         | Categories, options |
| `number`   | Numeric input    | Quantities, ratings |
| `date`     | Date picker      | Deadlines, dates    |

### Example Schema

```typescript
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
```

## Assignment

Tasks can be assigned to:

### Individual Users

```typescript
assignTo: {
  userId: 'user_123';
}
```

### Groups

```typescript
assignTo: {
  group: 'support-l1';
}
```

When assigned to a group, the task appears in all group members' inboxes.
A user must **claim** the task before completing it.

### Assignment Strategies

Groups support different assignment strategies:

| Strategy        | Description                 |
| --------------- | --------------------------- |
| `round-robin`   | Rotate through members      |
| `load-balanced` | Assign to least-busy member |
| `manual`        | Let members self-assign     |

## SLA and Escalation

Tasks can have Service Level Agreements:

```typescript
sla: {
  deadline: '30m',      // 30 minutes
  onBreach: 'escalate', // What to do on breach
  escalateTo: { group: 'support-l2' },
}
```

### Escalation Chains

For complex escalation:

```typescript
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
```

## Context

Tasks can include context that helps humans understand what they're reviewing:

```typescript
context: {
  orderId: '12345',
  customerName: 'John Doe',
  orderTotal: '$150.00',
  issueType: 'refund-request',
}
```

This context is displayed in the Dashboard alongside the form.

## Conversation Context

For tasks related to conversations, link them:

```typescript
conversationId: 'conv_xyz';
```

The Dashboard will display the full conversation history, helping humans understand the context before responding.

**Benefits:**

- Human reviewers see full AI conversation
- Understand what led to the escalation
- Make more informed decisions

## Task Completion

### Completing a Task

When a human completes a task via Dashboard or API:

```typescript
// Via REST API
await fetch('/api/tasks/:taskId/complete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    formData: {
      answer: 'Here is the response',
      escalate: false,
    },
  }),
});
```

### Workflow Resumes

When a task completes:

1. Task status changes to `COMPLETED`
2. Form data is returned to the workflow
3. Workflow resumes execution at the `await task()` line
4. Workflow receives the result

```typescript
const result = await task(ctx, {
  title: 'Review Request',
  form: { approved: { type: 'boolean' } },
  assignTo: { group: 'reviewers' },
});

// Workflow resumes here with result.data
if (result.data.approved) {
  // Continue workflow
} else {
  // Handle rejection
}
```

## Task Queries

### List Tasks

```typescript
// Get my pending tasks
const myTasks = await taskRepo.list(ctx, {
  assignedUserId: ctx.userId,
  status: 'assigned',
});

// Get my group's tasks
const groupTasks = await taskRepo.list(ctx, {
  assignedGroupId: ctx.groups[0],
  status: 'assigned',
});

// Get all tasks with filters
const filteredTasks = await taskRepo.list(ctx, {
  status: 'assigned',
  slaDeadline: { before: new Date() }, // Past SLA
  sortBy: 'slaDeadline',
  sortOrder: 'asc',
});
```

### Get Task Details

```typescript
const task = await taskRepo.findById(ctx, taskId);

console.log(task.id);
console.log(task.title);
console.log(task.formSchema);
console.log(task.status);
console.log(task.assignedTo);
console.log(task.context);
```

## Real-World Examples

### Customer Support Escalation

```typescript
export const customerSupport = workflow('customer-support', async (ctx, input) => {
  const { question, conversationId, customerId, confidence } = input;

  // AI couldn't answer confidently - ask human
  const result = await task(ctx, {
    title: 'Customer Question Needs Help',
    description: `AI confidence: ${Math.round(confidence * 100)}%`,
    form: {
      answer: {
        type: 'textarea',
        label: 'Your response to the customer',
        required: true,
      },
      shouldFollowUp: {
        type: 'boolean',
        label: 'Schedule follow-up?',
        default: false,
      },
    },
    assignTo: { group: 'support-l1' },
    context: {
      conversationId,
      customerId,
      question,
      aiConfidence: confidence,
    },
    conversationId,
    sla: timeout('30m'), // Respond within 30 min
  });

  // Send the response back to customer
  await ctx.activities.sendMessage({
    conversationId,
    message: result.data.answer,
  });

  return { handledBy: 'human', followUp: result.data.shouldFollowUp };
});
```

### Document Approval Workflow

```typescript
export const documentApproval = workflow('document-approval', async (ctx, input) => {
  const { documentId, documentType } = input;

  // Legal review
  const legal = await task(ctx, {
    title: `Legal Review: ${documentType}`,
    form: {
      approved: { type: 'boolean', required: true },
      comments: { type: 'textarea' },
      changesRequired: { type: 'boolean' },
    },
    assignTo: { group: 'legal-team' },
    context: { documentId, documentType },
    sla: timeout('2h'),
  });

  if (!legal.data.approved) {
    return { status: 'rejected', stage: 'legal' };
  }

  // Executive approval (only if legal approved)
  const executive = await task(ctx, {
    title: `Executive Approval: ${documentType}`,
    form: {
      approved: { type: 'boolean', required: true },
      delegation: { type: 'text' }, // If delegating, to whom
    },
    assignTo: { group: 'executives' },
    context: {
      documentId,
      documentType,
      legalComments: legal.data.comments,
    },
    sla: timeout('1h'),
  });

  return {
    status: executive.data.approved ? 'approved' : 'rejected',
    stage: 'executive',
    delegatedTo: executive.data.delegation,
  };
});
```

### Incident Response

```typescript
export const incidentResponse = workflow('incident-response', async (ctx, input) => {
  const { incidentId, severity } = input;

  // Triage
  const triage = await task(ctx, {
    title: `Incident Triage: ${incidentId}`,
    form: {
      classification: {
        type: 'select',
        options: [
          { value: 'hardware', label: 'Hardware' },
          { value: 'software', label: 'Software' },
          { value: 'network', label: 'Network' },
          { value: 'security', label: 'Security' },
        ],
        required: true,
      },
      priority: {
        type: 'select',
        options: [
          { value: 'p1', label: 'P1 - Critical' },
          { value: 'p2', label: 'P2 - High' },
          { value: 'p3', label: 'P3 - Medium' },
          { value: 'p4', label: 'P4 - Low' },
        ],
        required: true,
      },
    },
    assignTo: { group: 'incident-triage' },
    context: { incidentId, severity },
    sla: timeout('15m'),
  });

  // Route based on classification
  const assignTo = getTeamForClassification(triage.data.classification);
  const sla = getSLAForPriority(triage.data.priority);

  // Resolution
  const resolution = await taskWithEscalation(ctx, {
    title: `Resolve Incident: ${incidentId}`,
    form: {
      resolution: { type: 'textarea', required: true },
      rootCause: { type: 'textarea', required: true },
      resolvedAt: { type: 'date' },
    },
    assignTo: { group: assignTo },
    context: {
      incidentId,
      classification: triage.data.classification,
      priority: triage.data.priority,
    },
    escalation: {
      steps: [
        { after: sla * 0.5, action: 'notify', priority: 'high' },
        { after: sla * 0.75, action: 'notify', priority: 'urgent' },
        { after: sla, action: 'escalate', target: { group: 'incident-managers' } },
      ],
    },
  });

  return {
    resolved: true,
    classification: triage.data.classification,
    priority: triage.data.priority,
    rootCause: resolution.data.rootCause,
  };
});

function getTeamForClassification(classification: string): string {
  const teams = {
    hardware: 'hardware-team',
    software: 'software-team',
    network: 'network-team',
    security: 'security-team',
  };
  return teams[classification] || 'general-ops';
}

function getSLAForPriority(priority: string): number {
  // Returns milliseconds
  const slas = {
    p1: 15 * 60 * 1000, // 15 minutes
    p2: 1 * 60 * 60 * 1000, // 1 hour
    p3: 4 * 60 * 60 * 1000, // 4 hours
    p4: 24 * 60 * 60 * 1000, // 24 hours
  };
  return slas[priority] || 4 * 60 * 60 * 1000;
}
```

## Task History & Audit

Every task maintains a complete history:

```typescript
interface TaskHistoryEntry {
  id: string;
  taskId: string;
  action: string; // 'created', 'assigned', 'claimed', 'completed', 'escalated', etc.
  actorType: 'user' | 'system' | 'workflow';
  actorId: string;
  actorName?: string;
  details: Record<string, any>;
  timestamp: Date;
}
```

**Example History:**

```typescript
[
  { action: 'created', actorType: 'workflow', actorId: 'wfl_123', timestamp: '2024-01-15T10:00:00Z' },
  { action: 'assigned', actorType: 'system', actorId: 'auto', details: { group: 'support-l1' }, timestamp: '2024-01-15T10:00:01Z' },
  { action: 'claimed', actorType: 'user', actorId: 'user_456', actorName: 'John Doe', timestamp: '2024-01-15T10:05:00Z' },
  { action: 'completed', actorType: 'user', actorId: 'user_456', details: { formData: { ... } }, timestamp: '2024-01-15T10:15:00Z' },
]
```

## Best Practices

### 1. Provide Clear Context

```typescript
// BAD - minimal context
context: { id: '123' }

// GOOD - rich context
context: {
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  orderNumber: 'ORD-12345',
  orderTotal: '$250.00',
  issueType: 'refund-request',
  lastOrderDate: '2024-01-01',
  customerTier: 'gold',
}
```

### 2. Use Descriptive Titles

```typescript
// BAD
title: 'Task';

// GOOD
title: 'Review Refund Request: $250.00 for Customer John Doe (Gold Tier)';
```

### 3. Set Appropriate SLAs

```typescript
// Critical customer issue
sla: timeout('15m'); // Fast response

// Internal review
sla: timeout('24h'); // More time needed
```

### 4. Link Conversations

```typescript
// Always link if there's a conversation
conversationId: conversationId,

// This gives reviewers full context
```

### 5. Use Form Validation

```typescript
form: {
  email: {
    type: 'text',
    required: true,
    validation: {
      pattern: '^[^@]+@[^@]+\.[^@]+$',  // Email regex
    },
  },
  amount: {
    type: 'number',
    required: true,
    validation: {
      min: 0,
      max: 1000000,
    },
  },
}
```

## Next Steps

- [SLA & Escalation](./sla-escalation.md) - Understanding escalation chains
- [Form Schemas Guide](../guides/form-schemas.md) - Advanced form configurations
- [Assignment Strategies Guide](../guides/assignment-strategies.md) - Group routing
