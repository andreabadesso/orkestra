# Notifications

This guide covers how to configure and use the notification system in Orkestra. Notifications keep users informed about tasks, escalations, and SLA events.

## Table of Contents

- [Notification Overview](#notification-overview)
- [Configuration](#configuration)
- [Notification Channels](#notification-channels)
- [Notification Events](#notification-events)
- [Notification Templates](#notification-templates)
- [User Preferences](#user-preferences)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Notification Overview

The notification system sends alerts through multiple channels when important events occur in your workflows.

### Default Events

Orkestra sends notifications for:

| Event            | Description                       | Default Priority |
| ---------------- | --------------------------------- | ---------------- |
| `task_created`   | New task created                  | normal           |
| `task_assigned`  | Task assigned to user             | normal           |
| `task_escalated` | Task escalated to higher priority | high             |
| `task_completed` | Task completed by user            | low              |
| `sla_warning`    | Approaching SLA deadline          | high             |
| `sla_breach`     | SLA deadline exceeded             | urgent           |

### Notification Flow

```
Workflow Event → Notification Service → Channel → User
```

---

## Configuration

### Enable Notifications

Notifications are configured in your Orkestra setup:

```typescript
// packages/api/src/config.ts
export const notificationConfig = {
  enabled: true,
  channels: {
    dashboard: {
      enabled: true,
    },
    email: {
      enabled: process.env.EMAIL_ENABLED === 'true',
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.FROM_EMAIL,
      fromName: 'Orkestra Notifications',
    },
    slack: {
      enabled: process.env.SLACK_ENABLED === 'true',
      botToken: process.env.SLACK_BOT_TOKEN,
      defaultChannelId: process.env.SLACK_DEFAULT_CHANNEL,
    },
  },
  baseUrl: process.env.APP_URL || 'http://localhost:3000',
};
```

### Environment Variables

```bash
# Email (Resend)
EMAIL_ENABLED=true
RESEND_API_KEY=re_xxxxxxxxxxxxx
FROM_EMAIL=notifications@yourcompany.com
FROM_NAME="Task Notifications"

# Slack
SLACK_ENABLED=true
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx
SLACK_DEFAULT_CHANNEL=C1234567890

# App
APP_URL=https://app.yourcompany.com
```

---

## Notification Channels

### Dashboard Notifications

In-app notifications shown in the Dashboard. Always enabled.

**Features**:

- Real-time updates
- Read/unread tracking
- Direct links to tasks
- Persistent storage

**Configuration**:

```typescript
{
  dashboard: {
    enabled: true,
  }
}
```

### Email Notifications

Email sent via Resend.

**Features**:

- Rich HTML formatting
- Attachments support
- Custom templates
- Batching for multiple events

**Configuration**:

```typescript
{
  email: {
    enabled: true,
    apiKey: 're_xxxxxxxxxxxxx',
    fromEmail: 'notifications@yourcompany.com',
    fromName: 'Task Notifications',
  }
}
```

**Example Email Template**:

```typescript
export const taskCreatedEmailTemplate = (event: TaskCreatedEvent) => ({
  subject: `New Task: ${event.task.title}`,
  html: `
    <h2>New Task Assigned</h2>
    <p><strong>Title:</strong> ${event.task.title}</p>
    <p><strong>Description:</strong> ${event.task.description || 'No description'}</p>
    <p><strong>Priority:</strong> ${event.task.priority}</p>
    <p><strong>Due:</strong> ${new Date(event.task.dueAt).toLocaleString()}</p>
    <p>
      <a href="${baseUrl}/tasks/${event.task.id}">
        View Task in Dashboard
      </a>
    </p>
  `,
});
```

### Slack Notifications

Messages sent to Slack channels or DMs.

**Features**:

- Interactive buttons
- Threaded conversations
- Channel or direct message
- Rich formatting

**Configuration**:

```typescript
{
  slack: {
    enabled: true,
    botToken: 'xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx',
    defaultChannelId: 'C1234567890',
  }
}
```

**Example Slack Message**:

```typescript
export const taskCreatedSlackTemplate = (event: TaskCreatedEvent) => ({
  channel: event.recipient.slackUserId,
  blocks: [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📋 New Task: ${event.task.title}`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Priority:*\n${event.task.priority}`,
        },
        {
          type: 'mrkdwn',
          text: `*Due:*\n${new Date(event.task.dueAt).toLocaleString()}`,
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Task',
          },
          url: `${baseUrl}/tasks/${event.task.id}`,
        },
      ],
    },
  ],
});
```

---

## Notification Events

### Task Created

When a new task is created.

**Event Data**:

```typescript
{
  type: 'task_created',
  task: {
    id: 'tsk_abc123',
    title: 'Review Document',
    description: 'Please review the attached document',
    priority: 'high',
    dueAt: '2024-01-20T10:00:00Z',
  },
  tenantId: 'tenant_123',
  timestamp: new Date(),
  priority: 'high',
}
```

### Task Assigned

When a task is assigned to a user.

**Event Data**:

```typescript
{
  type: 'task_assigned',
  task: { /* ... */ },
  tenantId: 'tenant_123',
  timestamp: new Date(),
  priority: 'normal',
  assignedUserId: 'usr_xyz789',
}
```

### Task Escalated

When a task is escalated to a higher priority or different group.

**Event Data**:

```typescript
{
  type: 'task_escalated',
  task: { /* ... */ },
  tenantId: 'tenant_123',
  timestamp: new Date(),
  priority: 'high',
  reason: 'SLA breached',
  previousAssigneeGroupId: 'support-l1',
  newAssigneeGroupId: 'support-l2',
}
```

### Task Completed

When a user completes a task.

**Event Data**:

```typescript
{
  type: 'task_completed',
  task: { /* ... */ },
  tenantId: 'tenant_123',
  timestamp: new Date(),
  priority: 'low',
  completedByUserId: 'usr_xyz789',
}
```

### SLA Warning

When a task is approaching its SLA deadline.

**Event Data**:

```typescript
{
  type: 'sla_warning',
  task: { /* ... */ },
  tenantId: 'tenant_123',
  timestamp: new Date(),
  priority: 'high',
  minutesRemaining: 15,
}
```

### SLA Breach

When a task exceeds its SLA deadline.

**Event Data**:

```typescript
{
  type: 'sla_breach',
  task: { /* ... */ },
  tenantId: 'tenant_123',
  timestamp: new Date(),
  priority: 'urgent',
  minutesPastDeadline: 5,
}
```

---

## Notification Templates

### Built-in Templates

Orkestra includes default templates for all event types:

```typescript
// Default templates are auto-generated based on event type
// They can be customized per tenant
```

### Custom Templates

Override templates for your use case:

```typescript
// packages/core/src/services/notifications/templates/custom.ts
export const customTaskCreatedTemplate = {
  title: (event: NotificationEvent) => {
    return `🔔 New ${event.task.type}: ${event.task.title}`;
  },
  body: (event: NotificationEvent) => {
    const { task } = event;
    return `
A new ${task.type} has been assigned to you.

Title: ${task.title}
Priority: ${task.priority}
Due: ${new Date(task.dueAt).toLocaleString()}

${task.description ? `Description: ${task.description}` : ''}

${Object.entries(task.context || {})
  .map(([key, value]) => `${key}: ${value}`)
  .join('\n')}
    `.trim();
  },
};
```

### Register Custom Templates

```typescript
import { NotificationService } from '@orkestra/core';

const notificationService = new NotificationService({
  enabled: true,
  channels: {
    /* ... */
  },
  templates: {
    task_created: customTaskCreatedTemplate,
    task_escalated: customEscalationTemplate,
  },
});
```

### Template Variables

Available in all templates:

| Variable                 | Type      | Description     |
| ------------------------ | --------- | --------------- |
| `event.type`             | string    | Event type      |
| `event.task`             | Task      | Task object     |
| `event.tenantId`         | string    | Tenant ID       |
| `event.timestamp`        | Date      | Event timestamp |
| `event.priority`         | string    | Event priority  |
| `event.minutesRemaining` | number    | SLA warning     |
| `event.recipient`        | Recipient | Recipient info  |
| `baseUrl`                | string    | App base URL    |

---

## User Preferences

### Preference Types

Users can control which notifications they receive:

```typescript
interface NotificationPreferences {
  dashboard?: boolean; // In-app notifications
  email?: boolean; // Email notifications
  slack?: boolean; // Slack notifications
  slackUserId?: string; // Slack user ID for DMs
}
```

### Setting Preferences

Via Dashboard:

```typescript
// User updates preferences
await prisma.user.update({
  where: { id: userId },
  data: {
    notificationPreferences: {
      dashboard: true,
      email: false,
      slack: true,
    },
  },
});
```

Via API:

```typescript
await trpc.user.updatePreferences.mutate({
  preferences: {
    dashboard: true,
    email: false,
    slack: true,
  },
});
```

### Default Preferences

Set defaults for new users:

```typescript
const defaultPreferences: NotificationPreferences = {
  dashboard: true,
  email: true,
  slack: false,
};
```

---

## Best Practices

### 1. Don't Over-Notify

```typescript
// Good: Notify only for important events
{
  task_created: true,
  task_escalated: true,
  sla_breach: true,
}

// Bad: Notify for everything
{
  task_created: true,
  task_assigned: true,
  task_claimed: true,
  task_in_progress: true,
  task_completed: true,
  // ... too many notifications
}
```

### 2. Use Appropriate Priorities

```typescript
// Good: Match priority to urgency
{
  sla_breach: 'urgent',
  task_escalated: 'high',
  sla_warning: 'high',
  task_created: 'normal',
  task_completed: 'low',
}

// Bad: Everything is urgent
{
  task_created: 'urgent',
  task_completed: 'urgent',
  // ... users will ignore notifications
}
```

### 3. Provide Actionable Links

```typescript
// Good: Direct link to task
const body = `
A new task has been assigned.

<a href="${baseUrl}/tasks/${task.id}">View Task</a>
`;

// Bad: No way to take action
const body = `
A new task has been assigned.
Task ID: ${task.id}
`;
```

### 4. Include Relevant Context

```typescript
// Good: Rich context
{
  title: `New ${task.type}: ${task.title}`,
  body: `
Priority: ${task.priority}
Customer: ${task.context.customerName}
Order ID: ${task.context.orderId}
Amount: $${task.context.amount}
  `,
}

// Bad: Minimal information
{
  title: 'New Task',
  body: 'You have a new task.',
}
```

### 5. Respect User Preferences

```typescript
// Always check preferences before sending
if (recipient.preferences?.email) {
  await emailChannel.send(payload);
}
if (recipient.preferences?.slack && recipient.slackUserId) {
  await slackChannel.sendDirectMessage(payload, recipient.slackUserId);
}
```

### 6. Use Channels Appropriately

```typescript
// Dashboard: For persistent, actionable notifications
// Email: For important, non-urgent events
// Slack: For urgent, time-sensitive events

if (event.priority === 'urgent' && user.slackUserId) {
  await sendSlackDM(event, user.slackUserId);
} else if (event.priority === 'high' && user.preferences.email) {
  await sendEmail(event);
} else {
  await sendDashboardNotification(event);
}
```

### 7. Monitor Notification Health

```typescript
// Track delivery metrics
const metrics = {
  totalSent: 0,
  delivered: 0,
  failed: 0,
  byChannel: {
    dashboard: { sent: 0, delivered: 0 },
    email: { sent: 0, delivered: 0 },
    slack: { sent: 0, delivered: 0 },
  },
};

// Alert on high failure rates
if (metrics.failed / metrics.totalSent > 0.1) {
  await notifyAdmin('High notification failure rate', metrics);
}
```

---

## Troubleshooting

### Notifications Not Sending

**Symptoms**: Events occur but no notifications delivered

**Solutions**:

1. Check if notification service is enabled
2. Verify channel configurations
3. Check logs for errors
4. Test individual channels

```bash
# Check notification service
docker compose logs orkestra-api | grep notification

# Test email
npx orkestra notification test email user@example.com

# Test Slack
npx orkestra notification test slack @username
```

### Emails Not Arriving

**Symptoms**: Email notifications not delivered

**Solutions**:

1. Verify Resend API key is correct
2. Check from email is verified
3. Check recipient email preferences
4. Check spam folder

```bash
# Test email configuration
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -d "from=onboarding@resend.dev" \
  -d "to=delivered@resend.dev" \
  -d "subject=Test" \
  -d "html=Test email"
```

### Slack Notifications Failing

**Symptoms**: Slack messages not sending

**Solutions**:

1. Verify bot token is valid
2. Check bot has permission to send messages
3. Verify channel ID or user ID is correct
4. Check bot is invited to workspace

```bash
# Test Slack bot
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -d "channel=C1234567890" \
  -d "text=Test message"
```

### Duplicate Notifications

**Symptoms**: Same notification sent multiple times

**Solutions**:

1. Check for duplicate event triggers
2. Verify notification deduplication is working
3. Check retry policies
4. Review workflow signal handlers

```typescript
// Implement deduplication
const sentNotifications = new Set<string>();

async function sendNotification(event: NotificationEvent) {
  const key = `${event.type}-${event.task.id}-${event.timestamp.getTime()}`;

  if (sentNotifications.has(key)) {
    return;
  }

  await deliver(event);
  sentNotifications.add(key);
}
```

### Wrong Recipients

**Symptoms**: Notifications sent to wrong users

**Solutions**:

1. Verify assignment logic
2. Check group membership
3. Review recipient resolver
4. Check user preferences

```typescript
// Debug: Log recipient resolution
const recipients = await resolveRecipients(event);

ctx.log.info('Notification recipients', {
  eventType: event.type,
  taskId: event.task.id,
  recipients: recipients.map((r) => r.userId || r.groupId),
});
```

### SLA Warnings Not Triggering

**Symptoms**: No warnings before SLA deadline

**Solutions**:

1. Verify SLA `warnBefore` is configured
2. Check warning time calculation
3. Ensure notification service is processing timers
4. Review Temporal workflow timers

```typescript
// Debug: Check SLA configuration
ctx.log.info('Task SLA config', {
  taskId,
  deadline: task.dueAt,
  warnBefore: task.sla.warnBefore,
  warningTime: new Date(new Date(task.dueAt).getTime() - task.sla.warnBefore),
});
```

### Dashboard Notifications Not Persisting

**Symptoms**: Notifications disappear or not saved

**Solutions**:

1. Check database connection
2. Verify notification table exists
3. Check for database write errors
4. Review user notification queries

```bash
# Check database
nix develop --command psql orkestra
\dt notifications
```

---

## Resources

- [Writing Workflows](./writing-workflows.md)
- [SLA and Escalation](../concepts/sla-escalation.md)
- [Task Concepts](../concepts/tasks.md)
- [Deployment Guide](./deployment.md)
