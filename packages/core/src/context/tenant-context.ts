/**
 * Tenant context for multi-tenant operations
 *
 * Provides tenant-scoped configuration and utilities.
 */

import type { TenantId } from '../types/common.js';
import type { Tenant, TenantConfig, TenantLimits } from '../types/tenant.js';

/**
 * Tenant context class for managing tenant-scoped operations
 *
 * Wraps a Tenant entity and provides convenient access to
 * configuration and limits.
 *
 * @example
 * ```typescript
 * const tenantCtx = new TenantContext(tenant);
 *
 * // Check limits
 * if (tenantCtx.isWithinUserLimit(currentUserCount)) {
 *   // Allow creating new user
 * }
 *
 * // Get config with defaults
 * const timezone = tenantCtx.getTimezone();
 * ```
 */
export class TenantContext {
  private readonly tenant: Tenant;

  constructor(tenant: Tenant) {
    this.tenant = tenant;
  }

  /** Tenant ID */
  get id(): TenantId {
    return this.tenant.id;
  }

  /** Tenant name */
  get name(): string {
    return this.tenant.name;
  }

  /** Tenant slug */
  get slug(): string {
    return this.tenant.slug;
  }

  /** Tenant status */
  get status(): Tenant['status'] {
    return this.tenant.status;
  }

  /** Tenant configuration */
  get config(): TenantConfig {
    return this.tenant.config;
  }

  /** Tenant limits */
  get limits(): TenantLimits {
    return this.tenant.limits;
  }

  /**
   * Check if the tenant is active
   */
  isActive(): boolean {
    return this.tenant.status === 'active';
  }

  /**
   * Check if the tenant is suspended
   */
  isSuspended(): boolean {
    return this.tenant.status === 'suspended';
  }

  /**
   * Get the tenant timezone (defaults to UTC)
   */
  getTimezone(): string {
    return this.tenant.config.timezone ?? 'UTC';
  }

  /**
   * Get the tenant locale (defaults to en-US)
   */
  getLocale(): string {
    return this.tenant.config.locale ?? 'en-US';
  }

  /**
   * Check if a feature flag is enabled
   *
   * @param feature - Feature flag name
   * @returns Whether the feature is enabled (defaults to false)
   */
  isFeatureEnabled(feature: string): boolean {
    return this.tenant.config.features?.[feature] ?? false;
  }

  /**
   * Check if user count is within limit
   *
   * @param currentCount - Current number of users
   */
  isWithinUserLimit(currentCount: number): boolean {
    return currentCount < this.tenant.limits.maxUsers;
  }

  /**
   * Check if workflow count is within limit
   *
   * @param currentCount - Current number of concurrent workflows
   */
  isWithinWorkflowLimit(currentCount: number): boolean {
    return currentCount < this.tenant.limits.maxConcurrentWorkflows;
  }

  /**
   * Check if task count is within monthly limit
   *
   * @param currentCount - Current number of tasks this month
   */
  isWithinTaskLimit(currentCount: number): boolean {
    return currentCount < this.tenant.limits.maxTasksPerMonth;
  }

  /**
   * Check if API request count is within rate limit
   *
   * @param currentCount - Current number of requests this minute
   */
  isWithinRateLimit(currentCount: number): boolean {
    return currentCount < this.tenant.limits.maxApiRequestsPerMinute;
  }

  /**
   * Check if storage usage is within limit
   *
   * @param currentBytes - Current storage usage in bytes
   */
  isWithinStorageLimit(currentBytes: number): boolean {
    return currentBytes < this.tenant.limits.maxStorageBytes;
  }

  /**
   * Get webhook URL for task events
   */
  getTaskWebhookUrl(): string | undefined {
    return this.tenant.config.webhooks?.taskEvents;
  }

  /**
   * Get webhook URL for workflow events
   */
  getWorkflowWebhookUrl(): string | undefined {
    return this.tenant.config.webhooks?.workflowEvents;
  }

  /**
   * Get the underlying tenant entity
   */
  getTenant(): Tenant {
    return this.tenant;
  }

  /**
   * Get a serializable representation
   */
  toJSON(): Tenant {
    return this.tenant;
  }
}

/**
 * Create a tenant context from a tenant entity
 *
 * @param tenant - Tenant entity
 * @returns Tenant context
 */
export function createTenantContext(tenant: Tenant): TenantContext {
  return new TenantContext(tenant);
}
