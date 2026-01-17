/**
 * Test fixtures for tenants
 *
 * Provides factory functions for creating mock tenants in tests.
 */

import type { TenantId } from '../../src/types/common.js';
import type { Tenant, TenantConfig, TenantLimits, DEFAULT_TENANT_LIMITS } from '../../src/types/tenant.js';

/**
 * Counter for generating unique tenant IDs
 */
let tenantCounter = 0;

/**
 * Reset tenant counter (call in beforeEach)
 */
export function resetTenantCounter(): void {
  tenantCounter = 0;
}

/**
 * Options for creating a test tenant
 */
export interface CreateTestTenantOptions {
  /** Custom tenant ID (auto-generated if not provided) */
  id?: string;
  /** Tenant name */
  name?: string;
  /** URL slug */
  slug?: string;
  /** Tenant status */
  status?: 'active' | 'suspended' | 'pending' | 'archived';
  /** Configuration overrides */
  config?: Partial<TenantConfig>;
  /** Limit overrides */
  limits?: Partial<TenantLimits>;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create a mock tenant for testing
 *
 * @param options - Tenant options
 * @returns Mock tenant object
 */
export function createTestTenant(options: CreateTestTenantOptions = {}): Tenant {
  tenantCounter++;
  const now = new Date().toISOString();

  const defaultLimits: TenantLimits = {
    maxUsers: 10,
    maxConcurrentWorkflows: 100,
    maxTasksPerMonth: 10000,
    maxApiRequestsPerMinute: 1000,
    maxStorageBytes: 1024 * 1024 * 1024,
  };

  return {
    id: (options.id ?? `ten_test${tenantCounter}`) as TenantId,
    name: options.name ?? `Test Tenant ${tenantCounter}`,
    slug: options.slug ?? `test-tenant-${tenantCounter}`,
    status: options.status ?? 'active',
    config: {
      timezone: 'UTC',
      locale: 'en-US',
      features: {},
      branding: {},
      webhooks: {},
      ...options.config,
    },
    limits: {
      ...defaultLimits,
      ...options.limits,
    },
    metadata: options.metadata ?? {},
    createdAt: now as Tenant['createdAt'],
    updatedAt: now as Tenant['updatedAt'],
    deletedAt: null,
  };
}

/**
 * Create multiple test tenants
 *
 * @param count - Number of tenants to create
 * @param baseOptions - Base options applied to all tenants
 * @returns Array of mock tenants
 */
export function createTestTenants(
  count: number,
  baseOptions: CreateTestTenantOptions = {}
): Tenant[] {
  return Array.from({ length: count }, () => createTestTenant(baseOptions));
}

/**
 * Create a suspended test tenant
 */
export function createSuspendedTenant(options: Omit<CreateTestTenantOptions, 'status'> = {}): Tenant {
  return createTestTenant({ ...options, status: 'suspended' });
}

/**
 * Create a pending test tenant
 */
export function createPendingTenant(options: Omit<CreateTestTenantOptions, 'status'> = {}): Tenant {
  return createTestTenant({ ...options, status: 'pending' });
}
