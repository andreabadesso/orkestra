/**
 * Dashboard Notification Channel
 *
 * Creates in-app notification records for display in the dashboard.
 */

import type {
  NotificationChannel,
  NotificationPayload,
  DashboardChannelConfig,
  CreateDashboardNotificationInput,
  DashboardNotification,
} from '../types.js';
import { generateId } from '../../../utils/id.js';

/**
 * Notification store interface for dashboard notifications
 *
 * This abstracts the storage mechanism for dashboard notifications.
 * Implementations can use a database, in-memory store, etc.
 */
export interface DashboardNotificationStore {
  /**
   * Create a new dashboard notification
   */
  create(input: CreateDashboardNotificationInput): Promise<DashboardNotification>;

  /**
   * Get notifications for a user
   */
  getByUserId(
    tenantId: string,
    userId: string,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<DashboardNotification[]>;

  /**
   * Mark a notification as read
   */
  markAsRead(notificationId: string): Promise<void>;

  /**
   * Mark all notifications for a user as read
   */
  markAllAsRead(tenantId: string, userId: string): Promise<void>;

  /**
   * Delete a notification
   */
  delete(notificationId: string): Promise<void>;

  /**
   * Get unread count for a user
   */
  getUnreadCount(tenantId: string, userId: string): Promise<number>;
}

/**
 * In-memory dashboard notification store
 *
 * For testing and development. In production, use a database-backed store.
 */
export class InMemoryDashboardNotificationStore implements DashboardNotificationStore {
  private notifications: Map<string, DashboardNotification> = new Map();

  async create(input: CreateDashboardNotificationInput): Promise<DashboardNotification> {
    const notification: DashboardNotification = {
      id: generateId('notification'),
      tenantId: input.tenantId,
      userId: input.userId,
      taskId: input.taskId,
      eventType: input.eventType,
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl,
      read: false,
      priority: input.priority,
      createdAt: new Date(),
      metadata: input.metadata ?? {},
    };

    this.notifications.set(notification.id, notification);
    return notification;
  }

  async getByUserId(
    tenantId: string,
    userId: string,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<DashboardNotification[]> {
    const { unreadOnly = false, limit = 50, offset = 0 } = options ?? {};

    let results = Array.from(this.notifications.values())
      .filter((n) => n.tenantId === tenantId && n.userId === userId)
      .filter((n) => !unreadOnly || !n.read)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (offset > 0) {
      results = results.slice(offset);
    }

    if (limit > 0) {
      results = results.slice(0, limit);
    }

    return results;
  }

  async markAsRead(notificationId: string): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.read = true;
      notification.readAt = new Date();
    }
  }

  async markAllAsRead(tenantId: string, userId: string): Promise<void> {
    const now = new Date();
    for (const notification of this.notifications.values()) {
      if (notification.tenantId === tenantId && notification.userId === userId && !notification.read) {
        notification.read = true;
        notification.readAt = now;
      }
    }
  }

  async delete(notificationId: string): Promise<void> {
    this.notifications.delete(notificationId);
  }

  async getUnreadCount(tenantId: string, userId: string): Promise<number> {
    let count = 0;
    for (const notification of this.notifications.values()) {
      if (notification.tenantId === tenantId && notification.userId === userId && !notification.read) {
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all notifications (for testing)
   */
  clear(): void {
    this.notifications.clear();
  }
}

/**
 * Dashboard notification channel
 *
 * Creates in-app notification records when events occur.
 */
export class DashboardChannel implements NotificationChannel {
  readonly name = 'dashboard' as const;
  private readonly config: DashboardChannelConfig;
  private readonly store: DashboardNotificationStore;

  constructor(config: DashboardChannelConfig, store: DashboardNotificationStore) {
    this.config = config;
    this.store = store;
  }

  isAvailable(): boolean {
    return this.config.enabled;
  }

  async send(payload: NotificationPayload): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    // Only send to user recipients for dashboard notifications
    if (payload.recipient.type !== 'user' || !payload.recipient.userId) {
      return;
    }

    const input: CreateDashboardNotificationInput = {
      tenantId: payload.tenantId,
      userId: payload.recipient.userId,
      taskId: payload.taskId,
      eventType: payload.eventType,
      title: payload.title,
      body: payload.body,
      actionUrl: payload.actionUrl,
      priority: payload.priority,
      metadata: payload.metadata,
    };

    await this.store.create(input);
  }

  /**
   * Get the notification store (for querying notifications)
   */
  getStore(): DashboardNotificationStore {
    return this.store;
  }
}

/**
 * Create a dashboard channel with an in-memory store
 */
export function createDashboardChannel(
  config: DashboardChannelConfig = { enabled: true }
): DashboardChannel {
  return new DashboardChannel(config, new InMemoryDashboardNotificationStore());
}

/**
 * Create a dashboard channel with a custom store
 */
export function createDashboardChannelWithStore(
  config: DashboardChannelConfig,
  store: DashboardNotificationStore
): DashboardChannel {
  return new DashboardChannel(config, store);
}
