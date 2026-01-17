/**
 * Notification Service
 *
 * Main entry point for the notification service module.
 * Re-exports all public APIs.
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Event types
  NotificationEventType,
  NotificationPriority,
  NotificationEventBase,
  TaskCreatedEvent,
  TaskAssignedEvent,
  TaskEscalatedEvent,
  TaskCompletedEvent,
  SLAWarningEvent,
  SLABreachEvent,
  NotificationEvent,
  // Recipient types
  RecipientType,
  NotificationRecipient,
  NotificationPreferences,
  // Payload types
  NotificationPayload,
  // Channel types
  ChannelName,
  NotificationChannel,
  ChannelConfig,
  DashboardChannelConfig,
  EmailChannelConfig,
  SlackChannelConfig,
  // Service types
  NotificationServiceConfig,
  RecipientResolver,
  NotificationTemplate,
  TemplateMap,
  // Dashboard types
  DashboardNotification,
  CreateDashboardNotificationInput,
} from './types.js';

// ============================================================================
// Notification Service
// ============================================================================

// Note: The class is exported with an alias to avoid conflict with the
// NotificationService interface from task-manager/types.ts
export {
  NotificationService as NotificationServiceImpl,
  createNotificationService,
  createNotificationServiceWithChannels,
} from './notification-service.js';

// ============================================================================
// Channels
// ============================================================================

// Dashboard channel
export {
  DashboardChannel,
  createDashboardChannel,
  createDashboardChannelWithStore,
  InMemoryDashboardNotificationStore,
} from './channels/index.js';

export type { DashboardNotificationStore } from './channels/index.js';

// Email channel
export {
  EmailChannel,
  createEmailChannel,
  createEmailChannelWithClient,
  StubEmailClient,
  ResendEmailClient,
} from './channels/index.js';

export type { EmailClient, EmailSendResult } from './channels/index.js';

// Slack channel
export {
  SlackChannel,
  createSlackChannel,
  createSlackChannelWithClient,
  StubSlackClient,
  WebAPISlackClient,
} from './channels/index.js';

export type { SlackClient, SlackSendResult, SlackBlock } from './channels/index.js';

// ============================================================================
// Templates
// ============================================================================

export {
  taskCreatedTemplate,
  taskAssignedTemplate,
  taskEscalatedTemplate,
  taskCompletedTemplate,
  slaWarningTemplate,
  slaBreachTemplate,
  defaultTemplates,
  getTemplate,
} from './templates/index.js';
