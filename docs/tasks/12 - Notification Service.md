# Task 12: Notification Service

## Overview

Implement the notification routing service that alerts humans when tasks are created, escalated, or approaching SLA deadlines.

## Phase

🟠 **Phase 4: Dashboard**

## Priority

🟢 **Medium** - Enhances UX but not blocking

## Estimated Effort

4-6 hours

## Description

Create a notification service that routes alerts to appropriate channels (dashboard, email, Slack) based on tenant configuration.

## Requirements

### Package Structure Addition

```
packages/core/src/
├── services/
│   └── notifications/
│       ├── index.ts
│       ├── notification-service.ts
│       ├── channels/
│       │   ├── index.ts
│       │   ├── dashboard.ts       # In-app notifications
│       │   ├── email.ts           # Email notifications
│       │   └── slack.ts           # Slack notifications
│       └── templates/
│           ├── index.ts
│           ├── task-created.ts
│           ├── task-escalated.ts
│           └── sla-warning.ts
```

### Notification Service Interface

```typescript
// services/notifications/notification-service.ts
import { Task, User, Tenant } from '@prisma/client';

export interface NotificationEvent {
  type: NotificationType;
  tenantId: string;
  data: Record<string, unknown>;
}

export type NotificationType =
  | 'task.created'
  | 'task.assigned'
  | 'task.escalated'
  | 'task.sla_warning'
  | 'task.sla_breached'
  | 'task.completed';

export interface NotificationChannel {
  name: string;
  send(notification: NotificationPayload): Promise<void>;
}

export interface NotificationPayload {
  recipients: NotificationRecipient[];
  subject: string;
  body: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  metadata: Record<string, unknown>;
}

export interface NotificationRecipient {
  userId: string;
  email?: string;
  slackId?: string;
}

export class NotificationService {
  private channels: Map<string, NotificationChannel> = new Map();

  constructor(
    private tenantRepo: TenantRepository,
    private userRepo: UserRepository
  ) {}

  registerChannel(channel: NotificationChannel): void {
    this.channels.set(channel.name, channel);
  }

  async taskCreated(task: Task): Promise<void> {
    await this.notify({
      type: 'task.created',
      tenantId: task.tenantId,
      data: { task },
    });
  }

  async taskEscalated(task: Task, reason?: string): Promise<void> {
    await this.notify({
      type: 'task.escalated',
      tenantId: task.tenantId,
      data: { task, reason },
    });
  }

  async taskSLAWarning(task: Task, minutesRemaining: number): Promise<void> {
    await this.notify({
      type: 'task.sla_warning',
      tenantId: task.tenantId,
      data: { task, minutesRemaining },
    });
  }

  async taskReassigned(task: Task): Promise<void> {
    await this.notify({
      type: 'task.assigned',
      tenantId: task.tenantId,
      data: { task },
    });
  }

  private async notify(event: NotificationEvent): Promise<void> {
    // 1. Get tenant notification config
    const tenant = await this.tenantRepo.findById(event.tenantId);
    if (!tenant) return;

    const config = tenant.config as TenantConfig;
    const notificationConfig = config.notifications;

    // 2. Determine recipients
    const recipients = await this.resolveRecipients(event);
    if (recipients.length === 0) return;

    // 3. Build notification payload
    const payload = this.buildPayload(event, recipients);

    // 4. Route to appropriate channels based on config
    const activeChannels = this.selectChannels(notificationConfig, event);

    // 5. Send to all active channels
    await Promise.allSettled(
      activeChannels.map((channelName) => {
        const channel = this.channels.get(channelName);
        if (channel) {
          return channel.send(payload);
        }
      })
    );
  }

  private async resolveRecipients(
    event: NotificationEvent
  ): Promise<NotificationRecipient[]> {
    const { type, data } = event;
    const task = data.task as Task;

    switch (type) {
      case 'task.created':
      case 'task.assigned':
        // Notify assigned user or group members
        if (task.assignedUserId) {
          const user = await this.userRepo.findById(task.assignedUserId);
          return user ? [this.toRecipient(user)] : [];
        }
        if (task.assignedGroupId) {
          const members = await this.userRepo.findByGroup(task.assignedGroupId);
          return members.map(this.toRecipient);
        }
        return [];

      case 'task.escalated':
      case 'task.sla_warning':
      case 'task.sla_breached':
        // Notify current assignees + escalation targets
        const recipients: NotificationRecipient[] = [];

        if (task.assignedUserId) {
          const user = await this.userRepo.findById(task.assignedUserId);
          if (user) recipients.push(this.toRecipient(user));
        }
        if (task.assignedGroupId) {
          const members = await this.userRepo.findByGroup(task.assignedGroupId);
          recipients.push(...members.map(this.toRecipient));
        }

        // Also notify admins for escalations
        if (type === 'task.escalated') {
          const admins = await this.userRepo.findAdmins(event.tenantId);
          recipients.push(...admins.map(this.toRecipient));
        }

        return recipients;

      default:
        return [];
    }
  }

  private toRecipient(user: User): NotificationRecipient {
    return {
      userId: user.id,
      email: user.email,
      slackId: (user.preferences as any)?.slackId,
    };
  }

  private buildPayload(
    event: NotificationEvent,
    recipients: NotificationRecipient[]
  ): NotificationPayload {
    const template = this.getTemplate(event.type);
    const { subject, body } = template.render(event.data);

    return {
      recipients,
      subject,
      body,
      priority: this.getPriority(event.type),
      metadata: {
        eventType: event.type,
        tenantId: event.tenantId,
        ...event.data,
      },
    };
  }

  private selectChannels(
    config: NotificationConfig,
    event: NotificationEvent
  ): string[] {
    // Check rules for specific routing
    for (const rule of config.rules ?? []) {
      if (this.ruleMatches(rule, event)) {
        return [rule.channel];
      }
    }

    // Fall back to default channels
    return config.channels.filter((c) => c.enabled).map((c) => c.type);
  }

  private getPriority(type: NotificationType): NotificationPayload['priority'] {
    switch (type) {
      case 'task.sla_breached':
      case 'task.escalated':
        return 'urgent';
      case 'task.sla_warning':
        return 'high';
      default:
        return 'normal';
    }
  }
}
```

### Dashboard Channel (In-App)

```typescript
// services/notifications/channels/dashboard.ts
import { NotificationChannel, NotificationPayload } from '../notification-service';

export interface DashboardNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  priority: string;
  read: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export class DashboardChannel implements NotificationChannel {
  name = 'dashboard';

  constructor(private notificationRepo: DashboardNotificationRepository) {}

  async send(payload: NotificationPayload): Promise<void> {
    // Create in-app notification for each recipient
    await Promise.all(
      payload.recipients.map((recipient) =>
        this.notificationRepo.create({
          userId: recipient.userId,
          title: payload.subject,
          body: payload.body,
          priority: payload.priority,
          metadata: payload.metadata,
        })
      )
    );
  }
}

// Add endpoint to fetch notifications
// GET /notifications - List unread notifications for user
// POST /notifications/:id/read - Mark as read
```

### Email Channel

```typescript
// services/notifications/channels/email.ts
import { NotificationChannel, NotificationPayload } from '../notification-service';
import { Resend } from 'resend';

export class EmailChannel implements NotificationChannel {
  name = 'email';
  private resend: Resend;

  constructor(apiKey: string) {
    this.resend = new Resend(apiKey);
  }

  async send(payload: NotificationPayload): Promise<void> {
    const recipients = payload.recipients
      .filter((r) => r.email)
      .map((r) => r.email!);

    if (recipients.length === 0) return;

    await this.resend.emails.send({
      from: 'Orkestra <notifications@orkestra.io>',
      to: recipients,
      subject: payload.subject,
      html: this.renderEmailHtml(payload),
    });
  }

  private renderEmailHtml(payload: NotificationPayload): string {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">${payload.subject}</h2>
        <div style="color: #4a4a4a; line-height: 1.6;">
          ${payload.body}
        </div>
        <div style="margin-top: 24px;">
          <a href="${this.getTaskUrl(payload.metadata)}"
             style="background: #0066ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View Task
          </a>
        </div>
      </div>
    `;
  }

  private getTaskUrl(metadata: Record<string, unknown>): string {
    const task = metadata.task as any;
    return `${process.env.DASHBOARD_URL}/tasks/${task?.id}`;
  }
}
```

### Slack Channel

```typescript
// services/notifications/channels/slack.ts
import { WebClient } from '@slack/web-api';
import { NotificationChannel, NotificationPayload } from '../notification-service';

export class SlackChannel implements NotificationChannel {
  name = 'slack';
  private client: WebClient;

  constructor(token: string) {
    this.client = new WebClient(token);
  }

  async send(payload: NotificationPayload): Promise<void> {
    const slackRecipients = payload.recipients.filter((r) => r.slackId);

    for (const recipient of slackRecipients) {
      await this.client.chat.postMessage({
        channel: recipient.slackId!,
        text: payload.subject,
        blocks: this.buildBlocks(payload),
      });
    }
  }

  private buildBlocks(payload: NotificationPayload): any[] {
    const task = payload.metadata.task as any;

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: payload.subject,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: payload.body,
        },
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
            url: `${process.env.DASHBOARD_URL}/tasks/${task?.id}`,
            style: 'primary',
          },
        ],
      },
    ];
  }
}
```

### Notification Templates

```typescript
// services/notifications/templates/task-created.ts
export const taskCreatedTemplate = {
  render(data: { task: Task }) {
    const { task } = data;
    return {
      subject: `New Task: ${task.title}`,
      body: `
        A new task has been assigned to you.

        **${task.title}**
        ${task.description ?? ''}

        ${task.slaDeadline
          ? `Due: ${formatDate(task.slaDeadline)}`
          : ''}
      `.trim(),
    };
  },
};

// services/notifications/templates/task-escalated.ts
export const taskEscalatedTemplate = {
  render(data: { task: Task; reason?: string }) {
    const { task, reason } = data;
    return {
      subject: `⚠️ Escalated: ${task.title}`,
      body: `
        This task has been escalated and requires immediate attention.

        **${task.title}**
        ${reason ? `Reason: ${reason}` : ''}

        Please review and complete this task as soon as possible.
      `.trim(),
    };
  },
};
```

## Acceptance Criteria

- [ ] NotificationService routes events to channels
- [ ] Dashboard channel creates in-app notifications
- [ ] Email channel sends emails via Resend
- [ ] Slack channel posts messages (when configured)
- [ ] Recipient resolution works for users and groups
- [ ] Notification rules are evaluated correctly
- [ ] Priority is set based on event type
- [ ] Templates render correctly
- [ ] Dashboard API for fetching/marking notifications
- [ ] Unit tests for notification routing
- [ ] Integration test with mock channels

## Dependencies

- [[03 - Core Package Setup]]
- [[05 - Database Schema]]
- [[06 - Task Manager]]

## Blocked By

- [[06 - Task Manager]]

## Blocks

- [[14 - Integration Testing]]

## Technical Notes

### Dependencies

```json
{
  "dependencies": {
    "resend": "^2.0.0",
    "@slack/web-api": "^6.10.0"
  }
}
```

### Database Addition

Add notifications table:

```prisma
model DashboardNotification {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  title     String
  body      String
  priority  String
  read      Boolean  @default(false)
  metadata  Json?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId, read, createdAt])
  @@map("dashboard_notifications")
}
```

## References

- [Resend Documentation](https://resend.com/docs)
- [Slack Web API](https://api.slack.com/web)

## Tags

#orkestra #task #notifications #email #slack
