/**
 * Workflow types for orchestration
 */

import type {
  TenantId,
  UserId,
  WorkflowId,
  Timestamps,
  Metadata,
  JsonValue,
} from './common.js';

/**
 * Workflow execution status
 */
export type WorkflowStatus =
  | 'pending'      // Workflow created, not yet started
  | 'running'      // Workflow is actively executing
  | 'paused'       // Workflow is paused (e.g., waiting for human task)
  | 'completed'    // Workflow completed successfully
  | 'failed'       // Workflow failed with error
  | 'cancelled'    // Workflow was cancelled
  | 'timed_out';   // Workflow exceeded timeout

/**
 * Workflow definition metadata
 */
export interface WorkflowDefinition {
  /** Workflow type name (must match registered workflow) */
  name: string;
  /** Workflow version */
  version: string;
  /** Human-readable description */
  description?: string;
  /** Expected input schema (JSON Schema) */
  inputSchema?: JsonValue;
  /** Expected output schema (JSON Schema) */
  outputSchema?: JsonValue;
  /** Default timeout in seconds */
  defaultTimeoutSeconds?: number;
  /** Retry configuration */
  retry?: {
    /** Maximum number of retries */
    maxAttempts: number;
    /** Initial retry delay in seconds */
    initialIntervalSeconds: number;
    /** Maximum retry delay in seconds */
    maxIntervalSeconds: number;
    /** Backoff coefficient */
    backoffCoefficient: number;
  };
}

/**
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
  /** Custom workflow ID (auto-generated if not provided) */
  workflowId?: string;
  /** Task queue to run on (uses default if not provided) */
  taskQueue?: string;
  /** Execution timeout in seconds */
  executionTimeoutSeconds?: number;
  /** Run timeout in seconds (single run, before retry) */
  runTimeoutSeconds?: number;
  /** Search attributes for Temporal */
  searchAttributes?: Record<string, JsonValue>;
  /** Memo data (visible in Temporal UI) */
  memo?: Record<string, JsonValue>;
  /** Retry policy override */
  retry?: WorkflowDefinition['retry'];
}

/**
 * Workflow instance representing a running or completed workflow
 */
export interface Workflow extends Timestamps {
  /** Unique workflow identifier */
  id: WorkflowId;
  /** Tenant this workflow belongs to */
  tenantId: TenantId;
  /** Temporal workflow ID */
  temporalWorkflowId: string;
  /** Temporal run ID (changes on retry) */
  temporalRunId: string;
  /** Workflow type name */
  type: string;
  /** Current execution status */
  status: WorkflowStatus;
  /** Workflow input data */
  input: JsonValue;
  /** Workflow output data (null if not completed) */
  output: JsonValue | null;
  /** Error message if failed */
  error: string | null;
  /** User who started the workflow */
  startedBy: UserId | null;
  /** When the workflow started executing */
  startedAt: string;
  /** When the workflow completed/failed/cancelled */
  completedAt: string | null;
  /** Execution options used */
  options: WorkflowExecutionOptions;
  /** Additional metadata */
  metadata: Metadata;
}

/**
 * Input for starting a new workflow
 */
export interface StartWorkflowInput {
  /** Workflow type name */
  type: string;
  /** Workflow input data */
  input: JsonValue;
  /** Execution options */
  options?: WorkflowExecutionOptions;
  /** Additional metadata */
  metadata?: Metadata;
}

/**
 * Workflow query types
 */
export interface WorkflowQuery {
  /** Query name */
  name: string;
  /** Query arguments */
  args?: JsonValue[];
}

/**
 * Workflow signal types
 */
export interface WorkflowSignal {
  /** Signal name */
  name: string;
  /** Signal arguments */
  args?: JsonValue[];
}

/**
 * Workflow event types for audit logging
 */
export type WorkflowEventType =
  | 'started'
  | 'paused'
  | 'resumed'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out'
  | 'signaled'
  | 'queried';

/**
 * Workflow event for audit trail
 */
export interface WorkflowEvent {
  /** Event type */
  type: WorkflowEventType;
  /** Timestamp */
  timestamp: string;
  /** Event data */
  data?: Metadata;
}

/**
 * Workflow summary for list views
 */
export interface WorkflowSummary {
  /** Workflow ID */
  id: WorkflowId;
  /** Workflow type */
  type: string;
  /** Current status */
  status: WorkflowStatus;
  /** When started */
  startedAt: string;
  /** When completed (if applicable) */
  completedAt: string | null;
  /** Number of pending tasks */
  pendingTaskCount: number;
}

/**
 * Workflow filter options for listing
 */
export interface WorkflowFilter {
  /** Filter by type */
  type?: string;
  /** Filter by status */
  status?: WorkflowStatus | WorkflowStatus[];
  /** Filter by start date (from) */
  startedAfter?: string;
  /** Filter by start date (to) */
  startedBefore?: string;
  /** Filter by user who started */
  startedBy?: UserId;
}
