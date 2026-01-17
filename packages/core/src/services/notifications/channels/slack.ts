/**
 * Slack Notification Channel
 *
 * Sends notifications to Slack via the Slack API.
 * This is a stub implementation - configure with a Slack bot token for production.
 */

import type {
  NotificationChannel,
  NotificationPayload,
  SlackChannelConfig,
  NotificationPriority,
} from '../types.js';

/**
 * Slack message send result
 */
export interface SlackSendResult {
  success: boolean;
  ts?: string; // Slack message timestamp
  error?: string;
}

/**
 * Slack text object
 */
export interface SlackTextObject {
  type: string;
  text: string;
  emoji?: boolean | undefined;
}

/**
 * Slack message block element
 */
export interface SlackBlock {
  type: string;
  text?: SlackTextObject | undefined;
  accessory?: {
    type: string;
    text?: SlackTextObject | undefined;
    url?: string | undefined;
  } | undefined;
  elements?: Array<SlackBlockElement> | undefined;
}

/**
 * Slack block element (for actions, context, etc.)
 */
export interface SlackBlockElement {
  type: string;
  text?: SlackTextObject | string | undefined;
  url?: string | undefined;
}

/**
 * Slack client interface
 *
 * Abstracts the Slack API for easier testing and mocking.
 */
export interface SlackClient {
  /**
   * Post a message to a Slack channel or user
   */
  postMessage(options: {
    channel: string;
    text: string;
    blocks?: SlackBlock[];
  }): Promise<SlackSendResult>;
}

/**
 * Stub Slack client for development/testing
 *
 * Logs messages to console instead of sending to Slack.
 */
export class StubSlackClient implements SlackClient {
  private readonly logMessages: boolean;

  constructor(options: { logMessages?: boolean } = {}) {
    this.logMessages = options.logMessages ?? true;
  }

  async postMessage(options: {
    channel: string;
    text: string;
    blocks?: SlackBlock[];
  }): Promise<SlackSendResult> {
    if (this.logMessages) {
      console.log('[SlackChannel:Stub] Would post message:', {
        channel: options.channel,
        text: options.text,
        blockCount: options.blocks?.length ?? 0,
      });
    }

    return {
      success: true,
      ts: `${Date.now()}.${Math.random().toString(36).slice(2)}`,
    };
  }
}

/**
 * Web API Slack client
 *
 * Production client that posts messages via Slack Web API.
 * Note: This is a stub implementation. Install @slack/web-api for actual integration.
 */
export class WebAPISlackClient implements SlackClient {
  private readonly botToken: string;

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  async postMessage(options: {
    channel: string;
    text: string;
    blocks?: SlackBlock[];
  }): Promise<SlackSendResult> {
    // Stub implementation - in production, this would use the Slack SDK
    // import { WebClient } from '@slack/web-api';
    // const client = new WebClient(this.botToken);
    // const result = await client.chat.postMessage({ ... });

    console.log('[SlackChannel:WebAPI] Would post message via Slack API:', {
      channel: options.channel,
      text: options.text,
      botTokenPresent: !!this.botToken,
    });

    // Simulated response - replace with actual Slack API call
    return {
      success: true,
      ts: `${Date.now()}.${Math.random().toString(36).slice(2)}`,
    };
  }
}

/**
 * Slack notification channel
 *
 * Sends notifications to Slack using the configured Slack client.
 */
export class SlackChannel implements NotificationChannel {
  readonly name = 'slack' as const;
  private readonly config: SlackChannelConfig;
  private readonly client: SlackClient;

  constructor(config: SlackChannelConfig, client?: SlackClient) {
    this.config = config;

    if (client) {
      this.client = client;
    } else if (config.botToken) {
      this.client = new WebAPISlackClient(config.botToken);
    } else {
      this.client = new StubSlackClient();
    }
  }

  isAvailable(): boolean {
    return this.config.enabled;
  }

  async send(payload: NotificationPayload): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    // Determine channel to send to
    const channel = this.resolveChannel(payload);
    if (!channel) {
      console.warn('[SlackChannel] No channel resolved for notification, skipping');
      return;
    }

    const text = this.buildFallbackText(payload);
    const blocks = this.buildBlocks(payload);

    try {
      const result = await this.client.postMessage({
        channel,
        text,
        blocks,
      });

      if (!result.success) {
        console.error('[SlackChannel] Failed to send message:', result.error);
      }
    } catch (error) {
      console.error('[SlackChannel] Error sending message:', error);
    }
  }

  /**
   * Resolve the Slack channel or user to send to
   */
  private resolveChannel(payload: NotificationPayload): string | null {
    // If recipient has a Slack user ID, send as DM
    if (payload.recipient.preferences?.slackUserId) {
      return payload.recipient.preferences.slackUserId;
    }

    // Use default channel if configured
    if (this.config.defaultChannelId) {
      return this.config.defaultChannelId;
    }

    return null;
  }

  /**
   * Build fallback text for the message (used when blocks can't be displayed)
   */
  private buildFallbackText(payload: NotificationPayload): string {
    return `${payload.title}: ${payload.body}`;
  }

  /**
   * Build Slack blocks for rich message formatting
   */
  private buildBlocks(payload: NotificationPayload): SlackBlock[] {
    const blocks: SlackBlock[] = [];

    // Header with priority emoji
    const priorityEmoji = this.getPriorityEmoji(payload.priority);
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${priorityEmoji} ${payload.title}`,
        emoji: true,
      },
    });

    // Body section
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: payload.body,
      },
    });

    // Action button if URL is available
    if (payload.actionUrl) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Task',
              emoji: true,
            },
            url: payload.actionUrl,
          },
        ],
      });
    }

    // Context with timestamp
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Task ID: ${payload.taskId}`,
        },
      ],
    });

    return blocks;
  }

  /**
   * Get emoji for priority level
   */
  private getPriorityEmoji(priority: NotificationPriority): string {
    switch (priority) {
      case 'urgent':
        return ':rotating_light:';
      case 'high':
        return ':warning:';
      case 'normal':
        return ':bell:';
      case 'low':
        return ':information_source:';
      default:
        return ':bell:';
    }
  }
}

/**
 * Create a Slack channel with default configuration
 */
export function createSlackChannel(
  config: SlackChannelConfig = { enabled: false }
): SlackChannel {
  return new SlackChannel(config);
}

/**
 * Create a Slack channel with a custom client
 */
export function createSlackChannelWithClient(
  config: SlackChannelConfig,
  client: SlackClient
): SlackChannel {
  return new SlackChannel(config, client);
}
