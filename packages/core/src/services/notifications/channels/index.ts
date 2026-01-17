/**
 * Notification Channels
 *
 * Export all notification channel implementations.
 */

// Dashboard channel
export {
  DashboardChannel,
  createDashboardChannel,
  createDashboardChannelWithStore,
  InMemoryDashboardNotificationStore,
} from './dashboard.js';

export type { DashboardNotificationStore } from './dashboard.js';

// Email channel
export {
  EmailChannel,
  createEmailChannel,
  createEmailChannelWithClient,
  StubEmailClient,
  ResendEmailClient,
} from './email.js';

export type { EmailClient, EmailSendResult } from './email.js';

// Slack channel
export {
  SlackChannel,
  createSlackChannel,
  createSlackChannelWithClient,
  StubSlackClient,
  WebAPISlackClient,
} from './slack.js';

export type { SlackClient, SlackSendResult, SlackBlock, SlackBlockElement, SlackTextObject } from './slack.js';
