/**
 * SLA Warning Notification Template
 */

import type { NotificationEvent, NotificationTemplate, SLAWarningEvent } from '../types.js';

/**
 * Format minutes into a human-readable string
 */
function formatMinutesRemaining(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  return `${hours} hour${hours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
}

/**
 * Template for SLA warning notifications
 */
export const slaWarningTemplate: NotificationTemplate = {
  title(event: NotificationEvent): string {
    const e = event as SLAWarningEvent;
    return `SLA Warning: ${e.task.title} - ${e.minutesRemaining}m remaining`;
  },

  body(event: NotificationEvent): string {
    const e = event as SLAWarningEvent;
    const timeRemaining = formatMinutesRemaining(e.minutesRemaining);

    let body = `This task is approaching its SLA deadline.`;
    body += `\n\nTime remaining: ${timeRemaining}`;

    if (e.task.description) {
      body += `\n\nTask Description: ${e.task.description}`;
    }

    body += `\n\nPlease complete this task before the deadline to avoid escalation.`;

    return body;
  },
};
