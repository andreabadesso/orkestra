/**
 * Task Manager Service Types
 *
 * Service-specific types for the task manager.
 */

import type { Task as PrismaTask } from '@prisma/client';
import type { TaskPriority } from '../../types/task.js';

// ============================================================================
// Form Schema Types
// ============================================================================

/**
 * Form field types supported in task forms
 */
export type ServiceFormFieldType =
  | 'text'
  | 'textarea'
  | 'boolean'
  | 'select'
  | 'number'
  | 'date';

/**
 * Option for select fields
 */
export interface FormFieldOption {
  value: string;
  label: string;
}

/**
 * Validation rules for form fields
 */
export interface FormFieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
}

/**
 * Form field definition
 */
export interface FormField {
  type: ServiceFormFieldType;
  label?: string;
  required?: boolean;
  default?: unknown;
  options?: FormFieldOption[];
  validation?: FormFieldValidation;
}

/**
 * Form schema definition
 */
export interface FormSchema {
  fields: Record<string, FormField>;
}

// ============================================================================
// Assignment Types
// ============================================================================

/**
 * Assignment target (who to assign the task to)
 */
export interface AssignmentTarget {
  userId?: string;
  groupId?: string;
}

/**
 * Assignment strategy types
 */
export type AssignmentStrategyType = 'round_robin' | 'load_balanced' | 'direct';

/**
 * Resolved assignment result
 */
export interface ResolvedAssignment {
  /** Assigned user ID */
  userId: string | null;
  /** Assigned group ID */
  groupId: string | null;
  /** Strategy used for assignment */
  strategy: AssignmentStrategyType;
}

// ============================================================================
// SLA Types
// ============================================================================

/**
 * Escalation step in the escalation chain
 */
export interface EscalationStep {
  /** Delay before this escalation step (duration string like "30m", "1h") */
  after: string;
  /** Target user to escalate to */
  toUserId?: string;
  /** Target group to escalate to */
  toGroupId?: string;
  /** Notification message */
  message?: string;
}

/**
 * SLA configuration
 */
export interface SLAConfig {
  /** Deadline as Date or duration string */
  deadline: Date | string;
  /** Escalation chain */
  escalationChain?: EscalationStep[];
  /** Action to take on breach */
  onBreach?: 'escalate' | 'notify' | 'cancel';
  /** Warning threshold before deadline (duration string like "15m") */
  warnBefore?: string;
}

/**
 * Computed SLA information
 */
export interface ComputedSLA {
  /** Due date */
  dueAt: Date;
  /** Warning date */
  warnAt: Date | null;
  /** Escalation configuration */
  escalationConfig: EscalationStep[] | null;
  /** Breach action */
  onBreach: 'escalate' | 'notify' | 'cancel';
}

// ============================================================================
// Task Service Types
// ============================================================================

/**
 * Options for creating a task
 */
export interface CreateTaskOptions {
  /** Task title */
  title: string;
  /** Task description */
  description?: string;
  /** Form schema for task completion */
  form: FormSchema;
  /** Assignment target */
  assignTo: AssignmentTarget;
  /** Context data */
  context?: Record<string, unknown>;
  /** Related conversation ID */
  conversationId?: string;
  /** SLA configuration */
  sla?: SLAConfig;
  /** Related workflow ID */
  workflowId: string;
  /** Related workflow run ID */
  workflowRunId: string;
  /** Task priority */
  priority?: TaskPriority;
  /** Task type */
  type?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task history entry
 */
export interface TaskHistory {
  id: string;
  action: string;
  userId: string | null;
  data: unknown;
  createdAt: Date;
}

/**
 * Task with history
 */
export interface TaskWithHistory extends PrismaTask {
  history: TaskHistory[];
}

/**
 * Task comment
 */
export interface TaskComment {
  text: string;
  userId?: string;
  internal?: boolean;
}

/**
 * Reassignment target
 */
export interface ReassignTarget {
  userId?: string | null;
  groupId?: string | null;
}

// ============================================================================
// Notification Types
// ============================================================================

/**
 * Notification service interface
 *
 * This interface defines the contract for notification services.
 * Implementations will be provided in a separate package.
 */
export interface NotificationService {
  /**
   * Notify when a task is created
   */
  taskCreated(task: PrismaTask): Promise<void>;

  /**
   * Notify when a task is assigned to a user
   */
  taskAssigned(task: PrismaTask, userId: string): Promise<void>;

  /**
   * Notify when a task is escalated
   */
  taskEscalated(task: PrismaTask, reason?: string): Promise<void>;

  /**
   * Notify when a task is completed
   */
  taskCompleted(task: PrismaTask): Promise<void>;

  /**
   * Notify when SLA warning threshold is reached
   */
  slaWarning(task: PrismaTask, timeRemaining: number): Promise<void>;

  /**
   * Notify when SLA is breached
   */
  slaBreach(task: PrismaTask): Promise<void>;
}

/**
 * No-op notification service implementation
 *
 * Used as default when no notification service is provided.
 */
export class NoOpNotificationService implements NotificationService {
  async taskCreated(_task: PrismaTask): Promise<void> {}
  async taskAssigned(_task: PrismaTask, _userId: string): Promise<void> {}
  async taskEscalated(_task: PrismaTask, _reason?: string): Promise<void> {}
  async taskCompleted(_task: PrismaTask): Promise<void> {}
  async slaWarning(_task: PrismaTask, _timeRemaining: number): Promise<void> {}
  async slaBreach(_task: PrismaTask): Promise<void> {}
}

// ============================================================================
// Workflow Signal Types
// ============================================================================

/**
 * Task completion signal payload
 */
export interface TaskCompletionSignal {
  taskId: string;
  formData: Record<string, unknown>;
  completedBy: string;
  completedAt: Date;
}

/**
 * Task cancellation signal payload
 */
export interface TaskCancellationSignal {
  taskId: string;
  reason?: string | undefined;
  cancelledBy: string | null;
  cancelledAt: Date;
}

/**
 * Task escalation signal payload
 */
export interface TaskEscalationSignal {
  taskId: string;
  reason?: string | undefined;
  escalatedTo: ReassignTarget;
  escalatedAt: Date;
}
