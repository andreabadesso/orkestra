# Your First Task

This guide covers creating and managing human tasks in Orkestra.

## What is a Task?

A Task is a unit of work that requires human input. When an AI agent encounters something it can't handle autonomously, it creates a Task and waits for a human to complete it.

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

## Creating a Task

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

When assigned to a group, the task appears in all group members' inboxes. A user must **claim** the task before completing it.

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

## Complete Example

Here's a complete example of creating a task in a workflow:

```typescript
import { workflow, task, timeout } from '@orkestra/sdk';

export const customerSupport = workflow('customer-support', async (ctx, input) => {
  const { question, conversationId, customerId } = input;

  const result = await task(ctx, {
    title: 'Customer needs help',
    description: question,
    form: {
      answer: {
        type: 'textarea',
        label: 'Your answer',
        required: true,
      },
      sentiment: {
        type: 'select',
        label: 'Customer sentiment',
        options: [
          { value: 'positive', label: 'Positive' },
          { value: 'neutral', label: 'Neutral' },
          { value: 'frustrated', label: 'Frustrated' },
        ],
      },
      priority: {
        type: 'select',
        label: 'Priority level',
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
        ],
      },
    },
    assignTo: { group: 'support-l1' },
    context: {
      customerId,
      conversationId,
    },
    conversationId,
    sla: timeout('30m'),
  });

  return {
    answer: result.data.answer,
    sentiment: result.data.sentiment,
    handledBy: result.completedBy,
  };
});
```

## Next Steps

- [Workflow Concepts](../concepts/workflows.md) - Learn about workflows
- [Form Schemas](../guides/form-schemas.md) - Advanced form configurations
- [Assignment Strategies](../guides/assignment-strategies.md) - Task assignment patterns
