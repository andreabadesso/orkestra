# Multi-Tenancy

Multi-tenancy is built into Orkestra from the ground up. Every entity—users, tasks, workflows, conversations—is scoped to a tenant.

## What is Multi-Tenancy?

Multi-tenancy allows a single Orkestra instance to serve multiple organizations (tenants) while maintaining complete data isolation.

**Benefits:**

- Cost efficiency: Share infrastructure across multiple customers
- Data isolation: Each tenant's data is completely separate
- Independent configuration: Each tenant can customize settings
- Billing flexibility: Track usage per tenant

## Tenant Hierarchy

```
Tenant
├── Users
│   ├── User A (admin)
│   ├── User B (member)
│   └── User C (member)
├── Groups
│   ├── Support Team
│   ├── Sales Team
│   └── Engineering Team
├── Tasks
├── Workflows
└── Conversations
```

## Tenant Schema

```typescript
interface Tenant {
  id: string; // UUID
  name: string; // Display name
  slug: string; // URL-safe identifier
  config: {
    notifications: NotificationConfig;
    slaDefaults: SLADefaults;
    workflowSettings: WorkflowSettings;
  };
  limits?: {
    maxConcurrentWorkflows?: number;
    maxTasksPerDay?: number;
    maxUsers?: number;
  };
  status: 'active' | 'suspended' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}
```

## Data Isolation

### Type-Level Enforcement

All repository methods require a tenant context:

```typescript
interface RequestContext {
  tenantId: string; // Current tenant
  userId: string;
  role: Role;
  groups: string[];
}

class TaskRepository {
  async findById(ctx: RequestContext, id: string): Promise<Task | null> {
    return this.db.task.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId, // Always scoped!
      },
    });
  }

  async list(ctx: RequestContext, filters?: TaskFilters): Promise<Task[]> {
    return this.db.task.findMany({
      where: {
        tenantId: ctx.tenantId, // Always scoped!
        ...filters,
      },
    });
  }
}
```

### Database-Level Isolation

Every query includes the tenant ID:

```sql
-- Always include tenant_id in queries
SELECT * FROM tasks
WHERE tenant_id = ? AND status = 'pending';

-- Indexes optimize for tenant queries
CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status);
```

## User & Group Management

### Users

```typescript
interface User {
  id: string;
  tenantId: string; // Scoped to tenant
  email: string;
  name: string;
  role: 'admin' | 'member';
  groups: string[]; // Group IDs
  preferences: {
    notifications: NotificationPreferences;
  };
  status: 'active' | 'inactive';
  createdAt: Date;
  lastActiveAt?: Date;
}
```

### Groups

```typescript
interface Group {
  id: string;
  tenantId: string; // Scoped to tenant
  name: string;
  slug: string;
  description?: string;
  assignmentStrategy: 'round-robin' | 'load-balanced' | 'manual';
  members: string[]; // User IDs
  createdAt: Date;
  updatedAt: Date;
}
```

### Group Membership

```typescript
// Add user to group
await groupService.addMember(tenantId, groupId, userId);

// Remove user from group
await groupService.removeMember(tenantId, groupId, userId);

// Get group members
const members = await groupService.getMembers(tenantId, groupId);
```

## Tenant Configuration

Each tenant can customize:

### Notification Settings

```typescript
interface NotificationConfig {
  channels: Array<{
    type: 'dashboard' | 'slack' | 'email' | 'webhook';
    config: Record<string, any>;
    enabled: boolean;
  }>;
  rules: Array<{
    conditions: {
      group?: string;
      slaBreached?: boolean;
      taskType?: string;
    };
    channel: string;
    template?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }>;
}
```

### SLA Defaults

```typescript
interface SLADefaults {
  defaultTimeout?: string; // e.g., '1h', '2d'
  escalationRules?: Array<{
    after: string; // e.g., '30m', '2h'
    action: 'notify' | 'reassign' | 'escalate';
    target?: { group?: string };
  }>;
}
```

### Workflow Settings

```typescript
interface WorkflowSettings {
  maxRetries?: number;
  defaultTaskTimeout?: string;
  autoEscalateOnTimeout?: boolean;
}
```

## Tenant Limits

Enforce resource limits per tenant:

```typescript
interface TenantLimits {
  maxConcurrentWorkflows?: number; // e.g., 100
  maxTasksPerDay?: number; // e.g., 1000
  maxUsers?: number; // e.g., 50
  maxStorageGB?: number; // e.g., 100
}
```

**Enforcement:**

```typescript
// Before creating a workflow
const currentCount = await workflowRepo.countByTenant(tenantId);
if (tenant.limits?.maxConcurrentWorkflows && currentCount >= tenant.limits.maxConcurrentWorkflows) {
  throw new Error('Workflow limit exceeded');
}
```

## Tenant Context

All operations include tenant context:

```typescript
// API request middleware
async function handleRequest(req: Request) {
  const apiKey = req.headers['x-api-key'];
  const tenant = await tenantRepo.findByApiKey(apiKey);

  const ctx: RequestContext = {
    tenantId: tenant.id,
    userId: req.user?.id,
    role: req.user?.role,
    groups: req.user?.groups || [],
  };

  return await handler(req, ctx);
}
```

```typescript
// Workflow execution
const result = await workflow.execute(workflowId, {
  tenantId: tenantId,
  input: workflowInput,
});
```

## Tenant Lifecycle

### Creating a Tenant

```typescript
const tenant = await tenantService.create({
  name: 'Acme Corp',
  slug: 'acme-corp',
  config: {
    notifications: {
      channels: [{ type: 'dashboard', enabled: true }],
    },
  },
  limits: {
    maxConcurrentWorkflows: 100,
    maxTasksPerDay: 1000,
    maxUsers: 50,
  },
});
```

### Updating a Tenant

```typescript
await tenantService.update(tenantId, {
  config: {
    notifications: {
      channels: [
        { type: 'dashboard', enabled: true },
        { type: 'slack', config: { webhookUrl: '...' }, enabled: true },
      ],
    },
  },
});
```

### Suspending a Tenant

```typescript
await tenantService.suspend(tenantId, 'Payment overdue');

// All operations return 403
const result = await workflowService.start(tenantId, workflowId);
// Error: Tenant is suspended
```

### Deleting a Tenant

```typescript
await tenantService.delete(tenantId);

// Cascades to all entities (ON DELETE CASCADE)
// Tasks, workflows, conversations, users all deleted
```

## Security Considerations

### Tenant ID Leaks

Never expose internal tenant IDs:

```typescript
// BAD - exposes internal ID
GET /api/tenants/abc123/tasks

// GOOD - use slug or subdomain
GET /api/acme-corp/tasks
// or
https://acme-corp.app.com/api/tasks
```

### Cross-Tenant Access

Never allow cross-tenant queries:

```typescript
// BAD - allows cross-tenant access
async function getTask(taskId: string) {
  return db.task.findUnique({ where: { id: taskId } });
}

// GOOD - enforced tenant scoping
async function getTask(ctx: RequestContext, taskId: string) {
  return db.task.findFirst({
    where: { id: taskId, tenantId: ctx.tenantId },
  });
}
```

### API Key Management

Each tenant has unique API keys:

```typescript
// Generate API key per tenant
const apiKey = await apiKeyService.generate(tenantId, {
  name: 'Production Key',
  permissions: ['tasks:*', 'workflows:*'],
});
```

## Monitoring & Analytics

### Per-Tenant Metrics

```typescript
// Track usage per tenant
const metrics = {
  tenantId: tenant.id,
  timestamp: Date.now(),
  workflowsCreated: 10,
  tasksCompleted: 50,
  avgTaskDuration: '15m',
  slaBreaches: 2,
};

await metricsService.record(metrics);
```

### Billing Integration

```typescript
// Calculate billable usage
const usage = await billingService.calculateUsage(tenantId, {
  period: { start: startDate, end: endDate },
});

// Example billing tiers
const tier = calculateTier(usage.tasksCompleted);
// 0-1000: $100/mo
// 1001-5000: $500/mo
// 5001+: $1000/mo
```

## Migration & Data Export

### Export Tenant Data

```typescript
const export = await tenantService.exportData(tenantId, {
  include: ['tasks', 'workflows', 'conversations'],
  format: 'json',
});

// Returns: { url: 'https://...', expiresAt: Date }
```

### Import Tenant Data

```typescript
await tenantService.importData(tenantId, {
  url: 'https://...',
  options: {
    merge: false, // Replace existing data
  },
});
```

## Best Practices

### 1. Always Scope Queries

```typescript
// Always use repository pattern with context
const tasks = await taskRepo.list(ctx, filters);
```

### 2. Use Tenant-Specific Indexes

```sql
CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status);
CREATE INDEX idx_workflows_tenant_date ON workflows(tenant_id, created_at);
```

### 3. Implement Soft Deletes

```typescript
// Don't hard-delete immediately
interface DeletableEntity {
  id: string;
  tenantId: string;
  deletedAt?: Date;
  deletedBy?: string;
}

await taskRepo.softDelete(ctx, taskId);
```

### 4. Log Tenant Activity

```typescript
await auditLog.record({
  tenantId,
  action: 'task.completed',
  actor: { type: 'user', id: userId },
  resource: { type: 'task', id: taskId },
});
```

### 5. Implement Rate Limiting

```typescript
// Per-tenant rate limiting
await rateLimiter.check(tenantId, {
  limit: tenant.limits?.maxTasksPerDay,
  window: '1d',
});
```

## Next Steps

- [Architecture Concept](./architecture.md) - System design overview
- [Security Guide](../guides/security.md) - Security best practices
- [Admin API](../api-reference/rest-api.md) - Tenant management endpoints
