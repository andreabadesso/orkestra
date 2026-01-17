# Task 07: SDK Workflow Helpers

## Overview

Create the `@orkestra/sdk` package with developer-friendly workflow helpers and patterns.

## Phase

🟢 **Phase 2: Core Engine**

## Priority

🟡 **High** - Enables workflow development

## Estimated Effort

6-8 hours

## Description

The SDK package provides an opinionated, ergonomic API for writing Temporal workflows with Orkestra patterns built-in: human tasks, escalation, timeouts, and more.

## Requirements

### Package Structure

```
packages/sdk/
├── src/
│   ├── index.ts
│   ├── workflow.ts           # Workflow definition helpers
│   ├── task.ts               # Human task creation
│   ├── escalation.ts         # Escalation patterns
│   ├── timeout.ts            # Timeout utilities
│   ├── context.ts            # Workflow context
│   ├── signals.ts            # Signal handlers
│   └── activities/
│       ├── index.ts
│       ├── task-activities.ts
│       └── notification-activities.ts
├── package.json
└── tsconfig.json
```

### Workflow Definition Helper

```typescript
// workflow.ts
import {
  defineWorkflow,
  WorkflowContext,
} from '@orkestra/sdk';

export interface WorkflowDefinition<TInput, TOutput> {
  name: string;
  handler: (ctx: WorkflowContext, input: TInput) => Promise<TOutput>;
}

export function workflow<TInput, TOutput>(
  name: string,
  handler: (ctx: WorkflowContext, input: TInput) => Promise<TOutput>
): WorkflowDefinition<TInput, TOutput> {
  return {
    name,
    handler,
  };
}

// Usage example:
export const supportEscalation = workflow(
  'support-escalation',
  async (ctx, input: { question: string; conversationId: string }) => {
    // Workflow logic here
  }
);
```

### Workflow Context

```typescript
// context.ts
export interface WorkflowContext {
  // Tenant information
  tenantId: string;

  // Workflow metadata
  workflowId: string;
  runId: string;

  // Logging (mapped to Temporal logger)
  log: Logger;

  // Current time (Temporal deterministic)
  now(): Date;

  // Sleep (Temporal timer)
  sleep(duration: Duration): Promise<void>;
}

export type Duration = string | number; // '10m', '1h', '1d' or milliseconds
```

### Human Task Helper

```typescript
// task.ts
import { WorkflowContext } from './context';

export interface TaskOptions {
  title: string;
  description?: string;
  form: FormSchema;
  assignTo: AssignmentTarget;
  context?: Record<string, unknown>;
  conversationId?: string;
  sla?: SLAOptions;
}

export interface FormSchema {
  [fieldName: string]: FormField;
}

export interface FormField {
  type: 'text' | 'textarea' | 'boolean' | 'select' | 'number' | 'date';
  label?: string;
  required?: boolean;
  default?: unknown;
  options?: Array<{ value: string; label: string }>;
}

export interface AssignmentTarget {
  user?: string;   // User ID
  group?: string;  // Group slug or ID
}

export interface SLAOptions {
  deadline: Duration;
  onBreach?: 'escalate' | 'notify' | 'cancel';
  escalateTo?: AssignmentTarget;
}

export interface TaskResult<T = Record<string, unknown>> {
  taskId: string;
  data: T;
  completedBy: string;
  completedAt: Date;
}

/**
 * Create a human task and wait for completion
 */
export async function task<T extends Record<string, unknown>>(
  ctx: WorkflowContext,
  options: TaskOptions
): Promise<TaskResult<T>> {
  // 1. Create task via activity
  const taskId = await activities.createTask({
    workflowId: ctx.workflowId,
    runId: ctx.runId,
    tenantId: ctx.tenantId,
    ...options,
  });

  // 2. Wait for completion signal (or timeout)
  const result = await waitForTaskCompletion<T>(ctx, taskId, options.sla);

  return result;
}

// Internal: wait for signal with timeout
async function waitForTaskCompletion<T>(
  ctx: WorkflowContext,
  taskId: string,
  sla?: SLAOptions
): Promise<TaskResult<T>> {
  const signalPromise = ctx.waitForSignal<TaskResult<T>>('taskCompleted', {
    filter: (data) => data.taskId === taskId,
  });

  if (!sla) {
    return signalPromise;
  }

  // Race between completion and deadline
  const deadlineMs = parseDuration(sla.deadline);
  const result = await Promise.race([
    signalPromise,
    ctx.sleep(deadlineMs).then(() => null),
  ]);

  if (result === null) {
    // SLA breached
    await handleSLABreach(ctx, taskId, sla);
    // Continue waiting after escalation
    return signalPromise;
  }

  return result;
}
```

### Escalation Pattern

```typescript
// escalation.ts
export interface EscalationChain {
  steps: EscalationStep[];
}

export interface EscalationStep {
  after: Duration;
  action: 'reassign' | 'notify' | 'escalate';
  target?: AssignmentTarget;
  message?: string;
}

/**
 * Create a task with automatic escalation chain
 */
export async function taskWithEscalation<T extends Record<string, unknown>>(
  ctx: WorkflowContext,
  options: TaskOptions & { escalation: EscalationChain }
): Promise<TaskResult<T>> {
  const { escalation, ...taskOptions } = options;

  // Create initial task
  const taskId = await activities.createTask({
    workflowId: ctx.workflowId,
    runId: ctx.runId,
    tenantId: ctx.tenantId,
    ...taskOptions,
  });

  // Start escalation timer workflow
  const completionPromise = ctx.waitForSignal<TaskResult<T>>('taskCompleted', {
    filter: (data) => data.taskId === taskId,
  });

  // Process escalation steps
  for (const step of escalation.steps) {
    const result = await Promise.race([
      completionPromise,
      ctx.sleep(parseDuration(step.after)).then(() => 'timeout' as const),
    ]);

    if (result !== 'timeout') {
      return result; // Task completed
    }

    // Execute escalation step
    await executeEscalationStep(ctx, taskId, step);
  }

  // Wait indefinitely after all escalations
  return completionPromise;
}

async function executeEscalationStep(
  ctx: WorkflowContext,
  taskId: string,
  step: EscalationStep
): Promise<void> {
  switch (step.action) {
    case 'reassign':
      await activities.reassignTask(taskId, step.target!);
      break;
    case 'notify':
      await activities.notifyTaskUrgent(taskId, step.message);
      break;
    case 'escalate':
      await activities.escalateTask(taskId, step.target);
      break;
  }
}
```

### Timeout Utility

```typescript
// timeout.ts
export function timeout(
  duration: Duration,
  handler: () => Promise<void> | void
): SLAOptions {
  return {
    deadline: duration,
    onBreach: 'escalate',
  };
}

// Convenience function for creating deadline-based SLAs
export function deadline(
  date: Date,
  handler?: () => Promise<void> | void
): SLAOptions {
  const now = new Date();
  const ms = date.getTime() - now.getTime();
  if (ms <= 0) {
    throw new Error('Deadline must be in the future');
  }
  return {
    deadline: ms,
    onBreach: handler ? 'escalate' : 'notify',
  };
}
```

### Complete Example Workflow

```typescript
// Example: Customer support escalation workflow
import { workflow, task, timeout, escalate } from '@orkestra/sdk';

interface SupportInput {
  question: string;
  conversationId: string;
  customerTier: 'basic' | 'premium' | 'enterprise';
}

interface SupportOutput {
  answer: string;
  resolvedBy: 'ai' | 'human';
  handledBy?: string;
}

export const customerSupport = workflow<SupportInput, SupportOutput>(
  'customer-support',
  async (ctx, input) => {
    const { question, conversationId, customerTier } = input;

    // Determine SLA based on customer tier
    const slaMinutes = {
      basic: 60,
      premium: 30,
      enterprise: 10,
    }[customerTier];

    // Create human task
    const result = await task<{ answer: string; needsFollowup: boolean }>(ctx, {
      title: 'Customer Question',
      description: `Customer asked: ${question}`,
      form: {
        answer: {
          type: 'textarea',
          label: 'Your response',
          required: true,
        },
        needsFollowup: {
          type: 'boolean',
          label: 'Requires follow-up?',
          default: false,
        },
      },
      assignTo: { group: 'support-l1' },
      context: { conversationId, customerTier },
      conversationId,
      sla: timeout(`${slaMinutes}m`, () =>
        escalate({ group: 'support-l2' })
      ),
    });

    return {
      answer: result.data.answer,
      resolvedBy: 'human',
      handledBy: result.completedBy,
    };
  }
);
```

## Acceptance Criteria

- [ ] `workflow()` helper creates valid workflow definitions
- [ ] `task()` creates tasks and waits for completion
- [ ] `taskWithEscalation()` handles escalation chains
- [ ] `timeout()` utility works correctly
- [ ] WorkflowContext provides all needed utilities
- [ ] Activities are properly defined and callable
- [ ] Duration parsing works for all formats
- [ ] Types are fully documented with JSDoc
- [ ] Example workflows compile and run
- [ ] Unit tests for helpers
- [ ] Integration test with Temporal

## Dependencies

- [[01 - Initialize Monorepo]]
- [[03 - Core Package Setup]]
- [[04 - Temporal Integration]]
- [[06 - Task Manager]]

## Blocked By

- [[04 - Temporal Integration]]
- [[06 - Task Manager]]

## Blocks

- [[17 - Example Project]]
- [[18 - Workflow Agent]]

## Technical Notes

### Temporal Workflow Constraints

Remember that Temporal workflows must be deterministic:
- No direct I/O (use activities)
- No random numbers (use Temporal's random)
- No current time (use `ctx.now()`)
- No external network calls

### Activity Definitions

Activities for the SDK should be defined in `@orkestra/core` and imported here:

```typescript
import { proxyActivities } from '@temporalio/workflow';
import type * as taskActivities from '@orkestra/core/activities/task';

const activities = proxyActivities<typeof taskActivities>({
  startToCloseTimeout: '1 minute',
});
```

### Re-exporting from Core

The SDK should re-export commonly used types from core:

```typescript
// index.ts
export { workflow, task, taskWithEscalation } from './workflow';
export { timeout, deadline } from './timeout';
export type {
  FormSchema,
  FormField,
  AssignmentTarget,
  TaskResult,
} from './task';
```

## References

- [Temporal Workflow API](https://docs.temporal.io/dev-guide/typescript/foundations#develop-workflows)
- [Temporal Signals](https://docs.temporal.io/workflows#signal)

## Tags

#orkestra #task #sdk #workflows #developer-experience
