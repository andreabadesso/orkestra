/**
 * Database module exports
 *
 * Provides access to the Prisma client and all repository classes
 * for database operations.
 */

// Client exports
export {
  prisma,
  getPrismaClient,
  disconnectPrisma,
  type PrismaClient,
  type PrismaClientOptions,
} from './client.js';

// Repository exports
export {
  // Base
  BaseRepository,
  EntityNotFoundError,
  UniqueConstraintError,
  type PaginationOptions,
  type SortOptions,
  type QueryOptions,
  type PaginatedResult,
  // Tenant
  TenantRepository,
  type CreateTenantInput,
  type UpdateTenantInput,
  type TenantFilterOptions,
  type TenantSortField,
  // User
  UserRepository,
  type CreateUserInput,
  type UpdateUserInput,
  type UserFilterOptions,
  type UserSortField,
  type UserWithGroups,
  // Group
  GroupRepository,
  type CreateGroupInput,
  type UpdateGroupInput,
  type GroupFilterOptions,
  type GroupSortField,
  type GroupWithMembers,
  // Task
  TaskRepository,
  type CreateTaskInput,
  type UpdateTaskInput,
  type TaskFilterOptions,
  type TaskSortField,
  type TaskWithHistory,
  // Conversation
  ConversationRepository,
  type CreateConversationInput,
  type UpdateConversationInput,
  type CreateMessageInput,
  type ConversationFilterOptions,
  type ConversationSortField,
  type ConversationWithMessages,
  // Audit
  AuditRepository,
  type CreateAuditEventInput,
  type AuditEventFilterOptions,
  type AuditEventSortField,
} from './repositories/index.js';

/**
 * Create all repository instances with a shared Prisma client
 *
 * @param prismaClient - Optional Prisma client instance (defaults to singleton)
 * @returns Object containing all repository instances
 *
 * @example
 * ```typescript
 * const repos = createRepositories();
 *
 * // Or with a specific Prisma client
 * const prisma = getPrismaClient({ logQueries: true });
 * const repos = createRepositories(prisma);
 * ```
 */
export function createRepositories(prismaClient?: import('@prisma/client').PrismaClient) {
  const client = prismaClient ?? require('./client.js').prisma;

  return {
    tenant: new (require('./repositories/tenant.js').TenantRepository)(client),
    user: new (require('./repositories/user.js').UserRepository)(client),
    group: new (require('./repositories/group.js').GroupRepository)(client),
    task: new (require('./repositories/task.js').TaskRepository)(client),
    conversation: new (require('./repositories/conversation.js').ConversationRepository)(client),
    audit: new (require('./repositories/audit.js').AuditRepository)(client),
  };
}

/**
 * Repository container type for use with dependency injection
 */
export interface Repositories {
  tenant: import('./repositories/tenant.js').TenantRepository;
  user: import('./repositories/user.js').UserRepository;
  group: import('./repositories/group.js').GroupRepository;
  task: import('./repositories/task.js').TaskRepository;
  conversation: import('./repositories/conversation.js').ConversationRepository;
  audit: import('./repositories/audit.js').AuditRepository;
}
