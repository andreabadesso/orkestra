/**
 * Email Notification Channel
 *
 * Sends email notifications via Resend.
 * This is a stub implementation - configure with a Resend API key for production.
 */

import type {
  NotificationChannel,
  NotificationPayload,
  EmailChannelConfig,
} from '../types.js';

/**
 * Email send result
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email client interface
 *
 * Abstracts the email sending mechanism for easier testing and swapping providers.
 */
export interface EmailClient {
  /**
   * Send an email
   */
  send(options: {
    to: string;
    from: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<EmailSendResult>;
}

/**
 * Stub email client for development/testing
 *
 * Logs emails to console instead of sending them.
 */
export class StubEmailClient implements EmailClient {
  private readonly logEmails: boolean;

  constructor(options: { logEmails?: boolean } = {}) {
    this.logEmails = options.logEmails ?? true;
  }

  async send(options: {
    to: string;
    from: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<EmailSendResult> {
    if (this.logEmails) {
      console.log('[EmailChannel:Stub] Would send email:', {
        to: options.to,
        from: options.from,
        subject: options.subject,
        textLength: options.text.length,
      });
    }

    return {
      success: true,
      messageId: `stub-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
  }
}

/**
 * Resend email client
 *
 * Production client that sends emails via Resend API.
 * Note: This is a stub implementation. Install the Resend SDK for actual integration.
 */
export class ResendEmailClient implements EmailClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(options: {
    to: string;
    from: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<EmailSendResult> {
    // Stub implementation - in production, this would use the Resend SDK
    // import { Resend } from 'resend';
    // const resend = new Resend(this.apiKey);

    console.log('[EmailChannel:Resend] Would send email via Resend API:', {
      to: options.to,
      from: options.from,
      subject: options.subject,
      apiKeyPresent: !!this.apiKey,
    });

    // Simulated response - replace with actual Resend call
    return {
      success: true,
      messageId: `resend-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
  }
}

/**
 * Email notification channel
 *
 * Sends notifications via email using the configured email client.
 */
export class EmailChannel implements NotificationChannel {
  readonly name = 'email' as const;
  private readonly config: EmailChannelConfig;
  private readonly client: EmailClient;

  constructor(config: EmailChannelConfig, client?: EmailClient) {
    this.config = config;

    if (client) {
      this.client = client;
    } else if (config.apiKey) {
      this.client = new ResendEmailClient(config.apiKey);
    } else {
      this.client = new StubEmailClient();
    }
  }

  isAvailable(): boolean {
    return this.config.enabled;
  }

  async send(payload: NotificationPayload): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    // Need an email address to send to
    const recipientEmail = payload.recipient.email;
    if (!recipientEmail) {
      console.warn('[EmailChannel] No email address for recipient, skipping notification');
      return;
    }

    const fromEmail = this.config.fromEmail ?? 'notifications@orkestra.app';
    const fromName = this.config.fromName ?? 'Orkestra';
    const from = `${fromName} <${fromEmail}>`;

    const subject = payload.title;
    const text = this.buildTextBody(payload);
    const html = this.buildHtmlBody(payload);

    try {
      const result = await this.client.send({
        to: recipientEmail,
        from,
        subject,
        text,
        html,
      });

      if (!result.success) {
        console.error('[EmailChannel] Failed to send email:', result.error);
      }
    } catch (error) {
      console.error('[EmailChannel] Error sending email:', error);
    }
  }

  /**
   * Build plain text email body
   */
  private buildTextBody(payload: NotificationPayload): string {
    let body = payload.body;

    if (payload.actionUrl) {
      body += `\n\nView task: ${payload.actionUrl}`;
    }

    return body;
  }

  /**
   * Build HTML email body
   */
  private buildHtmlBody(payload: NotificationPayload): string {
    const escapedTitle = this.escapeHtml(payload.title);
    const escapedBody = this.escapeHtml(payload.body).replace(/\n/g, '<br>');

    let actionButton = '';
    if (payload.actionUrl) {
      actionButton = `
        <p style="margin-top: 20px;">
          <a href="${this.escapeHtml(payload.actionUrl)}"
             style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
            View Task
          </a>
        </p>
      `;
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px;">
    <h1 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">
      ${escapedTitle}
    </h1>
    <p style="margin: 0; color: #4b5563;">
      ${escapedBody}
    </p>
    ${actionButton}
  </div>
  <p style="margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center;">
    Sent by Orkestra
  </p>
</body>
</html>
    `.trim();
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => htmlEntities[char] ?? char);
  }
}

/**
 * Create an email channel with default configuration
 */
export function createEmailChannel(
  config: EmailChannelConfig = { enabled: false }
): EmailChannel {
  return new EmailChannel(config);
}

/**
 * Create an email channel with a custom client
 */
export function createEmailChannelWithClient(
  config: EmailChannelConfig,
  client: EmailClient
): EmailChannel {
  return new EmailChannel(config, client);
}
