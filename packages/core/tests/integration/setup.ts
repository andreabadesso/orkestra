/**
 * Integration Test Setup
 *
 * Provides setup/teardown utilities and mock infrastructure for integration tests.
 * Uses mocked PrismaClient and Temporal client for testing without real dependencies.
 */

import { vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient, Task, TaskHistory, Prisma } from '@prisma/client';

import { createRequestContext, RequestContext } from '../../src/context/index.js';
import type { TenantId, UserId } from '../../src/types/common.js';
import { createTestTenant, createTestUser, resetTenantCounter, resetUserCounters } from '../fixtures/index.js';

// Import resetSeedTaskCounter for setup
// Note: We'll export this and call it in setup, but we need to avoid circular imports
let resetSeedTaskCounterFn: (() => void) | null = null;

/**
 * Set the reset function for seed task counter (to avoid circular import)
 */
export function setResetSeedTaskCounter(fn: () => void): void {
  resetSeedTaskCounterFn = fn;
}

// ============================================================================
// Mock Storage
// ============================================================================

/**
 * Group member record
 */
export interface MockGroupMember {
  userId: string;
  groupId: string;
  joinedAt: Date;
}

/**
 * In-memory storage for mocked data
 */
export interface MockStorage {
  tasks: Map<string, Task>;
  taskHistory: Map<string, TaskHistory[]>;
  users: Map<string, Record<string, unknown>>;
  groups: Map<string, Record<string, unknown>>;
  groupMembers: Map<string, MockGroupMember[]>; // groupId -> members
  tenants: Map<string, Record<string, unknown>>;
}

/**
 * Create fresh mock storage
 */
export function createMockStorage(): MockStorage {
  return {
    tasks: new Map(),
    taskHistory: new Map(),
    users: new Map(),
    groups: new Map(),
    groupMembers: new Map(),
    tenants: new Map(),
  };
}

// Global storage instance
let mockStorage: MockStorage = createMockStorage();

/**
 * Get the current mock storage instance
 */
export function getMockStorage(): MockStorage {
  return mockStorage;
}

/**
 * Reset mock storage (call in beforeEach)
 */
export function resetMockStorage(): void {
  mockStorage = createMockStorage();
}

// ============================================================================
// Mock Prisma Client
// ============================================================================

/**
 * Create a mock Prisma task object
 */
export function createMockPrismaTask(data: Partial<Task> & { id: string; tenantId: string }): Task {
  const now = new Date();
  return {
    id: data.id,
    tenantId: data.tenantId,
    type: data.type ?? 'human_task',
    title: data.title ?? 'Test Task',
    description: data.description ?? null,
    status: data.status ?? 'pending',
    priority: data.priority ?? 'medium',
    formSchema: data.formSchema ?? { fields: {} },
    formData: data.formData ?? null,
    context: data.context ?? {},
    assignedUserId: data.assignedUserId ?? null,
    assignedGroupId: data.assignedGroupId ?? null,
    claimedBy: data.claimedBy ?? null,
    claimedAt: data.claimedAt ?? null,
    dueAt: data.dueAt ?? null,
    warnAt: data.warnAt ?? null,
    escalationConfig: data.escalationConfig ?? null,
    completedBy: data.completedBy ?? null,
    completedAt: data.completedAt ?? null,
    workflowId: data.workflowId ?? null,
    workflowRunId: data.workflowRunId ?? null,
    metadata: data.metadata ?? {},
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
    deletedAt: data.deletedAt ?? null,
  };
}

/**
 * Create a mock Prisma client with in-memory storage
 *
 * Note: Uses getMockStorage() to always access current storage,
 * allowing storage to be reset between tests.
 */
export function createMockPrismaClient(): PrismaClient {
  const mockPrisma = {
    task: {
      create: vi.fn(async ({ data }: { data: Prisma.TaskCreateInput }) => {
        const storage = getMockStorage();
        const task = createMockPrismaTask({
          id: data.id as string,
          tenantId: data.tenantId as string,
          type: data.type as string,
          title: data.title as string,
          description: data.description as string | null,
          status: data.status,
          priority: data.priority,
          formSchema: data.formSchema as Prisma.JsonValue,
          context: data.context as Prisma.JsonValue,
          assignedUserId: data.assignedUserId as string | null,
          assignedGroupId: data.assignedGroupId as string | null,
          dueAt: data.dueAt ? new Date(data.dueAt as string) : null,
          warnAt: data.warnAt ? new Date(data.warnAt as string) : null,
          escalationConfig: data.escalationConfig as Prisma.JsonValue,
          workflowId: data.workflowId as string | null,
          workflowRunId: data.workflowRunId as string | null,
          metadata: data.metadata as Prisma.JsonValue,
        });
        storage.tasks.set(task.id, task);
        return task;
      }),

      findFirst: vi.fn(async ({ where }: { where: Prisma.TaskWhereInput }) => {
        const storage = getMockStorage();
        for (const task of storage.tasks.values()) {
          if (task.id === where.id && task.tenantId === where.tenantId && task.deletedAt === null) {
            return task;
          }
        }
        return null;
      }),

      findMany: vi.fn(async ({ where, orderBy }: { where?: Prisma.TaskWhereInput; orderBy?: unknown }) => {
        const storage = getMockStorage();
        const results: Task[] = [];
        for (const task of storage.tasks.values()) {
          if (!where) {
            results.push(task);
            continue;
          }

          let matches = true;

          // Check tenantId
          if (where.tenantId && task.tenantId !== where.tenantId) matches = false;

          // Check deletedAt - null means not deleted
          if (where.deletedAt === null && task.deletedAt !== null) matches = false;

          // Check status
          if (where.status && matches) {
            if (typeof where.status === 'string' && task.status !== where.status) matches = false;
            if (typeof where.status === 'object' && 'in' in where.status) {
              if (!where.status.in.includes(task.status)) matches = false;
            }
          }

          // Handle OR conditions (for listForUser)
          if (where.OR && matches) {
            const orConditions = where.OR as Array<Record<string, unknown>>;
            let orMatches = false;

            for (const condition of orConditions) {
              let conditionMatches = true;

              if (condition.assignedUserId !== undefined) {
                if (task.assignedUserId !== condition.assignedUserId) conditionMatches = false;
              }
              if (condition.claimedBy !== undefined) {
                if (task.claimedBy !== condition.claimedBy) conditionMatches = false;
              }
              if (condition.assignedGroupId !== undefined) {
                const groupCondition = condition.assignedGroupId as Record<string, unknown>;
                if (typeof groupCondition === 'object' && groupCondition !== null && 'in' in groupCondition) {
                  if (!Array.isArray(groupCondition.in) || !groupCondition.in.includes(task.assignedGroupId)) {
                    conditionMatches = false;
                  }
                }
                if (condition.claimedBy !== undefined && task.claimedBy !== condition.claimedBy) {
                  conditionMatches = false;
                }
              }

              if (conditionMatches) {
                orMatches = true;
                break;
              }
            }

            if (!orMatches) matches = false;
          }

          // Check assignedUserId (when not in OR)
          if (!where.OR && where.assignedUserId && task.assignedUserId !== where.assignedUserId) {
            matches = false;
          }

          // Check assignedGroupId (when not in OR)
          if (!where.OR && where.assignedGroupId && matches) {
            if (typeof where.assignedGroupId === 'string' && task.assignedGroupId !== where.assignedGroupId) {
              matches = false;
            }
            if (typeof where.assignedGroupId === 'object' && 'in' in where.assignedGroupId) {
              if (!where.assignedGroupId.in.includes(task.assignedGroupId as string)) matches = false;
            }
          }

          // Check dueAt
          if (where.dueAt && matches) {
            if (typeof where.dueAt === 'object' && 'lt' in where.dueAt) {
              const dueAtCondition = where.dueAt as { lt: Date };
              if (!task.dueAt || task.dueAt >= dueAtCondition.lt) matches = false;
            }
          }

          if (matches) results.push(task);
        }
        return results;
      }),

      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Prisma.TaskUpdateInput }) => {
        const storage = getMockStorage();
        const task = storage.tasks.get(where.id);
        if (!task) throw new Error(`Task not found: ${where.id}`);

        const updated = {
          ...task,
          ...Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined)
          ),
          updatedAt: new Date(),
        } as Task;

        storage.tasks.set(where.id, updated);
        return updated;
      }),

      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const storage = getMockStorage();
        const task = storage.tasks.get(where.id);
        if (!task) throw new Error(`Task not found: ${where.id}`);
        storage.tasks.delete(where.id);
        return task;
      }),
    },

    taskHistory: {
      create: vi.fn(async ({ data }: { data: Prisma.TaskHistoryCreateInput }) => {
        const storage = getMockStorage();
        const entry: TaskHistory = {
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          taskId: data.taskId as string,
          action: data.action as string,
          userId: data.userId as string | null,
          data: data.data as Prisma.JsonValue,
          createdAt: new Date(),
        };

        const existing = storage.taskHistory.get(data.taskId as string) ?? [];
        existing.push(entry);
        storage.taskHistory.set(data.taskId as string, existing);

        return entry;
      }),

      findMany: vi.fn(async ({ where, orderBy }: { where?: { taskId?: string }; orderBy?: unknown }) => {
        const storage = getMockStorage();
        if (!where?.taskId) return [];
        return storage.taskHistory.get(where.taskId) ?? [];
      }),
    },

    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const storage = getMockStorage();
        return storage.users.get(where.id) ?? null;
      }),

      findFirst: vi.fn(async ({ where }: { where: Prisma.UserWhereInput }) => {
        const storage = getMockStorage();
        for (const user of storage.users.values()) {
          if (user.id === where.id) return user;
        }
        return null;
      }),

      findMany: vi.fn(async () => {
        const storage = getMockStorage();
        return Array.from(storage.users.values());
      }),
    },

    group: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const storage = getMockStorage();
        return storage.groups.get(where.id) ?? null;
      }),

      findFirst: vi.fn(async ({ where }: { where: Prisma.GroupWhereInput }) => {
        const storage = getMockStorage();
        for (const group of storage.groups.values()) {
          if (group.id === where.id) return group;
        }
        return null;
      }),

      findMany: vi.fn(async () => {
        const storage = getMockStorage();
        return Array.from(storage.groups.values());
      }),
    },

    groupMember: {
      findMany: vi.fn(async ({ where }: { where?: { groupId?: string } }) => {
        const storage = getMockStorage();
        if (!where?.groupId) return [];
        const members = storage.groupMembers.get(where.groupId) ?? [];
        return members.map((m) => ({
          userId: m.userId,
          groupId: m.groupId,
          joinedAt: m.joinedAt,
          user: {
            _count: {
              assignedTasks: 0,
            },
          },
        }));
      }),

      create: vi.fn(async ({ data }: { data: { userId: string; groupId: string } }) => {
        const storage = getMockStorage();
        const member: MockGroupMember = {
          userId: data.userId,
          groupId: data.groupId,
          joinedAt: new Date(),
        };
        const existing = storage.groupMembers.get(data.groupId) ?? [];
        existing.push(member);
        storage.groupMembers.set(data.groupId, existing);
        return member;
      }),
    },

    tenant: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const storage = getMockStorage();
        return storage.tenants.get(where.id) ?? null;
      }),
    },

    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
  };

  return mockPrisma as unknown as PrismaClient;
}

// ============================================================================
// Mock Temporal Client
// ============================================================================

/**
 * Mock workflow handle for testing
 */
export interface MockWorkflowHandle {
  workflowId: string;
  runId: string;
  signals: Array<{ name: string; args: unknown[] }>;
  queries: Array<{ name: string; args: unknown[] }>;
}

/**
 * Storage for mock workflow handles
 */
const mockWorkflowHandles: Map<string, MockWorkflowHandle> = new Map();

/**
 * Get mock workflow handles for inspection in tests
 */
export function getMockWorkflowHandles(): Map<string, MockWorkflowHandle> {
  return mockWorkflowHandles;
}

/**
 * Reset mock workflow handles
 */
export function resetMockWorkflowHandles(): void {
  mockWorkflowHandles.clear();
}

/**
 * Create a mock Temporal client
 */
export function createMockTemporalClient() {
  return {
    workflow: {
      start: vi.fn(async (workflow: string, options: { workflowId: string; taskQueue: string; args: unknown[] }) => {
        const handle: MockWorkflowHandle = {
          workflowId: options.workflowId,
          runId: `run_${Date.now()}`,
          signals: [],
          queries: [],
        };
        mockWorkflowHandles.set(options.workflowId, handle);
        return {
          workflowId: handle.workflowId,
          firstExecutionRunId: handle.runId,
        };
      }),

      getHandle: vi.fn((workflowId: string, runId?: string) => {
        const handle = mockWorkflowHandles.get(workflowId) ?? {
          workflowId,
          runId: runId ?? `run_${Date.now()}`,
          signals: [],
          queries: [],
        };

        if (!mockWorkflowHandles.has(workflowId)) {
          mockWorkflowHandles.set(workflowId, handle);
        }

        return {
          workflowId: handle.workflowId,
          signal: vi.fn(async (name: string, ...args: unknown[]) => {
            handle.signals.push({ name, args });
          }),
          query: vi.fn(async (name: string, ...args: unknown[]) => {
            handle.queries.push({ name, args });
            return null;
          }),
          result: vi.fn(async () => null),
          cancel: vi.fn(async () => {}),
          terminate: vi.fn(async () => {}),
          describe: vi.fn(async () => ({
            workflowId: handle.workflowId,
            runId: handle.runId,
            status: { name: 'RUNNING' },
          })),
        };
      }),

      signalWithStart: vi.fn(async () => ({
        workflowId: `wf_${Date.now()}`,
        firstExecutionRunId: `run_${Date.now()}`,
      })),
    },
  };
}

// ============================================================================
// Test Context Helpers
// ============================================================================

/**
 * Default test tenant
 */
let defaultTestTenant = createTestTenant();

/**
 * Default test user
 */
let defaultTestUser = createTestUser({ tenantId: defaultTestTenant.id });

/**
 * Get the default test tenant
 */
export function getTestTenant() {
  return defaultTestTenant;
}

/**
 * Get the default test user
 */
export function getTestUser() {
  return defaultTestUser;
}

/**
 * Create a test request context
 */
export function createTestContext(options: {
  tenantId?: string;
  userId?: string | null;
  source?: string;
} = {}): RequestContext {
  // Use explicit check for undefined to allow null userId
  const userId = options.userId === undefined ? defaultTestUser.id : options.userId;

  return createRequestContext({
    requestId: `req_test_${Date.now()}`,
    tenantId: (options.tenantId ?? defaultTestTenant.id) as TenantId,
    userId: userId as UserId | null,
    source: options.source ?? 'test',
  });
}

/**
 * Create an unauthenticated test context
 */
export function createUnauthenticatedContext(options: {
  tenantId?: string;
} = {}): RequestContext {
  return createTestContext({
    ...options,
    userId: null,
  });
}

// ============================================================================
// Setup and Teardown
// ============================================================================

/**
 * Setup function to run before each test
 */
export function setupIntegrationTest(): void {
  // Reset all counters
  resetTenantCounter();
  resetUserCounters();

  // Reset seed task counter if set
  if (resetSeedTaskCounterFn) {
    resetSeedTaskCounterFn();
  }

  // Reset mock storage
  resetMockStorage();
  resetMockWorkflowHandles();

  // Recreate default fixtures
  defaultTestTenant = createTestTenant();
  defaultTestUser = createTestUser({ tenantId: defaultTestTenant.id });

  // Note: We don't call vi.clearAllMocks() here because each test
  // creates its own fresh mock instances in their beforeEach
}

/**
 * Teardown function to run after each test
 */
export function teardownIntegrationTest(): void {
  // Clean up any remaining resources
  vi.restoreAllMocks();
}

/**
 * Hook to setup/teardown for each test
 */
export function useIntegrationTestSetup(): void {
  beforeEach(() => {
    setupIntegrationTest();
  });

  afterEach(() => {
    teardownIntegrationTest();
  });
}
