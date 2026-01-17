# Task 05: Database Schema & Repository Layer

## Overview

Implement the PostgreSQL database schema and repository layer using Prisma ORM.

## Phase

🟢 **Phase 2: Core Engine**

## Priority

🔴 **Critical** - Required for persistence

## Estimated Effort

6-8 hours

## Description

Create the database schema for all Orkestra entities using Prisma, implement the repository pattern for data access with tenant scoping built-in.

## Requirements

### Package Structure Addition

```
packages/core/src/
├── db/
│   ├── index.ts
│   ├── client.ts           # Prisma client setup
│   ├── migrations/         # Prisma migrations
│   └── repositories/
│       ├── index.ts
│       ├── base.ts         # Base repository with tenant scoping
│       ├── tenant.ts
│       ├── user.ts
│       ├── group.ts
│       ├── task.ts
│       ├── conversation.ts
│       └── audit.ts
```

### Prisma Schema

```prisma
// packages/core/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// TENANTS
// ============================================

model Tenant {
  id        String       @id @default(uuid())
  name      String
  slug      String       @unique
  config    Json         @default("{}")
  limits    Json?
  status    TenantStatus @default(ACTIVE)
  createdAt DateTime     @default(now()) @map("created_at")
  updatedAt DateTime     @updatedAt @map("updated_at")

  users         User[]
  groups        Group[]
  tasks         Task[]
  conversations Conversation[]
  auditEvents   AuditEvent[]

  @@map("tenants")
}

enum TenantStatus {
  ACTIVE
  SUSPENDED
  DELETED
}

// ============================================
// USERS & GROUPS
// ============================================

model User {
  id           String     @id @default(uuid())
  tenantId     String     @map("tenant_id")
  email        String
  name         String
  role         UserRole   @default(MEMBER)
  preferences  Json       @default("{}")
  status       UserStatus @default(ACTIVE)
  createdAt    DateTime   @default(now()) @map("created_at")
  lastActiveAt DateTime?  @map("last_active_at")

  tenant         Tenant        @relation(fields: [tenantId], references: [id])
  groups         GroupMember[]
  assignedTasks  Task[]        @relation("AssignedUser")
  claimedTasks   Task[]        @relation("ClaimedBy")
  completedTasks Task[]        @relation("CompletedBy")

  @@unique([tenantId, email])
  @@map("users")
}

enum UserRole {
  ADMIN
  MEMBER
}

enum UserStatus {
  ACTIVE
  INACTIVE
}

model Group {
  id                 String             @id @default(uuid())
  tenantId           String             @map("tenant_id")
  name               String
  slug               String
  description        String?
  assignmentStrategy AssignmentStrategy @default(ROUND_ROBIN) @map("assignment_strategy")
  createdAt          DateTime           @default(now()) @map("created_at")
  updatedAt          DateTime           @updatedAt @map("updated_at")

  tenant        Tenant        @relation(fields: [tenantId], references: [id])
  members       GroupMember[]
  assignedTasks Task[]

  @@unique([tenantId, slug])
  @@map("groups")
}

enum AssignmentStrategy {
  ROUND_ROBIN
  LOAD_BALANCED
  MANUAL
}

model GroupMember {
  groupId String @map("group_id")
  userId  String @map("user_id")

  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([groupId, userId])
  @@map("group_members")
}

// ============================================
// TASKS
// ============================================

model Task {
  id              String     @id @default(uuid())
  tenantId        String     @map("tenant_id")
  workflowId      String     @map("workflow_id")
  workflowRunId   String     @map("workflow_run_id")
  title           String
  description     String?
  formSchema      Json       @map("form_schema")
  formData        Json?      @map("form_data")
  assignedUserId  String?    @map("assigned_user_id")
  assignedGroupId String?    @map("assigned_group_id")
  claimedById     String?    @map("claimed_by")
  context         Json       @default("{}")
  conversationId  String?    @map("conversation_id")
  slaDeadline     DateTime?  @map("sla_deadline")
  slaConfig       Json?      @map("sla_config")
  status          TaskStatus @default(CREATED)
  createdAt       DateTime   @default(now()) @map("created_at")
  updatedAt       DateTime   @updatedAt @map("updated_at")
  completedAt     DateTime?  @map("completed_at")
  completedById   String?    @map("completed_by")

  tenant        Tenant        @relation(fields: [tenantId], references: [id])
  assignedUser  User?         @relation("AssignedUser", fields: [assignedUserId], references: [id])
  assignedGroup Group?        @relation(fields: [assignedGroupId], references: [id])
  claimedBy     User?         @relation("ClaimedBy", fields: [claimedById], references: [id])
  completedBy   User?         @relation("CompletedBy", fields: [completedById], references: [id])
  conversation  Conversation? @relation(fields: [conversationId], references: [id])
  history       TaskHistory[]

  @@index([tenantId, status])
  @@index([assignedUserId])
  @@index([assignedGroupId])
  @@index([workflowId, workflowRunId])
  @@map("tasks")
}

enum TaskStatus {
  CREATED
  ASSIGNED
  CLAIMED
  COMPLETED
  ESCALATED
  EXPIRED
  CANCELLED
}

model TaskHistory {
  id        String   @id @default(uuid())
  taskId    String   @map("task_id")
  action    String
  actorType String   @map("actor_type")
  actorId   String   @map("actor_id")
  details   Json?
  createdAt DateTime @default(now()) @map("created_at")

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@map("task_history")
}

// ============================================
// CONVERSATIONS
// ============================================

model Conversation {
  id          String             @id @default(uuid())
  tenantId    String             @map("tenant_id")
  externalId  String?            @map("external_id")
  channel     String?
  participant Json
  status      ConversationStatus @default(ACTIVE)
  createdAt   DateTime           @default(now()) @map("created_at")
  updatedAt   DateTime           @updatedAt @map("updated_at")
  closedAt    DateTime?          @map("closed_at")

  tenant   Tenant    @relation(fields: [tenantId], references: [id])
  messages Message[]
  tasks    Task[]

  @@index([tenantId])
  @@index([tenantId, externalId])
  @@map("conversations")
}

enum ConversationStatus {
  ACTIVE
  CLOSED
  ARCHIVED
}

model Message {
  id             String   @id @default(uuid())
  conversationId String   @map("conversation_id")
  role           String
  content        String
  metadata       Json?
  createdAt      DateTime @default(now()) @map("created_at")

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt])
  @@map("messages")
}

// ============================================
// AUDIT
// ============================================

model AuditEvent {
  id           String   @id @default(uuid())
  tenantId     String   @map("tenant_id")
  eventType    String   @map("event_type")
  action       String
  actorType    String   @map("actor_type")
  actorId      String   @map("actor_id")
  actorName    String?  @map("actor_name")
  resourceType String   @map("resource_type")
  resourceId   String   @map("resource_id")
  details      Json?
  traceId      String?  @map("trace_id")
  spanId       String?  @map("span_id")
  createdAt    DateTime @default(now()) @map("created_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId, eventType, createdAt])
  @@map("audit_events")
}
```

### Base Repository with Tenant Scoping

```typescript
// db/repositories/base.ts
import { PrismaClient } from '@prisma/client';
import { RequestContext } from '../../context';

export abstract class BaseRepository<T> {
  constructor(protected prisma: PrismaClient) {}

  protected tenantScope(ctx: RequestContext) {
    return { tenantId: ctx.tenantId };
  }

  protected withTenant<Q extends Record<string, unknown>>(
    ctx: RequestContext,
    query: Q
  ): Q & { tenantId: string } {
    return { ...query, ...this.tenantScope(ctx) };
  }
}
```

### Task Repository Example

```typescript
// db/repositories/task.ts
import { PrismaClient, Task, TaskStatus } from '@prisma/client';
import { BaseRepository } from './base';
import { RequestContext } from '../../context';

export interface CreateTaskInput {
  workflowId: string;
  workflowRunId: string;
  title: string;
  description?: string;
  formSchema: Record<string, unknown>;
  assignTo?: { userId?: string; groupId?: string };
  context?: Record<string, unknown>;
  conversationId?: string;
  sla?: { deadline: Date; config: Record<string, unknown> };
}

export class TaskRepository extends BaseRepository<Task> {
  async create(ctx: RequestContext, input: CreateTaskInput): Promise<Task> {
    return this.prisma.task.create({
      data: {
        tenantId: ctx.tenantId,
        workflowId: input.workflowId,
        workflowRunId: input.workflowRunId,
        title: input.title,
        description: input.description,
        formSchema: input.formSchema,
        assignedUserId: input.assignTo?.userId,
        assignedGroupId: input.assignTo?.groupId,
        context: input.context ?? {},
        conversationId: input.conversationId,
        slaDeadline: input.sla?.deadline,
        slaConfig: input.sla?.config,
        status: input.assignTo ? TaskStatus.ASSIGNED : TaskStatus.CREATED,
      },
    });
  }

  async findById(ctx: RequestContext, id: string): Promise<Task | null> {
    return this.prisma.task.findFirst({
      where: this.withTenant(ctx, { id }),
    });
  }

  async findPendingForUser(
    ctx: RequestContext,
    userId: string
  ): Promise<Task[]> {
    const userGroups = await this.prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });
    const groupIds = userGroups.map((g) => g.groupId);

    return this.prisma.task.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: { in: [TaskStatus.ASSIGNED, TaskStatus.CREATED] },
        OR: [
          { assignedUserId: userId },
          { assignedGroupId: { in: groupIds } },
        ],
      },
      orderBy: [
        { slaDeadline: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async complete(
    ctx: RequestContext,
    id: string,
    formData: Record<string, unknown>,
    completedBy: string
  ): Promise<Task> {
    return this.prisma.task.update({
      where: { id, tenantId: ctx.tenantId },
      data: {
        formData,
        completedById: completedBy,
        completedAt: new Date(),
        status: TaskStatus.COMPLETED,
      },
    });
  }
}
```

## Acceptance Criteria

- [ ] Prisma schema defined with all entities
- [ ] Migrations created and run successfully
- [ ] BaseRepository with tenant scoping implemented
- [ ] TenantRepository implemented
- [ ] UserRepository implemented
- [ ] GroupRepository implemented
- [ ] TaskRepository implemented
- [ ] ConversationRepository implemented
- [ ] AuditRepository implemented
- [ ] All queries enforce tenant isolation
- [ ] Indexes created for common queries
- [ ] Unit tests for repositories with mocked Prisma
- [ ] Integration tests with real database

## Dependencies

- [[01 - Initialize Monorepo]]
- [[02 - Docker Dev Environment]]
- [[03 - Core Package Setup]]

## Blocked By

- [[02 - Docker Dev Environment]] - Need PostgreSQL
- [[03 - Core Package Setup]] - Need types

## Blocks

- [[06 - Task Manager]]
- [[09 - REST API]]
- [[11 - Dashboard Backend]]

## Technical Notes

### Prisma Setup

```bash
# In packages/core
pnpm add prisma @prisma/client
pnpm prisma init
pnpm prisma migrate dev --name init
pnpm prisma generate
```

### Transaction Support

```typescript
async createTaskWithHistory(
  ctx: RequestContext,
  input: CreateTaskInput
): Promise<Task> {
  return this.prisma.$transaction(async (tx) => {
    const task = await tx.task.create({ ... });
    await tx.taskHistory.create({
      data: {
        taskId: task.id,
        action: 'created',
        actorType: 'system',
        actorId: ctx.userId,
      },
    });
    return task;
  });
}
```

### Soft Deletes

Consider using Prisma middleware for soft deletes:

```typescript
prisma.$use(async (params, next) => {
  if (params.action === 'delete') {
    params.action = 'update';
    params.args.data = { deletedAt: new Date() };
  }
  return next(params);
});
```

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma with TypeScript](https://www.prisma.io/docs/concepts/components/prisma-client/advanced-type-safety)

## Tags

#orkestra #task #core #database #prisma #postgresql
