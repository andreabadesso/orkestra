/**
 * Notification Templates
 *
 * Templates for rendering notification content.
 */

import type { NotificationTemplate, NotificationEventType, TemplateMap } from '../types.js';
export { taskCreatedTemplate } from './task-created.js';
export { taskEscalatedTemplate } from './task-escalated.js';
export { slaWarningTemplate } from './sla-warning.js';

import { taskCreatedTemplate } from './task-created.js';
import { taskEscalatedTemplate } from './task-escalated.js';
import { slaWarningTemplate } from './sla-warning.js';

/**
 * Default template for task assigned notifications
 */
export const taskAssignedTemplate: NotificationTemplate = {
  title(event) {
    return `Task Assigned: ${event.task.title}`;
  },

  body(event) {
    let body = `You have been assigned a new task.`;

    if (event.task.description) {
      body += `\n\n${event.task.description}`;
    }

    if (event.task.priority === 'urgent' || event.task.priority === 'high') {
      body += `\n\nPriority: ${event.task.priority.charAt(0).toUpperCase() + event.task.priority.slice(1)}`;
    }

    return body;
  },
};

/**
 * Default template for task completed notifications
 */
export const taskCompletedTemplate: NotificationTemplate = {
  title(event) {
    return `Task Completed: ${event.task.title}`;
  },

  body(event) {
    let body = `A task has been completed.`;

    if (event.task.description) {
      body += `\n\nDescription: ${event.task.description}`;
    }

    return body;
  },
};

/**
 * Default template for SLA breach notifications
 */
export const slaBreachTemplate: NotificationTemplate = {
  title(event) {
    return `SLA Breached: ${event.task.title}`;
  },

  body(event) {
    let body = `This task has exceeded its SLA deadline.`;

    if (event.task.description) {
      body += `\n\nTask Description: ${event.task.description}`;
    }

    body += `\n\nImmediate action is required.`;

    return body;
  },
};

/**
 * Default templates for all event types
 */
export const defaultTemplates: TemplateMap = {
  task_created: taskCreatedTemplate,
  task_assigned: taskAssignedTemplate,
  task_escalated: taskEscalatedTemplate,
  task_completed: taskCompletedTemplate,
  sla_warning: slaWarningTemplate,
  sla_breach: slaBreachTemplate,
};

/**
 * Get template for event type
 */
export function getTemplate(eventType: NotificationEventType, customTemplates?: TemplateMap): NotificationTemplate | undefined {
  // Check custom templates first
  if (customTemplates?.[eventType]) {
    return customTemplates[eventType];
  }

  // Fall back to default templates
  return defaultTemplates[eventType];
}
