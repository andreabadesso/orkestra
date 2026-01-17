# Architecture

This document provides a comprehensive overview of Orkestra's technical architecture.

## System Overview

```
+-----------------------------------------------------------------------------+
|                        IMPLEMENTER'S APPLICATION                            |
|          (WhatsApp Bot, Support Agent, Sales Assistant, etc.)               |
+-----------------------------------------------------------------------------+
                                    |
                        +-----------+-----------+
                        v                       v
                +--------------+        +--------------+
                |  MCP Server  |        |   REST API   |
                |  (AI-native) |        |   (tRPC)     |
                +--------------+        +--------------+
                        |                       |
                        +-----------+-----------+
                                    v
+-----------------------------------------------------------------------------+
|                              ORKESTRA CORE                                  |
|                                                                             |
|  +---------------+  +---------------+  +-----------------------------+      |
|  |   Workflow    |  |     Task      |  |    Tenant & Identity        |      |
|  |    Engine     |  |   Manager     |  |       Management            |      |
|  |  (Temporal)   |  |               |  |                             |      |
|  +---------------+  +---------------+  +-----------------------------+      |
|                                                                             |
|  +---------------+  +---------------+  +-----------------------------+      |
|  | Conversation  |  | Notification  |  |      Audit Logger           |      |
|  |    Store      |  |    Router     |  |   (Langfuse adapter)        |      |
|  +---------------+  +---------------+  +-----------------------------+      |
+-----------------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------------+
|                         DATA & INFRASTRUCTURE                               |
|                                                                             |
|      +--------------+        +--------------+        +--------------+       |
|      |  PostgreSQL  |        |   Temporal   |        |   Langfuse   |       |
|      |  (primary)   |        |   (durable)  |        |   (traces)   |       |
|      +--------------+        +--------------+        +--------------+       |
+-----------------------------------------------------------------------------+
```

## Core Components

### 1. Workflow Engine (Temporal)

Orkestra wraps Temporal to provide a developer-friendly SDK while maintaining full access to Temporal's power.

**Why Temporal?**

- **Durable execution**: Survives crashes and restarts
- **Built-in retries**: Configurable retry policies with exponential backoff
- **Time-based triggers**: Native support for SLAs and deadlines
- **Signals**: External events (like task completion) can wake up workflows
- **Queries**: Inspect workflow state without affecting execution
- **Battle-tested**: Used at scale by Uber, Netflix, Snap, and more

**How Orkestra Uses Temporal**

```typescript
// Raw Temporal approach
import { proxyActivities, sleep } from '@temporalio/workflow';

// Orkestra SDK (wraps Temporal with opinions)
import { workflow, task, timeout } from '@orkestra/sdk';

export const supportWorkflow = workflow('support', async (ctx) => {
  // task() internally:
  // 1. Calls an activity to create the task in PostgreSQL
  // 2. Waits for a signal (taskCompleted)
  // 3. Handles timeouts and escalation
  const result = await task(ctx, {
    title: 'Handle customer question',
    form: { answer: { type: 'textarea', required: true } },
    assignTo: { group: 'support-l1' },
    sla: timeout('30m'),
  });

  return result;
});
```

### 2. Task Manager

The Task Manager handles human-in-the-loop interactions with a structured lifecycle.

**Task Lifecycle**

```
+----------+     +----------+     +----------+     +-----------+
| CREATED  | --> | ASSIGNED | --> | CLAIMED  | --> | COMPLETED |
+----------+     +----------+     +----------+     +-----------+
      |                |                |
      |                |                |
      v                v                v
+----------+     +-----------+     +----------+
| ESCALATED|     | REASSIGNED|     |  EXPIRED |
+----------+     +-----------+     +----------+
```

**States:**

| State | Description |
|-------|-------------|
| `pending` | Task created, not yet assigned |
| `assigned` | Assigned to user or group |
| `in_progress` | User has claimed and is working on it |
| `completed` | Form submitted, workflow continues |
| `cancelled` | Cancelled before completion |
| `expired` | SLA breached with cancel action |
| `escalated` | Escalated to different assignee |

### 3. Tenant & Identity Management

Every entity in Orkestra is tenant-scoped. This is enforced at multiple levels:

**Type-Level Enforcement:**

```typescript
// All repository methods require a context with tenantId
interface RequestContext {
  tenantId: string;
  userId?: string;
  role: Role;
  groups: string[];
}

// Queries are automatically scoped
class TaskRepository {
  async findById(ctx: RequestContext, id: string) {
    return this.db.task.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId, // Always included
      },
    });
  }
}
```

**Entity Hierarchy:**

```
Tenant
  |
  +-- Users
  |     |
  |     +-- Group Memberships
  |
  +-- Groups
  |
  +-- Tasks
  |
  +-- Conversations
  |
  +-- Workflows
```

### 4. Conversation Store

Stores conversation context for AI agents and human reviewers.

```typescript
interface Conversation {
  id: string;
  tenantId: string;
  externalId?: string;      // e.g., WhatsApp conversation ID
  channel?: string;         // 'whatsapp', 'slack', 'email', etc.
  participant: {
    id: string;
    name?: string;
    metadata?: Record<string, any>;
  };
  messages: Message[];
  status: 'active' | 'closed' | 'archived';
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'human';
  content: string;
  metadata?: {
    confidence?: number;    // AI confidence score
    model?: string;         // AI model used
    humanId?: string;       // If from human operator
    taskId?: string;        // If from task completion
  };
  timestamp: Date;
}
```

### 5. Notification Router

Routes notifications based on tenant configuration and rules.

```typescript
interface NotificationConfig {
  channels: NotificationChannel[];
  rules: NotificationRule[];
}

interface NotificationRule {
  conditions: {
    group?: string;
    slaBreached?: boolean;
    escalationLevel?: number;
    taskType?: string;
  };
  channel: string;        // 'dashboard', 'slack', 'email', 'webhook'
  template?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}
```

### 6. Audit Logger

Comprehensive audit trail with Langfuse integration for AI observability.

```typescript
interface AuditEvent {
  id: string;
  tenantId: string;
  type: AuditEventType;
  action: string;
  actor: {
    type: 'user' | 'system' | 'workflow' | 'ai';
    id: string;
    name?: string;
  };
  resource: {
    type: 'workflow' | 'task' | 'conversation' | 'tenant' | 'user';
    id: string;
  };
  details: Record<string, any>;
  traceId?: string;       // Langfuse trace ID
  timestamp: Date;
}
```

## API Layers

### MCP Server (AI-Native)

The MCP server provides tools and resources for AI agents via the Model Context Protocol.

**Tools** (Actions):

| Tool | Description |
|------|-------------|
| `workflow_start` | Start a workflow instance |
| `workflow_get` | Get workflow status |
| `workflow_signal` | Send signal to workflow |
| `task_create` | Create a human task |
| `task_complete` | Complete a task |
| `conversation_append` | Add message to conversation |

**Resources** (Data):

| URI Pattern | Description |
|-------------|-------------|
| `orkestra://workflows` | Available workflow definitions |
| `orkestra://tasks/pending` | Pending tasks for current user |
| `orkestra://conversations/{id}` | Conversation with history |

### REST/tRPC API

Traditional API for dashboard and integrations:

```
POST   /api/workflows/start
GET    /api/workflows/:id
POST   /api/workflows/:id/signal
DELETE /api/workflows/:id

POST   /api/tasks
GET    /api/tasks/:id
POST   /api/tasks/:id/complete
PUT    /api/tasks/:id/reassign

POST   /api/conversations
GET    /api/conversations/:id
POST   /api/conversations/:id/messages
```

## Database Schema

### Core Tables

```sql
-- Tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  UNIQUE(tenant_id, email)
);

-- Groups
CREATE TABLE groups (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  assignment_strategy VARCHAR(20) DEFAULT 'round-robin',
  UNIQUE(tenant_id, slug)
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  workflow_id VARCHAR(255),
  title VARCHAR(500) NOT NULL,
  form_schema JSONB NOT NULL,
  form_data JSONB,
  assigned_user_id UUID REFERENCES users(id),
  assigned_group_id UUID REFERENCES groups(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  external_id VARCHAR(255),
  channel VARCHAR(50),
  participant JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status);
CREATE INDEX idx_tasks_assigned_user ON tasks(assigned_user_id);
CREATE INDEX idx_tasks_assigned_group ON tasks(assigned_group_id);
CREATE INDEX idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
```

## Security

### Authentication

| Interface | Method |
|-----------|--------|
| Dashboard | Session-based (NextAuth.js) |
| API | API key or JWT |
| MCP | API key in context |

### Authorization

```typescript
type Permission =
  | 'tasks:read'
  | 'tasks:write'
  | 'tasks:admin'
  | 'workflows:read'
  | 'workflows:write'
  | 'conversations:read'
  | 'conversations:write'
  | 'admin:users'
  | 'admin:groups'
  | 'admin:settings';

const rolePermissions = {
  admin: ['*'],
  manager: ['tasks:*', 'workflows:*', 'conversations:*'],
  member: ['tasks:read', 'tasks:write', 'workflows:read', 'conversations:read'],
  viewer: ['tasks:read', 'workflows:read', 'conversations:read'],
};
```

### Tenant Isolation

All database queries are scoped to the current tenant via middleware:

```typescript
// Middleware extracts tenant from request
const tenantId = request.headers['x-tenant-id'];

// Repository enforces tenant in all queries
const task = await taskRepo.findById(
  { tenantId, userId, role },
  taskId
);
```

## Deployment Options

### Development

```bash
docker-compose up -d  # PostgreSQL + Temporal + Temporal UI
pnpm dev              # API + Worker
```

### Production

Recommended architecture:

```
                    Load Balancer
                          |
            +-------------+-------------+
            |             |             |
        API Pod 1     API Pod 2     API Pod N
            |             |             |
            +-------------+-------------+
                          |
                    PostgreSQL
                    (Managed)
                          |
            +-------------+-------------+
            |                           |
     Temporal Cloud              Worker Pods
     (Managed)                   (Auto-scaled)
```

**Managed Services:**

| Component | Options |
|-----------|---------|
| PostgreSQL | RDS, Cloud SQL, Neon |
| Temporal | Temporal Cloud (recommended) |
| Observability | Langfuse Cloud |

## Next Steps

- [Workflows Concept](./workflows.md) - Understanding workflow patterns
- [Tasks Concept](./tasks.md) - Task lifecycle and forms
- [Multi-tenancy](./multi-tenancy.md) - Tenant isolation details
