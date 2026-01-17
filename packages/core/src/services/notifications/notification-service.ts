/**
 * Notification Service
 *
 * Main service for sending notifications through various channels.
 */

import type { Task as PrismaTask } from '@prisma/client';
import type {
  NotificationChannel,
  NotificationEvent,
  NotificationPayload,
  NotificationRecipient,
  NotificationServiceConfig,
  NotificationPriority,
  RecipientResolver,
  TemplateMap,
  TaskCreatedEvent,
  TaskAssignedEvent,
  TaskEscalatedEvent,
  TaskCompletedEvent,
  SLAWarningEvent,
  SLABreachEvent,
  ChannelName,
} from './types.js';
import { getTemplate, defaultTemplates } from './templates/index.js';
import { generateId } from '../../utils/id.js';

/**
 * Default recipient resolver
 *
 * Resolves recipients based on task assignment.
 */
async function defaultRecipientResolver(event: NotificationEvent): Promise<NotificationRecipient[]> {
  const recipients: NotificationRecipient[] = [];
  const task = event.task;

  // For assignment events, send to the assigned user
  if (event.type === 'task_assigned') {
    const assignedEvent = event as TaskAssignedEvent;
    if (assignedEvent.assignedUserId) {
      recipients.push({
        type: 'user',
        userId: assignedEvent.assignedUserId,
      });
    }
  }

  // For most events, notify the assigned user or group
  // The Prisma Task has assignedUserId and assignedGroupId fields directly
  if (task.assignedUserId && !recipients.some((r) => r.userId === task.assignedUserId)) {
    recipients.push({
      type: 'user',
      userId: task.assignedUserId,
    });
  }

  if (task.assignedGroupId) {
    recipients.push({
      type: 'group',
      groupId: task.assignedGroupId,
    });
  }

  // For escalated events, also notify the new assignee
  if (event.type === 'task_escalated') {
    const escalatedEvent = event as TaskEscalatedEvent;
    if (escalatedEvent.newAssigneeUserId && !recipients.some((r) => r.userId === escalatedEvent.newAssigneeUserId)) {
      recipients.push({
        type: 'user',
        userId: escalatedEvent.newAssigneeUserId,
      });
    }
    if (escalatedEvent.newAssigneeGroupId && !recipients.some((r) => r.groupId === escalatedEvent.newAssigneeGroupId)) {
      recipients.push({
        type: 'group',
        groupId: escalatedEvent.newAssigneeGroupId,
      });
    }
  }

  return recipients;
}

/**
 * Notification Service
 *
 * Handles sending notifications through configured channels.
 */
export class NotificationService {
  private readonly config: NotificationServiceConfig;
  private readonly channels: Map<ChannelName, NotificationChannel> = new Map();
  private readonly recipientResolver: RecipientResolver;
  private readonly templates: TemplateMap;

  constructor(
    config: NotificationServiceConfig,
    options?: {
      recipientResolver?: RecipientResolver;
      templates?: TemplateMap;
    }
  ) {
    this.config = config;
    this.recipientResolver = options?.recipientResolver ?? defaultRecipientResolver;
    this.templates = options?.templates ?? defaultTemplates;
  }

  /**
   * Register a notification channel
   */
  registerChannel(channel: NotificationChannel): void {
    this.channels.set(channel.name, channel);
  }

  /**
   * Unregister a notification channel
   */
  unregisterChannel(channelName: ChannelName): void {
    this.channels.delete(channelName);
  }

  /**
   * Get a registered channel
   */
  getChannel(channelName: ChannelName): NotificationChannel | undefined {
    return this.channels.get(channelName);
  }

  /**
   * Get all registered channels
   */
  getChannels(): NotificationChannel[] {
    return Array.from(this.channels.values());
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Notify when a task is created
   */
  async taskCreated(task: PrismaTask): Promise<void> {
    const event: TaskCreatedEvent = {
      type: 'task_created',
      task,
      tenantId: task.tenantId,
      timestamp: new Date(),
      priority: this.mapTaskPriority(task.priority),
    };

    await this.notify(event);
  }

  /**
   * Notify when a task is assigned to a user
   */
  async taskAssigned(task: PrismaTask, userId: string): Promise<void> {
    const event: TaskAssignedEvent = {
      type: 'task_assigned',
      task,
      tenantId: task.tenantId,
      timestamp: new Date(),
      priority: this.mapTaskPriority(task.priority),
      assignedUserId: userId,
    };

    await this.notify(event);
  }

  /**
   * Notify when a task is escalated
   */
  async taskEscalated(task: PrismaTask, reason?: string): Promise<void> {
    const event: TaskEscalatedEvent = {
      type: 'task_escalated',
      task,
      tenantId: task.tenantId,
      timestamp: new Date(),
      priority: 'high', // Escalations are always high priority
      reason,
    };

    await this.notify(event);
  }

  /**
   * Notify when SLA warning threshold is reached
   */
  async taskSLAWarning(task: PrismaTask, minutesRemaining: number): Promise<void> {
    const event: SLAWarningEvent = {
      type: 'sla_warning',
      task,
      tenantId: task.tenantId,
      timestamp: new Date(),
      priority: 'high',
      minutesRemaining,
    };

    await this.notify(event);
  }

  /**
   * Notify when a task is completed
   */
  async taskCompleted(task: PrismaTask): Promise<void> {
    const event: TaskCompletedEvent = {
      type: 'task_completed',
      task,
      tenantId: task.tenantId,
      timestamp: new Date(),
      priority: 'normal',
      completedByUserId: task.completedBy ?? undefined,
    };

    await this.notify(event);
  }

  /**
   * Notify when SLA is breached
   */
  async slaBreach(task: PrismaTask): Promise<void> {
    const event: SLABreachEvent = {
      type: 'sla_breach',
      task,
      tenantId: task.tenantId,
      timestamp: new Date(),
      priority: 'urgent',
    };

    await this.notify(event);
  }

  /**
   * Alias for slaBreach to match the interface
   */
  async slaWarning(task: PrismaTask, timeRemaining: number): Promise<void> {
    return this.taskSLAWarning(task, timeRemaining);
  }

  // ============================================================================
  // Internal Methods
  // ============================================================================

  /**
   * Send notification for an event
   */
  private async notify(event: NotificationEvent): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Resolve recipients
      const recipients = await this.resolveRecipients(event);
      if (recipients.length === 0) {
        return;
      }

      // Select channels to use
      const channelNames = this.selectChannels(event);
      const activeChannels = channelNames
        .map((name) => this.channels.get(name))
        .filter((ch): ch is NotificationChannel => ch !== undefined && ch.isAvailable());

      if (activeChannels.length === 0) {
        return;
      }

      // Send to each recipient through each channel
      const sendPromises: Promise<void>[] = [];

      for (const recipient of recipients) {
        for (const channel of activeChannels) {
          // Check if recipient has opted out of this channel
          if (!this.shouldSendToChannel(recipient, channel.name)) {
            continue;
          }

          const payload = this.buildPayload(event, recipient);
          sendPromises.push(
            channel.send(payload).catch((error) => {
              console.error(`[NotificationService] Error sending to ${channel.name}:`, error);
            })
          );
        }
      }

      await Promise.all(sendPromises);
    } catch (error) {
      console.error('[NotificationService] Error processing notification:', error);
    }
  }

  /**
   * Resolve recipients for an event
   */
  private async resolveRecipients(event: NotificationEvent): Promise<NotificationRecipient[]> {
    return this.recipientResolver(event);
  }

  /**
   * Build notification payload
   */
  private buildPayload(event: NotificationEvent, recipient: NotificationRecipient): NotificationPayload {
    const template = getTemplate(event.type, this.templates);

    const title = template?.title(event) ?? `Notification: ${event.task.title}`;
    const body = template?.body(event) ?? '';

    const actionUrl = this.config.baseUrl
      ? `${this.config.baseUrl}/tasks/${event.task.id}`
      : undefined;

    return {
      id: generateId('notification'),
      eventType: event.type,
      priority: event.priority,
      tenantId: event.tenantId,
      taskId: event.task.id,
      title,
      body,
      actionUrl,
      recipient,
      metadata: {
        taskType: event.task.type,
        taskStatus: event.task.status,
        workflowId: event.task.workflowId,
      },
      timestamp: event.timestamp,
    };
  }

  /**
   * Select channels to send notification through
   */
  private selectChannels(event: NotificationEvent): ChannelName[] {
    const channels: ChannelName[] = [];

    // Always include dashboard if enabled
    if (this.config.channels.dashboard?.enabled) {
      channels.push('dashboard');
    }

    // Include email for high priority and escalations
    if (this.config.channels.email?.enabled) {
      if (event.priority === 'high' || event.priority === 'urgent') {
        channels.push('email');
      }
      // Also send email for SLA warnings and breaches
      if (event.type === 'sla_warning' || event.type === 'sla_breach') {
        if (!channels.includes('email')) {
          channels.push('email');
        }
      }
    }

    // Include Slack for urgent notifications and escalations
    if (this.config.channels.slack?.enabled) {
      if (event.priority === 'urgent' || event.type === 'task_escalated') {
        channels.push('slack');
      }
    }

    return channels;
  }

  /**
   * Check if notification should be sent to a specific channel for a recipient
   */
  private shouldSendToChannel(recipient: NotificationRecipient, channelName: ChannelName): boolean {
    const preferences = recipient.preferences ?? this.config.defaultPreferences;

    if (!preferences) {
      return true; // Default to sending if no preferences
    }

    switch (channelName) {
      case 'dashboard':
        return preferences.dashboard !== false;
      case 'email':
        return preferences.email !== false;
      case 'slack':
        return preferences.slack !== false;
      default:
        return true;
    }
  }

  /**
   * Map task priority to notification priority
   */
  private mapTaskPriority(taskPriority: string): NotificationPriority {
    switch (taskPriority) {
      case 'urgent':
        return 'urgent';
      case 'high':
        return 'high';
      case 'low':
        return 'low';
      default:
        return 'normal';
    }
  }
}

/**
 * Create notification service with default configuration
 */
export function createNotificationService(
  config: Partial<NotificationServiceConfig> = {}
): NotificationService {
  const defaultConfig: NotificationServiceConfig = {
    enabled: true,
    channels: {
      dashboard: { enabled: true },
      email: { enabled: false },
      slack: { enabled: false },
    },
    ...config,
  };

  return new NotificationService(defaultConfig);
}

/**
 * Create notification service with all channels pre-configured
 */
export function createNotificationServiceWithChannels(
  config: NotificationServiceConfig,
  channels: NotificationChannel[]
): NotificationService {
  const service = new NotificationService(config);

  for (const channel of channels) {
    service.registerChannel(channel);
  }

  return service;
}
