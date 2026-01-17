/**
 * Repository exports
 *
 * Re-exports all repository classes and types for convenient access.
 */

// Base repository
export {
  BaseRepository,
  EntityNotFoundError,
  UniqueConstraintError,
  type PaginationOptions,
  type SortOptions,
  type QueryOptions,
  type PaginatedResult,
} from './base.js';

// Tenant repository
export {
  TenantRepository,
  type CreateTenantInput,
  type UpdateTenantInput,
  type TenantFilterOptions,
  type TenantSortField,
} from './tenant.js';

// User repository
export {
  UserRepository,
  type CreateUserInput,
  type UpdateUserInput,
  type UserFilterOptions,
  type UserSortField,
  type UserWithGroups,
} from './user.js';

// Group repository
export {
  GroupRepository,
  type CreateGroupInput,
  type UpdateGroupInput,
  type GroupFilterOptions,
  type GroupSortField,
  type GroupWithMembers,
} from './group.js';

// Task repository
export {
  TaskRepository,
  type CreateTaskInput,
  type UpdateTaskInput,
  type TaskFilterOptions,
  type TaskSortField,
  type TaskWithHistory,
} from './task.js';

// Conversation repository
export {
  ConversationRepository,
  type CreateConversationInput,
  type UpdateConversationInput,
  type CreateMessageInput,
  type ConversationFilterOptions,
  type ConversationSortField,
  type ConversationWithMessages,
} from './conversation.js';

// Audit repository
export {
  AuditRepository,
  type CreateAuditEventInput,
  type AuditEventFilterOptions,
  type AuditEventSortField,
} from './audit.js';
