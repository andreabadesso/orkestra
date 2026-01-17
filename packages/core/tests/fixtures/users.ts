/**
 * Test fixtures for users and groups
 *
 * Provides factory functions for creating mock users and groups in tests.
 */

import type { TenantId, UserId, GroupId } from '../../src/types/common.js';
import type { User, UserRole, UserStatus, UserPreferences, Group } from '../../src/types/user.js';

/**
 * Counter for generating unique IDs
 */
let userCounter = 0;
let groupCounter = 0;

/**
 * Reset counters (call in beforeEach)
 */
export function resetUserCounters(): void {
  userCounter = 0;
  groupCounter = 0;
}

/**
 * Options for creating a test user
 */
export interface CreateTestUserOptions {
  /** Custom user ID (auto-generated if not provided) */
  id?: string;
  /** Tenant ID the user belongs to */
  tenantId: string;
  /** User email */
  email?: string;
  /** User name */
  name?: string;
  /** User role */
  role?: UserRole;
  /** User status */
  status?: UserStatus;
  /** Group IDs */
  groupIds?: string[];
  /** User preferences */
  preferences?: Partial<UserPreferences>;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create a mock user for testing
 *
 * @param options - User options
 * @returns Mock user object
 */
export function createTestUser(options: CreateTestUserOptions): User {
  userCounter++;
  const now = new Date().toISOString();

  return {
    id: (options.id ?? `usr_test${userCounter}`) as UserId,
    tenantId: options.tenantId as TenantId,
    email: options.email ?? `user${userCounter}@test.com`,
    name: options.name ?? `Test User ${userCounter}`,
    avatarUrl: null,
    status: options.status ?? 'active',
    role: options.role ?? 'operator',
    groupIds: (options.groupIds ?? []) as GroupId[],
    preferences: {
      timezone: 'UTC',
      locale: 'en-US',
      notifications: {
        taskAssigned: true,
        taskDueSoon: true,
        taskOverdue: true,
        workflowComplete: true,
      },
      ui: {
        theme: 'system',
        compactView: false,
      },
      ...options.preferences,
    },
    lastLoginAt: null,
    metadata: options.metadata ?? {},
    createdAt: now as User['createdAt'],
    updatedAt: now as User['updatedAt'],
    deletedAt: null,
  };
}

/**
 * Create multiple test users
 *
 * @param count - Number of users to create
 * @param baseOptions - Base options applied to all users
 * @returns Array of mock users
 */
export function createTestUsers(
  count: number,
  baseOptions: Omit<CreateTestUserOptions, 'email' | 'name'>
): User[] {
  return Array.from({ length: count }, () => createTestUser(baseOptions));
}

/**
 * Create an admin user
 */
export function createAdminUser(options: Omit<CreateTestUserOptions, 'role'>): User {
  return createTestUser({ ...options, role: 'admin' });
}

/**
 * Create a manager user
 */
export function createManagerUser(options: Omit<CreateTestUserOptions, 'role'>): User {
  return createTestUser({ ...options, role: 'manager' });
}

/**
 * Create a viewer user
 */
export function createViewerUser(options: Omit<CreateTestUserOptions, 'role'>): User {
  return createTestUser({ ...options, role: 'viewer' });
}

/**
 * Options for creating a test group
 */
export interface CreateTestGroupOptions {
  /** Custom group ID (auto-generated if not provided) */
  id?: string;
  /** Tenant ID the group belongs to */
  tenantId: string;
  /** Group name */
  name?: string;
  /** URL slug */
  slug?: string;
  /** Description */
  description?: string | null;
  /** Whether assignable */
  isAssignable?: boolean;
  /** Member user IDs */
  memberIds?: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create a mock group for testing
 *
 * @param options - Group options
 * @returns Mock group object
 */
export function createTestGroup(options: CreateTestGroupOptions): Group {
  groupCounter++;
  const now = new Date().toISOString();

  const memberIds = (options.memberIds ?? []) as UserId[];

  return {
    id: (options.id ?? `grp_test${groupCounter}`) as GroupId,
    tenantId: options.tenantId as TenantId,
    name: options.name ?? `Test Group ${groupCounter}`,
    slug: options.slug ?? `test-group-${groupCounter}`,
    description: options.description ?? null,
    isAssignable: options.isAssignable ?? true,
    memberIds,
    memberCount: memberIds.length,
    metadata: options.metadata ?? {},
    createdAt: now as Group['createdAt'],
    updatedAt: now as Group['updatedAt'],
    deletedAt: null,
  };
}

/**
 * Create multiple test groups
 *
 * @param count - Number of groups to create
 * @param baseOptions - Base options applied to all groups
 * @returns Array of mock groups
 */
export function createTestGroups(
  count: number,
  baseOptions: Omit<CreateTestGroupOptions, 'name' | 'slug'>
): Group[] {
  return Array.from({ length: count }, () => createTestGroup(baseOptions));
}
