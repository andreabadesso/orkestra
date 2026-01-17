# SDK Reference

The Orkestra SDK provides developer-friendly helpers for defining workflows, creating human tasks, and managing escalation chains.

## Installation

```bash
npm install @orkestra/sdk
```

## Overview

The SDK exports utilities organized into these categories:

- **Workflows**: `workflow()`, `WorkflowRegistry`, `createState()`
- **Tasks**: `task()`, `allTasks()`, `anyTask()`, `taskWithEscalation()`
- **Escalation**: `escalationChain()`, `tieredSupport()`, `approvalEscalation()`
- **Signals**: `taskCompleted`, `taskCancelled`, `waitForCondition()`
- **Timeouts**: `timeout()`, `deadline()`, `timeoutWithEscalation()`
- **Duration**: `parseDuration()`, `formatDuration()`, `addDurations()`

---

## Workflows

### `workflow()`

Define a new Orkestra workflow.

**Signature:**

```typescript
function workflow<TInput, TOutput>(
  name: string,
  handler: WorkflowHandler<TInput, TOutput>
): WorkflowDefinition<TInput, TOutput>;
```

**Parameters:**

| Name      | Type     | Required | Description                                           |
| --------- | -------- | -------- | ----------------------------------------------------- |
| `name`    | string   | Yes      | Unique workflow name (used as Temporal workflow type) |
| `handler` | function | Yes      | Async function implementing workflow logic            |

**Type Parameters:**

| Parameter | Description                  |
| --------- | ---------------------------- |
| `TInput`  | Input type for the workflow  |
| `TOutput` | Output type for the workflow |

**Returns:** `WorkflowDefinition<TInput, TOutput>`

**Example:**

```typescript
import { workflow, task, timeout } from '@orkestra/sdk';

interface SupportInput {
  question: string;
  customerId: string;
  customerTier: 'basic' | 'premium' | 'enterprise';
}

interface SupportOutput {
  answer: string;
  resolvedBy: 'ai' | 'human';
}

export const customerSupport = workflow<SupportInput, SupportOutput>(
  'customer-support',
  async (ctx, input) => {
    const { question, customerId, customerTier } = input;

    // Tier-based SLA
    const slaMinutes = {
      basic: 60,
      premium: 30,
      enterprise: 10,
    }[customerTier];

    const result = await task(ctx, {
      title: 'Customer Question',
      description: `Customer asked: ${question}`,
      form: {
        answer: { type: 'textarea', required: true },
      },
      assignTo: { group: 'support-l1' },
      context: { customerId, customerTier },
      sla: timeout(`${slaMinutes}m`),
    });

    return {
      answer: result.data.answer,
      resolvedBy: 'human',
      handledBy: result.completedBy,
    };
  }
);
```

### `WorkflowRegistry`

Registry for managing multiple workflow definitions.

**Methods:**

#### `register(definition)`

Register a workflow definition.

```typescript
register<TInput, TOutput>(
  definition: WorkflowDefinition<TInput, TOutput>
): this
```

**Parameters:**

- `definition` - The workflow definition to register

**Returns:** `this` (for chaining)

**Example:**

```typescript
import { createRegistry } from '@orkestra/sdk';
import { customerSupport, documentReview } from './workflows.js';

const registry = createRegistry().register(customerSupport).register(documentReview);
```

#### `get(name)`

Get a registered workflow by name.

```typescript
get(name: string): WorkflowDefinition<unknown, unknown> | undefined
```

#### `all()`

Get all registered workflows.

```typescript
all(): WorkflowDefinition<unknown, unknown>[]
```

#### `names()`

Get workflow names.

```typescript
names(): string[]
```

#### `has(name)`

Check if a workflow is registered.

```typescript
has(name: string): boolean
```

#### `toTemporalWorkflows()`

Export workflows as a map for Temporal worker registration.

```typescript
toTemporalWorkflows(): Record<string, (...args: unknown[]) => Promise<unknown>>
```

### `createRegistry()`

Create a new workflow registry.

```typescript
function createRegistry(): WorkflowRegistry;
```

### `createState()`

Create a workflow state container with query handler.

```typescript
function createState<T extends Record<string, unknown>>(
  initialState: T,
  queryName = 'getState'
): WorkflowState<T>;
```

**Parameters:**

| Name           | Type   | Required | Description                      |
| -------------- | ------ | -------- | -------------------------------- |
| `initialState` | object | Yes      | Initial state value              |
| `queryName`    | string | No       | Query name (default: 'getState') |

**Returns:** `WorkflowState<T>`

**State Methods:**

| Method            | Description                   |
| ----------------- | ----------------------------- |
| `get()`           | Get the current state         |
| `set(value)`      | Set a new state value         |
| `update(updater)` | Update state using a function |

**Example:**

```typescript
import { workflow, createState } from '@orkestra/sdk';

export const orderProcessing = workflow('order-processing', async (ctx, input) => {
  const state = createState({
    step: 0,
    items: [],
    total: 0,
  });

  state.set({ step: 1, items: ['item1'] });
  state.update((s) => ({ ...s, step: s.step + 1 }));

  // State is queryable from outside the workflow
  return { completed: true };
});
```

---

## Tasks

### `task()`

Create a human task and wait for completion.

```typescript
async function task<T extends Record<string, unknown> = Record<string, unknown>>(
  ctx: WorkflowContext,
  options: TaskOptions
): Promise<TaskResult<T>>;
```

**Parameters:**

| Name      | Type            | Required | Description        |
| --------- | --------------- | -------- | ------------------ |
| `ctx`     | WorkflowContext | Yes      | Workflow context   |
| `options` | TaskOptions     | Yes      | Task configuration |

**TaskOptions:**

| Property         | Type             | Required | Description                 |
| ---------------- | ---------------- | -------- | --------------------------- |
| `title`          | string           | Yes      | Task title                  |
| `type`           | string           | No       | Task type identifier        |
| `description`    | string           | No       | Task description            |
| `form`           | FormSchema       | Yes      | Form schema defining inputs |
| `assignTo`       | AssignmentTarget | Yes      | Assignment target           |
| `context`        | object           | No       | Context data                |
| `conversationId` | string           | No       | Linked conversation         |
| `sla`            | SLAOptions       | No       | SLA configuration           |
| `priority`       | TaskPriority     | No       | Task priority               |
| `metadata`       | object           | No       | Additional metadata         |

**AssignmentTarget:**

```typescript
interface AssignmentTarget {
  userId?: string; // Assign to specific user
  groupId?: string; // Assign to group (any member can claim)
}
```

**SLAOptions:**

```typescript
interface SLAOptions {
  deadline: string; // Duration (e.g., '30m', '2h')
  warnBefore?: string; // Warning duration (e.g., '15m')
  onBreach?: SLABreachAction; // Action on breach
  escalateTo?: AssignmentTarget; // Escalation target
}

type SLABreachAction = 'escalate' | 'notify' | 'cancel';
```

**TaskPriority:**

```typescript
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
```

**FormSchema:**

```typescript
interface FormSchema {
  fields: Record<string, FormField>;
  fieldOrder?: string[];
}
```

**FormField Types:**

| Type          | Description        | Example          |
| ------------- | ------------------ | ---------------- |
| `text`        | Single-line text   | Name, email      |
| `textarea`    | Multi-line text    | Response, notes  |
| `number`      | Numeric input      | Quantity, rating |
| `email`       | Email address      | User email       |
| `url`         | URL input          | Website link     |
| `date`        | Date picker        | Due date         |
| `datetime`    | Date and time      | Meeting time     |
| `time`        | Time picker        | Time slot        |
| `select`      | Single dropdown    | Category         |
| `multiselect` | Multiple dropdown  | Tags             |
| `radio`       | Radio button group | Yes/No           |
| `checkbox`    | Single checkbox    | Opt-in           |
| `file`        | File upload        | Document         |
| `json`        | JSON object        | Metadata         |

**FormField Example:**

```typescript
{
  customerSentiment: {
    type: 'select',
    label: 'Customer Sentiment',
    required: true,
    options: [
      { value: 'positive', label: 'Positive' },
      { value: 'neutral', label: 'Neutral' },
      { value: 'negative', label: 'Negative' }
    ]
  },
  notes: {
    type: 'textarea',
    label: 'Additional Notes',
    placeholder: 'Enter your notes here...'
  }
}
```

**TaskResult:**

```typescript
interface TaskResult<T> {
  taskId: string;
  data: T; // Form data submitted by user
  completedBy: string; // User ID who completed
  completedAt: Date;
}
```

**Example:**

```typescript
import { task, timeout } from '@orkestra/sdk';

const result = await task(ctx, {
  title: 'Review Document',
  description: 'Please review the attached document',
  type: 'document-review',
  form: {
    fields: {
      approved: {
        type: 'boolean',
        label: 'Do you approve?',
        required: true,
      },
      comments: {
        type: 'textarea',
        label: 'Review comments',
      },
    },
  },
  assignTo: { group: 'reviewers' },
  priority: 'high',
  sla: {
    deadline: '1h',
    warnBefore: '30m',
    onBreach: 'escalate',
    escalateTo: { group: 'managers' },
  },
});

console.log('Approved:', result.data.approved);
console.log('Comments:', result.data.comments);
console.log('Completed by:', result.completedBy);
```

### `allTasks()`

Create multiple tasks and wait for ALL to complete.

```typescript
async function allTasks<T extends Record<string, unknown> = Record<string, unknown>>(
  ctx: WorkflowContext,
  options: AllTasksOptions
): Promise<TaskResult<T>[]>;
```

**AllTasksOptions:**

```typescript
interface AllTasksOptions {
  tasks: TaskOptions[];
  sla?: SLAOptions;
}
```

**Example:**

```typescript
import { allTasks, timeout } from '@orkestra/sdk';

const results = await allTasks(ctx, {
  tasks: [
    {
      title: 'Legal Review',
      form: { fields: { approved: { type: 'boolean' } } },
      assignTo: { group: 'legal' },
    },
    {
      title: 'Finance Review',
      form: { fields: { approved: { type: 'boolean' } } },
      assignTo: { group: 'finance' },
    },
  ],
  sla: { deadline: '2h' },
});

console.log('Legal approved:', results[0].data.approved);
console.log('Finance approved:', results[1].data.approved);
```

### `anyTask()`

Create multiple tasks and wait for ANY one to complete.

```typescript
async function anyTask<T extends Record<string, unknown> = Record<string, unknown>>(
  ctx: WorkflowContext,
  options: AnyTaskOptions
): Promise<TaskResult<T>>;
```

**AnyTaskOptions:**

```typescript
interface AnyTaskOptions {
  tasks: TaskOptions[];
  sla?: SLAOptions;
  cancelRemaining?: boolean;
}
```

**Example:**

```typescript
import { anyTask } from '@orkestra/sdk';

// Get approval from any manager
const result = await anyTask(ctx, {
  tasks: [
    {
      title: 'Manager A Approval',
      form: { fields: { approved: { type: 'boolean' } } },
      assignTo: { userId: 'manager_a' },
    },
    {
      title: 'Manager B Approval',
      form: { fields: { approved: { type: 'boolean' } } },
      assignTo: { userId: 'manager_b' },
    },
  ],
  cancelRemaining: true,
});

console.log('Approved by:', result.completedBy);
```

---

## Escalation

### `taskWithEscalation()`

Create a task with automatic escalation chain.

```typescript
async function taskWithEscalation<T extends Record<string, unknown> = Record<string, unknown>>(
  ctx: WorkflowContext,
  options: TaskWithEscalationOptions
): Promise<TaskResult<T>>;
```

**TaskWithEscalationOptions:**

```typescript
interface TaskWithEscalationOptions extends TaskOptions {
  escalation: EscalationChain;
}
```

### `escalationChain()`

Builder for creating escalation chains.

```typescript
function escalationChain(): EscalationChainBuilder;
```

**EscalationChainBuilder Methods:**

#### `notifyAfter(duration, message)`

Send notification after specified duration.

```typescript
notifyAfter(duration: string, message: string): this
```

#### `escalateAfter(duration, target)`

Escalate to new target after specified duration.

```typescript
escalateAfter(duration: string, target?: AssignmentTarget): this
```

#### `escalateChain(steps)`

Set full escalation chain.

```typescript
escalateChain(steps: EscalationStep[]): this
```

**EscalationStep:**

```typescript
interface EscalationStep {
  after: string; // Duration (e.g., '15m')
  action: EscalationAction;
  target?: AssignmentTarget;
  message?: string;
}

type EscalationAction = 'notify' | 'escalate' | 'cancel';
```

#### `build()`

Build the escalation chain.

```typescript
build(): EscalationChain
```

**Example:**

```typescript
import { taskWithEscalation, escalationChain } from '@orkestra/sdk';

const result = await taskWithEscalation(ctx, {
  title: 'Handle Support Ticket',
  form: {
    fields: {
      resolution: { type: 'textarea', required: true },
    },
  },
  assignTo: { group: 'support-l1' },
  escalation: escalationChain()
    .notifyAfter('15m', 'Ticket needs attention')
    .escalateAfter('30m', { group: 'support-l2' })
    .escalateAfter('1h', { group: 'managers' })
    .build(),
});
```

### `tieredSupport()`

Predefined tiered support escalation pattern.

```typescript
function tieredSupport(config: TieredSupportConfig): EscalationChain;
```

**TieredSupportConfig:**

```typescript
interface TieredSupportConfig {
  levels: Array<{
    after: string; // Duration
    group: string; // Group to escalate to
    message?: string; // Optional message
  }>;
}
```

**Example:**

```typescript
import { taskWithEscalation, tieredSupport } from '@orkestra/sdk';

const result = await taskWithEscalation(ctx, {
  title: 'Support Ticket',
  form: { fields: { resolution: { type: 'textarea' } } },
  assignTo: { group: 'support-l1' },
  escalation: tieredSupport({
    levels: [
      { after: '30m', group: 'support-l2', message: 'Escalating to L2' },
      { after: '1h', group: 'support-l3', message: 'Escalating to L3' },
      { after: '2h', group: 'managers', message: 'Escalating to management' },
    ],
  }),
});
```

### `approvalEscalation()`

Predefined approval escalation pattern.

```typescript
function approvalEscalation(config: ApprovalEscalationConfig): EscalationChain;
```

**ApprovalEscalationConfig:**

```typescript
interface ApprovalEscalationConfig {
  approvers: string[]; // User IDs in escalation order
  notifyAfter?: string; // Notification duration
  notifyMessage?: string; // Notification message
}
```

**Example:**

```typescript
import { taskWithEscalation, approvalEscalation } from '@orkestra/sdk';

const result = await taskWithEscalation(ctx, {
  title: 'Expense Approval',
  form: { fields: { approved: { type: 'boolean' } } },
  assignTo: { userId: 'manager_1' },
  escalation: approvalEscalation({
    approvers: ['manager_1', 'manager_2', 'director'],
    notifyAfter: '30m',
    notifyMessage: 'Expense awaiting approval',
  }),
});
```

### `simpleEscalation()`

Simple escalation with a single step.

```typescript
function simpleEscalation(
  after: string,
  target: AssignmentTarget,
  message?: string
): EscalationChain;
```

### `notifyThenEscalate()`

Notify then escalate pattern.

```typescript
function notifyThenEscalate(
  notifyAfter: string,
  escalateAfter: string,
  target: AssignmentTarget,
  notifyMessage?: string
): EscalationChain;
```

---

## Signals

### Predefined Signals

#### `taskCompleted`

Signal emitted when a task is completed.

```typescript
const taskCompleted = defineSignal<[TaskCompletedSignalData]>('taskCompleted');
```

#### `taskCancelled`

Signal emitted when a task is cancelled.

```typescript
const taskCancelled = defineSignal<[TaskCancelledSignalData]>('taskCancelled');
```

#### `cancelRequested`

Signal for requesting workflow cancellation.

```typescript
const cancelRequested = defineSignal<[CancelRequestData]>('cancelRequested');
```

#### `resume`

Signal for resuming a paused workflow.

```typescript
const resume = defineSignal<[ResumeData]>('resume');
```

#### `custom()`

Create a custom signal.

```typescript
function custom<T = unknown>(name: string): SignalDefinition<T>;
```

### Signal Utilities

#### `waitForCondition()`

Wait for a condition to become true.

```typescript
async function waitForCondition(predicate: () => boolean, timeout?: number): Promise<void>;
```

#### `waitForAnySignal()`

Wait for any of the specified signals.

```typescript
async function waitForAnySignal<T>(
  signals: Array<{
    signal: SignalDefinition<T>;
    handler: (data: T) => void;
  }>,
  timeout?: number
): Promise<void>;
```

#### `createSignalAccumulator()`

Accumulate signal data over time.

```typescript
function createSignalAccumulator<T>(
  signal: SignalDefinition<T>,
  options?: {
    timeout?: number;
    maxCount?: number;
  }
): SignalAccumulator<T>;
```

#### `createSignalStateMachine()`

Create a state machine driven by signals.

```typescript
function createSignalStateMachine<T extends string>(
  states: Record<T, StateConfig>
): SignalStateMachine<T>;
```

### Query Definitions

#### `getState`

Query to get workflow state.

```typescript
const getState = defineQuery('getState');
```

#### `getPendingTasks`

Query to get pending tasks.

```typescript
const getPendingTasks = defineQuery('getPendingTasks');
```

#### `isWaitingFor`

Query to check if workflow is waiting for specific task.

```typescript
const isWaitingFor = defineQuery('isWaitingFor');
```

---

## Timeouts

### `timeout()`

Create a timeout duration for SLAs.

```typescript
function timeout(duration: string): SLAOptions;
```

**Parameters:**

- `duration` - Duration string (e.g., '30m', '1h', '2d')

**Returns:** `SLAOptions`

**Example:**

```typescript
import { timeout } from '@orkestra/sdk';

const sla = timeout('30m');

// Equivalent to:
const sla = {
  deadline: '30m',
};
```

### `timeoutWithEscalation()`

Create a timeout with automatic escalation.

```typescript
function timeoutWithEscalation(
  deadline: string,
  escalateTo: AssignmentTarget,
  warnBefore?: string
): SLAOptions;
```

**Example:**

```typescript
const sla = timeoutWithEscalation('1h', { group: 'escalation-team' }, '30m');

// Equivalent to:
const sla = {
  deadline: '1h',
  warnBefore: '30m',
  onBreach: 'escalate',
  escalateTo: { group: 'escalation-team' },
};
```

### `timeoutWithWarning()`

Create a timeout with warning only (no escalation).

```typescript
function timeoutWithWarning(deadline: string, warnBefore: string): SLAOptions;
```

### `deadline()`

Create a deadline (absolute time).

```typescript
function deadline(
  deadline: string | Date,
  onBreach?: SLABreachAction
): { deadline: Date; onBreach?: SLABreachAction };
```

### `deadlineWithEscalation()`

Create a deadline with escalation.

```typescript
function deadlineWithEscalation(
  deadline: string | Date,
  escalateTo: AssignmentTarget,
  warnBefore?: string
): SLAOptions;
```

### `calculateDeadline()`

Calculate absolute deadline from duration.

```typescript
function calculateDeadline(duration: string, from?: Date): Date;
```

### `isBreached()`

Check if a deadline has been breached.

```typescript
function isBreached(deadline: Date): boolean;
```

### `isInWarningPeriod()`

Check if within warning period of a deadline.

```typescript
function isInWarningPeriod(deadline: Date, warnBeforeMinutes: number): boolean;
```

### `getTimeRemaining()`

Get remaining time until deadline.

```typescript
function getTimeRemaining(deadline: Date): number;
```

### Tier-based SLA Helpers

#### `tierBasedTimeout()`

Get timeout based on customer tier.

```typescript
function tierBasedTimeout(tier: string, timeouts: Record<string, string>): string;
```

**Example:**

```typescript
const timeout = tierBasedTimeout(customerTier, {
  basic: '60m',
  premium: '30m',
  enterprise: '10m',
});
```

#### `tierBasedEscalation()`

Create tier-based escalation chain.

```typescript
function tierBasedEscalation(
  tier: string,
  config: Record<string, EscalationChain>
): EscalationChain;
```

---

## Duration Utilities

### `parseDuration()`

Parse duration string to milliseconds.

```typescript
function parseDuration(duration: string): number;
```

**Supported formats:**

- `'30s'` - 30 seconds
- `'15m'` - 15 minutes
- `'2h'` - 2 hours
- `'1d'` - 1 day

**Example:**

```typescript
import { parseDuration } from '@orkestra/sdk';

const ms = parseDuration('2h30m'); // 9000000
```

### `formatDuration()`

Format milliseconds to duration string.

```typescript
function formatDuration(
  ms: number,
  options?: {
    compact?: boolean;
    maxUnits?: number;
  }
): string;
```

**Example:**

```typescript
formatDuration(9000000); // '2h 30m'
formatDuration(9000000, { compact: true }); // '2.5h'
```

### `isDuration()`

Check if string is a valid duration.

```typescript
function isDuration(value: string): boolean;
```

### `addDurations()`

Add multiple durations.

```typescript
function addDurations(...durations: string[]): string;
```

**Example:**

```typescript
addDurations('1h', '30m', '15m'); // '1h 45m'
```

### `toSeconds()`

Convert duration string to seconds.

```typescript
function toSeconds(duration: string): number;
```

### `toMinutes()`

Convert duration string to minutes.

```typescript
function toMinutes(duration: string): number;
```

### `toHours()`

Convert duration string to hours.

```typescript
function toHours(duration: string): number;
```

---

## Workflow Utilities

### `parallel()`

Run multiple async operations in parallel.

```typescript
async function parallel<T extends readonly unknown[] | []>(operations: {
  [K in keyof T]: Promise<T[K]>;
}): Promise<T>;
```

**Example:**

```typescript
import { parallel } from '@orkestra/sdk';

const [userData, settings, history] = await parallel([
  activities.getUserData(userId),
  activities.getSettings(userId),
  activities.getHistory(userId),
]);
```

### `withTimeout()`

Run operation with timeout.

```typescript
async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message?: string
): Promise<T>;
```

**Example:**

```typescript
import { withTimeout } from '@orkestra/sdk';

try {
  const result = await withTimeout(
    activities.processDocument(docId),
    30000,
    'Document processing timed out'
  );
} catch (error) {
  if (error.code === 'TIMEOUT') {
    // Handle timeout
  }
}
```

### `retry()`

Retry operation with exponential backoff.

```typescript
async function retry<T>(
  operation: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
  }
): Promise<T>;
```

**Options:**

| Option          | Default | Description                   |
| --------------- | ------- | ----------------------------- |
| `maxAttempts`   | 3       | Maximum retry attempts        |
| `initialDelay`  | 1000    | Initial delay in milliseconds |
| `maxDelay`      | 30000   | Maximum delay in milliseconds |
| `backoffFactor` | 2       | Backoff multiplier            |

**Example:**

```typescript
import { retry } from '@orkestra/sdk';

const result = await retry(() => activities.callExternalAPI(), {
  maxAttempts: 5,
  initialDelay: 1000,
  maxDelay: 10000,
});
```

---

## Task Utilities

### `cancelTask()`

Cancel a task.

```typescript
async function cancelTask(taskId: string, reason?: string): Promise<void>;
```

### `reassignTask()`

Reassign a task to a new target.

```typescript
async function reassignTask(taskId: string, target: AssignmentTarget): Promise<void>;
```

### `notifyUrgent()`

Send urgent notification for a task.

```typescript
async function notifyUrgent(taskId: string, message?: string): Promise<void>;
```

---

## Types

Complete type definitions:

```typescript
// Form types
export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'url'
  | 'date'
  | 'datetime'
  | 'time'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'json';

export interface FormField {
  type: FormFieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  defaultValue?: unknown;
  options?: FormFieldOption[];
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  disabled?: boolean;
  hidden?: boolean;
  showWhen?: {
    field: string;
    equals: unknown;
  };
}

export interface FormFieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface FormSchema {
  fields: Record<string, FormField>;
  fieldOrder?: string[];
  settings?: {
    submitLabel?: string;
    cancelLabel?: string;
    confirmSubmit?: boolean;
    confirmMessage?: string;
  };
}

// Assignment
export interface AssignmentTarget {
  userId?: string;
  groupId?: string;
}

// Task
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskOptions {
  title: string;
  type?: string;
  description?: string;
  form: FormSchema;
  assignTo: AssignmentTarget;
  context?: Record<string, unknown>;
  conversationId?: string;
  sla?: SLAOptions;
  priority?: TaskPriority;
  metadata?: Record<string, unknown>;
}

export interface TaskResult<T = Record<string, unknown>> {
  taskId: string;
  data: T;
  completedBy: string;
  completedAt: Date;
}

// SLA
export interface SLAOptions {
  deadline: string;
  warnBefore?: string;
  onBreach?: SLABreachAction;
  escalateTo?: AssignmentTarget;
}

export type SLABreachAction = 'escalate' | 'notify' | 'cancel';

// Escalation
export interface EscalationStep {
  after: string;
  action: EscalationAction;
  target?: AssignmentTarget;
  message?: string;
}

export type EscalationAction = 'notify' | 'escalate' | 'cancel';

export interface EscalationChain {
  steps: EscalationStep[];
}
```

---

## Implementation Reference

- SDK Source: `packages/sdk/src/`
  - Workflows: `workflow.ts:34-439`
  - Tasks: `task.ts:153-500`
  - Escalation: `escalation.ts`
  - Signals: `signals.ts`
  - Timeouts: `timeout.ts`
  - Duration: `duration.ts`
  - Types: `types.ts`
