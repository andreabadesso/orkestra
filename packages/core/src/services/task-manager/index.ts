/**
 * Task Manager Service
 *
 * Main entry point for the task manager service module.
 * Re-exports all public APIs.
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Form types
  ServiceFormFieldType,
  FormFieldOption,
  FormFieldValidation,
  FormField,
  FormSchema,
  // Assignment types
  AssignmentTarget,
  AssignmentStrategyType,
  ResolvedAssignment,
  // SLA types
  EscalationStep,
  SLAConfig,
  ComputedSLA,
  // Task service types
  CreateTaskOptions,
  TaskHistory,
  TaskWithHistory,
  TaskComment,
  ReassignTarget,
  // Notification types
  NotificationService,
  // Signal types
  TaskCompletionSignal,
  TaskCancellationSignal,
  TaskEscalationSignal,
} from './types.js';

export { NoOpNotificationService } from './types.js';

// ============================================================================
// SLA Management
// ============================================================================

export {
  parseDurationToMs,
  calculateDeadline,
  addDuration,
  isBreached,
  getTimeRemaining,
  isInWarningPeriod,
  calculateWarningDate,
  computeSLA,
  getNextEscalationStep,
  getNextEscalationTime,
  formatTimeRemaining,
  getSLAStatus,
} from './sla.js';

export type { SLAStatus } from './sla.js';

// ============================================================================
// Form Validation
// ============================================================================

export {
  buildFormValidator,
  validateFormData,
  validateFormDataOrThrow,
  applyDefaults,
  isValidFormSchema,
  getRequiredFields,
  parseFormSchema,
} from './form-validation.js';

export type { FormValidationResult } from './form-validation.js';

// ============================================================================
// Assignment Strategies
// ============================================================================

export {
  RoundRobinStrategy,
  LoadBalancedStrategy,
  DirectStrategy,
  AssignmentResolver,
  createAssignmentResolver,
} from './assignment.js';

export type { AssignmentStrategy } from './assignment.js';

// ============================================================================
// Escalation
// ============================================================================

export {
  parseEscalationConfig,
  getApplicableEscalationStep,
  getEscalationTarget,
  shouldEscalateOnBreach,
  getDefaultEscalationTarget,
  buildEscalationReason,
  EscalationProcessor,
  createEscalationProcessor,
} from './escalation.js';

export type { EscalationContext, EscalationResult } from './escalation.js';

// ============================================================================
// Task Service
// ============================================================================

export { TaskService, createTaskService } from './task-service.js';

export type { TaskServiceConfig } from './task-service.js';
