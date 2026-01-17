/**
 * Task Escalated Notification Template
 */

import type { NotificationEvent, NotificationTemplate, TaskEscalatedEvent } from '../types.js';

/**
 * Template for task escalated notifications
 */
export const taskEscalatedTemplate: NotificationTemplate = {
  title(event: NotificationEvent): string {
    const e = event as TaskEscalatedEvent;
    return `Escalated: ${e.task.title}`;
  },

  body(event: NotificationEvent): string {
    const e = event as TaskEscalatedEvent;
    const reason = e.reason;

    let body = `This task has been escalated and requires immediate attention.`;

    if (reason) {
      body += `\n\nReason: ${reason}`;
    }

    const description = e.task.description;
    if (description) {
      body += `\n\nTask Description: ${description}`;
    }

    body += `\n\nPriority: ${e.task.priority.charAt(0).toUpperCase() + e.task.priority.slice(1)}`;

    return body;
  },
};
