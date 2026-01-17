/**
 * Conversation and Message types for context tracking
 */

import type {
  TenantId,
  UserId,
  ConversationId,
  MessageId,
  WorkflowId,
  Timestamps,
  SoftDeletable,
  Metadata,
  JsonValue,
} from './common.js';

/**
 * Conversation status values
 */
export type ConversationStatus =
  | 'active'      // Conversation is ongoing
  | 'resolved'    // Conversation completed successfully
  | 'abandoned'   // User left without resolution
  | 'archived';   // Conversation archived

/**
 * Message role indicating who sent the message
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'human_operator';

/**
 * Message content type
 */
export type MessageContentType = 'text' | 'markdown' | 'html' | 'json';

/**
 * Conversation channel type
 */
export type ConversationChannel =
  | 'web'
  | 'api'
  | 'slack'
  | 'email'
  | 'sms'
  | 'custom';

/**
 * Conversation participant
 */
export interface ConversationParticipant {
  /** User ID (null for anonymous/external participants) */
  userId: UserId | null;
  /** Participant role */
  role: MessageRole;
  /** Display name */
  name: string;
  /** When they joined */
  joinedAt: string;
  /** When they left (null if still active) */
  leftAt: string | null;
}

/**
 * Conversation entity for tracking interactions
 */
export interface Conversation extends Timestamps, SoftDeletable {
  /** Unique conversation identifier */
  id: ConversationId;
  /** Tenant this conversation belongs to */
  tenantId: TenantId;
  /** Related workflow ID (if conversation triggered a workflow) */
  workflowId: WorkflowId | null;
  /** Conversation title/subject */
  title: string | null;
  /** Current status */
  status: ConversationStatus;
  /** Channel through which conversation is happening */
  channel: ConversationChannel;
  /** External reference ID (e.g., ticket number, chat ID) */
  externalId: string | null;
  /** Participants in the conversation */
  participants: ConversationParticipant[];
  /** Total message count */
  messageCount: number;
  /** Summary of the conversation (AI-generated) */
  summary: string | null;
  /** Tags for categorization */
  tags: string[];
  /** Additional metadata */
  metadata: Metadata;
}

/**
 * Input for creating a new conversation
 */
export interface CreateConversationInput {
  /** Conversation title/subject */
  title?: string;
  /** Channel type */
  channel: ConversationChannel;
  /** External reference ID */
  externalId?: string;
  /** Initial participants */
  participants?: Omit<ConversationParticipant, 'joinedAt' | 'leftAt'>[];
  /** Initial tags */
  tags?: string[];
  /** Additional metadata */
  metadata?: Metadata;
}

/**
 * Input for updating a conversation
 */
export interface UpdateConversationInput {
  /** Updated title */
  title?: string | null;
  /** Updated status */
  status?: ConversationStatus;
  /** Updated summary */
  summary?: string | null;
  /** Updated tags */
  tags?: string[];
  /** Updated metadata (merged with existing) */
  metadata?: Metadata;
}

/**
 * Message attachment
 */
export interface MessageAttachment {
  /** Attachment ID */
  id: string;
  /** File name */
  fileName: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  sizeBytes: number;
  /** URL to download the attachment */
  url: string;
}

/**
 * Message entity representing a single message in a conversation
 */
export interface Message extends Timestamps {
  /** Unique message identifier */
  id: MessageId;
  /** Conversation this message belongs to */
  conversationId: ConversationId;
  /** Tenant ID (denormalized for query efficiency) */
  tenantId: TenantId;
  /** Who sent the message */
  role: MessageRole;
  /** User ID of sender (null for system messages or external participants) */
  userId: UserId | null;
  /** Sender display name */
  senderName: string;
  /** Content type */
  contentType: MessageContentType;
  /** Message content */
  content: string;
  /** Attachments */
  attachments: MessageAttachment[];
  /** Tool calls made in this message (for AI messages) */
  toolCalls?: Array<{
    /** Tool name */
    name: string;
    /** Tool arguments */
    arguments: JsonValue;
    /** Tool result */
    result?: JsonValue;
  }>;
  /** Token usage (for AI messages) */
  tokenUsage?: {
    /** Input/prompt tokens */
    input: number;
    /** Output/completion tokens */
    output: number;
    /** Total tokens */
    total: number;
  };
  /** Additional metadata */
  metadata: Metadata;
}

/**
 * Input for creating a new message
 */
export interface CreateMessageInput {
  /** Who is sending the message */
  role: MessageRole;
  /** User ID of sender (if applicable) */
  userId?: UserId;
  /** Sender display name */
  senderName?: string;
  /** Content type (default: 'text') */
  contentType?: MessageContentType;
  /** Message content */
  content: string;
  /** Attachments */
  attachments?: Omit<MessageAttachment, 'id'>[];
  /** Tool calls (for AI messages) */
  toolCalls?: Message['toolCalls'];
  /** Token usage (for AI messages) */
  tokenUsage?: Message['tokenUsage'];
  /** Additional metadata */
  metadata?: Metadata;
}

/**
 * Conversation filter options for listing
 */
export interface ConversationFilter {
  /** Filter by status */
  status?: ConversationStatus | ConversationStatus[];
  /** Filter by channel */
  channel?: ConversationChannel | ConversationChannel[];
  /** Filter by participant user ID */
  participantUserId?: UserId;
  /** Filter by tag */
  tag?: string;
  /** Filter by workflow ID */
  workflowId?: WorkflowId;
  /** Filter by creation date (from) */
  createdAfter?: string;
  /** Filter by creation date (to) */
  createdBefore?: string;
  /** Search in title and summary */
  search?: string;
}
