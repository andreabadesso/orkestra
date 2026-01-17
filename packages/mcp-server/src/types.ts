/**
 * MCP Server Types
 *
 * Type definitions for the Orkestra MCP server.
 */

import type { TenantId, UserId } from '@orkestra/core';

/**
 * Server configuration options
 */
export interface ServerOptions {
  /** Server name displayed to clients */
  name?: string;
  /** Server version */
  version?: string;
  /** API key for authentication (optional, can also be set via environment) */
  apiKey?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Request context containing tenant and user information
 */
export interface RequestContext {
  /** Tenant ID for multi-tenancy */
  tenantId: TenantId;
  /** User ID of the requester (optional for API key auth) */
  userId?: UserId | undefined;
  /** Request ID for tracing */
  requestId: string;
  /** Timestamp of the request */
  timestamp: Date;
}

/**
 * Tool handler result
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Service interface for workflow operations
 * This is meant to be implemented by the actual service layer
 */
export interface WorkflowService {
  start(input: {
    type: string;
    input: unknown;
    options?: unknown;
  }): Promise<unknown>;
  get(workflowId: string): Promise<unknown>;
  list(filter?: unknown): Promise<unknown>;
  signal(workflowId: string, signal: { name: string; args?: unknown[] }): Promise<void>;
  cancel(workflowId: string, reason?: string): Promise<void>;
}

/**
 * Service interface for task operations
 */
export interface TaskService {
  create(input: unknown): Promise<unknown>;
  get(taskId: string): Promise<unknown>;
  list(filter?: unknown): Promise<unknown>;
  complete(taskId: string, result: unknown): Promise<unknown>;
  reassign(taskId: string, assignment: unknown): Promise<unknown>;
  addComment(taskId: string, comment: { content: string; userId?: string }): Promise<unknown>;
}

/**
 * Service interface for conversation operations
 */
export interface ConversationService {
  create(input: unknown): Promise<unknown>;
  get(conversationId: string, includeMessages?: boolean): Promise<unknown>;
  list(filter?: unknown): Promise<unknown>;
  append(conversationId: string, message: unknown): Promise<unknown>;
}

/**
 * Service interface for user operations
 */
export interface UserService {
  listUsers(filter?: unknown): Promise<unknown>;
  listGroups(filter?: unknown): Promise<unknown>;
}

/**
 * Combined services interface
 */
export interface OrkestraServices {
  workflows: WorkflowService;
  tasks: TaskService;
  conversations: ConversationService;
  users: UserService;
}
