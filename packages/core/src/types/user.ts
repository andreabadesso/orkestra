/**
 * User and Group types for authentication and authorization
 */

import type {
  TenantId,
  UserId,
  GroupId,
  Timestamps,
  SoftDeletable,
  Metadata,
} from './common.js';

/**
 * User status values
 */
export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';

/**
 * System-defined user roles
 */
export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer';

/**
 * User preferences
 */
export interface UserPreferences {
  /** Preferred timezone (IANA timezone, overrides tenant default) */
  timezone?: string;
  /** Preferred locale (e.g., 'en-US', overrides tenant default) */
  locale?: string;
  /** Email notification preferences */
  notifications?: {
    /** Receive email for task assignments */
    taskAssigned?: boolean;
    /** Receive email for task due soon */
    taskDueSoon?: boolean;
    /** Receive email for task overdue */
    taskOverdue?: boolean;
    /** Receive email for workflow completion */
    workflowComplete?: boolean;
  };
  /** UI preferences */
  ui?: {
    /** Preferred theme */
    theme?: 'light' | 'dark' | 'system';
    /** Compact list view */
    compactView?: boolean;
  };
}

/**
 * User entity representing a person who can perform tasks
 */
export interface User extends Timestamps, SoftDeletable {
  /** Unique user identifier */
  id: UserId;
  /** Tenant this user belongs to */
  tenantId: TenantId;
  /** User's email address (unique within tenant) */
  email: string;
  /** User's display name */
  name: string;
  /** URL to user's avatar image */
  avatarUrl: string | null;
  /** Current user status */
  status: UserStatus;
  /** User's role within the tenant */
  role: UserRole;
  /** Groups this user belongs to (populated separately) */
  groupIds: GroupId[];
  /** User preferences */
  preferences: UserPreferences;
  /** Last login timestamp */
  lastLoginAt: string | null;
  /** Additional metadata */
  metadata: Metadata;
}

/**
 * Input for creating a new user
 */
export interface CreateUserInput {
  /** User's email address */
  email: string;
  /** User's display name */
  name: string;
  /** User's role */
  role: UserRole;
  /** Initial groups to add user to */
  groupIds?: GroupId[];
  /** User preferences */
  preferences?: Partial<UserPreferences>;
  /** Additional metadata */
  metadata?: Metadata;
}

/**
 * Input for updating an existing user
 */
export interface UpdateUserInput {
  /** Updated email address */
  email?: string;
  /** Updated display name */
  name?: string;
  /** Updated avatar URL */
  avatarUrl?: string | null;
  /** Updated status */
  status?: UserStatus;
  /** Updated role */
  role?: UserRole;
  /** Updated group memberships */
  groupIds?: GroupId[];
  /** Updated preferences (merged with existing) */
  preferences?: Partial<UserPreferences>;
  /** Updated metadata (merged with existing) */
  metadata?: Metadata;
}

/**
 * Group entity for organizing users and task assignment
 */
export interface Group extends Timestamps, SoftDeletable {
  /** Unique group identifier */
  id: GroupId;
  /** Tenant this group belongs to */
  tenantId: TenantId;
  /** Group name (unique within tenant) */
  name: string;
  /** URL-friendly slug */
  slug: string;
  /** Group description */
  description: string | null;
  /** Whether this group can receive task assignments */
  isAssignable: boolean;
  /** Member user IDs (populated separately) */
  memberIds: UserId[];
  /** Number of members (denormalized for efficiency) */
  memberCount: number;
  /** Additional metadata */
  metadata: Metadata;
}

/**
 * Input for creating a new group
 */
export interface CreateGroupInput {
  /** Group name */
  name: string;
  /** URL-friendly slug (optional, generated from name if not provided) */
  slug?: string;
  /** Group description */
  description?: string;
  /** Whether this group can receive task assignments (default: true) */
  isAssignable?: boolean;
  /** Initial member user IDs */
  memberIds?: UserId[];
  /** Additional metadata */
  metadata?: Metadata;
}

/**
 * Input for updating an existing group
 */
export interface UpdateGroupInput {
  /** Updated group name */
  name?: string;
  /** Updated description */
  description?: string | null;
  /** Updated assignable status */
  isAssignable?: boolean;
  /** Updated metadata (merged with existing) */
  metadata?: Metadata;
}
