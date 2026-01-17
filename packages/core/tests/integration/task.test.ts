/**
 * Task Lifecycle Integration Tests
 *
 * Tests for task lifecycle operations including:
 * - Task creation
 * - Claim flow
 * - Complete flow
 * - Form validation
 * - Tenant isolation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { Client as TemporalClient } from '@temporalio/client';

import { TaskService } from '../../src/services/task-manager/task-service.js';
import type { CreateTaskOptions, FormSchema } from '../../src/services/task-manager/types.js';
import { ValidationError, InvalidStateError, NotFoundError } from '../../src/errors/index.js';
import {
  useIntegrationTestSetup,
  createMockPrismaClient,
  createMockTemporalClient,
  createTestContext,
  createUnauthenticatedContext,
  getTestTenant,
  getTestUser,
  getMockStorage,
} from './setup.js';
import {
  simpleFormSchema,
  complexFormSchema,
  seedMockTask,
  seedMockTasks,
  getMockTask,
  getAllMockTasks,
  getMockTaskHistory,
  expectTaskStatus,
  expectTaskClaimedBy,
  expectTaskCompletedBy,
} from './helpers.js';
import { createTestUser, createTestGroup } from '../fixtures/index.js';

describe('Task Lifecycle', () => {
  useIntegrationTestSetup();

  let prisma: PrismaClient;
  let temporalClient: ReturnType<typeof createMockTemporalClient>;
  let taskService: TaskService;

  beforeEach(() => {
    prisma = createMockPrismaClient();
    temporalClient = createMockTemporalClient();
    taskService = new TaskService({
      prisma,
      temporalClient: temporalClient as unknown as TemporalClient,
    });
  });

  describe('Task Creation', () => {
    it('should create a task with minimal options', async () => {
      const ctx = createTestContext();
      const user = getTestUser();

      const task = await taskService.create(ctx, {
        title: 'Simple task',
        form: simpleFormSchema,
        assignTo: { userId: user.id },
        workflowId: 'wfl_123',
        workflowRunId: 'run_123',
      });

      expect(task).toBeDefined();
      expect(task.id).toMatch(/^tsk_/);
      expect(task.title).toBe('Simple task');
      expect(task.status).toBe('assigned');
      expect(task.priority).toBe('medium');
      expect(task.assignedUserId).toBe(user.id);
    });

    it('should create a task with all options', async () => {
      const ctx = createTestContext();
      const user = getTestUser();

      const task = await taskService.create(ctx, {
        title: 'Complete task',
        description: 'This is a detailed description',
        form: complexFormSchema,
        assignTo: { userId: user.id },
        workflowId: 'wfl_complete_123',
        workflowRunId: 'run_complete_123',
        priority: 'high',
        type: 'approval',
        context: { orderId: '12345' },
        conversationId: 'cnv_123',
        metadata: { source: 'api' },
        sla: {
          deadline: '1h',
          warnBefore: '15m',
        },
      });

      expect(task.title).toBe('Complete task');
      expect(task.description).toBe('This is a detailed description');
      expect(task.priority).toBe('high');
      expect(task.type).toBe('approval');
      expect(task.dueAt).not.toBeNull();
      expect(task.warnAt).not.toBeNull();
    });

    it('should create a task with group assignment', async () => {
      const ctx = createTestContext();
      const tenant = getTestTenant();
      const user = getTestUser();
      const group = createTestGroup({ tenantId: tenant.id, name: 'Support Team' });

      // Add group to mock storage
      getMockStorage().groups.set(group.id, {
        ...group,
        assignmentStrategy: 'round_robin',
      });

      // Add a member to the group so round-robin can assign
      const members = getMockStorage().groupMembers.get(group.id) ?? [];
      members.push({ userId: user.id, groupId: group.id, joinedAt: new Date() });
      getMockStorage().groupMembers.set(group.id, members);

      const task = await taskService.create(ctx, {
        title: 'Group task',
        form: simpleFormSchema,
        assignTo: { groupId: group.id },
        workflowId: 'wfl_group_123',
        workflowRunId: 'run_group_123',
      });

      expect(task.assignedGroupId).toBe(group.id);
      // With round-robin, it should select a user from the group
      expect(task.assignedUserId).toBe(user.id);
      expect(task.status).toBe('assigned');
    });

    it('should reject invalid form schema', async () => {
      const ctx = createTestContext();
      const user = getTestUser();

      const invalidSchema = {
        fields: {
          answer: {
            type: 'invalid_type', // Invalid type
            label: 'Answer',
          },
        },
      } as unknown as FormSchema;

      await expect(
        taskService.create(ctx, {
          title: 'Invalid schema task',
          form: invalidSchema,
          assignTo: { userId: user.id },
          workflowId: 'wfl_invalid_123',
          workflowRunId: 'run_invalid_123',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should record task creation in history', async () => {
      const ctx = createTestContext();
      const user = getTestUser();

      const task = await taskService.create(ctx, {
        title: 'History test task',
        form: simpleFormSchema,
        assignTo: { userId: user.id },
        workflowId: 'wfl_history_123',
        workflowRunId: 'run_history_123',
      });

      const history = getMockTaskHistory(task.id);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].action).toBe('created');
    });
  });

  describe('Task Claim Flow', () => {
    it('should allow user to claim a group-assigned task', async () => {
      const ctx = createTestContext();
      const tenant = getTestTenant();
      const group = createTestGroup({ tenantId: tenant.id });

      const task = seedMockTask({
        assignedGroupId: group.id,
        status: 'assigned',
      });

      const claimedTask = await taskService.claim(ctx, task.id);

      expect(claimedTask.claimedBy).toBe(ctx.userId);
      expect(claimedTask.claimedAt).not.toBeNull();
      expect(claimedTask.status).toBe('in_progress');
    });

    it('should reject claim if task is already claimed', async () => {
      const ctx = createTestContext();
      const otherUser = createTestUser({ tenantId: getTestTenant().id });

      const task = seedMockTask({
        assignedGroupId: 'grp_test_123',
        claimedBy: otherUser.id,
        status: 'in_progress',
      });

      await expect(taskService.claim(ctx, task.id)).rejects.toThrow(InvalidStateError);
    });

    it('should reject claim for completed task', async () => {
      const ctx = createTestContext();

      const task = seedMockTask({
        assignedGroupId: 'grp_test_123',
        status: 'completed',
      });

      await expect(taskService.claim(ctx, task.id)).rejects.toThrow(InvalidStateError);
    });

    it('should reject claim from unauthenticated context', async () => {
      const ctx = createUnauthenticatedContext();

      const task = seedMockTask({
        assignedGroupId: 'grp_test_123',
        status: 'assigned',
      });

      await expect(taskService.claim(ctx, task.id)).rejects.toThrow(ValidationError);
    });
  });

  describe('Task Complete Flow', () => {
    it('should complete a task with valid form data', async () => {
      const ctx = createTestContext();

      const task = seedMockTask({
        assignedUserId: ctx.userId,
        status: 'in_progress',
        formSchema: simpleFormSchema,
      });

      const completedTask = await taskService.complete(ctx, task.id, {
        answer: 'This is my answer',
      });

      expect(completedTask.status).toBe('completed');
      expect(completedTask.completedBy).toBe(ctx.userId);
      expect(completedTask.completedAt).not.toBeNull();
      expect(completedTask.formData).toMatchObject({
        answer: 'This is my answer',
      });
    });

    it('should complete a task with complex form data', async () => {
      const ctx = createTestContext();

      const task = seedMockTask({
        assignedUserId: ctx.userId,
        status: 'in_progress',
        formSchema: complexFormSchema,
      });

      const completedTask = await taskService.complete(ctx, task.id, {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        category: 'support',
        subscribe: true,
      });

      expect(completedTask.status).toBe('completed');
      expect(completedTask.formData).toMatchObject({
        name: 'John Doe',
        email: 'john@example.com',
        category: 'support',
      });
    });

    it('should reject completion with missing required fields', async () => {
      const ctx = createTestContext();

      const task = seedMockTask({
        assignedUserId: ctx.userId,
        status: 'in_progress',
        formSchema: simpleFormSchema,
      });

      await expect(
        taskService.complete(ctx, task.id, {
          // Missing required 'answer' field
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject completion with invalid field type', async () => {
      const ctx = createTestContext();

      const numberSchema: FormSchema = {
        fields: {
          quantity: {
            type: 'number',
            label: 'Quantity',
            required: true,
          },
        },
      };

      const task = seedMockTask({
        assignedUserId: ctx.userId,
        status: 'in_progress',
        formSchema: numberSchema,
      });

      await expect(
        taskService.complete(ctx, task.id, {
          quantity: 'not a number', // Invalid type
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject completion of already completed task', async () => {
      const ctx = createTestContext();

      const task = seedMockTask({
        assignedUserId: ctx.userId,
        status: 'completed',
      });

      await expect(taskService.complete(ctx, task.id, { answer: 'test' })).rejects.toThrow(
        InvalidStateError
      );
    });

    it('should reject completion from unauthenticated context', async () => {
      const ctx = createUnauthenticatedContext();

      const task = seedMockTask({
        status: 'in_progress',
      });

      await expect(taskService.complete(ctx, task.id, { answer: 'test' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should record completion in history', async () => {
      const ctx = createTestContext();

      const task = seedMockTask({
        assignedUserId: ctx.userId,
        status: 'in_progress',
        formSchema: simpleFormSchema,
      });

      await taskService.complete(ctx, task.id, { answer: 'Done' });

      const history = getMockTaskHistory(task.id);
      const completedEntry = history.find((h) => h.action === 'completed');
      expect(completedEntry).toBeDefined();
      expect(completedEntry?.userId).toBe(ctx.userId);
    });
  });

  describe('Form Validation', () => {
    it('should validate text field min length', async () => {
      const ctx = createTestContext();

      const schema: FormSchema = {
        fields: {
          name: {
            type: 'text',
            label: 'Name',
            required: true,
            validation: { min: 3 },
          },
        },
      };

      const task = seedMockTask({
        assignedUserId: ctx.userId,
        status: 'in_progress',
        formSchema: schema,
      });

      await expect(taskService.complete(ctx, task.id, { name: 'AB' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should validate text field max length', async () => {
      const ctx = createTestContext();

      const schema: FormSchema = {
        fields: {
          code: {
            type: 'text',
            label: 'Code',
            required: true,
            validation: { max: 5 },
          },
        },
      };

      const task = seedMockTask({
        assignedUserId: ctx.userId,
        status: 'in_progress',
        formSchema: schema,
      });

      await expect(taskService.complete(ctx, task.id, { code: 'TOOLONGCODE' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should validate number field range', async () => {
      const ctx = createTestContext();

      const schema: FormSchema = {
        fields: {
          rating: {
            type: 'number',
            label: 'Rating',
            required: true,
            validation: { min: 1, max: 5 },
          },
        },
      };

      const task = seedMockTask({
        assignedUserId: ctx.userId,
        status: 'in_progress',
        formSchema: schema,
      });

      await expect(taskService.complete(ctx, task.id, { rating: 10 })).rejects.toThrow(
        ValidationError
      );
    });

    it('should validate select field options', async () => {
      const ctx = createTestContext();

      const schema: FormSchema = {
        fields: {
          status: {
            type: 'select',
            label: 'Status',
            required: true,
            options: [
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ],
          },
        },
      };

      const task = seedMockTask({
        assignedUserId: ctx.userId,
        status: 'in_progress',
        formSchema: schema,
      });

      await expect(taskService.complete(ctx, task.id, { status: 'invalid_option' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should allow optional fields to be omitted', async () => {
      const ctx = createTestContext();

      const schema: FormSchema = {
        fields: {
          required: {
            type: 'text',
            label: 'Required',
            required: true,
          },
          optional: {
            type: 'text',
            label: 'Optional',
            required: false,
          },
        },
      };

      const task = seedMockTask({
        assignedUserId: ctx.userId,
        status: 'in_progress',
        formSchema: schema,
      });

      const completedTask = await taskService.complete(ctx, task.id, {
        required: 'value',
        // optional field omitted
      });

      expect(completedTask.status).toBe('completed');
    });
  });

  describe('Tenant Isolation', () => {
    it('should not allow access to tasks from different tenant', async () => {
      const tenant1 = getTestTenant();
      const ctx1 = createTestContext({ tenantId: tenant1.id });

      // Create task for tenant 1
      const task = seedMockTask({
        tenantId: tenant1.id,
        title: 'Tenant 1 Task',
      });

      // Try to access from different tenant
      const ctx2 = createTestContext({ tenantId: 'ten_other_tenant' });
      const found = await taskService.findById(ctx2, task.id);

      expect(found).toBeNull();
    });

    it('should only list tasks for current tenant', async () => {
      const tenant1 = getTestTenant();
      const ctx1 = createTestContext({ tenantId: tenant1.id });

      // Seed tasks for tenant 1
      seedMockTasks(3, { tenantId: tenant1.id, status: 'pending' });

      // Seed tasks for different tenant
      seedMockTasks(2, { tenantId: 'ten_other_tenant', status: 'pending' });

      const tasks = await taskService.listPending(ctx1);

      // Should only get tenant 1's tasks
      expect(tasks.every((t) => t.tenantId === tenant1.id)).toBe(true);
    });

    it('should isolate task operations by tenant', async () => {
      const tenant1 = getTestTenant();
      const ctx1 = createTestContext({ tenantId: tenant1.id });

      const task = seedMockTask({
        tenantId: tenant1.id,
        status: 'assigned',
      });

      // Different tenant should not be able to claim
      const ctx2 = createTestContext({ tenantId: 'ten_other_tenant' });

      await expect(taskService.claim(ctx2, task.id)).rejects.toThrow(NotFoundError);
    });
  });

  describe('Task Query Operations', () => {
    it('should find task by ID', async () => {
      const ctx = createTestContext();

      const task = seedMockTask({ tenantId: getTestTenant().id });

      const found = await taskService.findById(ctx, task.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(task.id);
    });

    it('should throw when finding non-existent task with OrThrow', async () => {
      const ctx = createTestContext();

      await expect(taskService.findByIdOrThrow(ctx, 'tsk_nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should list pending tasks', async () => {
      const ctx = createTestContext();
      const tenantId = getTestTenant().id;

      seedMockTask({ tenantId, status: 'pending' });
      seedMockTask({ tenantId, status: 'assigned' });
      seedMockTask({ tenantId, status: 'in_progress' });
      seedMockTask({ tenantId, status: 'completed' });
      seedMockTask({ tenantId, status: 'cancelled' });

      const pending = await taskService.listPending(ctx);

      expect(pending.length).toBe(3);
      expect(pending.every((t) => ['pending', 'assigned', 'in_progress'].includes(t.status))).toBe(
        true
      );
    });

    it('should list tasks by status', async () => {
      const ctx = createTestContext();
      const tenantId = getTestTenant().id;

      seedMockTask({ tenantId, status: 'completed' });
      seedMockTask({ tenantId, status: 'completed' });
      seedMockTask({ tenantId, status: 'pending' });

      const completed = await taskService.listByStatus(ctx, 'completed');

      expect(completed.length).toBe(2);
      expect(completed.every((t) => t.status === 'completed')).toBe(true);
    });

    it('should list tasks for user', async () => {
      const ctx = createTestContext();
      const tenantId = getTestTenant().id;
      const userId = ctx.userId as string;

      // Tasks assigned to user
      seedMockTask({ tenantId, assignedUserId: userId, status: 'assigned' });

      // Tasks claimed by user
      seedMockTask({ tenantId, claimedBy: userId, status: 'in_progress' });

      // Tasks assigned to someone else
      seedMockTask({ tenantId, assignedUserId: 'usr_other', status: 'assigned' });

      const userTasks = await taskService.listForUser(ctx, userId);

      expect(userTasks.length).toBe(2);
    });
  });

  describe('Task Reassignment', () => {
    it('should reassign task to different user', async () => {
      const ctx = createTestContext();
      const newUser = createTestUser({ tenantId: getTestTenant().id });

      const task = seedMockTask({
        assignedUserId: ctx.userId,
        status: 'assigned',
      });

      const reassigned = await taskService.reassign(ctx, task.id, { userId: newUser.id });

      expect(reassigned.assignedUserId).toBe(newUser.id);
      expect(reassigned.claimedBy).toBeNull();
    });

    it('should reassign task to different group', async () => {
      const ctx = createTestContext();
      const newGroup = createTestGroup({ tenantId: getTestTenant().id });

      const task = seedMockTask({
        assignedGroupId: 'grp_original',
        status: 'assigned',
      });

      const reassigned = await taskService.reassign(ctx, task.id, { groupId: newGroup.id });

      expect(reassigned.assignedGroupId).toBe(newGroup.id);
      expect(reassigned.claimedBy).toBeNull();
    });

    it('should not allow reassigning completed task', async () => {
      const ctx = createTestContext();

      const task = seedMockTask({
        status: 'completed',
      });

      await expect(taskService.reassign(ctx, task.id, { userId: 'usr_new' })).rejects.toThrow(
        InvalidStateError
      );
    });
  });

  describe('Task Cancellation', () => {
    it('should cancel a pending task', async () => {
      const ctx = createTestContext();

      const task = seedMockTask({
        status: 'pending',
      });

      const cancelled = await taskService.cancel(ctx, task.id, 'No longer needed');

      expect(cancelled.status).toBe('cancelled');
    });

    it('should record cancellation reason in history', async () => {
      const ctx = createTestContext();

      const task = seedMockTask({
        status: 'assigned',
      });

      await taskService.cancel(ctx, task.id, 'Duplicate task');

      const history = getMockTaskHistory(task.id);
      const cancelledEntry = history.find((h) => h.action === 'cancelled');

      expect(cancelledEntry).toBeDefined();
      expect((cancelledEntry?.data as Record<string, unknown>)?.reason).toBe('Duplicate task');
    });

    it('should not allow cancelling completed task', async () => {
      const ctx = createTestContext();

      const task = seedMockTask({
        status: 'completed',
      });

      await expect(taskService.cancel(ctx, task.id)).rejects.toThrow(InvalidStateError);
    });
  });
});
