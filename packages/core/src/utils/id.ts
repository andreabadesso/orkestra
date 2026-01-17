/**
 * ID generation utilities for Orkestra
 *
 * Generates prefixed, URL-safe, unique identifiers using nanoid.
 */

import { nanoid, customAlphabet } from 'nanoid';
import type {
  TenantId,
  UserId,
  GroupId,
  TaskId,
  WorkflowId,
  ConversationId,
  MessageId,
  BrandedId,
} from '../types/common.js';

/**
 * ID prefixes for different entity types
 */
export const ID_PREFIXES = {
  tenant: 'ten',
  user: 'usr',
  group: 'grp',
  task: 'tsk',
  workflow: 'wfl',
  conversation: 'cnv',
  message: 'msg',
  apiKey: 'key',
  session: 'ses',
  request: 'req',
} as const;

/**
 * Entity type to ID prefix mapping
 */
export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

/**
 * Default ID length (excluding prefix)
 */
const DEFAULT_ID_LENGTH = 21;

/**
 * Custom alphabet for IDs (URL-safe, no ambiguous characters)
 * Excludes: 0, O, o, l, I (to avoid confusion)
 */
const ID_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';

/**
 * Custom nanoid generator with our alphabet
 */
const customNanoid = customAlphabet(ID_ALPHABET, DEFAULT_ID_LENGTH);

/**
 * Generate a prefixed ID
 *
 * @param prefix - ID prefix (e.g., 'ten', 'usr')
 * @param length - ID length excluding prefix (default: 21)
 * @returns Prefixed ID string
 *
 * @example
 * ```typescript
 * const id = generateId('ten'); // 'ten_8fK3jR9mP2xL5nQ7vB4c'
 * ```
 */
export function generateId<T extends string>(
  prefix: string,
  length: number = DEFAULT_ID_LENGTH
): BrandedId<T> {
  const id = length === DEFAULT_ID_LENGTH ? customNanoid() : customAlphabet(ID_ALPHABET, length)();
  return `${prefix}_${id}` as BrandedId<T>;
}

/**
 * Generate a tenant ID
 * @returns New tenant ID (ten_xxx)
 */
export function generateTenantId(): TenantId {
  return generateId<'TenantId'>(ID_PREFIXES.tenant);
}

/**
 * Generate a user ID
 * @returns New user ID (usr_xxx)
 */
export function generateUserId(): UserId {
  return generateId<'UserId'>(ID_PREFIXES.user);
}

/**
 * Generate a group ID
 * @returns New group ID (grp_xxx)
 */
export function generateGroupId(): GroupId {
  return generateId<'GroupId'>(ID_PREFIXES.group);
}

/**
 * Generate a task ID
 * @returns New task ID (tsk_xxx)
 */
export function generateTaskId(): TaskId {
  return generateId<'TaskId'>(ID_PREFIXES.task);
}

/**
 * Generate a workflow ID
 * @returns New workflow ID (wfl_xxx)
 */
export function generateWorkflowId(): WorkflowId {
  return generateId<'WorkflowId'>(ID_PREFIXES.workflow);
}

/**
 * Generate a conversation ID
 * @returns New conversation ID (cnv_xxx)
 */
export function generateConversationId(): ConversationId {
  return generateId<'ConversationId'>(ID_PREFIXES.conversation);
}

/**
 * Generate a message ID
 * @returns New message ID (msg_xxx)
 */
export function generateMessageId(): MessageId {
  return generateId<'MessageId'>(ID_PREFIXES.message);
}

/**
 * Generate an API key
 * @returns New API key (key_xxx) - longer for security
 */
export function generateApiKey(): string {
  return generateId(ID_PREFIXES.apiKey, 32);
}

/**
 * Generate a session ID
 * @returns New session ID (ses_xxx)
 */
export function generateSessionId(): string {
  return generateId(ID_PREFIXES.session);
}

/**
 * Generate a request ID
 * @returns New request ID (req_xxx)
 */
export function generateRequestId(): string {
  return generateId(ID_PREFIXES.request);
}

/**
 * Generate a raw nanoid (no prefix)
 *
 * @param length - ID length (default: 21)
 * @returns Raw nanoid string
 */
export function generateRawId(length: number = DEFAULT_ID_LENGTH): string {
  return length === DEFAULT_ID_LENGTH ? customNanoid() : customAlphabet(ID_ALPHABET, length)();
}

/**
 * Generate a UUID v4 (for external compatibility)
 * Uses nanoid internally but formats as UUID
 *
 * @returns UUID v4 string
 */
export function generateUuid(): string {
  return nanoid();
}

/**
 * Parse a prefixed ID to extract the prefix and value
 *
 * @param id - Prefixed ID string
 * @returns Object with prefix and value, or null if invalid
 *
 * @example
 * ```typescript
 * parseId('ten_abc123'); // { prefix: 'ten', value: 'abc123' }
 * parseId('invalid');    // null
 * ```
 */
export function parseId(id: string): { prefix: string; value: string } | null {
  const match = /^([a-z]{3})_([a-zA-Z0-9]+)$/.exec(id);
  if (!match || !match[1] || !match[2]) {
    return null;
  }
  return { prefix: match[1], value: match[2] };
}

/**
 * Validate that an ID has the expected prefix
 *
 * @param id - ID to validate
 * @param expectedPrefix - Expected prefix
 * @returns Whether the ID is valid
 *
 * @example
 * ```typescript
 * isValidId('ten_abc123', 'ten'); // true
 * isValidId('usr_abc123', 'ten'); // false
 * ```
 */
export function isValidId(id: string, expectedPrefix: string): boolean {
  const parsed = parseId(id);
  return parsed !== null && parsed.prefix === expectedPrefix;
}

/**
 * Type guard for tenant ID
 */
export function isTenantId(id: string): id is TenantId {
  return isValidId(id, ID_PREFIXES.tenant);
}

/**
 * Type guard for user ID
 */
export function isUserId(id: string): id is UserId {
  return isValidId(id, ID_PREFIXES.user);
}

/**
 * Type guard for group ID
 */
export function isGroupId(id: string): id is GroupId {
  return isValidId(id, ID_PREFIXES.group);
}

/**
 * Type guard for task ID
 */
export function isTaskId(id: string): id is TaskId {
  return isValidId(id, ID_PREFIXES.task);
}

/**
 * Type guard for workflow ID
 */
export function isWorkflowId(id: string): id is WorkflowId {
  return isValidId(id, ID_PREFIXES.workflow);
}

/**
 * Type guard for conversation ID
 */
export function isConversationId(id: string): id is ConversationId {
  return isValidId(id, ID_PREFIXES.conversation);
}

/**
 * Type guard for message ID
 */
export function isMessageId(id: string): id is MessageId {
  return isValidId(id, ID_PREFIXES.message);
}
