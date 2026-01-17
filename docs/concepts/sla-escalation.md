# SLA and Escalation

Service Level Agreements (SLAs) and automatic escalation ensure tasks are handled on time. Orkestra provides flexible, configurable SLA policies with multi-step escalation chains.

## What is an SLA?

An SLA (Service Level Agreement) defines how quickly a task must be completed. If the deadline is breached, Orkestra automatically takes action—notify, reassign, escalate, or cancel.

**Use Cases:**

- Customer support: Respond within 30 minutes
- Approval workflows: Review within 1 business day
- Compliance: Must complete before legal deadline

## SLA Basics

### Simple Timeout

```typescript
import { task, timeout } from '@orkestra/sdk';

const result = await task(ctx, {
  title: 'Customer Support Request',
  form: { response: { type: 'textarea', required: true } },
  assignTo: { group: 'support-l1' },
  sla: timeout('30m'), // 30 minutes
});
```

**On Breach:**

- Task marked as `EXPIRED`
- Workflow receives `SLA_BREACH` error
- Workflow must handle the error or fail

### Timeout with Custom Action

```typescript
const result = await task(ctx, {
  title: 'Review Document',
  form: { approved: { type: 'boolean', required: true } },
  assignTo: { group: 'legal' },
  sla: timeout('2h', {
    onBreach: 'reassign', // Action on breach
    target: { group: 'managers' }, // Reassign here
  }),
});
```

**On Breach:**

- Task reassigned to `managers`
- Original assignee receives notification
- Timer resets for new assignee

## Duration Syntax

Orkestra supports flexible duration strings:

```typescript
timeout('30s'); // 30 seconds
timeout('5m'); // 5 minutes
timeout('2h'); // 2 hours
timeout('1d'); // 1 day
timeout('1w'); // 1 week
timeout('30'); // 30 seconds (default)
```

**Milliseconds also work:**

```typescript
timeout(30000); // 30 seconds
timeout(2 * 60 * 60 * 1000); // 2 hours
```

## Escalation Chains

For complex scenarios, use multi-step escalation:

```typescript
import { taskWithEscalation } from '@orkestra/sdk';

const result = await taskWithEscalation(ctx, {
  title: 'High-Priority Incident',
  form: {
    resolution: { type: 'textarea', required: true },
    followUpNeeded: { type: 'boolean' },
  },
  assignTo: { group: 'support-l1' },
  escalation: {
    steps: [
      {
        after: '15m', // 15 minutes
        action: 'notify', // Send notification
        channel: 'slack',
        priority: 'high',
      },
      {
        after: '30m', // 30 minutes total
        action: 'reassign', // Reassign to L2
        target: { group: 'support-l2' },
        message: 'Task escalated to L2 support',
      },
      {
        after: '1h', // 1 hour total
        action: 'escalate', // Escalate to managers
        target: { group: 'managers' },
        priority: 'urgent',
      },
      {
        after: '2h', // 2 hours total
        action: 'cancel', // Cancel workflow
        reason: 'SLA breach after 2 hours',
      },
    ],
  },
});
```

### Escalation Timeline

```
0m    : Task created → Assigned to support-l1
      |
      v
15m   : ⚠️ Notification sent (slack, high priority)
      |
      v
30m   : 🔄 Reassigned to support-l2 (timer resets)
      |
      v
1h    : 🔥 Escalated to managers (urgent)
      |
      v
2h    : ❌ Task cancelled (SLA breach)
```

## Escalation Actions

### 1. Notify

Send a notification without changing assignment:

```typescript
{
  after: '15m',
  action: 'notify',
  channel: 'slack',     // 'slack', 'email', 'dashboard', 'webhook'
  priority: 'high',
  template: 'sla-warning', // Optional template name
}
```

### 2. Reassign

Move task to a different assignee:

```typescript
{
  after: '30m',
  action: 'reassign',
  target: {
    group: 'support-l2',  // Or userId: 'user_123'
  },
  message: 'Escalated due to SLA',
  resetTimer: true,      // Restart timer for new assignee
}
```

### 3. Escalate

Like reassign but marks task as escalated:

```typescript
{
  after: '1h',
  action: 'escalate',
  target: { group: 'managers' },
  priority: 'urgent',
  addComment: 'SLA escalation - urgent attention needed',
}
```

**Difference between `reassign` and `escalate`:**

- `reassign`: Normal reassignment, status unchanged
- `escalate`: Marks task as `ESCALATED`, adds urgency indicator

### 4. Cancel

Cancel the task and workflow:

```typescript
{
  after: '2h',
  action: 'cancel',
  reason: 'SLA breach after 2 hours',
  notifyAssignee: true,
}
```

## Per-Group SLA Rules

Define different SLAs based on group:

```typescript
interface GroupConfig {
  id: string;
  name: string;
  slaConfig: {
    defaultTimeout: string;
    escalationSteps: EscalationStep[];
  };
}

const groups = {
  'support-l1': {
    defaultTimeout: '30m',
    escalationSteps: [
      { after: '15m', action: 'notify', channel: 'slack' },
      { after: '30m', action: 'escalate', target: { group: 'support-l2' } },
    ],
  },
  'support-l2': {
    defaultTimeout: '2h',
    escalationSteps: [
      { after: '1h', action: 'notify', channel: 'slack' },
      { after: '2h', action: 'escalate', target: { group: 'managers' } },
    ],
  },
  managers: {
    defaultTimeout: '4h',
    escalationSteps: [{ after: '2h', action: 'notify', channel: 'email', priority: 'urgent' }],
  },
};
```

Use in workflow:

```typescript
const groupConfig = groups['support-l1'];
const result = await taskWithEscalation(ctx, {
  title: 'Customer Issue',
  form: { resolution: { type: 'textarea' } },
  assignTo: { group: 'support-l1' },
  escalation: {
    steps: groupConfig.escalationSteps,
  },
});
```

## Business Hours SLAs

SLAs that only count during business hours:

```typescript
import { businessHoursTimeout } from '@orkestra/sdk';

const result = await task(ctx, {
  title: 'Internal Approval',
  form: { approved: { type: 'boolean' } },
  assignTo: { group: 'finance' },
  sla: businessHoursTimeout({
    duration: '2h',
    hours: {
      start: '09:00',
      end: '17:00',
      timezone: 'America/New_York',
    },
    weekends: false, // Don't count weekends
    holidays: [
      '2024-12-25', // Christmas
      '2024-01-01', // New Year
    ],
  }),
});
```

**Example:**

- Task created at 4:30 PM on Friday
- 2 hours = 9:30 PM Friday, but business hours end at 5 PM
- 30 minutes counted on Friday
- 1.5 hours counted on Monday at 9 AM
- Deadline: 10:30 AM Monday

## Conditional Escalation

Escalate based on task data:

```typescript
const taskResult = await task(ctx, {
  title: 'Review Request',
  form: {
    approved: { type: 'boolean' },
    priority: {
      type: 'select',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'normal', label: 'Normal' },
        { value: 'high', label: 'High' },
      ],
    },
  },
  assignTo: { group: 'reviewers' },
  sla: async (taskData) => {
    if (taskData.priority === 'high') {
      return timeout('1h', {
        onBreach: 'escalate',
        target: { group: 'managers' },
      });
    } else {
      return timeout('24h', {
        onBreach: 'cancel',
      });
    }
  },
});
```

## Monitoring SLAs

### Track SLA Breaches

```typescript
// Get tasks near SLA deadline
const atRisk = await taskRepo.list(ctx, {
  status: 'assigned',
  slaDeadline: {
    before: new Date(Date.now() + 15 * 60 * 1000), // Next 15 min
  },
});

// Get breached SLAs
const breached = await taskRepo.list(ctx, {
  status: 'expired',
  slaDeadline: {
    before: new Date(),
  },
});
```

### SLA Metrics

```typescript
// Calculate SLA compliance rate
const metrics = {
  totalTasks: 100,
  completedOnTime: 95,
  completedAfterSLA: 3,
  expired: 2,
  complianceRate: 0.95, // 95%
  avgCompletionTime: '18m',
};
```

## Tenant-Level SLA Defaults

Define default SLAs per tenant:

```typescript
interface TenantConfig {
  id: string;
  name: string;
  slaDefaults: {
    defaultTimeout: string;
    escalationRules: EscalationStep[];
    groupOverrides: {
      [groupSlug: string]: {
        timeout: string;
        escalation: EscalationStep[];
      };
    };
  };
}

// Example tenant config
const tenantConfig = {
  id: 'tenant_123',
  name: 'Acme Corp',
  slaDefaults: {
    defaultTimeout: '1h',
    escalationRules: [
      { after: '30m', action: 'notify', channel: 'slack' },
      { after: '1h', action: 'escalate', target: { group: 'managers' } },
    ],
    groupOverrides: {
      'urgent-response': {
        timeout: '15m',
        escalation: [
          { after: '5m', action: 'notify', channel: 'slack', priority: 'high' },
          { after: '15m', action: 'escalate', target: { group: 'executives' } },
        ],
      },
    },
  },
};
```

## SLA Notifications

### Notification Channels

```typescript
interface SLANotification {
  channel: 'dashboard' | 'slack' | 'email' | 'webhook';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  template?: string;
  customMessage?: string;
}
```

### Example Configurations

**Slack Notification:**

```typescript
{
  channel: 'slack',
  priority: 'high',
  template: 'sla-warning',
  slack: {
    webhookUrl: 'https://hooks.slack.com/...',
    channel: '#alerts',
    username: 'Orkestra Bot',
    iconEmoji: ':warning:',
  },
}
```

**Email Notification:**

```typescript
{
  channel: 'email',
  priority: 'urgent',
  template: 'sla-urgent',
  email: {
    to: ['oncall@company.com'],
    subject: 'URGENT: SLA Breach - Task requires immediate attention',
  },
}
```

**Webhook:**

```typescript
{
  channel: 'webhook',
  priority: 'high',
  webhook: {
    url: 'https://api.company.com/sla-breach',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer token',
    },
  },
}
```

## Handling SLA Breaches in Workflows

### Catch and Retry

```typescript
export const slaAwareWorkflow = workflow('sla-aware', async (ctx, input) => {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const result = await task(ctx, {
        title: `Attempt ${attempts + 1}`,
        form: { approved: { type: 'boolean' } },
        assignTo: { group: 'reviewers' },
        sla: timeout('15m', {
          onBreach: 'reassign',
          target: { group: 'senior-reviewers' },
        }),
      });

      return { success: true, data: result.data };
    } catch (error) {
      attempts++;
      if (error.name === 'SLA_BREACH_CANCEL') {
        ctx.log.warn('SLA breach on task', { attempt: attempts });
        continue;
      }
      throw error;
    }
  }

  return { success: false, reason: 'Max attempts exceeded' };
});
```

### Fallback to Automatic Decision

```typescript
export const fallbackWorkflow = workflow('fallback', async (ctx, input) => {
  try {
    const result = await task(ctx, {
      title: 'Manual Review',
      form: { approved: { type: 'boolean' } },
      assignTo: { group: 'reviewers' },
      sla: timeout('1h', { onBreach: 'cancel' }),
    });

    return { result: result.data.approved, source: 'manual' };
  } catch (error) {
    if (error.name === 'SLA_BREACH_CANCEL') {
      // SLA breached - make automatic decision
      ctx.log.warn('SLA breached, making automatic decision');
      return { result: false, source: 'automatic' };
    }
    throw error;
  }
});
```

## Best Practices

### 1. Set Realistic SLAs

```typescript
// BAD - too aggressive
sla: timeout('5m'); // Unrealistic for human review

// GOOD - reasonable based on task complexity
sla: timeout('1h'); // Allows time for review
```

### 2. Use Escalation Chains

```typescript
// BAD - single step with harsh penalty
sla: timeout('30m', { onBreach: 'cancel' })

// GOOD - progressive escalation
escalation: {
  steps: [
    { after: '15m', action: 'notify' },
    { after: '30m', action: 'reassign', target: { group: 'l2' } },
    { after: '1h', action: 'escalate', target: { group: 'managers' } },
  ],
}
```

### 3. Notify Before Breach

```typescript
escalation: {
  steps: [
    { after: '20m', action: 'notify', priority: 'high' },  // Warning
    { after: '30m', action: 'escalate' },                   // Action
  ],
}
```

### 4. Consider Business Hours

```typescript
// For internal tasks, use business hours
sla: businessHoursTimeout({
  duration: '4h',
  hours: { start: '09:00', end: '17:00' },
});

// For customer-facing tasks, use 24/7
sla: timeout('1h');
```

### 5. Track and Adjust

```typescript
// Monitor SLA compliance monthly
const monthlyMetrics = await analytics.getMonthlySLAMetrics(tenantId);

if (monthlyMetrics.complianceRate < 0.9) {
  // SLA too aggressive - adjust
  await tenantService.updateSLADefaults(tenantId, {
    defaultTimeout: '2h', // Increased from 1h
  });
}
```

## Next Steps

- [Tasks Concept](./tasks.md) - Task lifecycle and states
- [Workflows Concept](./workflows.md) - Error handling patterns
- [Notification Guide](../guides/notifications.md) - Configuring channels
