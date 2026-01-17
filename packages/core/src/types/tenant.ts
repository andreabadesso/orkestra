/**
 * Tenant types for multi-tenancy support
 */

import type {
  TenantId,
  Timestamps,
  SoftDeletable,
  Metadata,
} from './common.js';

/**
 * Tenant status values
 */
export type TenantStatus = 'active' | 'suspended' | 'pending' | 'archived';

/**
 * Tenant configuration options
 */
export interface TenantConfig {
  /** Default timezone for the tenant (IANA timezone) */
  timezone?: string;
  /** Default locale (e.g., 'en-US') */
  locale?: string;
  /** Feature flags enabled for this tenant */
  features?: Record<string, boolean>;
  /** Custom branding settings */
  branding?: {
    /** Primary brand color (hex) */
    primaryColor?: string;
    /** Logo URL */
    logoUrl?: string;
    /** Favicon URL */
    faviconUrl?: string;
  };
  /** Webhook configuration */
  webhooks?: {
    /** Webhook URL for task events */
    taskEvents?: string;
    /** Webhook URL for workflow events */
    workflowEvents?: string;
    /** Secret for webhook signature verification */
    secret?: string;
  };
}

/**
 * Tenant resource limits
 */
export interface TenantLimits {
  /** Maximum number of active users */
  maxUsers: number;
  /** Maximum number of concurrent workflows */
  maxConcurrentWorkflows: number;
  /** Maximum number of tasks per month */
  maxTasksPerMonth: number;
  /** Maximum API requests per minute */
  maxApiRequestsPerMinute: number;
  /** Maximum file storage in bytes */
  maxStorageBytes: number;
}

/**
 * Default tenant limits for new tenants
 */
export const DEFAULT_TENANT_LIMITS: TenantLimits = {
  maxUsers: 10,
  maxConcurrentWorkflows: 100,
  maxTasksPerMonth: 10000,
  maxApiRequestsPerMinute: 1000,
  maxStorageBytes: 1024 * 1024 * 1024, // 1GB
};

/**
 * Tenant entity representing an organization using Orkestra
 */
export interface Tenant extends Timestamps, SoftDeletable {
  /** Unique tenant identifier */
  id: TenantId;
  /** Human-readable tenant name */
  name: string;
  /** URL-friendly slug (unique across all tenants) */
  slug: string;
  /** Current tenant status */
  status: TenantStatus;
  /** Tenant configuration */
  config: TenantConfig;
  /** Resource limits for this tenant */
  limits: TenantLimits;
  /** Additional metadata */
  metadata: Metadata;
}

/**
 * Input for creating a new tenant
 */
export interface CreateTenantInput {
  /** Human-readable tenant name */
  name: string;
  /** URL-friendly slug (optional, generated from name if not provided) */
  slug?: string;
  /** Initial tenant configuration */
  config?: Partial<TenantConfig>;
  /** Custom resource limits (uses defaults if not provided) */
  limits?: Partial<TenantLimits>;
  /** Additional metadata */
  metadata?: Metadata;
}

/**
 * Input for updating an existing tenant
 */
export interface UpdateTenantInput {
  /** Updated tenant name */
  name?: string;
  /** Updated tenant status */
  status?: TenantStatus;
  /** Updated configuration (merged with existing) */
  config?: Partial<TenantConfig>;
  /** Updated limits (merged with existing) */
  limits?: Partial<TenantLimits>;
  /** Updated metadata (merged with existing) */
  metadata?: Metadata;
}
