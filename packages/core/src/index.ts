/**
 * @orkestra/core
 *
 * Core orchestration engine for Orkestra.
 * This package provides the main types, configuration, context management,
 * error handling, and utilities for building AI-native workflows with
 * human-in-the-loop capabilities.
 *
 * @packageDocumentation
 */

export const VERSION = '0.0.1';

// ============================================================================
// Types
// ============================================================================

// Common types
export type {
  BrandedId,
  TenantId,
  UserId,
  GroupId,
  TaskId,
  WorkflowId,
  ConversationId,
  MessageId,
  ISODateString,
  Timestamps,
  SoftDeletable,
  PaginationParams,
  PaginatedResponse,
  JsonPrimitive,
  JsonArray,
  JsonObject,
  JsonValue,
  Metadata,
} from './types/index.js';

// Tenant types
export type {
  TenantStatus,
  TenantConfig,
  TenantLimits,
  Tenant,
  CreateTenantInput,
  UpdateTenantInput,
} from './types/index.js';
export { DEFAULT_TENANT_LIMITS } from './types/index.js';

// User and Group types
export type {
  UserStatus,
  UserRole,
  UserPreferences,
  User,
  CreateUserInput,
  UpdateUserInput,
  Group,
  CreateGroupInput,
  UpdateGroupInput,
} from './types/index.js';

// Task types
export type {
  TaskStatus,
  TaskPriority,
  FormFieldType,
  FormFieldOption,
  FormFieldValidation,
  FormField,
  TaskFormSchema,
  TaskAssignment,
  TaskSLA,
  TaskContext,
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  CompleteTaskInput,
  TaskEventType,
  TaskEvent,
} from './types/index.js';

// Workflow types
export type {
  WorkflowStatus,
  WorkflowDefinition,
  WorkflowExecutionOptions,
  Workflow,
  StartWorkflowInput,
  WorkflowQuery,
  WorkflowSignal,
  WorkflowEventType,
  WorkflowEvent,
  WorkflowSummary,
  WorkflowFilter,
} from './types/index.js';

// Conversation and Message types
export type {
  ConversationStatus,
  MessageRole,
  MessageContentType,
  ConversationChannel,
  ConversationParticipant,
  Conversation,
  CreateConversationInput,
  UpdateConversationInput,
  MessageAttachment,
  Message,
  CreateMessageInput,
  ConversationFilter,
} from './types/index.js';

// ============================================================================
// Configuration
// ============================================================================

export {
  // Schemas
  databaseConfigSchema,
  temporalConfigSchema,
  serverConfigSchema,
  authConfigSchema,
  langfuseConfigSchema,
  loggingConfigSchema,
  orkestraConfigSchema,
  // Loaders
  loadConfig,
  validateConfig,
  requireEnv,
  ConfigurationError,
} from './config/index.js';

export type {
  DatabaseConfig,
  TemporalConfig,
  ServerConfig,
  AuthConfig,
  LangfuseConfig,
  LoggingConfig,
  OrkestraConfig,
} from './config/index.js';

// ============================================================================
// Context
// ============================================================================

export {
  RequestContext,
  createRequestContext,
  TenantContext,
  createTenantContext,
} from './context/index.js';

export type {
  RequestContextData,
  CreateRequestContextInput,
} from './context/index.js';

// ============================================================================
// Errors
// ============================================================================

export {
  OrkestraError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  InvalidStateError,
  LimitExceededError,
  isOrkestraError,
  wrapError,
} from './errors/index.js';

export type {
  ErrorCode,
  ErrorDetails,
  SerializedError,
} from './errors/index.js';

// ============================================================================
// Utilities
// ============================================================================

// ID generation
export {
  ID_PREFIXES,
  generateId,
  generateTenantId,
  generateUserId,
  generateGroupId,
  generateTaskId,
  generateWorkflowId,
  generateConversationId,
  generateMessageId,
  generateApiKey,
  generateSessionId,
  generateRequestId,
  generateRawId,
  generateUuid,
  parseId,
  isValidId,
  isTenantId,
  isUserId,
  isGroupId,
  isTaskId,
  isWorkflowId,
  isConversationId,
  isMessageId,
} from './utils/index.js';

export type { IdPrefix } from './utils/index.js';

// Date utilities
export {
  now,
  toISOString,
  parseISOString,
  isValidISOString,
  parseDuration,
  formatDuration,
  addDuration,
  subtractDuration,
  dateDiff,
  isPast,
  isFuture,
  isWithin,
  startOfDay,
  endOfDay,
  timeout,
  timeRemaining,
  formatRelative,
} from './utils/index.js';

export type { DurationUnit } from './utils/index.js';

// ============================================================================
// Temporal Integration
// ============================================================================

// Connection management
export {
  TemporalConnectionManager,
  createTemporalConnection,
} from './temporal/index.js';

export type {
  TemporalConnectionOptions,
  HealthCheckResult,
} from './temporal/index.js';

// Client factory
export {
  createTemporalClient,
  checkTemporalHealth,
  ManagedTemporalClient,
} from './temporal/index.js';

export type {
  CreateTemporalClientOptions,
  TemporalHealthCheckResult,
  ManagedTemporalClientOptions,
} from './temporal/index.js';

// Worker factory
export { createWorker, WorkerRunner } from './temporal/index.js';

export type {
  CreateWorkerOptions,
  ActivityDefinition,
  ActivityMap,
  WorkerHealthCheckResult,
} from './temporal/index.js';

// Interceptors
export {
  // Tenant interceptor
  TENANT_ID_HEADER,
  TENANT_ID_MEMO_KEY,
  createTenantClientInterceptor,
  createTenantWorkflowInterceptor,
  createTenantActivityInterceptor,
  getWorkflowTenantId,
  getWorkflowTenantIdOrUndefined,
  getActivityTenantId,
  getActivityTenantIdOrUndefined,
  withTenantContext,
  // Tracing interceptor
  TRACE_ID_HEADER,
  PARENT_SPAN_ID_HEADER,
  createTracingClientInterceptor,
  createTracingWorkflowInterceptor,
  createTracingActivityInterceptor,
  createTracingInterceptors,
  getWorkflowTrace,
  getWorkflowSpan,
  getActivityTrace,
  getActivitySpan,
  createActivityChildSpan,
} from './temporal/index.js';

export type {
  TenantInterceptorOptions,
  TenantAwareInput,
  TracingInterceptorOptions,
  CreateTracingInterceptorsOptions,
  LangfuseClient,
  LangfuseTrace,
  LangfuseSpan,
  LangfuseSpanOptions,
  LangfuseTraceUpdateOptions,
  LangfuseSpanEndOptions,
} from './temporal/index.js';

// ============================================================================
// Database
// ============================================================================

// Client
export {
  prisma,
  getPrismaClient,
  disconnectPrisma,
  createRepositories,
} from './db/index.js';

export type {
  PrismaClient,
  PrismaClientOptions,
  Repositories,
} from './db/index.js';

// Base repository types
export {
  BaseRepository,
  EntityNotFoundError,
  UniqueConstraintError,
} from './db/index.js';

export type {
  PaginationOptions,
  SortOptions,
  QueryOptions,
  PaginatedResult,
} from './db/index.js';

// Repositories
export {
  TenantRepository,
  UserRepository,
  GroupRepository,
  TaskRepository,
  ConversationRepository,
  AuditRepository,
} from './db/index.js';

// Repository input/filter/sort types
export type {
  // Tenant
  CreateTenantInput as CreateTenantRepoInput,
  UpdateTenantInput as UpdateTenantRepoInput,
  TenantFilterOptions,
  TenantSortField,
  // User
  CreateUserInput as CreateUserRepoInput,
  UpdateUserInput as UpdateUserRepoInput,
  UserFilterOptions,
  UserSortField,
  UserWithGroups,
  // Group
  CreateGroupInput as CreateGroupRepoInput,
  UpdateGroupInput as UpdateGroupRepoInput,
  GroupFilterOptions,
  GroupSortField,
  GroupWithMembers,
  // Task
  CreateTaskInput as CreateTaskRepoInput,
  UpdateTaskInput as UpdateTaskRepoInput,
  TaskFilterOptions,
  TaskSortField,
  TaskWithHistory,
  // Conversation
  CreateConversationInput as CreateConversationRepoInput,
  UpdateConversationInput as UpdateConversationRepoInput,
  CreateMessageInput as CreateMessageRepoInput,
  ConversationFilterOptions,
  ConversationSortField,
  ConversationWithMessages,
  // Audit
  CreateAuditEventInput,
  AuditEventFilterOptions,
  AuditEventSortField,
} from './db/index.js';

// ============================================================================
// Services
// ============================================================================

// Task Manager Service
export {
  // Service class
  TaskService,
  createTaskService,
  // Assignment
  AssignmentResolver,
  createAssignmentResolver,
  RoundRobinStrategy,
  LoadBalancedStrategy,
  DirectStrategy,
  // Escalation
  EscalationProcessor,
  createEscalationProcessor,
  parseEscalationConfig,
  getApplicableEscalationStep,
  getEscalationTarget,
  shouldEscalateOnBreach,
  getDefaultEscalationTarget,
  buildEscalationReason,
  // SLA utilities
  parseDurationToMs,
  calculateDeadline,
  addDuration as addSLADuration,
  isBreached,
  getTimeRemaining as getSLATimeRemaining,
  isInWarningPeriod,
  calculateWarningDate,
  computeSLA,
  getNextEscalationStep,
  getNextEscalationTime,
  formatTimeRemaining,
  getSLAStatus,
  // Form validation
  buildFormValidator,
  validateFormData,
  validateFormDataOrThrow,
  applyDefaults,
  isValidFormSchema,
  getRequiredFields,
  parseFormSchema,
  // Notification (no-op implementation)
  NoOpNotificationService,
} from './services/index.js';

export type {
  // Task service config
  TaskServiceConfig,
  // Task creation options
  CreateTaskOptions,
  TaskComment,
  ReassignTarget,
  TaskHistory as ServiceTaskHistory,
  TaskWithHistory as ServiceTaskWithHistory,
  // Form types
  ServiceFormFieldType,
  FormFieldOption as ServiceFormFieldOption,
  FormFieldValidation as ServiceFormFieldValidation,
  FormField as ServiceFormField,
  FormSchema,
  FormValidationResult,
  // Assignment types
  AssignmentTarget,
  AssignmentStrategyType,
  ResolvedAssignment,
  AssignmentStrategy,
  // SLA types
  EscalationStep,
  SLAConfig,
  ComputedSLA,
  SLAStatus,
  // Escalation types
  EscalationContext,
  EscalationResult,
  // Notification types (legacy interface)
  NotificationService,
  // Signal types
  TaskCompletionSignal,
  TaskCancellationSignal,
  TaskEscalationSignal,
} from './services/index.js';

// Notification Service (full implementation)
export {
  // Service class (already aliased in services/notifications/index.ts)
  NotificationServiceImpl,
  createNotificationService,
  createNotificationServiceWithChannels,
  // Dashboard channel
  DashboardChannel,
  createDashboardChannel,
  createDashboardChannelWithStore,
  InMemoryDashboardNotificationStore,
  // Email channel
  EmailChannel,
  createEmailChannel,
  createEmailChannelWithClient,
  StubEmailClient,
  ResendEmailClient,
  // Slack channel
  SlackChannel,
  createSlackChannel,
  createSlackChannelWithClient,
  StubSlackClient,
  WebAPISlackClient,
  // Templates
  taskCreatedTemplate,
  taskAssignedTemplate,
  taskEscalatedTemplate,
  taskCompletedTemplate,
  slaWarningTemplate,
  slaBreachTemplate,
  defaultTemplates,
  getTemplate,
} from './services/index.js';

export type {
  // Event types
  NotificationEventType,
  NotificationPriority,
  NotificationEventBase,
  TaskCreatedEvent,
  TaskAssignedEvent,
  TaskEscalatedEvent,
  TaskCompletedEvent,
  SLAWarningEvent,
  SLABreachEvent,
  NotificationEvent,
  // Recipient types
  RecipientType,
  NotificationRecipient,
  NotificationPreferences,
  // Payload types
  NotificationPayload,
  // Channel types
  ChannelName,
  NotificationChannel,
  ChannelConfig,
  DashboardChannelConfig,
  EmailChannelConfig,
  SlackChannelConfig,
  // Service types
  NotificationServiceConfig,
  RecipientResolver,
  NotificationTemplate,
  TemplateMap,
  // Dashboard types
  DashboardNotification,
  CreateDashboardNotificationInput,
  DashboardNotificationStore,
  // Email types
  EmailClient,
  EmailSendResult,
  // Slack types
  SlackClient,
  SlackSendResult,
  SlackBlock,
} from './services/index.js';
