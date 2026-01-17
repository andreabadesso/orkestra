# Approval Workflow Example

A common pattern in business operations: multi-level approval workflows with automatic routing and escalation.

## Use Case

When a request requires approval from multiple stakeholders, Orkestra can orchestrate the process:

- Manager reviews and approves/rejects
- If approved, route to finance for budget check
- Finance approves/rejects or requests more information
- All parties are notified of the final decision

## Workflow Definition

```typescript
import { workflow, task, timeout } from '@orkestra/sdk';

export const approvalWorkflow = workflow('approval-workflow', async (ctx, input) => {
  const { requestId, type, amount, requesterId, description } = input;

  // Step 1: Manager approval
  const managerResult = await task(ctx, {
    title: 'Manager Approval Required',
    description: `Review ${type} request for ${amount}`,
    form: {
      decision: {
        type: 'select',
        label: 'Decision',
        options: [
          { value: 'approve', label: 'Approve' },
          { value: 'reject', label: 'Reject' },
          { value: 'request-info', label: 'Request More Information' },
        ],
        required: true,
      },
      comments: {
        type: 'textarea',
        label: 'Comments',
        required: true,
      },
    },
    assignTo: { group: getManagerGroup(requesterId) },
    context: {
      requestId,
      requesterId,
      type,
      amount,
      description,
    },
    conversationId: requestId,
    sla: timeout('2d'),
  });

  // Check manager decision
  if (managerResult.data.decision === 'reject') {
    await notifyRequester(ctx, {
      status: 'rejected',
      reason: managerResult.data.comments,
    });
    return { status: 'rejected', stage: 'manager' };
  }

  if (managerResult.data.decision === 'request-info') {
    await notifyRequester(ctx, {
      status: 'info-requested',
      message: managerResult.data.comments,
    });

    // Wait for requester response
    const response = await task(ctx, {
      title: 'Provide Additional Information',
      form: {
        info: { type: 'textarea', label: 'Additional Information', required: true },
      },
      assignTo: { userId: requesterId },
      context: { requestId },
      conversationId: requestId,
      sla: timeout('3d'),
    });

    // Loop back to manager
    return approvalWorkflow(ctx, {
      ...input,
      description: `${description}\n\nAdditional Info: ${response.data.info}`,
    });
  }

  // Step 2: Finance review for amounts > $10,000
  if (amount > 10000) {
    const financeResult = await task(ctx, {
      title: 'Finance Review Required',
      description: `Budget review for ${type} request`,
      form: {
        decision: {
          type: 'select',
          label: 'Decision',
          options: [
            { value: 'approve', label: 'Approve' },
            { value: 'reject', label: 'Reject' },
            { value: 'escalate', label: 'Escalate to CFO' },
          ],
          required: true,
        },
        budgetCode: {
          type: 'text',
          label: 'Budget Code',
          required: true,
          helpText: 'Enter the budget code to charge',
        },
        comments: {
          type: 'textarea',
          label: 'Comments',
        },
      },
      assignTo: { group: 'finance-team' },
      context: {
        requestId,
        type,
        amount,
        managerComments: managerResult.data.comments,
      },
      conversationId: requestId,
      sla: timeout('3d'),
    });

    if (financeResult.data.decision === 'reject') {
      await notifyRequester(ctx, {
        status: 'rejected',
        reason: financeResult.data.comments,
      });
      return { status: 'rejected', stage: 'finance', budgetCode: financeResult.data.budgetCode };
    }

    if (financeResult.data.decision === 'escalate') {
      const cfoResult = await task(ctx, {
        title: 'CFO Approval Required',
        description: `High-value ${type} request needs CFO approval`,
        form: {
          decision: {
            type: 'select',
            label: 'Decision',
            options: [
              { value: 'approve', label: 'Approve' },
              { value: 'reject', label: 'Reject' },
            ],
            required: true,
          },
          comments: { type: 'textarea', label: 'Comments' },
        },
        assignTo: { userId: getCFOId() },
        context: { requestId, amount, type },
        conversationId: requestId,
        sla: timeout('1d'),
        priority: 'urgent',
      });

      if (cfoResult.data.decision === 'reject') {
        await notifyRequester(ctx, {
          status: 'rejected',
          reason: cfoResult.data.comments,
        });
        return { status: 'rejected', stage: 'cfo' };
      }

      // CFO approved, proceed
    }

    return {
      status: 'approved',
      stage: 'finance',
      budgetCode: financeResult.data.budgetCode,
      managerComments: managerResult.data.comments,
    };
  }

  // Manager approved for small amounts
  return {
    status: 'approved',
    stage: 'manager',
    managerComments: managerResult.data.comments,
  };
});
```

## Features Demonstrated

### Conditional Routing

```typescript
if (managerResult.data.decision === 'reject') {
  // Handle rejection
}

if (amount > 10000) {
  // Route to finance
}
```

### Loop Back Pattern

```typescript
if (managerResult.data.decision === 'request-info') {
  const response = await task(ctx, {
    /* requester task */
  });

  // Re-execute workflow with updated info
  return approvalWorkflow(ctx, {
    /* updated input */
  });
}
```

### Multi-Stage Approval

1. Manager review (always required)
2. Finance review (if amount > $10,000)
3. CFO review (if finance escalates)

### SLA Enforcement

Each stage has its own SLA:

- Manager: 2 days
- Finance: 3 days
- CFO: 1 day (urgent priority)

## Task Context

Each task receives relevant context:

```typescript
context: {
  requestId,
  requesterId,
  type,
  amount,
  description,
  // Previous stage decisions
  managerComments: managerResult.data.comments,
}
```

## Notifications

The workflow notifies the requester at key stages:

```typescript
async function notifyRequester(ctx, notification) {
  // Send notification via your preferred channel
  // Email, Slack, SMS, etc.
}
```

## Extensions

### Add Parallel Reviews

```typescript
const [legal, security, compliance] = await Promise.all([
  task(ctx, {
    /* legal review */
  }),
  task(ctx, {
    /* security review */
  }),
  task(ctx, {
    /* compliance review */
  }),
]);
```

### Add Approval History Tracking

```typescript
const approvals = [];

approvals.push({
  approver: managerResult.completedBy,
  stage: 'manager',
  decision: managerResult.data.decision,
  comments: managerResult.data.comments,
  timestamp: Date.now(),
});

if (financeResult) {
  approvals.push({
    approver: financeResult.completedBy,
    stage: 'finance',
    decision: financeResult.data.decision,
    budgetCode: financeResult.data.budgetCode,
    timestamp: Date.now(),
  });
}
```

### Add Delegation

```typescript
const delegatedTo = await task(ctx, {
  title: 'Delegate Approval',
  form: {
    delegateTo: {
      type: 'select',
      label: 'Delegate to',
      options: getAvailableDelegates(ctx, managerResult.completedBy),
    },
  },
  assignTo: { userId: managerResult.completedBy },
});

// Create task for delegate
const delegateResult = await task(ctx, {
  /* same task, assigned to delegateTo */
});
```

## Use Cases

- Purchase requisitions
- Expense reimbursements
- Time-off requests
- Budget allocations
- Contract reviews
- Project approvals
- Resource requests

## Best Practices

1. **Clear decision options**: Use select/radio buttons for structured decisions
2. **Require comments**: Always ask for reasoning on rejections
3. **Tiered SLAs**: Urgent decisions get shorter SLAs
4. **Rich context**: Include all relevant information in each task
5. **Conversation tracking**: Use `conversationId` to maintain history
6. **Escalation paths**: Always have a way to escalate if needed
