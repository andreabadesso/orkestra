# Task 14: Integration Testing

## Overview

Set up comprehensive integration tests that verify the full Orkestra flow works end-to-end.

## Phase

🔴 **Phase 5: Developer Experience**

## Priority

🟡 **High** - Essential for reliability

## Estimated Effort

8-10 hours

## Description

Create integration tests that verify workflows execute correctly, tasks are created and completed, MCP tools work, and the dashboard functions properly.

## Requirements

### Test Structure

```
packages/core/
├── tests/
│   ├── integration/
│   │   ├── setup.ts            # Test setup/teardown
│   │   ├── workflow.test.ts    # Workflow tests
│   │   ├── task.test.ts        # Task lifecycle tests
│   │   ├── mcp.test.ts         # MCP server tests
│   │   └── api.test.ts         # API endpoint tests
│   └── fixtures/
│       ├── tenants.ts
│       ├── users.ts
│       └── workflows.ts
```

### Test Setup

```typescript
// tests/integration/setup.ts
import { PrismaClient } from '@prisma/client';
import { Client, Connection } from '@temporalio/client';
import { Worker } from '@temporalio/worker';
import { createTestTenant, createTestUser } from '../fixtures';

let prisma: PrismaClient;
let temporalClient: Client;
let worker: Worker;

export async function setupIntegration() {
  // Connect to test database
  prisma = new PrismaClient({
    datasources: {
      db: { url: process.env.TEST_DATABASE_URL },
    },
  });

  // Clean database
  await prisma.$executeRaw`TRUNCATE TABLE tasks, users, tenants CASCADE`;

  // Connect to Temporal
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
  });

  temporalClient = new Client({
    connection,
    namespace: 'test',
  });

  // Start test worker
  worker = await Worker.create({
    connection: await NativeConnection.connect({
      address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
    }),
    namespace: 'test',
    taskQueue: 'test-queue',
    workflowsPath: require.resolve('./test-workflows'),
    activities: testActivities,
  });

  // Run worker in background
  worker.run().catch(console.error);

  return { prisma, temporalClient };
}

export async function teardownIntegration() {
  await worker.shutdown();
  await prisma.$disconnect();
}

export async function createTestContext() {
  const tenant = await createTestTenant(prisma);
  const user = await createTestUser(prisma, tenant.id);

  return {
    tenantId: tenant.id,
    userId: user.id,
    role: user.role,
    groups: [],
    permissions: ['tasks:read', 'tasks:write', 'workflows:read', 'workflows:write'],
  };
}
```

### Workflow Integration Tests

```typescript
// tests/integration/workflow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegration, teardownIntegration, createTestContext } from './setup';
import { WorkflowService } from '../../src/services/workflow-service';

describe('Workflow Integration', () => {
  let services: Awaited<ReturnType<typeof setupIntegration>>;
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let workflowService: WorkflowService;

  beforeAll(async () => {
    services = await setupIntegration();
    ctx = await createTestContext();
    workflowService = new WorkflowService(services.temporalClient);
  });

  afterAll(async () => {
    await teardownIntegration();
  });

  it('should start a workflow and wait for completion', async () => {
    const handle = await workflowService.start(ctx, {
      name: 'simple-workflow',
      input: { message: 'Hello' },
    });

    expect(handle.workflowId).toBeDefined();

    // Wait for completion
    const result = await handle.result();
    expect(result).toEqual({ processed: true, message: 'Hello' });
  });

  it('should create a task and wait for human completion', async () => {
    const handle = await workflowService.start(ctx, {
      name: 'task-workflow',
      input: { question: 'What is 2+2?' },
    });

    // Workflow should be running, waiting for task
    const status = await workflowService.get(ctx, handle.workflowId);
    expect(status.status).toBe('RUNNING');

    // Find the created task
    const tasks = await services.prisma.task.findMany({
      where: { workflowId: handle.workflowId },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('ASSIGNED');

    // Complete the task
    const taskService = new TaskService(services.prisma, services.temporalClient);
    await taskService.claim(ctx, tasks[0].id);
    await taskService.complete(ctx, tasks[0].id, { answer: '4' });

    // Workflow should complete
    const result = await handle.result();
    expect(result).toEqual({ answer: '4' });
  });

  it('should handle workflow cancellation', async () => {
    const handle = await workflowService.start(ctx, {
      name: 'long-workflow',
      input: {},
    });

    await workflowService.cancel(ctx, handle.workflowId, 'Test cancellation');

    const status = await workflowService.get(ctx, handle.workflowId);
    expect(status.status).toBe('CANCELLED');
  });

  it('should signal a running workflow', async () => {
    const handle = await workflowService.start(ctx, {
      name: 'signal-workflow',
      input: {},
    });

    await workflowService.signal(ctx, handle.workflowId, 'proceed', {
      approved: true,
    });

    const result = await handle.result();
    expect(result).toEqual({ approved: true });
  });
});
```

### Task Lifecycle Tests

```typescript
// tests/integration/task.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupIntegration, teardownIntegration, createTestContext } from './setup';
import { TaskService } from '../../src/services/task-manager/task-service';

describe('Task Lifecycle', () => {
  let services: Awaited<ReturnType<typeof setupIntegration>>;
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let taskService: TaskService;

  beforeAll(async () => {
    services = await setupIntegration();
    taskService = new TaskService(services.prisma, services.temporalClient);
  });

  afterAll(async () => {
    await teardownIntegration();
  });

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  it('should create a task with form schema', async () => {
    const task = await taskService.create(ctx, {
      title: 'Test Task',
      form: {
        fields: {
          answer: { type: 'text', required: true },
        },
      },
      assignTo: { userId: ctx.userId },
      workflowId: 'test-workflow',
      workflowRunId: 'test-run',
    });

    expect(task.id).toBeDefined();
    expect(task.status).toBe('ASSIGNED');
    expect(task.tenantId).toBe(ctx.tenantId);
  });

  it('should enforce claim before complete', async () => {
    const task = await taskService.create(ctx, {
      title: 'Test Task',
      form: { fields: { answer: { type: 'text' } } },
      assignTo: { userId: ctx.userId },
      workflowId: 'test-workflow',
      workflowRunId: 'test-run',
    });

    // Should fail without claiming
    await expect(
      taskService.complete(ctx, task.id, { answer: 'test' })
    ).rejects.toThrow('Task must be claimed');

    // Should succeed after claiming
    await taskService.claim(ctx, task.id);
    const completed = await taskService.complete(ctx, task.id, { answer: 'test' });
    expect(completed.status).toBe('COMPLETED');
  });

  it('should validate form data on completion', async () => {
    const task = await taskService.create(ctx, {
      title: 'Test Task',
      form: {
        fields: {
          answer: { type: 'text', required: true },
        },
      },
      assignTo: { userId: ctx.userId },
      workflowId: 'test-workflow',
      workflowRunId: 'test-run',
    });

    await taskService.claim(ctx, task.id);

    // Should fail with missing required field
    await expect(
      taskService.complete(ctx, task.id, {})
    ).rejects.toThrow('Invalid form data');
  });

  it('should handle SLA escalation', async () => {
    const task = await taskService.create(ctx, {
      title: 'Urgent Task',
      form: { fields: {} },
      assignTo: { userId: ctx.userId },
      workflowId: 'test-workflow',
      workflowRunId: 'test-run',
      sla: {
        deadline: '1s', // Very short for testing
        onBreach: 'escalate',
      },
    });

    // Wait for SLA to breach
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check task was escalated
    const updated = await taskService.get(ctx, task.id);
    expect(updated.status).toBe('ESCALATED');
  });

  it('should enforce tenant isolation', async () => {
    // Create task in tenant A
    const taskA = await taskService.create(ctx, {
      title: 'Tenant A Task',
      form: { fields: {} },
      assignTo: { userId: ctx.userId },
      workflowId: 'test-workflow',
      workflowRunId: 'test-run',
    });

    // Create context for different tenant
    const ctxB = await createTestContext();

    // Should not find task from different tenant
    const task = await taskService.get(ctxB, taskA.id);
    expect(task).toBeNull();
  });
});
```

### MCP Server Tests

```typescript
// tests/integration/mcp.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createMCPServer } from '@orkestra/mcp-server';

describe('MCP Server', () => {
  let mcpClient: Client;

  beforeAll(async () => {
    const server = createMCPServer({
      // ... services
    });

    // Create test client connected to server
    mcpClient = await createTestMCPClient(server);
  });

  it('should list available tools', async () => {
    const tools = await mcpClient.listTools();

    expect(tools.tools).toContainEqual(
      expect.objectContaining({ name: 'workflow_start' })
    );
    expect(tools.tools).toContainEqual(
      expect.objectContaining({ name: 'task_create' })
    );
  });

  it('should start a workflow via MCP', async () => {
    const result = await mcpClient.callTool({
      name: 'workflow_start',
      arguments: {
        name: 'simple-workflow',
        input: { test: true },
      },
    });

    expect(result.content[0].text).toContain('workflowId');
  });

  it('should list pending tasks via MCP', async () => {
    const result = await mcpClient.callTool({
      name: 'task_list',
      arguments: { status: 'pending' },
    });

    expect(result.content[0].text).toBeDefined();
    const tasks = JSON.parse(result.content[0].text);
    expect(Array.isArray(tasks)).toBe(true);
  });

  it('should read resources', async () => {
    const result = await mcpClient.readResource({
      uri: 'orkestra://workflows',
    });

    expect(result.contents[0].text).toBeDefined();
  });
});
```

### API Tests

```typescript
// tests/integration/api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '@orkestra/api';
import supertest from 'supertest';

describe('API Endpoints', () => {
  let request: supertest.SuperTest<supertest.Test>;
  let authToken: string;

  beforeAll(async () => {
    const server = createServer({ /* ... */ });
    request = supertest(server);

    // Get auth token
    const loginRes = await request.post('/auth/login').send({
      email: 'test@example.com',
      password: 'password',
    });
    authToken = loginRes.body.accessToken;
  });

  describe('Tasks API', () => {
    it('GET /trpc/task.pending returns pending tasks', async () => {
      const res = await request
        .get('/trpc/task.pending')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.result.data).toBeInstanceOf(Array);
    });

    it('POST /trpc/task.complete validates form data', async () => {
      const res = await request
        .post('/trpc/task.complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: 'test-task-id',
          formData: {},
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Admin API', () => {
    it('requires admin role', async () => {
      const res = await request
        .get('/trpc/admin.listUsers')
        .set('Authorization', `Bearer ${authToken}`);

      // Should fail if user is not admin
      expect(res.status).toBe(403);
    });
  });
});
```

### Test Configuration

```typescript
// vitest.config.ts (for integration tests)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/integration/setup.ts'],
    testTimeout: 30000, // Workflows can take time
    hookTimeout: 30000,
    pool: 'forks', // Isolate tests
    poolOptions: {
      forks: {
        singleFork: true, // Run sequentially
      },
    },
  },
});
```

## Acceptance Criteria

- [ ] Test setup creates isolated test environment
- [ ] Workflow start/completion tests pass
- [ ] Task lifecycle tests pass
- [ ] SLA escalation tests pass
- [ ] Tenant isolation tests pass
- [ ] MCP tool tests pass
- [ ] API endpoint tests pass
- [ ] Tests clean up after themselves
- [ ] CI/CD integration configured
- [ ] Test coverage report generated

## Dependencies

- [[04 - Temporal Integration]]
- [[05 - Database Schema]]
- [[06 - Task Manager]]
- [[08 - MCP Server]]
- [[09 - REST API]]

## Blocked By

- [[08 - MCP Server]]
- [[09 - REST API]]

## Blocks

- [[15 - Documentation]]

## Technical Notes

### Dependencies

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "supertest": "^6.3.0",
    "@types/supertest": "^2.0.0"
  }
}
```

### CI Configuration

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: orkestra_test
        ports:
          - 5432:5432
      temporal:
        image: temporalio/auto-setup:latest
        ports:
          - 7233:7233

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install
      - run: pnpm test:integration
        env:
          TEST_DATABASE_URL: postgresql://test:test@localhost:5432/orkestra_test
          TEMPORAL_ADDRESS: localhost:7233
```

## References

- [Vitest Documentation](https://vitest.dev/)
- [Temporal Testing](https://docs.temporal.io/dev-guide/typescript/testing)

## Tags

#orkestra #task #testing #integration #ci-cd
