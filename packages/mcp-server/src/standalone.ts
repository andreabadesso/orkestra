/**
 * Standalone MCP Server Entry Point
 *
 * This file provides a way to run the MCP server as a standalone process.
 * It's used by the bin/orkestra-mcp.js entry point.
 */

import { startMCPServer } from './server.js';
import { generateTenantId, generateUserId, generateTaskId } from '@orkestra/core';
import { getPrismaClient } from '@orkestra/core';
import type { OrkestraServices, TaskService as TaskServiceInterface } from './types.js';

export async function main() {
  const debug = process.env['ORKESTRA_DEBUG'] === 'true';

  const prisma = getPrismaClient();

  const tenantId = generateTenantId();
  const userId = generateUserId();

  const taskServiceAdapter: TaskServiceInterface = {
    async create(input: unknown) {
      const opts = input as any;
      const task = await prisma.task.create({
        data: {
          id: generateTaskId(),
          type: opts.type || 'task',
          title: opts.title,
          description: opts.description,
          status: 'pending',
          priority: opts.priority || 'medium',
          formSchema: opts.form || {},
          assignedGroupId: opts.assignment?.groupId,
          assignedUserId: opts.assignment?.userId,
          tenantId,
          workflowId: opts.workflowId,
          workflowRunId: opts.workflowRunId,
          context: opts.context,
          metadata: opts.metadata,
          dueAt: opts.sla?.dueAt || opts.sla?.deadline,
          warnAt: opts.sla?.warnBeforeMinutes
            ? new Date(Date.now() + opts.sla.warnBeforeMinutes * 60 * 1000)
            : null,
          escalationConfig: opts.sla?.escalation,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as any);
      return task;
    },

    async get(taskId: string) {
      return await prisma.task.findUnique({
        where: { id: taskId },
      });
    },

    async list(_filter?: unknown) {
      const where: any = {};
      if (_filter && typeof _filter === 'object') {
        const f = _filter as Record<string, unknown>;
        if (f['status']) where['status'] = f['status'];
        if (f['priority']) where['priority'] = f['priority'];
        if (f['assignedToUserId']) where['assignedUserId'] = f['assignedToUserId'];
        if (f['assignedToGroupId']) where['assignedGroupId'] = f['assignedToGroupId'];
        if (f['type']) where['type'] = f['type'];
        if (f['workflowId']) where['workflowId'] = f['workflowId'];
      }
      const tasks = await prisma.task.findMany({
        where,
        take: 100,
        orderBy: { createdAt: 'desc' },
      });
      return { items: tasks, total: tasks.length };
    },

    async complete(taskId: string, result: unknown) {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      const updated = await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          completedBy: userId,
          formData: result as any,
          updatedAt: new Date(),
        },
      });
      return updated;
    },

    async reassign(taskId: string, assignment: unknown) {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      const updated = await prisma.task.update({
        where: { id: taskId },
        data: {
          assignedUserId: (assignment as any).userId || undefined,
          assignedGroupId: (assignment as any).groupId || undefined,
          updatedAt: new Date(),
        },
      });
      return updated;
    },

    async addComment(taskId: string, comment: { content: string; userId?: string }) {
      await prisma.taskHistory.create({
        data: {
          id: `cmt_${Date.now()}`,
          taskId,
          action: 'comment',
          data: { content: comment.content },
          userId: comment.userId || userId,
          createdAt: new Date(),
        },
      });
    },
  };

  const mockWorkflowService: OrkestraServices['workflows'] = {
    async start(_input: { type: string; input: unknown; options?: unknown }): Promise<unknown> {
      return { workflowId: `wfl_${Date.now()}`, type: _input.type, input: _input.input };
    },
    async get(workflowId: string): Promise<unknown> {
      return { id: workflowId, type: 'mock-workflow', status: 'running' };
    },
    async list(_filter?: unknown): Promise<unknown> {
      return { workflows: [], total: 0 };
    },
    async signal(
      _workflowId: string,
      _signal: { name: string; args?: unknown[] }
    ): Promise<void> {},
    async cancel(_workflowId: string, _reason?: string): Promise<void> {},
  };

  const mockConversationService: OrkestraServices['conversations'] = {
    async create(_input: unknown): Promise<unknown> {
      return { id: `cnv_${Date.now()}`, messages: [] };
    },
    async get(conversationId: string, _includeMessages?: boolean): Promise<unknown> {
      return { id: conversationId, messages: [] };
    },
    async list(_filter?: unknown): Promise<unknown> {
      return { conversations: [], total: 0 };
    },
    async append(_conversationId: string, _message: unknown): Promise<unknown> {
      return { success: true };
    },
  };

  const mockUserService: OrkestraServices['users'] = {
    async listUsers(_filter?: unknown): Promise<unknown> {
      return { users: [], total: 0 };
    },
    async listGroups(_filter?: unknown): Promise<unknown> {
      return { groups: [], total: 0 };
    },
  };

  const services: OrkestraServices = {
    tasks: taskServiceAdapter,
    workflows: mockWorkflowService,
    conversations: mockConversationService,
    users: mockUserService,
  };

  await startMCPServer(
    {
      name: 'orkestra',
      version: '0.0.1',
      debug,
    },
    services
  );
}
