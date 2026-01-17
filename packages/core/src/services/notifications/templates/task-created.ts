/**
 * Task Created Notification Template
 */

import type { NotificationEvent, NotificationTemplate, TaskCreatedEvent } from '../types.js';

/**
 * Template for task created notifications
 */
export const taskCreatedTemplate: NotificationTemplate = {
  title(event: NotificationEvent): string {
    const e = event as TaskCreatedEvent;
    return `New Task: ${e.task.title}`;
  },

  body(event: NotificationEvent): string {
    const e = event as TaskCreatedEvent;
    const description = e.task.description;
    const priority = e.task.priority;

    let body = `A new task has been created that requires your attention.`;

    if (description) {
      body += `\n\n${description}`;
    }

    if (priority === 'urgent' || priority === 'high') {
      body += `\n\nPriority: ${priority.charAt(0).toUpperCase() + priority.slice(1)}`;
    }

    return body;
  },
};
