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
 * Create repository instances
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
export async function createRepositories(prismaClient?: import('@prisma/client').PrismaClient) {
  const { prisma } = await import('./client.js');
  const client = prismaClient ?? prisma;

  const [
    { TenantRepository },
    { TenantSettingsRepository },
    { UserRepository },
    { GroupRepository },
    { TaskRepository },
    { ConversationRepository },
    { AuditRepository },
  ] = await Promise.all([
    import('./repositories/tenant.js'),
    import('./repositories/tenant-settings.js'),
    import('./repositories/user.js'),
    import('./repositories/group.js'),
    import('./repositories/task.js'),
    import('./repositories/conversation.js'),
    import('./repositories/audit.js'),
  ]);

  return {
    tenant: new TenantRepository(client),
    tenantSettings: new TenantSettingsRepository(client),
    user: new UserRepository(client),
    group: new GroupRepository(client),
    task: new TaskRepository(client),
    conversation: new ConversationRepository(client),
    audit: new AuditRepository(client),
  };
}

/**
 * Repository container type for use with dependency injection
 */
export interface Repositories {
  tenant: import('./repositories/tenant.js').TenantRepository;
  tenantSettings: import('./repositories/tenant-settings.js').TenantSettingsRepository;
  user: import('./repositories/user.js').UserRepository;
  group: import('./repositories/group.js').GroupRepository;
  task: import('./repositories/task.js').TaskRepository;
  conversation: import('./repositories/conversation.js').ConversationRepository;
  audit: import('./repositories/audit.js').AuditRepository;
}
