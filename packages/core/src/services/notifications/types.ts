/**
 * Notification Service Types
 *
 * Types and interfaces for the notification service.
 */

import type { Task as PrismaTask } from '@prisma/client';

// ============================================================================
// Notification Event Types
// ============================================================================

/**
 * Types of notification events
 */
export type NotificationEventType =
  | 'task_created'
  | 'task_assigned'
  | 'task_escalated'
  | 'task_completed'
  | 'sla_warning'
  | 'sla_breach';

/**
 * Priority levels for notifications
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Notification event base
 */
export interface NotificationEventBase {
  /** Event type */
  type: NotificationEventType;
  /** The task related to this notification */
  task: PrismaTask;
  /** Tenant ID */
  tenantId: string;
  /** Timestamp of the event */
  timestamp: Date;
  /** Event priority */
  priority: NotificationPriority;
}

/**
 * Task created notification event
 */
export interface TaskCreatedEvent extends NotificationEventBase {
  type: 'task_created';
}

/**
 * Task assigned notification event
 */
export interface TaskAssignedEvent extends NotificationEventBase {
  type: 'task_assigned';
  /** User ID the task was assigned to */
  assignedUserId: string;
}

/**
 * Task escalated notification event
 */
export interface TaskEscalatedEvent extends NotificationEventBase {
  type: 'task_escalated';
  /** Reason for escalation */
  reason?: string | undefined;
  /** Previous assignee user ID */
  previousAssigneeUserId?: string | undefined;
  /** Previous assignee group ID */
  previousAssigneeGroupId?: string | undefined;
  /** New assignee user ID */
  newAssigneeUserId?: string | undefined;
  /** New assignee group ID */
  newAssigneeGroupId?: string | undefined;
}

/**
 * Task completed notification event
 */
export interface TaskCompletedEvent extends NotificationEventBase {
  type: 'task_completed';
  /** User who completed the task */
  completedByUserId?: string | undefined;
}

/**
 * SLA warning notification event
 */
export interface SLAWarningEvent extends NotificationEventBase {
  type: 'sla_warning';
  /** Minutes remaining until SLA breach */
  minutesRemaining: number;
}

/**
 * SLA breach notification event
 */
export interface SLABreachEvent extends NotificationEventBase {
  type: 'sla_breach';
  /** How many minutes past the deadline */
  minutesPastDeadline?: number | undefined;
}

/**
 * Union of all notification event types
 */
export type NotificationEvent =
  | TaskCreatedEvent
  | TaskAssignedEvent
  | TaskEscalatedEvent
  | TaskCompletedEvent
  | SLAWarningEvent
  | SLABreachEvent;

// ============================================================================
// Notification Recipient Types
// ============================================================================

/**
 * Recipient type
 */
export type RecipientType = 'user' | 'group' | 'email';

/**
 * Notification recipient
 */
export interface NotificationRecipient {
  /** Recipient type */
  type: RecipientType;
  /** User ID (if type is 'user') */
  userId?: string | undefined;
  /** Group ID (if type is 'group') */
  groupId?: string | undefined;
  /** Email address (if type is 'email' or for user lookup) */
  email?: string | undefined;
  /** Display name */
  name?: string | undefined;
  /** User preferences for notification channels */
  preferences?: NotificationPreferences | undefined;
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  /** Whether to receive dashboard notifications */
  dashboard?: boolean | undefined;
  /** Whether to receive email notifications */
  email?: boolean | undefined;
  /** Whether to receive Slack notifications */
  slack?: boolean | undefined;
  /** Slack user ID or channel for direct messages */
  slackUserId?: string | undefined;
}

// ============================================================================
// Notification Payload Types
// ============================================================================

/**
 * Notification payload sent to channels
 */
export interface NotificationPayload {
  /** Unique notification ID */
  id: string;
  /** Event type */
  eventType: NotificationEventType;
  /** Notification priority */
  priority: NotificationPriority;
  /** Tenant ID */
  tenantId: string;
  /** Task ID */
  taskId: string;
  /** Notification title */
  title: string;
  /** Notification body/message */
  body: string;
  /** URL to view the task (if applicable) */
  actionUrl?: string | undefined;
  /** Recipient information */
  recipient: NotificationRecipient;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// Notification Channel Types
// ============================================================================

/**
 * Channel names
 */
export type ChannelName = 'dashboard' | 'email' | 'slack';

/**
 * Notification channel interface
 *
 * Implement this interface to add new notification channels.
 */
export interface NotificationChannel {
  /** Channel name */
  readonly name: ChannelName;

  /**
   * Send a notification through this channel
   * @param payload - The notification payload to send
   */
  send(payload: NotificationPayload): Promise<void>;

  /**
   * Check if the channel is available/configured
   */
  isAvailable(): boolean;
}

/**
 * Channel configuration for the notification service
 */
export interface ChannelConfig {
  /** Dashboard channel config */
  dashboard?: DashboardChannelConfig;
  /** Email channel config */
  email?: EmailChannelConfig;
  /** Slack channel config */
  slack?: SlackChannelConfig;
}

/**
 * Dashboard channel configuration
 */
export interface DashboardChannelConfig {
  /** Whether dashboard notifications are enabled */
  enabled: boolean;
}

/**
 * Email channel configuration (Resend)
 */
export interface EmailChannelConfig {
  /** Whether email notifications are enabled */
  enabled: boolean;
  /** Resend API key */
  apiKey?: string;
  /** From email address */
  fromEmail?: string;
  /** From name */
  fromName?: string;
}

/**
 * Slack channel configuration
 */
export interface SlackChannelConfig {
  /** Whether Slack notifications are enabled */
  enabled: boolean;
  /** Slack bot token */
  botToken?: string;
  /** Default channel ID for notifications */
  defaultChannelId?: string;
}

// ============================================================================
// Notification Service Types
// ============================================================================

/**
 * Notification service configuration
 */
export interface NotificationServiceConfig {
  /** Whether notifications are enabled globally */
  enabled: boolean;
  /** Channel configurations */
  channels: ChannelConfig;
  /** Base URL for task action links */
  baseUrl?: string;
  /** Default notification preferences */
  defaultPreferences?: NotificationPreferences;
}

/**
 * Recipient resolver function type
 *
 * Used to resolve recipients for a notification event.
 */
export type RecipientResolver = (
  event: NotificationEvent
) => Promise<NotificationRecipient[]>;

/**
 * Notification template function type
 *
 * Templates take an event and return title and body.
 */
export interface NotificationTemplate {
  /** Generate notification title */
  title(event: NotificationEvent): string;
  /** Generate notification body */
  body(event: NotificationEvent): string;
}

/**
 * Map of event types to templates
 */
export type TemplateMap = Partial<Record<NotificationEventType, NotificationTemplate>>;

// ============================================================================
// Dashboard Notification Types
// ============================================================================

/**
 * Dashboard notification record (stored in database)
 */
export interface DashboardNotification {
  /** Unique notification ID */
  id: string;
  /** Tenant ID */
  tenantId: string;
  /** User ID this notification is for */
  userId: string;
  /** Task ID (if related to a task) */
  taskId?: string | undefined;
  /** Event type */
  eventType: NotificationEventType;
  /** Notification title */
  title: string;
  /** Notification body */
  body: string;
  /** URL to view the related item */
  actionUrl?: string | undefined;
  /** Whether the notification has been read */
  read: boolean;
  /** When the notification was read */
  readAt?: Date | undefined;
  /** Priority */
  priority: NotificationPriority;
  /** Created timestamp */
  createdAt: Date;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Input for creating a dashboard notification
 */
export interface CreateDashboardNotificationInput {
  tenantId: string;
  userId: string;
  taskId?: string | undefined;
  eventType: NotificationEventType;
  title: string;
  body: string;
  actionUrl?: string | undefined;
  priority: NotificationPriority;
  metadata?: Record<string, unknown> | undefined;
}
