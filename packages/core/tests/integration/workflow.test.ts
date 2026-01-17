/**
 * Workflow Integration Tests
 *
 * Tests for workflow-related functionality including:
 * - Workflow start (mocked)
 * - Task creation triggers
 * - Signal handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { Client as TemporalClient } from '@temporalio/client';

import { TaskService } from '../../src/services/task-manager/task-service.js';
import type { CreateTaskOptions } from '../../src/services/task-manager/types.js';
import {
  useIntegrationTestSetup,
  createMockPrismaClient,
  createMockTemporalClient,
  createTestContext,
  getMockWorkflowHandles,
  getMockStorage,
  getTestTenant,
  getTestUser,
} from './setup.js';
import {
  simpleFormSchema,
  seedMockTask,
  getWorkflowSignals,
  wasSignalSent,
  getLastSignal,
} from './helpers.js';

describe('Workflow Integration', () => {
  // Setup test environment
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

  describe('Task Creation from Workflow', () => {
    it('should create a task with workflow reference', async () => {
      const ctx = createTestContext();
      const tenant = getTestTenant();
      const user = getTestUser();

      const taskOptions: CreateTaskOptions = {
        title: 'Review customer request',
        form: simpleFormSchema,
        assignTo: { userId: user.id },
        workflowId: 'wfl_customer_support_123',
        workflowRunId: 'run_abc123',
      };

      const task = await taskService.create(ctx, taskOptions);

      expect(task).toBeDefined();
      expect(task.title).toBe('Review customer request');
      expect(task.workflowId).toBe('wfl_customer_support_123');
      expect(task.workflowRunId).toBe('run_abc123');
      expect(task.tenantId).toBe(tenant.id);
    });

    it('should create a task with context data', async () => {
      const ctx = createTestContext();
      const user = getTestUser();

      const taskOptions: CreateTaskOptions = {
        title: 'Process order',
        form: simpleFormSchema,
        assignTo: { userId: user.id },
        workflowId: 'wfl_order_123',
        workflowRunId: 'run_order_abc',
        context: {
          orderId: 'order_12345',
          customerName: 'John Doe',
        },
        conversationId: 'cnv_conv_123',
      };

      const task = await taskService.create(ctx, taskOptions);

      expect(task.context).toMatchObject({
        orderId: 'order_12345',
        customerName: 'John Doe',
        conversationId: 'cnv_conv_123',
      });
    });

    it('should create a task with SLA configuration', async () => {
      const ctx = createTestContext();
      const user = getTestUser();

      const taskOptions: CreateTaskOptions = {
        title: 'Urgent approval needed',
        form: simpleFormSchema,
        assignTo: { userId: user.id },
        workflowId: 'wfl_approval_123',
        workflowRunId: 'run_approval_abc',
        sla: {
          deadline: '30m', // 30 minutes from now
          warnBefore: '10m',
          onBreach: 'escalate',
        },
        priority: 'urgent',
      };

      const task = await taskService.create(ctx, taskOptions);

      expect(task.priority).toBe('urgent');
      expect(task.dueAt).toBeDefined();
      expect(task.warnAt).toBeDefined();
    });
  });

  describe('Workflow Signal Handling', () => {
    it('should signal workflow when task is completed', async () => {
      const ctx = createTestContext();
      const workflowId = 'wfl_test_signal_123';
      const workflowRunId = 'run_signal_abc';

      // Seed a task linked to a workflow
      const task = seedMockTask({
        assignedUserId: ctx.userId,
        workflowId,
        workflowRunId,
        status: 'in_progress',
      });

      // Complete the task
      await taskService.complete(ctx, task.id, { answer: 'Task completed' });

      // Verify signal was sent
      const signals = getWorkflowSignals(workflowId);
      expect(signals.length).toBeGreaterThan(0);
      expect(wasSignalSent(workflowId, 'taskCompleted')).toBe(true);

      const lastSignal = getLastSignal(workflowId);
      expect(lastSignal?.name).toBe('taskCompleted');
      expect(lastSignal?.args[0]).toMatchObject({
        taskId: task.id,
        formData: { answer: 'Task completed' },
        completedBy: ctx.userId,
      });
    });

    it('should signal workflow when task is cancelled', async () => {
      const ctx = createTestContext();
      const workflowId = 'wfl_cancel_signal_123';
      const workflowRunId = 'run_cancel_abc';

      const task = seedMockTask({
        assignedUserId: ctx.userId,
        workflowId,
        workflowRunId,
        status: 'assigned',
      });

      await taskService.cancel(ctx, task.id, 'No longer needed');

      expect(wasSignalSent(workflowId, 'taskCancelled')).toBe(true);

      const lastSignal = getLastSignal(workflowId);
      expect(lastSignal?.name).toBe('taskCancelled');
      expect(lastSignal?.args[0]).toMatchObject({
        taskId: task.id,
        reason: 'No longer needed',
      });
    });

    it('should signal workflow when task is escalated', async () => {
      const ctx = createTestContext();
      const workflowId = 'wfl_escalate_signal_123';
      const workflowRunId = 'run_escalate_abc';

      const task = seedMockTask({
        assignedUserId: ctx.userId,
        workflowId,
        workflowRunId,
        status: 'assigned',
      });

      await taskService.escalate(ctx, task.id, 'Needs senior approval');

      expect(wasSignalSent(workflowId, 'taskEscalated')).toBe(true);

      const lastSignal = getLastSignal(workflowId);
      expect(lastSignal?.name).toBe('taskEscalated');
      expect(lastSignal?.args[0]).toMatchObject({
        taskId: task.id,
      });
    });

    it('should not signal if task has no workflow reference', async () => {
      const ctx = createTestContext();

      // Seed a task without workflow reference
      const task = seedMockTask({
        assignedUserId: ctx.userId,
        workflowId: null,
        workflowRunId: null,
        status: 'in_progress',
      });

      // Complete the task
      await taskService.complete(ctx, task.id, { answer: 'Done' });

      // No signals should be sent
      const handles = getMockWorkflowHandles();
      expect(handles.size).toBe(0);
    });
  });

  describe('Workflow Context Propagation', () => {
    it('should maintain tenant isolation in workflow tasks', async () => {
      const tenant1 = getTestTenant();
      const ctx1 = createTestContext({ tenantId: tenant1.id });

      // Create task for tenant 1
      const task1 = await taskService.create(ctx1, {
        title: 'Tenant 1 Task',
        form: simpleFormSchema,
        assignTo: { userId: ctx1.userId as string },
        workflowId: 'wfl_tenant1_123',
        workflowRunId: 'run_t1_abc',
      });

      expect(task1.tenantId).toBe(tenant1.id);

      // Try to access task from different tenant context
      const ctx2 = createTestContext({ tenantId: 'ten_different_tenant' });
      const foundTask = await taskService.findById(ctx2, task1.id);

      // Should not find task (different tenant)
      expect(foundTask).toBeNull();
    });

    it('should create task with metadata from workflow', async () => {
      const ctx = createTestContext();
      const user = getTestUser();

      const taskOptions: CreateTaskOptions = {
        title: 'Task with metadata',
        form: simpleFormSchema,
        assignTo: { userId: user.id },
        workflowId: 'wfl_metadata_123',
        workflowRunId: 'run_meta_abc',
        metadata: {
          source: 'ai-agent',
          confidence: 0.85,
          category: 'support',
        },
      };

      const task = await taskService.create(ctx, taskOptions);

      expect(task.metadata).toMatchObject({
        source: 'ai-agent',
        confidence: 0.85,
        category: 'support',
      });
    });
  });

  describe('Workflow Error Handling', () => {
    it('should handle signal failure gracefully', async () => {
      const ctx = createTestContext();
      const workflowId = 'wfl_error_123';
      const workflowRunId = 'run_error_abc';

      // Create a mock that throws on signal
      const errorTemporalClient = createMockTemporalClient();
      const mockHandle = errorTemporalClient.workflow.getHandle(workflowId, workflowRunId);
      mockHandle.signal.mockRejectedValue(new Error('Workflow not found'));

      const errorTaskService = new TaskService({
        prisma,
        temporalClient: errorTemporalClient as unknown as TemporalClient,
      });

      const task = seedMockTask({
        assignedUserId: ctx.userId,
        workflowId,
        workflowRunId,
        status: 'in_progress',
      });

      // Complete should succeed even if signal fails
      // (signal failure is logged but doesn't break task completion)
      const completedTask = await errorTaskService.complete(ctx, task.id, { answer: 'Done' });

      expect(completedTask.status).toBe('completed');
    });
  });
});
