/**
 * Messaging Activities
 *
 * Mock message sending for the support bot example.
 * In a real implementation, this would integrate with various messaging platforms.
 */

import { log } from '@temporalio/activity';

// ============================================================================
// Types
// ============================================================================

export interface SendMessageInput {
  /** Conversation identifier */
  conversationId: string;
  /** Customer identifier */
  customerId: string;
  /** Communication channel */
  channel: 'chat' | 'email' | 'slack';
  /** Message content */
  message: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface SendMessageResult {
  /** Whether the message was sent successfully */
  success: boolean;
  /** Unique message identifier */
  messageId: string;
  /** Timestamp when the message was sent */
  sentAt: string;
  /** Delivery status */
  deliveryStatus: 'sent' | 'delivered' | 'failed';
}

export interface LogConversationEventInput {
  /** Conversation identifier */
  conversationId: string;
  /** Event type */
  event: string;
  /** Event data */
  data?: Record<string, unknown>;
}

// ============================================================================
// Activity Implementations
// ============================================================================

/**
 * Send a message to a customer.
 *
 * This is a mock implementation that logs the message.
 * In production, this would integrate with:
 * - Email providers (SendGrid, Mailgun, etc.)
 * - Chat platforms (Intercom, Zendesk, etc.)
 * - Slack webhooks
 */
export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const { conversationId, customerId, channel, message, metadata } = input;

  log.info('Sending message', {
    conversationId,
    customerId,
    channel,
    messageLength: message.length,
    metadata,
  });

  // Simulate network latency
  await sleep(50 + Math.random() * 100);

  // Generate a mock message ID
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const sentAt = new Date().toISOString();

  // Mock channel-specific behavior
  switch (channel) {
    case 'email':
      log.info('Email sent', {
        messageId,
        conversationId,
        to: `customer-${customerId}@example.com`,
      });
      break;

    case 'slack':
      log.info('Slack message sent', {
        messageId,
        conversationId,
        channel: `#support-${customerId}`,
      });
      break;

    case 'chat':
    default:
      log.info('Chat message sent', {
        messageId,
        conversationId,
      });
      break;
  }

  // In a real implementation, you would check delivery status
  // For now, we simulate successful delivery
  const deliveryStatus = Math.random() > 0.02 ? 'delivered' : 'sent';

  return {
    success: true,
    messageId,
    sentAt,
    deliveryStatus,
  };
}

/**
 * Log a conversation event for analytics and audit purposes.
 *
 * This is a mock implementation that logs the event.
 * In production, this would write to:
 * - Analytics systems (Segment, Mixpanel, etc.)
 * - Audit logs
 * - Data warehouses
 */
export async function logConversationEvent(input: LogConversationEventInput): Promise<void> {
  const { conversationId, event, data } = input;

  log.info('Conversation event logged', {
    conversationId,
    event,
    data,
    timestamp: new Date().toISOString(),
  });

  // Simulate async logging
  await sleep(10);
}

// ============================================================================
// Helper Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
