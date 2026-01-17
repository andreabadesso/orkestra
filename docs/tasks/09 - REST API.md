# Task 09: REST API Implementation

## Overview

Implement the `@orkestra/api` package with REST/tRPC endpoints for traditional API access.

## Phase

🟡 **Phase 3: Interfaces**

## Priority

🟡 **High** - Required for Dashboard and integrations

## Estimated Effort

6-8 hours

## Description

Create a REST API (with tRPC for type-safety) that mirrors the MCP tools, plus admin endpoints for user/tenant management.

## Requirements

### Package Structure

```
packages/api/
├── src/
│   ├── index.ts
│   ├── server.ts              # Express/Fastify setup
│   ├── trpc/
│   │   ├── index.ts           # tRPC router
│   │   ├── context.ts         # Request context
│   │   ├── routers/
│   │   │   ├── workflow.ts
│   │   │   ├── task.ts
│   │   │   ├── conversation.ts
│   │   │   └── admin.ts
│   │   └── middleware/
│   │       ├── auth.ts
│   │       └── tenant.ts
│   ├── rest/
│   │   ├── index.ts           # REST routes (optional)
│   │   └── openapi.ts         # OpenAPI spec generation
│   └── middleware/
│       ├── error-handler.ts
│       ├── cors.ts
│       └── logging.ts
├── package.json
└── tsconfig.json
```

### tRPC Setup

```typescript
// trpc/index.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { createContext, Context } from './context';

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        code: error.cause instanceof OrkestraError
          ? error.cause.code
          : 'INTERNAL_ERROR',
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Authenticated procedure
export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// Admin procedure
export const adminProcedure = authedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});
```

### Context Setup

```typescript
// trpc/context.ts
import { inferAsyncReturnType } from '@trpc/server';
import { CreateHTTPContextOptions } from '@trpc/server/adapters/standalone';
import { RequestContext } from '@orkestra/core';

export async function createContext(
  opts: CreateHTTPContextOptions
): Promise<Context> {
  const { req } = opts;

  // Extract auth token
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string;

  let user: RequestContext | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    // JWT token validation
    user = await validateJWT(authHeader.slice(7));
  } else if (apiKey) {
    // API key validation
    user = await validateAPIKey(apiKey);
  }

  return {
    user,
    services: getServices(), // DI container
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
```

### Workflow Router

```typescript
// trpc/routers/workflow.ts
import { z } from 'zod';
import { router, authedProcedure } from '../index';

export const workflowRouter = router({
  start: authedProcedure
    .input(z.object({
      name: z.string(),
      input: z.record(z.unknown()),
      workflowId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const handle = await ctx.services.workflow.start(ctx.user, input);
      return {
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
      };
    }),

  get: authedProcedure
    .input(z.object({
      workflowId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.services.workflow.get(ctx.user, input.workflowId);
    }),

  list: authedProcedure
    .input(z.object({
      status: z.enum(['running', 'completed', 'failed']).optional(),
      limit: z.number().default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.services.workflow.list(ctx.user, input);
    }),

  signal: authedProcedure
    .input(z.object({
      workflowId: z.string(),
      signalName: z.string(),
      data: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.services.workflow.signal(
        ctx.user,
        input.workflowId,
        input.signalName,
        input.data
      );
      return { success: true };
    }),

  cancel: authedProcedure
    .input(z.object({
      workflowId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.services.workflow.cancel(ctx.user, input.workflowId, input.reason);
      return { success: true };
    }),
});
```

### Task Router

```typescript
// trpc/routers/task.ts
export const taskRouter = router({
  create: authedProcedure
    .input(z.object({
      title: z.string(),
      description: z.string().optional(),
      form: z.record(z.unknown()),
      assignTo: z.object({
        userId: z.string().optional(),
        groupId: z.string().optional(),
      }),
      context: z.record(z.unknown()).optional(),
      conversationId: z.string().optional(),
      sla: z.object({
        deadline: z.string(),
        onBreach: z.enum(['escalate', 'notify', 'cancel']).optional(),
      }).optional(),
      workflowId: z.string(),
      workflowRunId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.task.create(ctx.user, input);
    }),

  get: authedProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.services.task.get(ctx.user, input.taskId);
    }),

  list: authedProcedure
    .input(z.object({
      status: z.enum(['pending', 'completed', 'all']).default('pending'),
      assignedTo: z.string().optional(),
      limit: z.number().default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.services.task.list(ctx.user, input);
    }),

  pending: authedProcedure
    .query(async ({ ctx }) => {
      return ctx.services.task.listPending(ctx.user);
    }),

  claim: authedProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.task.claim(ctx.user, input.taskId);
    }),

  complete: authedProcedure
    .input(z.object({
      taskId: z.string(),
      formData: z.record(z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.task.complete(ctx.user, input.taskId, input.formData);
    }),

  reassign: authedProcedure
    .input(z.object({
      taskId: z.string(),
      assignTo: z.object({
        userId: z.string().optional(),
        groupId: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.task.reassign(ctx.user, input.taskId, input.assignTo);
    }),

  addComment: authedProcedure
    .input(z.object({
      taskId: z.string(),
      comment: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.services.task.addComment(ctx.user, input.taskId, input.comment);
      return { success: true };
    }),
});
```

### Admin Router

```typescript
// trpc/routers/admin.ts
export const adminRouter = router({
  // Tenant
  getTenant: adminProcedure.query(async ({ ctx }) => {
    return ctx.services.tenant.get(ctx.user);
  }),

  updateTenant: adminProcedure
    .input(z.object({
      name: z.string().optional(),
      config: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.tenant.update(ctx.user, input);
    }),

  // Users
  listUsers: adminProcedure
    .input(z.object({
      status: z.enum(['active', 'inactive', 'all']).default('active'),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.services.user.list(ctx.user, input);
    }),

  createUser: adminProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string(),
      role: z.enum(['admin', 'member']).default('member'),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.user.create(ctx.user, input);
    }),

  updateUser: adminProcedure
    .input(z.object({
      userId: z.string(),
      name: z.string().optional(),
      role: z.enum(['admin', 'member']).optional(),
      status: z.enum(['active', 'inactive']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId, ...data } = input;
      return ctx.services.user.update(ctx.user, userId, data);
    }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.services.user.delete(ctx.user, input.userId);
      return { success: true };
    }),

  // Groups
  listGroups: adminProcedure.query(async ({ ctx }) => {
    return ctx.services.group.list(ctx.user);
  }),

  createGroup: adminProcedure
    .input(z.object({
      name: z.string(),
      slug: z.string(),
      description: z.string().optional(),
      assignmentStrategy: z.enum(['round-robin', 'load-balanced', 'manual']).default('round-robin'),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.group.create(ctx.user, input);
    }),

  updateGroup: adminProcedure
    .input(z.object({
      groupId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      assignmentStrategy: z.enum(['round-robin', 'load-balanced', 'manual']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { groupId, ...data } = input;
      return ctx.services.group.update(ctx.user, groupId, data);
    }),

  updateGroupMembers: adminProcedure
    .input(z.object({
      groupId: z.string(),
      userIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.group.setMembers(ctx.user, input.groupId, input.userIds);
    }),
});
```

### Main App Router

```typescript
// trpc/routers/index.ts
import { router } from '../index';
import { workflowRouter } from './workflow';
import { taskRouter } from './task';
import { conversationRouter } from './conversation';
import { adminRouter } from './admin';

export const appRouter = router({
  workflow: workflowRouter,
  task: taskRouter,
  conversation: conversationRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
```

### Server Setup

```typescript
// server.ts
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { appRouter } from './trpc/routers';
import { createContext } from './trpc/context';
import cors from 'cors';

export function createServer(options: ServerOptions) {
  const server = createHTTPServer({
    router: appRouter,
    createContext,
    middleware: cors(),
  });

  return server;
}

export async function startServer(port = 3000) {
  const server = createServer({});
  server.listen(port);
  console.log(`Orkestra API listening on port ${port}`);
}
```

## Acceptance Criteria

- [ ] tRPC server starts and accepts requests
- [ ] All workflow endpoints working
- [ ] All task endpoints working
- [ ] All conversation endpoints working
- [ ] Admin endpoints working (tenant, users, groups)
- [ ] JWT authentication working
- [ ] API key authentication working
- [ ] Tenant isolation enforced
- [ ] Error handling returns proper HTTP codes
- [ ] tRPC client types exported
- [ ] CORS configured
- [ ] Request logging
- [ ] OpenAPI spec generated (optional)
- [ ] Unit tests for routers
- [ ] Integration tests

## Dependencies

- [[01 - Initialize Monorepo]]
- [[03 - Core Package Setup]]
- [[05 - Database Schema]]
- [[06 - Task Manager]]

## Blocked By

- [[06 - Task Manager]]

## Blocks

- [[10 - Dashboard UI]]
- [[11 - Dashboard Backend]]

## Technical Notes

### Dependencies

```json
{
  "dependencies": {
    "@trpc/server": "^10.45.0",
    "zod": "^3.22.0",
    "cors": "^2.8.5",
    "jsonwebtoken": "^9.0.0"
  }
}
```

### tRPC Client Export

Export types for frontend consumption:

```typescript
// packages/api/src/client.ts
export type { AppRouter } from './trpc/routers';
```

### OpenAPI Generation (Optional)

Use `trpc-openapi` for REST endpoints:

```typescript
import { generateOpenApiDocument } from 'trpc-openapi';

export const openApiDocument = generateOpenApiDocument(appRouter, {
  title: 'Orkestra API',
  version: '1.0.0',
  baseUrl: 'http://localhost:3000',
});
```

## References

- [tRPC Documentation](https://trpc.io/docs)
- [tRPC Standalone Adapter](https://trpc.io/docs/server/adapters/standalone)

## Tags

#orkestra #task #api #trpc #rest
