/**
 * Utilities module for Orkestra
 *
 * Provides ID generation and date utilities.
 */

// ID generation utilities
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
} from './id.js';

export type { IdPrefix } from './id.js';

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
} from './date.js';

export type { DurationUnit } from './date.js';
