# Task 06: Task Manager Service

## Overview

Implement the Task Manager service that handles the full lifecycle of human-in-the-loop tasks.

## Phase

🟢 **Phase 2: Core Engine**

## Priority

🔴 **Critical** - Core human-in-the-loop functionality

## Estimated Effort

8-10 hours

## Description

The Task Manager is the heart of Orkestra's human-in-the-loop system. It handles task creation, assignment, claiming, completion, escalation, and SLA management.

## Requirements

### Package Structure Addition

```
packages/core/src/
├── services/
│   ├── index.ts
│   ├── task-manager/
│   │   ├── index.ts
│   │   ├── task-service.ts      # Main service
│   │   ├── assignment.ts        # Assignment strategies
│   │   ├── sla.ts               # SLA management
│   │   ├── escalation.ts        # Escalation logic
│   │   └── notifications.ts     # Notification triggers
```

### Task Service Interface

```typescript
// services/task-manager/task-service.ts
import { Task, TaskStatus } from '@prisma/client';
import { RequestContext } from '../../context';

export interface CreateTaskOptions {
  title: string;
  description?: string;
  form: FormSchema;
  assignTo: AssignmentTarget;
  context?: Record<string, unknown>;
  conversationId?: string;
  sla?: SLAConfig;
  workflowId: string;
  workflowRunId: string;
}

export interface AssignmentTarget {
  userId?: string;
  groupId?: string;
}

export interface FormSchema {
  fields: Record<string, FormField>;
}

export interface FormField {
  type: 'text' | 'textarea' | 'boolean' | 'select' | 'number' | 'date';
  label?: string;
  required?: boolean;
  default?: unknown;
  options?: Array<{ value: string; label: string }>;
  validation?: FieldValidation;
}

export interface SLAConfig {
  deadline: Date | string; // Duration string like '10m', '1h'
  escalationChain?: EscalationStep[];
  onBreach?: 'escalate' | 'notify' | 'cancel';
}

export interface EscalationStep {
  after: string; // Duration
  action: 'reassign' | 'notify' | 'escalate';
  target?: AssignmentTarget;
  notifyChannels?: string[];
}

export class TaskService {
  constructor(
    private taskRepo: TaskRepository,
    private userRepo: UserRepository,
    private groupRepo: GroupRepository,
    private notificationService: NotificationService,
    private temporalClient: Client
  ) {}

  async create(ctx: RequestContext, options: CreateTaskOptions): Promise<Task> {
    // 1. Validate form schema
    this.validateFormSchema(options.form);

    // 2. Resolve assignment (if group, may auto-assign to user)
    const assignment = await this.resolveAssignment(ctx, options.assignTo);

    // 3. Calculate SLA deadline
    const slaDeadline = options.sla
      ? this.calculateDeadline(options.sla.deadline)
      : undefined;

    // 4. Create task
    const task = await this.taskRepo.create(ctx, {
      ...options,
      assignTo: assignment,
      sla: slaDeadline
        ? { deadline: slaDeadline, config: options.sla }
        : undefined,
    });

    // 5. Record history
    await this.recordHistory(task.id, 'created', ctx);

    // 6. Send notifications
    await this.notificationService.taskCreated(task);

    // 7. Schedule SLA check if configured
    if (options.sla) {
      await this.scheduleSLACheck(task);
    }

    return task;
  }

  async claim(ctx: RequestContext, taskId: string): Promise<Task> {
    const task = await this.taskRepo.findById(ctx, taskId);
    if (!task) throw new NotFoundError('Task', taskId);
    if (task.status !== TaskStatus.ASSIGNED) {
      throw new ValidationError('Task cannot be claimed in current state');
    }

    // Verify user can claim (is assignee or in assigned group)
    await this.verifyCanClaim(ctx, task);

    const updated = await this.taskRepo.claim(ctx, taskId, ctx.userId);
    await this.recordHistory(taskId, 'claimed', ctx);

    return updated;
  }

  async complete(
    ctx: RequestContext,
    taskId: string,
    formData: Record<string, unknown>
  ): Promise<Task> {
    const task = await this.taskRepo.findById(ctx, taskId);
    if (!task) throw new NotFoundError('Task', taskId);
    if (task.status !== TaskStatus.CLAIMED) {
      throw new ValidationError('Task must be claimed before completion');
    }
    if (task.claimedById !== ctx.userId) {
      throw new ForbiddenError('Only the claimer can complete this task');
    }

    // Validate form data against schema
    this.validateFormData(task.formSchema as FormSchema, formData);

    const updated = await this.taskRepo.complete(ctx, taskId, formData, ctx.userId);
    await this.recordHistory(taskId, 'completed', ctx, { formData });

    // Signal the waiting workflow
    await this.signalWorkflowCompletion(task, formData);

    return updated;
  }

  async reassign(
    ctx: RequestContext,
    taskId: string,
    target: AssignmentTarget
  ): Promise<Task> {
    const task = await this.taskRepo.findById(ctx, taskId);
    if (!task) throw new NotFoundError('Task', taskId);

    const updated = await this.taskRepo.reassign(ctx, taskId, target);
    await this.recordHistory(taskId, 'reassigned', ctx, { target });
    await this.notificationService.taskReassigned(updated);

    return updated;
  }

  async escalate(
    ctx: RequestContext,
    taskId: string,
    reason?: string
  ): Promise<Task> {
    const task = await this.taskRepo.findById(ctx, taskId);
    if (!task) throw new NotFoundError('Task', taskId);

    // Determine escalation target from SLA config or default
    const escalationTarget = this.getEscalationTarget(task);

    const updated = await this.taskRepo.escalate(ctx, taskId, escalationTarget);
    await this.recordHistory(taskId, 'escalated', ctx, { reason, target: escalationTarget });
    await this.notificationService.taskEscalated(updated, reason);

    return updated;
  }

  async addComment(
    ctx: RequestContext,
    taskId: string,
    comment: string
  ): Promise<void> {
    const task = await this.taskRepo.findById(ctx, taskId);
    if (!task) throw new NotFoundError('Task', taskId);

    await this.recordHistory(taskId, 'comment_added', ctx, { comment });
  }

  // List tasks for current user (their tasks + group tasks)
  async listPending(ctx: RequestContext): Promise<Task[]> {
    return this.taskRepo.findPendingForUser(ctx, ctx.userId);
  }

  // Private methods
  private async signalWorkflowCompletion(
    task: Task,
    formData: Record<string, unknown>
  ): Promise<void> {
    const handle = this.temporalClient.workflow.getHandle(
      task.workflowId,
      task.workflowRunId
    );
    await handle.signal('taskCompleted', {
      taskId: task.id,
      formData,
      completedBy: task.completedById,
      completedAt: task.completedAt,
    });
  }

  private async scheduleSLACheck(task: Task): Promise<void> {
    // Use Temporal to schedule SLA check workflow
    // This will trigger escalation if task not completed by deadline
  }
}
```

### Assignment Strategies

```typescript
// services/task-manager/assignment.ts
export interface AssignmentStrategy {
  selectUser(ctx: RequestContext, groupId: string): Promise<string | null>;
}

export class RoundRobinStrategy implements AssignmentStrategy {
  constructor(private userRepo: UserRepository) {}

  async selectUser(ctx: RequestContext, groupId: string): Promise<string | null> {
    // Get group members
    const members = await this.userRepo.findByGroup(ctx, groupId);
    if (members.length === 0) return null;

    // Get last assigned user for this group (from cache or DB)
    const lastAssigned = await this.getLastAssigned(groupId);

    // Select next user in rotation
    const lastIndex = members.findIndex((m) => m.id === lastAssigned);
    const nextIndex = (lastIndex + 1) % members.length;

    // Update last assigned
    await this.setLastAssigned(groupId, members[nextIndex].id);

    return members[nextIndex].id;
  }
}

export class LoadBalancedStrategy implements AssignmentStrategy {
  constructor(
    private userRepo: UserRepository,
    private taskRepo: TaskRepository
  ) {}

  async selectUser(ctx: RequestContext, groupId: string): Promise<string | null> {
    // Get group members with their current task counts
    const members = await this.userRepo.findByGroupWithTaskCount(ctx, groupId);
    if (members.length === 0) return null;

    // Select user with lowest active task count
    return members.sort((a, b) => a.taskCount - b.taskCount)[0].id;
  }
}
```

### SLA Management

```typescript
// services/task-manager/sla.ts
import { parseISO, addMinutes, addHours, addDays, isBefore } from 'date-fns';

export function calculateDeadline(duration: Date | string): Date {
  if (duration instanceof Date) return duration;

  const now = new Date();
  const match = duration.match(/^(\d+)(m|h|d)$/);
  if (!match) throw new ValidationError(`Invalid duration format: ${duration}`);

  const [, amount, unit] = match;
  const value = parseInt(amount, 10);

  switch (unit) {
    case 'm':
      return addMinutes(now, value);
    case 'h':
      return addHours(now, value);
    case 'd':
      return addDays(now, value);
    default:
      throw new ValidationError(`Unknown duration unit: ${unit}`);
  }
}

export function isBreached(deadline: Date): boolean {
  return isBefore(deadline, new Date());
}
```

### SLA Check Workflow

```typescript
// This would be a Temporal workflow
export async function slaCheckWorkflow(taskId: string): Promise<void> {
  const task = await activities.getTask(taskId);
  if (!task || task.status === 'COMPLETED') return;

  const slaConfig = task.slaConfig as SLAConfig;
  if (!slaConfig) return;

  // Check if breached
  if (isBreached(task.slaDeadline)) {
    switch (slaConfig.onBreach) {
      case 'escalate':
        await activities.escalateTask(taskId);
        break;
      case 'notify':
        await activities.notifySLABreach(taskId);
        break;
      case 'cancel':
        await activities.cancelTask(taskId);
        break;
    }
  }
}
```

## Acceptance Criteria

- [ ] TaskService.create works with all options
- [ ] Task claiming enforces permissions
- [ ] Task completion validates form data
- [ ] Workflow signaling works on completion
- [ ] Reassignment updates assignments correctly
- [ ] Escalation follows configured chain
- [ ] Comments are added to history
- [ ] Round-robin assignment works
- [ ] Load-balanced assignment works
- [ ] SLA deadlines calculated correctly
- [ ] SLA breach triggers escalation
- [ ] All operations record history
- [ ] Notifications triggered appropriately
- [ ] Unit tests for all service methods
- [ ] Integration tests with real DB and Temporal

## Dependencies

- [[03 - Core Package Setup]]
- [[04 - Temporal Integration]]
- [[05 - Database Schema]]

## Blocked By

- [[04 - Temporal Integration]]
- [[05 - Database Schema]]

## Blocks

- [[08 - MCP Server]]
- [[09 - REST API]]

## Technical Notes

### Form Validation

Consider using Zod for runtime validation of form data:

```typescript
function validateFormData(schema: FormSchema, data: Record<string, unknown>) {
  const zodSchema = buildZodSchema(schema);
  const result = zodSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Invalid form data', {
      errors: result.error.issues,
    });
  }
}
```

### Optimistic Locking

For claim operations, use optimistic locking to prevent race conditions:

```typescript
await this.prisma.task.update({
  where: {
    id: taskId,
    tenantId: ctx.tenantId,
    status: TaskStatus.ASSIGNED, // Optimistic lock
    version: task.version, // Or use version field
  },
  data: { ... }
});
```

## References

- [[Architecture]] - Full task lifecycle
- [Temporal Signals](https://docs.temporal.io/workflows#signal)

## Tags

#orkestra #task #core #task-manager #human-in-the-loop
