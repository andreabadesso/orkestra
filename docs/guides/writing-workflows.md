# Writing Workflows

This guide covers how to write effective workflows using Orkestra's SDK. Workflows are the core building blocks that define your business processes with human-in-the-loop capabilities.

## Table of Contents

- [Basic Workflow Structure](#basic-workflow-structure)
- [Workflow Context](#workflow-context)
- [Creating Human Tasks](#creating-human-tasks)
- [Working with Signals](#working-with-signals)
- [Error Handling](#error-handling)
- [Advanced Patterns](#advanced-patterns)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Basic Workflow Structure

A workflow is defined using the `workflow()` helper. It receives a name and a handler function that implements the business logic.

### Simple Example

```typescript
import { workflow } from '@orkestra/sdk';

export const reviewDocument = workflow(
  'document-review',
  async (ctx, input: { documentId: string }) => {
    ctx.log.info('Starting document review', { documentId: input.documentId });

    // Your workflow logic here

    return { status: 'completed' };
  }
);
```

### Input and Output Types

Workflows are fully typed with TypeScript:

```typescript
import { workflow } from '@orkestra/sdk';

interface ReviewInput {
  documentId: string;
  reviewerId?: string;
  priority?: 'low' | 'medium' | 'high';
}

interface ReviewOutput {
  approved: boolean;
  comments?: string;
  reviewedBy: string;
  reviewedAt: Date;
}

export const reviewWorkflow = workflow<ReviewInput, ReviewOutput>(
  'document-review',
  async (ctx, input) => {
    // Workflow implementation
    return {
      approved: true,
      reviewedBy: 'usr_123',
      reviewedAt: new Date(),
    };
  }
);
```

---

## Workflow Context

Every workflow receives a `WorkflowContext` object that provides:

| Method/Property | Description                                  |
| --------------- | -------------------------------------------- |
| `tenantId`      | Current tenant ID (for multi-tenancy)        |
| `workflowId`    | Unique workflow instance ID                  |
| `runId`         | Temporal run ID                              |
| `log`           | Structured logger (debug, info, warn, error) |
| `time`          | Time utilities (now, sleep, until)           |

### Logging

```typescript
export const myWorkflow = workflow('my-workflow', async (ctx, input) => {
  ctx.log.debug('Detailed debug info', { details: input });
  ctx.log.info('Important event', { eventId: '123' });
  ctx.log.warn('Warning condition', { threshold: 0.9 });
  ctx.log.error('Error occurred', { error: 'something failed' });
});
```

### Time Operations

```typescript
import { workflow } from '@orkestra/sdk';

export const timedWorkflow = workflow('timed', async (ctx) => {
  const now = ctx.time.now();
  ctx.log.info('Current time', { now });

  // Sleep for 1 minute
  await ctx.time.sleep('1m');

  // Wait until a specific time
  await ctx.time.until(new Date('2024-12-31T23:59:59Z'));
});
```

---

## Creating Human Tasks

The `task()` function creates human tasks within workflows.

### Basic Task

```typescript
import { task } from '@orkestra/sdk';

export const approvalWorkflow = workflow('approval', async (ctx) => {
  const result = await task(ctx, {
    title: 'Review Request',
    form: {
      approved: { type: 'boolean', required: true },
      comments: { type: 'textarea' },
    },
    assignTo: { group: 'approvers' },
  });

  return { approved: result.data.approved };
});
```

### Task with SLA

```typescript
import { task, timeout } from '@orkestra/sdk';

export const urgentTaskWorkflow = workflow('urgent-task', async (ctx) => {
  const result = await task(ctx, {
    title: 'Urgent Review Required',
    description: 'Please review this as soon as possible',
    form: {
      decision: {
        type: 'select',
        required: true,
        options: [
          { value: 'approve', label: 'Approve' },
          { value: 'reject', label: 'Reject' },
        ],
      },
    },
    assignTo: { group: 'reviewers' },
    sla: {
      deadline: '30m',
      onBreach: 'escalate',
      escalateTo: { group: 'managers' },
    },
  });

  return result.data;
});
```

### Task with Context

```typescript
export const contextualTask = workflow('contextual-task', async (ctx) => {
  const result = await task(ctx, {
    title: 'Process Refund',
    form: {
      approve: { type: 'boolean', required: true },
      reason: { type: 'textarea' },
    },
    assignTo: { group: 'finance' },
    context: {
      orderId: 'ord_123',
      customerName: 'John Doe',
      refundAmount: 150.0,
      orderDate: '2024-01-15',
    },
  });

  return result.data;
});
```

### Multiple Tasks

```typescript
import { allTasks } from '@orkestra/sdk';

export const parallelReview = workflow('parallel-review', async (ctx) => {
  const results = await allTasks(ctx, {
    tasks: [
      {
        title: 'Legal Review',
        form: { approved: { type: 'boolean' } },
        assignTo: { group: 'legal' },
      },
      {
        title: 'Finance Review',
        form: { approved: { type: 'boolean' } },
        assignTo: { group: 'finance' },
      },
    ],
  });

  const legalApproved = results[0].data.approved;
  const financeApproved = results[1].data.approved;

  return { legalApproved, financeApproved };
});
```

---

## Working with Signals

Signals allow external systems to communicate with running workflows.

### Setting Up Signal Handlers

```typescript
import { workflow, signals } from '@orkestra/sdk';

// Define a signal type
const cancelSignal = signals.custom('cancel');

export const cancellableWorkflow = workflow('cancellable', async (ctx) => {
  let shouldContinue = true;

  // Set up signal handler
  ctx.time.setHandler(cancelSignal, (reason) => {
    ctx.log.info('Cancellation requested', { reason });
    shouldContinue = false;
  });

  // Do work, checking for cancellation
  while (shouldContinue) {
    await ctx.time.sleep('5s');

    if (!shouldContinue) {
      throw new Error('Workflow cancelled by signal');
    }
  }
});
```

### Waiting for Multiple Signals

```typescript
import { workflow, signals, waitForAnySignal } from '@orkestra/sdk';

const approveSignal = signals.custom('approve');
const rejectSignal = signals.custom('reject');

export const approvalWorkflow = workflow('signal-approval', async (ctx) => {
  const result = await waitForAnySignal(ctx, [approveSignal, rejectSignal]);

  if (result.signal === approveSignal) {
    return { approved: true, data: result.data };
  } else {
    return { approved: false, data: result.data };
  }
});
```

---

## Error Handling

Workflows should handle errors gracefully using Temporal's error handling capabilities.

### Retry Pattern

```typescript
import { workflow, retry } from '@orkestra/sdk';

export const resilientWorkflow = workflow('resilient', async (ctx) => {
  const result = await retry(
    async () => {
      // Operation that might fail
      return await riskyExternalAPI();
    },
    {
      maxAttempts: 3,
      initialDelay: '1s',
      maxDelay: '30s',
      backoffFactor: 2,
    }
  );

  return result;
});
```

### Try-Catch with Application Failure

```typescript
import { workflow } from '@temporalio/workflow';

export const errorHandlingWorkflow = workflow('error-handling', async (ctx) => {
  try {
    const result = await someOperation();

    if (!result.success) {
      // Throw a non-retryable error
      throw new ApplicationFailure('Operation failed', 'BUSINESS_ERROR', false);
    }

    return result;
  } catch (error) {
    ctx.log.error('Workflow failed', { error });

    if (error instanceof ApplicationFailure) {
      // Handle specific error types
      throw error;
    }

    // Re-throw unknown errors
    throw new ApplicationFailure('Unexpected error', 'UNKNOWN_ERROR', true, [error]);
  }
});
```

---

## Advanced Patterns

### AI-First with Human Fallback

```typescript
import { workflow, task, taskWithEscalation, escalationChain } from '@orkestra/sdk';

export const aiHybridWorkflow = workflow('ai-hybrid', async (ctx, input) => {
  const { question, conversationId, customerTier } = input;

  // Try AI first
  const aiResponse = await tryAIResponse(question);

  if (aiResponse.confidence > 0.8) {
    // AI handled it successfully
    return { response: aiResponse.answer, resolvedBy: 'ai' };
  }

  // Escalate to human with tier-based SLA
  const slaMinutes = customerTier === 'enterprise' ? 10 : 30;

  const humanResult = await taskWithEscalation(ctx, {
    title: 'Customer Question',
    description: question,
    form: {
      answer: { type: 'textarea', required: true },
    },
    assignTo: { group: 'support' },
    context: { aiConfidence: aiResponse.confidence },
    escalation: escalationChain()
      .notifyAfter(`${Math.floor(slaMinutes * 0.5)}m`)
      .escalateAfter(`${slaMinutes}m`, { group: 'support-l2' })
      .build(),
  });

  return { response: humanResult.data.answer, resolvedBy: 'human' };
});
```

### Conditional Workflow Paths

```typescript
export const conditionalWorkflow = workflow('conditional', async (ctx, input) => {
  const { amount, requiresApproval } = input;

  if (requiresApproval && amount > 1000) {
    const result = await task(ctx, {
      title: 'Manager Approval Required',
      form: { approved: { type: 'boolean', required: true } },
      assignTo: { group: 'managers' },
    });

    if (!result.data.approved) {
      return { status: 'rejected', reason: 'Manager denied' };
    }
  }

  // Process the request
  return { status: 'approved' };
});
```

### State Management

```typescript
import { workflow, createState } from '@orkestra/sdk';

export const statefulWorkflow = workflow('stateful', async (ctx) => {
  const state = createState({
    step: 0,
    data: {} as Record<string, unknown>,
  });

  // Step 1
  state.set({ step: 1, data: { name: 'value' } });
  await processStep1();

  // Step 2
  state.update((current) => ({
    ...current,
    step: 2,
    data: { ...current.data, field: 'new-value' },
  }));
  await processStep2();

  // State is queryable via getState query
  return { status: 'completed', finalState: state.get() };
});
```

---

## Best Practices

### 1. Use Descriptive Names

```typescript
// Good
export const customerSupportWorkflow = workflow('customer-support', ...);

// Bad
export const wf1 = workflow('wf1', ...);
```

### 2. Define Types Explicitly

```typescript
interface MyWorkflowInput {
  userId: string;
  amount: number;
  reason: string;
}

interface MyWorkflowOutput {
  approved: boolean;
  referenceId: string;
}

export const myWorkflow = workflow<MyWorkflowInput, MyWorkflowOutput>(...);
```

### 3. Log Important Events

```typescript
export const myWorkflow = workflow('logging-example', async (ctx, input) => {
  ctx.log.info('Workflow started', { workflowId: ctx.workflowId, input });

  try {
    const result = await doSomething();
    ctx.log.info('Step completed', { result });
    return result;
  } catch (error) {
    ctx.log.error('Step failed', { error });
    throw error;
  }
});
```

### 4. Use SLAs Wisely

```typescript
// Good: Tier-based SLA
const slaMinutes = customerTier === 'enterprise' ? 10 : 60;

// Bad: Hardcoded SLA
const sla = '30m'; // Doesn't account for customer value
```

### 5. Handle Escalation Gracefully

```typescript
export const workflowWithEscalation = workflow('escalation', async (ctx) => {
  const result = await taskWithEscalation(ctx, {
    // ... task config
    escalation: escalationChain()
      .notifyAfter('15m', 'Please review soon')
      .escalateAfter('30m', { group: 'support-l2' })
      .build(),
  });

  // Check escalation status in result if needed
  ctx.log.info('Task completed', {
    taskId: result.taskId,
    completedBy: result.completedBy,
  });
});
```

### 6. Keep Workflows Focused

```typescript
// Good: Single responsibility
export const documentApproval = workflow('document-approval', async (ctx) => {
  const result = await task(ctx, {
    /* ... */
  });
  return result;
});

// Bad: Doing too much
export const documentApproval = workflow('document-approval', async (ctx) => {
  // Upload file
  // Process file
  // Generate thumbnails
  // Send email
  // Create task
  // Wait for approval
  // Update database
  // Send notification
  // Archive file
  // ... too many responsibilities
});
```

---

## Troubleshooting

### Workflow Not Starting

**Symptoms**: Workflow call doesn't execute

**Solutions**:

1. Check if Temporal server is running: `docker compose ps temporal`
2. Verify worker is registered with your workflow
3. Check worker logs for registration errors
4. Ensure workflow name matches registration

```bash
# Check Temporal server status
docker compose logs temporal

# Restart worker
nix develop --command pnpm --filter my-app dev
```

### Task Never Completes

**Symptoms**: Task created but remains in pending state

**Solutions**:

1. Verify task assignment target exists
2. Check Dashboard for tasks
3. Verify users are in correct groups
4. Check notification channels are configured

```typescript
// Debug: Add logging
ctx.log.info('Creating task', {
  title: options.title,
  assignTo: options.assignTo,
  group: options.assignTo.group,
});
```

### SLA Not Triggering

**Symptoms**: Task exceeds SLA but no escalation

**Solutions**:

1. Verify `sla.deadline` is correct format
2. Check `onBreach` action is configured
3. Verify notification service is enabled
4. Check Temporal worker is processing timers

```typescript
// Debug: Check SLA configuration
ctx.log.info('Task SLA config', {
  sla: options.sla,
  deadlineMs: parseDuration(options.sla.deadline),
});
```

### Workflow Fails with Timeout

**Symptoms**: Workflow errors after time limit

**Solutions**:

1. Increase Temporal workflow timeout
2. Break workflow into smaller steps
3. Use `retry()` for flaky operations
4. Check if external APIs are slow

```typescript
// Temporal worker configuration
const worker = await Worker.create({
  connection,
  taskQueue: 'my-task-queue',
  workflowsPath: './dist/workflows',
  workflowDefaults: {
    executionTimeout: '1h', // Increase as needed
  },
});
```

### Context Not Showing in Dashboard

**Symptoms**: Task context fields not displayed

**Solutions**:

1. Verify `context` object is serializable
2. Check context values are not too large
3. Ensure context is passed to `task()` call
4. Refresh Dashboard to clear cache

```typescript
// Good: Serializable context
context: {
  orderId: 'ord_123',
  customerName: 'John Doe',
  amount: 100.00,
}

// Bad: Non-serializable or circular
context: {
  order: myOrderObject, // Could have circular references
  function: () => {}, // Functions not serializable
  date: new Date(),   // Use string instead
}
```

### Signal Not Received

**Symptoms**: Workflow doesn't respond to signals

**Solutions**:

1. Verify signal handler is set up before waiting
2. Check signal name matches exactly
3. Ensure signal is sent to correct workflow run
4. Use workflow query to check state

```typescript
// Verify signal handler
const mySignal = signals.custom('my-signal');
ctx.time.setHandler(mySignal, (data) => {
  console.log('Signal received:', data);
});

// Test by sending signal
await temporalClient.workflow.signal(workflowId, 'my-signal', { test: true });
```

---

## Resources

- [SDK API Reference](../api-reference/sdk-reference.md)
- [Form Schemas](./form-schemas.md)
- [Assignment Strategies](./assignment-strategies.md)
- [Example: Support Bot](../examples/support-bot.md)
