/**
 * Integration Test Helpers
 *
 * Utility functions for common test operations.
 */

import type { Task } from '@prisma/client';
import type { FormSchema } from '../../src/services/task-manager/types.js';
import type { TaskPriority, TaskStatus } from '../../src/types/task.js';
import {
  createMockPrismaClient,
  createMockTemporalClient,
  getMockStorage,
  getMockWorkflowHandles,
  getTestTenant,
  getTestUser,
  setResetSeedTaskCounter,
} from './setup.js';

// ============================================================================
// Task Helpers
// ============================================================================

/**
 * Counter for generating unique seeded task IDs
 */
let seedTaskCounter = 0;

/**
 * Reset the seed task counter (called in setup)
 */
export function resetSeedTaskCounter(): void {
  seedTaskCounter = 0;
}

// Register the reset function with setup
setResetSeedTaskCounter(resetSeedTaskCounter);

/**
 * Simple form schema for testing
 */
export const simpleFormSchema: FormSchema = {
  fields: {
    answer: {
      type: 'text',
      label: 'Your Answer',
      required: true,
    },
  },
};

/**
 * Complex form schema for testing
 */
export const complexFormSchema: FormSchema = {
  fields: {
    name: {
      type: 'text',
      label: 'Name',
      required: true,
      validation: {
        min: 2,
        max: 100,
      },
    },
    email: {
      type: 'text',
      label: 'Email',
      required: true,
      validation: {
        pattern: '^[^@]+@[^@]+\\.[^@]+$',
        message: 'Invalid email format',
      },
    },
    age: {
      type: 'number',
      label: 'Age',
      required: false,
      validation: {
        min: 0,
        max: 150,
      },
    },
    category: {
      type: 'select',
      label: 'Category',
      required: true,
      options: [
        { value: 'support', label: 'Support' },
        { value: 'sales', label: 'Sales' },
        { value: 'billing', label: 'Billing' },
      ],
    },
    subscribe: {
      type: 'boolean',
      label: 'Subscribe to newsletter',
      required: false,
      default: false,
    },
  },
};

/**
 * Create a task directly in mock storage for testing
 */
export function seedMockTask(options: {
  id?: string;
  title?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  formSchema?: FormSchema;
  assignedUserId?: string | null;
  assignedGroupId?: string | null;
  claimedBy?: string | null;
  workflowId?: string | null;
  workflowRunId?: string | null;
  dueAt?: Date | null;
  tenantId?: string;
}): Task {
  const storage = getMockStorage();
  const tenant = getTestTenant();
  const now = new Date();

  seedTaskCounter++;
  const task: Task = {
    id: options.id ?? `tsk_seed_${seedTaskCounter}_${Date.now()}`,
    tenantId: options.tenantId ?? tenant.id,
    type: 'human_task',
    title: options.title ?? 'Seeded Test Task',
    description: null,
    status: options.status ?? 'pending',
    priority: options.priority ?? 'medium',
    formSchema: (options.formSchema ?? simpleFormSchema) as unknown as Task['formSchema'],
    formData: null,
    context: {},
    assignedUserId: options.assignedUserId ?? null,
    assignedGroupId: options.assignedGroupId ?? null,
    claimedBy: options.claimedBy ?? null,
    claimedAt: options.claimedBy ? now : null,
    dueAt: options.dueAt ?? null,
    warnAt: null,
    escalationConfig: null,
    completedBy: null,
    completedAt: null,
    workflowId: options.workflowId ?? null,
    workflowRunId: options.workflowRunId ?? null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  storage.tasks.set(task.id, task);
  return task;
}

/**
 * Seed multiple tasks for testing
 */
export function seedMockTasks(count: number, baseOptions: Parameters<typeof seedMockTask>[0] = {}): Task[] {
  return Array.from({ length: count }, (_, i) =>
    seedMockTask({
      ...baseOptions,
      id: `tsk_seed_${i}_${Date.now()}`,
      title: baseOptions.title ?? `Seeded Task ${i + 1}`,
    })
  );
}

/**
 * Get task from mock storage
 */
export function getMockTask(taskId: string): Task | undefined {
  return getMockStorage().tasks.get(taskId);
}

/**
 * Get all tasks from mock storage
 */
export function getAllMockTasks(): Task[] {
  return Array.from(getMockStorage().tasks.values());
}

/**
 * Get task history from mock storage
 */
export function getMockTaskHistory(taskId: string) {
  return getMockStorage().taskHistory.get(taskId) ?? [];
}

// ============================================================================
// Workflow Signal Helpers
// ============================================================================

/**
 * Get signals sent to a workflow
 */
export function getWorkflowSignals(workflowId: string): Array<{ name: string; args: unknown[] }> {
  const handle = getMockWorkflowHandles().get(workflowId);
  return handle?.signals ?? [];
}

/**
 * Check if a specific signal was sent to a workflow
 */
export function wasSignalSent(workflowId: string, signalName: string): boolean {
  const signals = getWorkflowSignals(workflowId);
  return signals.some((s) => s.name === signalName);
}

/**
 * Get the last signal sent to a workflow
 */
export function getLastSignal(workflowId: string): { name: string; args: unknown[] } | undefined {
  const signals = getWorkflowSignals(workflowId);
  return signals[signals.length - 1];
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a task has a specific status
 */
export function expectTaskStatus(task: Task, expectedStatus: TaskStatus): void {
  if (task.status !== expectedStatus) {
    throw new Error(`Expected task status to be '${expectedStatus}', but got '${task.status}'`);
  }
}

/**
 * Assert that a task is assigned to a user
 */
export function expectTaskAssignedToUser(task: Task, userId: string): void {
  if (task.assignedUserId !== userId) {
    throw new Error(`Expected task to be assigned to '${userId}', but assigned to '${task.assignedUserId}'`);
  }
}

/**
 * Assert that a task is assigned to a group
 */
export function expectTaskAssignedToGroup(task: Task, groupId: string): void {
  if (task.assignedGroupId !== groupId) {
    throw new Error(`Expected task to be assigned to group '${groupId}', but assigned to '${task.assignedGroupId}'`);
  }
}

/**
 * Assert that a task is claimed by a user
 */
export function expectTaskClaimedBy(task: Task, userId: string): void {
  if (task.claimedBy !== userId) {
    throw new Error(`Expected task to be claimed by '${userId}', but claimed by '${task.claimedBy}'`);
  }
}

/**
 * Assert that a task is completed by a user
 */
export function expectTaskCompletedBy(task: Task, userId: string): void {
  if (task.completedBy !== userId) {
    throw new Error(`Expected task to be completed by '${userId}', but completed by '${task.completedBy}'`);
  }
}

// ============================================================================
// Wait Helpers
// ============================================================================

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const timeout = options.timeout ?? 5000;
  const interval = options.interval ?? 50;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Wait for a task to reach a specific status
 */
export async function waitForTaskStatus(
  taskId: string,
  expectedStatus: TaskStatus,
  options?: { timeout?: number }
): Promise<Task> {
  await waitFor(() => {
    const task = getMockTask(taskId);
    return task?.status === expectedStatus;
  }, options);

  const task = getMockTask(taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  return task;
}

// ============================================================================
// Service Factory Helpers
// ============================================================================

/**
 * Create configured TaskService for testing
 */
export function createTestTaskService() {
  // Import dynamically to avoid circular dependencies
  const { TaskService } = require('../../src/services/task-manager/task-service.js');

  const prisma = createMockPrismaClient();
  const temporalClient = createMockTemporalClient();

  return new TaskService({
    prisma,
    temporalClient,
  });
}

/**
 * Create services bundle for integration tests
 */
export function createTestServices() {
  const prisma = createMockPrismaClient();
  const temporalClient = createMockTemporalClient();

  return {
    prisma,
    temporalClient,
    // Add more services as needed
  };
}
