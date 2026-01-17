/**
 * Task types for human-in-the-loop task management
 */

import type {
  TenantId,
  UserId,
  GroupId,
  TaskId,
  WorkflowId,
  ConversationId,
  Timestamps,
  SoftDeletable,
  Metadata,
  JsonValue,
} from './common.js';

/**
 * Task status values representing the task lifecycle
 */
export type TaskStatus =
  | 'pending'      // Task created, waiting for assignment
  | 'assigned'     // Task assigned to user/group
  | 'in_progress'  // User has started working on task
  | 'completed'    // Task completed successfully
  | 'cancelled'    // Task cancelled before completion
  | 'expired'      // Task expired due to SLA timeout
  | 'escalated';   // Task escalated to higher level

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Form field types supported in task forms
 */
export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'url'
  | 'date'
  | 'datetime'
  | 'time'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'json';

/**
 * Option for select/multiselect/radio fields
 */
export interface FormFieldOption {
  /** Value to store when selected */
  value: string;
  /** Display label for the option */
  label: string;
  /** Whether this option is disabled */
  disabled?: boolean;
}

/**
 * Validation rules for form fields
 */
export interface FormFieldValidation {
  /** Whether the field is required */
  required?: boolean;
  /** Minimum length for text fields */
  minLength?: number;
  /** Maximum length for text fields */
  maxLength?: number;
  /** Minimum value for number fields */
  min?: number;
  /** Maximum value for number fields */
  max?: number;
  /** Regex pattern for text validation */
  pattern?: string;
  /** Custom error message for validation failures */
  errorMessage?: string;
}

/**
 * Form field definition
 */
export interface FormField {
  /** Field type */
  type: FormFieldType;
  /** Display label */
  label: string;
  /** Placeholder text */
  placeholder?: string;
  /** Help text shown below the field */
  helpText?: string;
  /** Default value */
  defaultValue?: JsonValue;
  /** Options for select/multiselect/radio fields */
  options?: FormFieldOption[];
  /** Validation rules */
  validation?: FormFieldValidation;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field should be hidden */
  hidden?: boolean;
  /** Conditional visibility (field name to check) */
  showWhen?: {
    /** Field name to check */
    field: string;
    /** Value that triggers visibility */
    equals: JsonValue;
  };
}

/**
 * Task form schema definition
 */
export interface TaskFormSchema {
  /** Form fields keyed by field name */
  fields: Record<string, FormField>;
  /** Order of fields for display */
  fieldOrder?: string[];
  /** Form-level settings */
  settings?: {
    /** Submit button text */
    submitLabel?: string;
    /** Cancel button text */
    cancelLabel?: string;
    /** Whether to show a confirmation dialog before submit */
    confirmSubmit?: boolean;
    /** Custom confirmation message */
    confirmMessage?: string;
  };
}

/**
 * Task assignment configuration
 */
export interface TaskAssignment {
  /** Assigned user ID (direct assignment) */
  userId?: UserId;
  /** Assigned group ID (group assignment) */
  groupId?: GroupId;
  /** User who claimed the task from a group */
  claimedBy?: UserId;
  /** When the task was claimed */
  claimedAt?: string;
}

/**
 * SLA (Service Level Agreement) configuration
 */
export interface TaskSLA {
  /** Due date/time (ISO 8601) */
  dueAt: string;
  /** Warning threshold in minutes before due */
  warnBeforeMinutes?: number;
  /** Escalation configuration */
  escalation?: {
    /** Escalate after this many minutes past due */
    afterMinutes: number;
    /** Group to escalate to */
    toGroupId?: GroupId;
    /** User to escalate to */
    toUserId?: UserId;
  };
}

/**
 * Task context data for providing background information
 */
export interface TaskContext {
  /** Related conversation ID */
  conversationId?: ConversationId;
  /** Related entity type and ID */
  relatedEntity?: {
    type: string;
    id: string;
  };
  /** Additional context data */
  data?: Metadata;
}

/**
 * Task entity representing a human task
 */
export interface Task extends Timestamps, SoftDeletable {
  /** Unique task identifier */
  id: TaskId;
  /** Tenant this task belongs to */
  tenantId: TenantId;
  /** Related workflow ID (if task was created by a workflow) */
  workflowId: WorkflowId | null;
  /** Task type identifier (for categorization) */
  type: string;
  /** Task title (short summary) */
  title: string;
  /** Task description (detailed instructions) */
  description: string | null;
  /** Current task status */
  status: TaskStatus;
  /** Task priority */
  priority: TaskPriority;
  /** Form schema for task completion */
  form: TaskFormSchema;
  /** Task assignment */
  assignment: TaskAssignment;
  /** SLA configuration */
  sla: TaskSLA | null;
  /** Context data */
  context: TaskContext;
  /** Form data submitted by the user */
  result: Metadata | null;
  /** When the task was completed */
  completedAt: string | null;
  /** User who completed the task */
  completedBy: UserId | null;
  /** Additional metadata */
  metadata: Metadata;
}

/**
 * Input for creating a new task
 */
export interface CreateTaskInput {
  /** Task type identifier */
  type: string;
  /** Task title */
  title: string;
  /** Task description */
  description?: string;
  /** Task priority (default: 'medium') */
  priority?: TaskPriority;
  /** Form schema */
  form: TaskFormSchema;
  /** Assignment (user or group) */
  assignment: Omit<TaskAssignment, 'claimedBy' | 'claimedAt'>;
  /** SLA configuration */
  sla?: TaskSLA;
  /** Context data */
  context?: TaskContext;
  /** Additional metadata */
  metadata?: Metadata;
}

/**
 * Input for updating a task
 */
export interface UpdateTaskInput {
  /** Updated title */
  title?: string;
  /** Updated description */
  description?: string | null;
  /** Updated priority */
  priority?: TaskPriority;
  /** Updated assignment */
  assignment?: Partial<TaskAssignment>;
  /** Updated SLA */
  sla?: TaskSLA | null;
  /** Updated metadata (merged with existing) */
  metadata?: Metadata;
}

/**
 * Input for completing a task
 */
export interface CompleteTaskInput {
  /** Form data submitted by the user */
  result: Metadata;
}

/**
 * Task event types for audit logging
 */
export type TaskEventType =
  | 'created'
  | 'assigned'
  | 'claimed'
  | 'unclaimed'
  | 'started'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'escalated'
  | 'updated'
  | 'commented';

/**
 * Task event for audit trail
 */
export interface TaskEvent {
  /** Event type */
  type: TaskEventType;
  /** Timestamp */
  timestamp: string;
  /** User who triggered the event */
  userId: UserId | null;
  /** Event data */
  data?: Metadata;
}
