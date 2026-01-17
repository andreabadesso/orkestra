/**
 * Orkestra Core Types
 *
 * This module exports all domain types used throughout Orkestra.
 */

// Common types and utilities
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
} from './common.js';

// Tenant types
export type {
  TenantStatus,
  TenantConfig,
  TenantLimits,
  Tenant,
  CreateTenantInput,
  UpdateTenantInput,
} from './tenant.js';
export { DEFAULT_TENANT_LIMITS } from './tenant.js';

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
} from './user.js';

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
} from './task.js';

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
} from './workflow.js';

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
} from './conversation.js';
