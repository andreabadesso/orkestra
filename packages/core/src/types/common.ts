/**
 * Common types used across Orkestra
 */

/**
 * Branded type for type-safe IDs
 * @template T - The brand name for the ID type
 */
export type BrandedId<T extends string> = string & { readonly __brand: T };

/**
 * Tenant ID type
 * @example 'ten_abc123xyz'
 */
export type TenantId = BrandedId<'TenantId'>;

/**
 * User ID type
 * @example 'usr_abc123xyz'
 */
export type UserId = BrandedId<'UserId'>;

/**
 * Group ID type
 * @example 'grp_abc123xyz'
 */
export type GroupId = BrandedId<'GroupId'>;

/**
 * Task ID type
 * @example 'tsk_abc123xyz'
 */
export type TaskId = BrandedId<'TaskId'>;

/**
 * Workflow ID type
 * @example 'wfl_abc123xyz'
 */
export type WorkflowId = BrandedId<'WorkflowId'>;

/**
 * Conversation ID type
 * @example 'cnv_abc123xyz'
 */
export type ConversationId = BrandedId<'ConversationId'>;

/**
 * Message ID type
 * @example 'msg_abc123xyz'
 */
export type MessageId = BrandedId<'MessageId'>;

/**
 * ISO 8601 date string type
 */
export type ISODateString = string & { readonly __brand: 'ISODateString' };

/**
 * Common timestamps for entities
 */
export interface Timestamps {
  /** When the entity was created */
  createdAt: ISODateString;
  /** When the entity was last updated */
  updatedAt: ISODateString;
}

/**
 * Soft delete timestamp
 */
export interface SoftDeletable {
  /** When the entity was deleted (null if not deleted) */
  deletedAt: ISODateString | null;
}

/**
 * Pagination parameters for list queries
 */
export interface PaginationParams {
  /** Number of items per page (default: 20, max: 100) */
  limit?: number;
  /** Cursor for pagination (usually the last item's ID) */
  cursor?: string;
}

/**
 * Paginated response wrapper
 * @template T - The type of items in the list
 */
export interface PaginatedResponse<T> {
  /** Array of items */
  items: T[];
  /** Cursor for the next page (null if no more pages) */
  nextCursor: string | null;
  /** Whether there are more items */
  hasMore: boolean;
}

/**
 * JSON-serializable value types
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

/**
 * Metadata type for arbitrary JSON data
 */
export type Metadata = JsonObject;
