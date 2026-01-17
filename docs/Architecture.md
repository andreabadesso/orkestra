# Orkestra Architecture

This document provides a comprehensive technical architecture for Orkestra.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           IMPLEMENTER'S APPLICATION                         │
│         (WhatsApp Bot, Support Agent, Sales Assistant, etc.)                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                          ┌───────────┴───────────┐
                          ▼                       ▼
                  ┌──────────────┐        ┌──────────────┐
                  │  MCP Server  │        │   REST API   │
                  │  (AI-native) │        │   (tRPC)     │
                  └──────────────┘        └──────────────┘
                          │                       │
                          └───────────┬───────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ORKESTRA CORE                                  │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │    Workflow     │  │      Task       │  │    Tenant & Identity        │ │
│  │    Engine       │  │    Manager      │  │       Management            │ │
│  │   (Temporal)    │  │                 │  │                             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │  Conversation   │  │  Notification   │  │      Audit Logger           │ │
│  │     Store       │  │     Router      │  │   (Langfuse adapter)        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA & INFRASTRUCTURE                             │
│                                                                             │
│     ┌──────────────┐        ┌──────────────┐        ┌──────────────┐       │
│     │  PostgreSQL  │        │   Temporal   │        │   Langfuse   │       │
│     │  (primary)   │        │   (durable)  │        │   (traces)   │       │
│     └──────────────┘        └──────────────┘        └──────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OPTIONAL CONNECTORS                                │
│       @orkestra/whatsapp   @orkestra/slack   @orkestra/email   ...          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Workflow Engine (Temporal)

Orkestra wraps Temporal to provide a developer-friendly SDK while maintaining full access to Temporal's power.

**Why Temporal?**
- Durable execution (survives crashes, restarts)
- Built-in retries, timeouts, and error handling
- Time-based triggers (SLAs, deadlines)
- Signals for external events (human task completion)
- Query support for workflow state inspection
- Battle-tested at massive scale (Uber, Netflix, Snap)

**Orkestra SDK Wrapper:**

```typescript
// Raw Temporal
import { proxyActivities, sleep } from '@temporalio/workflow';

// Orkestra SDK (wraps Temporal with opinions)
import { workflow, task, escalate, timeout } from '@orkestra/sdk';

export const supportEscalation = workflow('support-escalation', async (ctx) => {
  const { question, conversationId, confidence } = ctx.input;

  // Orkestra-provided patterns
  const response = await task({
    title: 'Customer Question Needs Human Help',
    form: {
      answer: { type: 'text', required: true },
      shouldFollowUp: { type: 'boolean', default: false },
    },
    context: { conversationId, question },
    assignTo: { group: 'support-l1' },
    sla: timeout('10m', () => escalate({ group: 'support-l2' })),
  });

  return response;
});
```

### 2. Task Manager

The Task Manager handles human-in-the-loop interactions.

**Task Lifecycle:**

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ CREATED  │────▶│ ASSIGNED │────▶│ CLAIMED  │────▶│COMPLETED │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
      │                │                │
      │                │                │
      ▼                ▼                ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│ESCALATED │     │REASSIGNED│     │ EXPIRED  │
└──────────┘     └──────────┘     └──────────┘
```

**Task Schema:**

```typescript
interface Task {
  id: string;
  tenantId: string;
  workflowId: string;           // Temporal workflow ID
  workflowRunId: string;        // Temporal run ID

  // Display
  title: string;
  description?: string;

  // Form definition
  form: FormSchema;
  formData?: Record<string, any>; // Submitted data

  // Assignment
  assignedTo?: {
    userId?: string;
    groupId?: string;
  };
  claimedBy?: string;           // User who claimed it

  // Context
  context: Record<string, any>; // Conversation, metadata, etc.
  conversationId?: string;      // Link to conversation

  // SLA
  sla?: {
    deadline: Date;
    escalationChain: EscalationStep[];
  };

  // Lifecycle
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  completedBy?: string;

  // Audit
  history: TaskHistoryEntry[];
}

interface FormSchema {
  fields: Record<string, FormField>;
}

interface FormField {
  type: 'text' | 'textarea' | 'boolean' | 'select' | 'number' | 'date';
  label?: string;
  required?: boolean;
  default?: any;
  options?: { value: string; label: string }[]; // For select
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}
```

### 3. Tenant & Identity Management

Every entity in Orkestra is tenant-scoped.

**Tenant Schema:**

```typescript
interface Tenant {
  id: string;
  name: string;
  slug: string;                 // URL-friendly identifier

  // Configuration
  config: {
    notifications: NotificationConfig;
    slaDefaults: SLADefaults;
    workflowSettings: WorkflowSettings;
  };

  // Limits
  limits?: {
    maxConcurrentWorkflows?: number;
    maxTasksPerDay?: number;
  };

  // Lifecycle
  status: 'active' | 'suspended' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  groups: string[];             // Group IDs

  // Preferences
  preferences: {
    notifications: UserNotificationPrefs;
  };

  status: 'active' | 'inactive';
  createdAt: Date;
  lastActiveAt?: Date;
}

interface Group {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;

  // Assignment rules
  assignmentStrategy: 'round-robin' | 'load-balanced' | 'manual';

  members: string[];            // User IDs

  createdAt: Date;
  updatedAt: Date;
}
```

### 4. Conversation Store

Stores conversation context for AI agents and human reviewers.

```typescript
interface Conversation {
  id: string;
  tenantId: string;

  // External reference
  externalId?: string;          // e.g., WhatsApp conversation ID
  channel?: string;             // 'whatsapp', 'slack', 'email', etc.

  // Participant
  participant: {
    id: string;                 // External user ID
    name?: string;
    phone?: string;
    email?: string;
    metadata?: Record<string, any>;
  };

  // Messages
  messages: Message[];

  // State
  status: 'active' | 'closed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'human';
  content: string;

  // Metadata
  metadata?: {
    confidence?: number;        // AI confidence score
    model?: string;             // AI model used
    humanId?: string;           // If role === 'human'
    taskId?: string;            // If from task completion
  };

  timestamp: Date;
}
```

### 5. Notification Router

Routes notifications to appropriate channels based on tenant configuration.

```typescript
interface NotificationConfig {
  channels: NotificationChannel[];
  rules: NotificationRule[];
}

interface NotificationChannel {
  type: 'dashboard' | 'slack' | 'email' | 'webhook';
  config: Record<string, any>;  // Channel-specific config
  enabled: boolean;
}

interface NotificationRule {
  // Conditions
  conditions: {
    group?: string;
    slaBreached?: boolean;
    escalationLevel?: number;
    taskType?: string;
  };

  // Actions
  channel: string;
  template?: string;
  mention?: boolean;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}
```

### 6. Audit Logger

Integrates with Langfuse for comprehensive tracing.

```typescript
interface AuditEvent {
  id: string;
  tenantId: string;

  // What happened
  type: AuditEventType;
  action: string;

  // Who did it
  actor: {
    type: 'user' | 'system' | 'workflow' | 'ai';
    id: string;
    name?: string;
  };

  // What was affected
  resource: {
    type: 'workflow' | 'task' | 'conversation' | 'tenant' | 'user';
    id: string;
  };

  // Details
  details: Record<string, any>;

  // Trace
  traceId?: string;             // Langfuse trace ID
  spanId?: string;

  timestamp: Date;
}

type AuditEventType =
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'task.created'
  | 'task.assigned'
  | 'task.completed'
  | 'task.escalated'
  | 'conversation.created'
  | 'conversation.message'
  | 'user.login'
  | 'config.changed';
```

## MCP Server Design

### Tools

**Workflows Domain:**

| Tool | Parameters | Description |
|------|------------|-------------|
| `workflow_start` | `name`, `input`, `options?` | Start a workflow instance |
| `workflow_get` | `workflowId` | Get workflow status and state |
| `workflow_list` | `filters?`, `pagination?` | List workflows |
| `workflow_signal` | `workflowId`, `signalName`, `data?` | Send signal to workflow |
| `workflow_cancel` | `workflowId`, `reason?` | Cancel a workflow |
| `workflow_history` | `workflowId` | Get execution history |

**Tasks Domain:**

| Tool | Parameters | Description |
|------|------------|-------------|
| `task_create` | `title`, `form`, `assignTo`, `context?`, `sla?` | Create a task |
| `task_get` | `taskId` | Get task details |
| `task_list` | `filters?`, `pagination?` | List tasks |
| `task_complete` | `taskId`, `formData` | Complete a task |
| `task_reassign` | `taskId`, `assignTo` | Reassign a task |
| `task_add_comment` | `taskId`, `comment` | Add comment to task |

**Conversations Domain:**

| Tool | Parameters | Description |
|------|------------|-------------|
| `conversation_create` | `participant`, `channel?`, `externalId?` | Start conversation |
| `conversation_get` | `conversationId` | Get with message history |
| `conversation_append` | `conversationId`, `message` | Add message |
| `conversation_list` | `filters?`, `pagination?` | List conversations |

**Tenants & Users Domain:**

| Tool | Parameters | Description |
|------|------------|-------------|
| `tenant_get` | | Get current tenant config |
| `user_list` | `filters?` | List users |
| `group_list` | `filters?` | List groups |
| `group_members` | `groupId` | Get group members |

### Resources

| URI Pattern | Description |
|-------------|-------------|
| `orkestra://workflows` | Available workflow definitions |
| `orkestra://workflows/{id}` | Specific workflow state |
| `orkestra://tasks/pending` | Pending tasks for current user |
| `orkestra://tasks/pending/{groupId}` | Pending tasks for group |
| `orkestra://conversations/{id}` | Conversation with history |
| `orkestra://tenant/config` | Current tenant configuration |

## Database Schema

### PostgreSQL Tables

```sql
-- Tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  limits JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  preferences JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  UNIQUE(tenant_id, email)
);

-- Groups
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  assignment_strategy VARCHAR(20) NOT NULL DEFAULT 'round-robin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

-- Group memberships
CREATE TABLE group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  workflow_id VARCHAR(255) NOT NULL,
  workflow_run_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  form_schema JSONB NOT NULL,
  form_data JSONB,
  assigned_user_id UUID REFERENCES users(id),
  assigned_group_id UUID REFERENCES groups(id),
  claimed_by UUID REFERENCES users(id),
  context JSONB NOT NULL DEFAULT '{}',
  conversation_id UUID,
  sla_deadline TIMESTAMPTZ,
  sla_config JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id)
);

-- Task history
CREATE TABLE task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  actor_type VARCHAR(20) NOT NULL,
  actor_id VARCHAR(255) NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  external_id VARCHAR(255),
  channel VARCHAR(50),
  participant JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  event_type VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  actor_type VARCHAR(20) NOT NULL,
  actor_id VARCHAR(255) NOT NULL,
  actor_name VARCHAR(255),
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  details JSONB,
  trace_id VARCHAR(255),
  span_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status);
CREATE INDEX idx_tasks_assigned_user ON tasks(assigned_user_id) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX idx_tasks_assigned_group ON tasks(assigned_group_id) WHERE assigned_group_id IS NOT NULL;
CREATE INDEX idx_tasks_workflow ON tasks(workflow_id, workflow_run_id);
CREATE INDEX idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX idx_conversations_external ON conversations(tenant_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_audit_tenant_type ON audit_events(tenant_id, event_type, created_at);
```

## API Design

### REST/tRPC Endpoints

The API mirrors MCP tools but adds admin-only endpoints:

**Public (authenticated):**
- `POST /workflows/start`
- `GET /workflows/:id`
- `GET /workflows`
- `POST /workflows/:id/signal`
- `DELETE /workflows/:id`
- `POST /tasks`
- `GET /tasks/:id`
- `GET /tasks`
- `POST /tasks/:id/complete`
- `PUT /tasks/:id/reassign`
- `POST /tasks/:id/comments`
- `POST /conversations`
- `GET /conversations/:id`
- `POST /conversations/:id/messages`

**Admin:**
- `GET /admin/tenant`
- `PUT /admin/tenant`
- `GET /admin/users`
- `POST /admin/users`
- `PUT /admin/users/:id`
- `DELETE /admin/users/:id`
- `GET /admin/groups`
- `POST /admin/groups`
- `PUT /admin/groups/:id`
- `DELETE /admin/groups/:id`
- `PUT /admin/groups/:id/members`

## Dashboard UI

### Pages

1. **Task Inbox** (`/tasks`)
   - List of pending tasks (my tasks + group tasks)
   - Filters: status, group, date range
   - Sort: deadline, created date
   - Bulk actions: claim, reassign

2. **Task Detail** (`/tasks/:id`)
   - Task metadata (title, description, SLA)
   - Conversation context (collapsible)
   - Form to complete
   - Comments thread
   - History timeline

3. **Task History** (`/tasks/history`)
   - Completed tasks
   - Search and filter

4. **Admin: Users** (`/admin/users`)
   - List, create, edit, delete users
   - Group membership management

5. **Admin: Groups** (`/admin/groups`)
   - List, create, edit, delete groups
   - Assignment strategy configuration

6. **Admin: Settings** (`/admin/settings`)
   - Tenant configuration
   - Notification settings
   - SLA defaults

## Security

### Authentication

- **Dashboard**: Session-based auth (NextAuth.js)
- **API**: API key or JWT
- **MCP**: API key passed in context

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

const rolePermissions: Record<Role, Permission[]> = {
  admin: ['*'],
  member: [
    'tasks:read',
    'tasks:write',
    'workflows:read',
    'conversations:read',
  ],
};
```

### Tenant Isolation

All queries are scoped to tenant. Middleware enforces this:

```typescript
// Every request includes tenant context
interface RequestContext {
  tenantId: string;
  userId: string;
  role: Role;
  groups: string[];
}

// Repository pattern enforces tenant scoping
class TaskRepository {
  async findById(ctx: RequestContext, id: string): Promise<Task | null> {
    return this.db.task.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId, // Always scoped
      },
    });
  }
}
```

## Deployment

### Development

```bash
# Start all services
docker-compose up -d

# Services:
# - PostgreSQL (5432)
# - Temporal (7233)
# - Temporal UI (8080)
# - Orkestra API (3000)
# - Orkestra Dashboard (3001)
```

### Production

Recommended: Kubernetes with:
- Temporal Cloud (managed) or self-hosted Temporal cluster
- PostgreSQL (managed: RDS, Cloud SQL, etc.)
- Orkestra services as deployments
- Langfuse Cloud or self-hosted

## Tags

#orkestra #architecture #temporal #mcp #typescript
