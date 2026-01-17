/**
 * @module types
 *
 * Shared types for the Orkestra SDK.
 * These types define the core interfaces for workflows, tasks, forms, and assignments.
 */

import type { Duration } from './duration.js';

// =============================================================================
// Form Types
// =============================================================================

/**
 * Form field types supported in task forms
 */
export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'datetime'
  | 'email'
  | 'url'
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
 * Form field definition for task forms
 *
 * @example
 * // Text field
 * { type: 'text', label: 'Name', required: true }
 *
 * // Select field with options
 * {
 *   type: 'select',
 *   label: 'Status',
 *   options: [
 *     { value: 'approved', label: 'Approved' },
 *     { value: 'rejected', label: 'Rejected' }
 *   ]
 * }
 */
export interface FormField {
  /** Field type */
  type: FormFieldType;
  /** Display label (defaults to field name) */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Help text shown below the field */
  helpText?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Default value */
  default?: unknown;
  /** Options for select/multiselect/radio fields */
  options?: FormFieldOption[];
  /** Minimum value (for number fields) or min length (for text) */
  min?: number;
  /** Maximum value (for number fields) or max length (for text) */
  max?: number;
  /** Regex pattern for validation */
  pattern?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
}

/**
 * Form schema defining all fields in a task form
 *
 * @example
 * const form: FormSchema = {
 *   answer: { type: 'textarea', required: true },
 *   approved: { type: 'boolean', default: false },
 *   priority: {
 *     type: 'select',
 *     options: [
 *       { value: 'low', label: 'Low' },
 *       { value: 'high', label: 'High' }
 *     ]
 *   }
 * };
 */
export interface FormSchema {
  [fieldName: string]: FormField;
}

// =============================================================================
// Assignment Types
// =============================================================================

/**
 * Target for task assignment - either a specific user or a group
 *
 * @example
 * // Assign to specific user
 * { user: 'usr_abc123' }
 *
 * // Assign to group
 * { group: 'support-l1' }
 */
export interface AssignmentTarget {
  /** User ID for direct assignment */
  user?: string;
  /** Group slug or ID for group assignment */
  group?: string;
}

// =============================================================================
// SLA Types
// =============================================================================

/**
 * Action to take when SLA is breached
 */
export type SLABreachAction = 'escalate' | 'notify' | 'cancel';

/**
 * SLA (Service Level Agreement) configuration for tasks
 *
 * @example
 * // 30 minute deadline with escalation
 * {
 *   deadline: '30m',
 *   onBreach: 'escalate',
 *   escalateTo: { group: 'support-l2' }
 * }
 */
export interface SLAOptions {
  /** Time until deadline (duration string or milliseconds) */
  deadline: Duration;
  /** Action to take when deadline is breached */
  onBreach?: SLABreachAction;
  /** Target to escalate to (when onBreach is 'escalate') */
  escalateTo?: AssignmentTarget;
  /** Warning before deadline (optional notification) */
  warnBefore?: Duration;
}

// =============================================================================
// Task Types
// =============================================================================

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Options for creating a human task
 *
 * @example
 * const options: TaskOptions = {
 *   title: 'Review customer request',
 *   description: 'Customer is asking for a refund',
 *   form: {
 *     decision: {
 *       type: 'select',
 *       required: true,
 *       options: [
 *         { value: 'approve', label: 'Approve Refund' },
 *         { value: 'deny', label: 'Deny Refund' }
 *       ]
 *     },
 *     notes: { type: 'textarea' }
 *   },
 *   assignTo: { group: 'customer-service' },
 *   priority: 'high',
 *   sla: { deadline: '1h', onBreach: 'escalate' }
 * };
 */
export interface TaskOptions {
  /** Task title (short summary) */
  title: string;
  /** Task description (detailed instructions) */
  description?: string;
  /** Form schema defining fields for task completion */
  form: FormSchema;
  /** Assignment target (user or group) */
  assignTo: AssignmentTarget;
  /** Additional context data to display with the task */
  context?: Record<string, unknown>;
  /** Related conversation ID (for AI chat workflows) */
  conversationId?: string;
  /** SLA configuration */
  sla?: SLAOptions;
  /** Task priority (default: 'medium') */
  priority?: TaskPriority;
  /** Task type identifier for categorization */
  type?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result returned when a task is completed
 *
 * @typeParam T - The type of the form data
 *
 * @example
 * const result: TaskResult<{ answer: string; approved: boolean }> = {
 *   taskId: 'tsk_abc123',
 *   data: { answer: 'Yes, approved', approved: true },
 *   completedBy: 'usr_xyz789',
 *   completedAt: new Date()
 * };
 */
export interface TaskResult<T = Record<string, unknown>> {
  /** Unique task identifier */
  taskId: string;
  /** Form data submitted by the user */
  data: T;
  /** ID of the user who completed the task */
  completedBy: string;
  /** Timestamp when the task was completed */
  completedAt: Date;
}

// =============================================================================
// Escalation Types
// =============================================================================

/**
 * Action to take at each escalation step
 */
export type EscalationAction = 'reassign' | 'notify' | 'escalate';

/**
 * A single step in an escalation chain
 *
 * @example
 * // Notify after 15 minutes
 * { after: '15m', action: 'notify', message: 'Task is approaching SLA' }
 *
 * // Escalate to L2 after 30 minutes
 * { after: '30m', action: 'escalate', target: { group: 'support-l2' } }
 */
export interface EscalationStep {
  /** Time after task creation to trigger this step */
  after: Duration;
  /** Action to take */
  action: EscalationAction;
  /** Target for reassign/escalate actions */
  target?: AssignmentTarget;
  /** Message to include with notification */
  message?: string;
}

/**
 * An escalation chain defining multiple escalation steps
 *
 * @example
 * const chain: EscalationChain = {
 *   steps: [
 *     { after: '15m', action: 'notify', message: 'Task pending' },
 *     { after: '30m', action: 'escalate', target: { group: 'support-l2' } },
 *     { after: '1h', action: 'escalate', target: { group: 'support-l3' } }
 *   ]
 * };
 */
export interface EscalationChain {
  /** Ordered list of escalation steps */
  steps: EscalationStep[];
}

// =============================================================================
// Signal Types
// =============================================================================

/**
 * Options for waiting for a signal
 */
export interface SignalOptions<T = unknown> {
  /** Optional timeout for waiting */
  timeout?: Duration;
  /** Optional filter function to match specific signals */
  filter?: (data: T) => boolean;
}

/**
 * Data sent with a task completed signal
 */
export interface TaskCompletedSignalData<T = Record<string, unknown>> {
  /** Task ID that was completed */
  taskId: string;
  /** Form data submitted */
  data: T;
  /** User who completed the task */
  completedBy: string;
  /** Completion timestamp */
  completedAt: string;
}

/**
 * Data sent with a task cancelled signal
 */
export interface TaskCancelledSignalData {
  /** Task ID that was cancelled */
  taskId: string;
  /** Reason for cancellation */
  reason?: string;
  /** User who cancelled (if applicable) */
  cancelledBy?: string;
}

// =============================================================================
// Workflow Types
// =============================================================================

/**
 * Logger interface for workflow logging
 */
export interface Logger {
  /** Log debug message */
  debug(message: string, attrs?: Record<string, unknown>): void;
  /** Log info message */
  info(message: string, attrs?: Record<string, unknown>): void;
  /** Log warning message */
  warn(message: string, attrs?: Record<string, unknown>): void;
  /** Log error message */
  error(message: string, attrs?: Record<string, unknown>): void;
}

/**
 * JSON-serializable value types
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;
