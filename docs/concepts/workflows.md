# Workflows

Workflows are the core building block of Orkestra. They define business processes that can involve both automated steps and human tasks.

## What is a Workflow?

A workflow is a durable, long-running process that:

- Survives process restarts and crashes
- Can wait indefinitely for human input
- Maintains state across steps
- Handles timeouts and escalation automatically
- Is fully auditable

## Workflow Lifecycle

```
    start
      |
      v
+----------+
| PENDING  |
+----------+
      |
      v
+----------+     +-----------+
| RUNNING  | --> |   PAUSED  | (waiting for signal)
+----------+     +-----------+
      |               |
      +-------+-------+
              |
      +-------+-------+
      |               |
      v               v
+-----------+   +-----------+
| COMPLETED |   |  FAILED   |
+-----------+   +-----------+
      |               |
      +-------+-------+
              |
              v
         +-----------+
         | CANCELLED |
         +-----------+
```

## Defining a Workflow

### Basic Structure

```typescript
import { workflow } from '@orkestra/sdk';

interface MyInput {
  data: string;
}

interface MyOutput {
  result: string;
}

export const myWorkflow = workflow<MyInput, MyOutput>(
  'my-workflow',           // Unique workflow name
  async (ctx, input) => {  // Handler function
    ctx.log.info('Starting workflow', { data: input.data });

    // ... workflow logic ...

    return { result: 'done' };
  }
);
```

### The Workflow Context

The `ctx` parameter provides:

```typescript
interface WorkflowContext {
  // Identifiers
  tenantId: string;      // Current tenant
  workflowId: string;    // Temporal workflow ID
  runId: string;         // Temporal run ID

  // Logging
  log: {
    debug(msg: string, attrs?: object): void;
    info(msg: string, attrs?: object): void;
    warn(msg: string, attrs?: object): void;
    error(msg: string, attrs?: object): void;
  };

  // Time utilities
  now(): Date;
  sleep(duration: Duration): Promise<void>;
}
```

## Workflow Patterns

### Sequential Tasks

Tasks execute one after another:

```typescript
export const sequentialWorkflow = workflow('sequential', async (ctx, input) => {
  // First task
  const step1 = await task(ctx, {
    title: 'Step 1: Review',
    form: { approved: { type: 'boolean', required: true } },
    assignTo: { group: 'reviewers' },
  });

  if (!step1.data.approved) {
    return { status: 'rejected', step: 1 };
  }

  // Second task (only if first approved)
  const step2 = await task(ctx, {
    title: 'Step 2: Final Approval',
    form: { approved: { type: 'boolean', required: true } },
    assignTo: { group: 'managers' },
  });

  return { status: step2.data.approved ? 'approved' : 'rejected' };
});
```

### Parallel Tasks

Multiple tasks execute simultaneously:

```typescript
import { allTasks } from '@orkestra/sdk';

export const parallelWorkflow = workflow('parallel', async (ctx, input) => {
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
      {
        title: 'Technical Review',
        form: { approved: { type: 'boolean' } },
        assignTo: { group: 'engineering' },
      },
    ],
    sla: timeout('2h'),
  });

  const allApproved = results.every(r => r.data.approved);
  return { approved: allApproved };
});
```

### Race Condition (First Wins)

First task to complete wins:

```typescript
import { anyTask } from '@orkestra/sdk';

export const raceWorkflow = workflow('race', async (ctx, input) => {
  // Any approver can approve
  const result = await anyTask(ctx, {
    tasks: [
      { title: 'Approver A', form: {...}, assignTo: { user: 'user_a' } },
      { title: 'Approver B', form: {...}, assignTo: { user: 'user_b' } },
      { title: 'Approver C', form: {...}, assignTo: { user: 'user_c' } },
    ],
    cancelRemaining: true, // Cancel other tasks when one completes
  });

  return { approvedBy: result.completedBy };
});
```

### Conditional Branching

```typescript
export const conditionalWorkflow = workflow('conditional', async (ctx, input) => {
  const triage = await task(ctx, {
    title: 'Triage Request',
    form: {
      route: {
        type: 'select',
        options: [
          { value: 'billing', label: 'Billing Issue' },
          { value: 'technical', label: 'Technical Issue' },
          { value: 'sales', label: 'Sales Inquiry' },
        ],
      },
    },
    assignTo: { group: 'triage' },
  });

  // Branch based on triage result
  switch (triage.data.route) {
    case 'billing':
      return await handleBilling(ctx, input);
    case 'technical':
      return await handleTechnical(ctx, input);
    case 'sales':
      return await handleSales(ctx, input);
    default:
      throw new Error(`Unknown route: ${triage.data.route}`);
  }
});
```

### Loops and Iteration

```typescript
export const iterativeWorkflow = workflow('iterative', async (ctx, input) => {
  let approved = false;
  let attempts = 0;
  const maxAttempts = 3;

  while (!approved && attempts < maxAttempts) {
    attempts++;

    const review = await task(ctx, {
      title: `Review Attempt ${attempts}`,
      form: {
        approved: { type: 'boolean' },
        feedback: { type: 'textarea' },
      },
      assignTo: { group: 'reviewers' },
    });

    approved = review.data.approved as boolean;

    if (!approved) {
      ctx.log.info('Review rejected, requesting revisions', {
        feedback: review.data.feedback,
      });
      // Wait before next attempt
      await ctx.sleep('1h');
    }
  }

  return { approved, attempts };
});
```

## State Management

### Using createState

Track workflow state that can be queried from outside:

```typescript
import { workflow, createState, task } from '@orkestra/sdk';

export const statefulWorkflow = workflow('stateful', async (ctx, input) => {
  // Create queryable state
  const state = createState({
    currentStep: 'init',
    completedSteps: [] as string[],
    errors: [] as string[],
  });

  state.set({ ...state.get(), currentStep: 'step1' });

  const step1 = await task(ctx, {
    title: 'Step 1',
    form: {...},
    assignTo: { group: 'team' },
  });

  state.update(s => ({
    ...s,
    currentStep: 'step2',
    completedSteps: [...s.completedSteps, 'step1'],
  }));

  // ... continue ...
});
```

Query the state from outside:

```typescript
const handle = temporalClient.getWorkflowHandle(workflowId);
const state = await handle.query('getState');
console.log(state.currentStep); // 'step2'
```

## Error Handling

### Try-Catch Pattern

```typescript
export const errorHandlingWorkflow = workflow('error-handling', async (ctx, input) => {
  try {
    const result = await task(ctx, {
      title: 'Risky Operation',
      form: {...},
      assignTo: { group: 'team' },
      sla: timeout('1h', { onBreach: 'cancel' }),
    });
    return { success: true, data: result.data };
  } catch (error) {
    if (error.name === 'TASK_CANCELLED') {
      ctx.log.warn('Task was cancelled', { error: error.message });
      return { success: false, reason: 'cancelled' };
    }
    if (error.name === 'SLA_BREACH_CANCEL') {
      ctx.log.warn('SLA breached', { error: error.message });
      return { success: false, reason: 'timeout' };
    }
    throw error; // Re-throw unknown errors
  }
});
```

### Retry with Backoff

```typescript
import { retry } from '@orkestra/sdk';

export const retryWorkflow = workflow('retry', async (ctx, input) => {
  const result = await retry(
    () => riskyActivity(input),
    {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
    }
  );
  return result;
});
```

## Workflow Registration

Register workflows with a registry for the Temporal worker:

```typescript
import { createRegistry } from '@orkestra/sdk';
import { customerSupport } from './customer-support.js';
import { documentReview } from './document-review.js';
import { onboarding } from './onboarding.js';

export const registry = createRegistry()
  .register(customerSupport)
  .register(documentReview)
  .register(onboarding);

// In worker setup
const worker = await Worker.create({
  workflowsPath: require.resolve('./workflows'),
  // ...
});
```

## Timeouts and Deadlines

### Workflow-Level Timeout

```typescript
import { withTimeout } from '@orkestra/sdk';

export const timedWorkflow = workflow('timed', async (ctx, input) => {
  const result = await withTimeout(
    task(ctx, {...}),
    30 * 60 * 1000, // 30 minutes
    'Operation timed out'
  );
  return result;
});
```

### Absolute Deadline

```typescript
import { deadline } from '@orkestra/sdk';

export const deadlineWorkflow = workflow('deadline', async (ctx, input) => {
  const result = await task(ctx, {
    title: 'Complete by EOD',
    form: {...},
    assignTo: { group: 'team' },
    sla: deadline('2024-12-31T23:59:59Z'), // Absolute deadline
  });
  return result;
});
```

## Best Practices

### 1. Keep Workflows Deterministic

Workflows must be deterministic - same inputs produce same execution path:

```typescript
// BAD - non-deterministic
const random = Math.random();
if (random > 0.5) { ... }

// GOOD - use workflow-safe randomness
const random = ctx.random();
if (random > 0.5) { ... }
```

### 2. Use Activities for Side Effects

```typescript
// BAD - side effect in workflow
await fetch('https://api.example.com/notify');

// GOOD - use activity
const activities = proxyActivities<MyActivities>({...});
await activities.sendNotification();
```

### 3. Handle Signals Properly

```typescript
// Set up signal handlers before waiting
workflow.setHandler(taskCompletedSignal, (data) => {
  // Handle completion
});

// Then wait
await workflow.condition(() => taskComplete);
```

### 4. Log Meaningful Events

```typescript
ctx.log.info('Workflow checkpoint', {
  step: 'approval',
  taskId: result.taskId,
  completedBy: result.completedBy,
  duration: Date.now() - startTime,
});
```

## Next Steps

- [Tasks Concept](./tasks.md) - Deep dive into human tasks
- [Writing Workflows Guide](../guides/writing-workflows.md) - Practical patterns
- [SDK Reference](../api-reference/sdk-reference.md) - Complete API
