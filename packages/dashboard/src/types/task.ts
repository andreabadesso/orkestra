/**
 * Task Types for Dashboard
 *
 * Type definitions for tasks used in the dashboard UI.
 * These mirror the API types but are optimized for frontend use.
 */

/**
 * Task status values
 */
export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'escalated';

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Form field types
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
 * Form field option
 */
export interface FormFieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Form field validation
 */
export interface FormFieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  errorMessage?: string;
}

/**
 * Form field definition
 */
export interface FormField {
  type: FormFieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  defaultValue?: unknown;
  options?: FormFieldOption[];
  validation?: FormFieldValidation;
  disabled?: boolean;
  hidden?: boolean;
  showWhen?: {
    field: string;
    equals: unknown;
  };
}

/**
 * Task form schema
 */
export interface TaskFormSchema {
  fields: Record<string, FormField>;
  fieldOrder?: string[];
  settings?: {
    submitLabel?: string;
    cancelLabel?: string;
    confirmSubmit?: boolean;
    confirmMessage?: string;
  };
}

/**
 * Task assignment
 */
export interface TaskAssignment {
  userId?: string | null;
  groupId?: string | null;
  claimedBy?: string | null;
  claimedAt?: string | null;
}

/**
 * Task SLA
 */
export interface TaskSLA {
  dueAt: string;
  warnBeforeMinutes?: number;
  escalation?: {
    afterMinutes: number;
    toGroupId?: string;
    toUserId?: string;
  };
}

/**
 * Task context
 */
export interface TaskContext {
  conversationId?: string;
  relatedEntity?: {
    type: string;
    id: string;
  };
  data?: Record<string, unknown>;
}

/**
 * Task entity for dashboard
 */
export interface Task {
  id: string;
  tenantId: string;
  workflowId: string | null;
  type: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  formSchema: TaskFormSchema;
  assignedUserId: string | null;
  assignedGroupId: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
  dueAt: string | null;
  warnAt: string | null;
  context: TaskContext | null;
  result: Record<string, unknown> | null;
  completedAt: string | null;
  completedBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Task list item (minimal data for list view)
 */
export interface TaskListItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedGroupId: string | null;
  claimedBy: string | null;
  dueAt: string | null;
  createdAt: string;
}

/**
 * Task statistics
 */
export interface TaskStats {
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}
