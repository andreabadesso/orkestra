/**
 * Temporal Worker Factory
 *
 * Creates and configures Temporal workers for executing workflows and activities.
 */

import {
  Worker,
  type WorkerOptions,
  NativeConnection,
  Runtime,
  DefaultLogger,
  type LogLevel,
} from '@temporalio/worker';
import * as fs from 'node:fs/promises';
import type { OrkestraConfig } from '../config/index.js';

/**
 * Activity definition type
 */
export type ActivityDefinition = (...args: unknown[]) => Promise<unknown>;

/**
 * Map of activity names to their implementations
 */
export type ActivityMap = Record<string, ActivityDefinition>;

/**
 * Options for creating a Temporal worker
 */
export interface CreateWorkerOptions {
  /** Orkestra configuration */
  config: OrkestraConfig;
  /** Task queue to listen on */
  taskQueue: string;
  /**
   * Path to compiled workflow code bundle
   * This should point to a webpack bundle or similar
   */
  workflowsPath?: string;
  /** Activity implementations */
  activities?: ActivityMap;
  /** Worker interceptors */
  interceptors?: WorkerOptions['interceptors'];
  /** Optional worker identity */
  identity?: string;
  /** Maximum concurrent activity executions */
  maxConcurrentActivityTaskExecutions?: number;
  /** Maximum concurrent workflow task executions */
  maxConcurrentWorkflowTaskExecutions?: number;
  /** Enable debug mode for workflows */
  debugMode?: boolean;
}

/**
 * Maps Orkestra log level to Temporal log level
 */
function mapLogLevel(level: string): LogLevel {
  const mapping: Record<string, LogLevel> = {
    trace: 'TRACE',
    debug: 'DEBUG',
    info: 'INFO',
    warn: 'WARN',
    error: 'ERROR',
    fatal: 'ERROR',
  };
  return mapping[level] ?? 'INFO';
}

/**
 * Build native connection options for worker
 */
async function buildNativeConnectionOptions(config: OrkestraConfig): Promise<{
  address: string;
  tls?: {
    clientCertPair: {
      crt: Buffer;
      key: Buffer;
    };
  };
}> {
  const { temporal } = config;

  const options: {
    address: string;
    tls?: {
      clientCertPair: {
        crt: Buffer;
        key: Buffer;
      };
    };
  } = {
    address: temporal.address,
  };

  if (temporal.tls) {
    if (!temporal.tlsCertPath || !temporal.tlsKeyPath) {
      throw new Error(
        'TLS is enabled but tlsCertPath and tlsKeyPath are not provided'
      );
    }

    const [cert, key] = await Promise.all([
      fs.readFile(temporal.tlsCertPath),
      fs.readFile(temporal.tlsKeyPath),
    ]);

    options.tls = {
      clientCertPair: {
        crt: cert,
        key: key,
      },
    };
  }

  return options;
}

/**
 * Create a Temporal worker
 *
 * Workers execute workflows and activities on behalf of Temporal.
 * At least one of workflowsPath or activities must be provided.
 *
 * @example
 * ```typescript
 * // Worker with workflows and activities
 * const worker = await createWorker({
 *   config,
 *   taskQueue: 'my-queue',
 *   workflowsPath: require.resolve('./workflows'),
 *   activities: {
 *     sendEmail: async (to, subject, body) => { ... },
 *     processPayment: async (amount, currency) => { ... },
 *   },
 * });
 *
 * // Start the worker
 * await worker.run();
 * ```
 *
 * @param options - Worker creation options
 * @returns A configured Temporal worker
 */
export async function createWorker(
  options: CreateWorkerOptions
): Promise<Worker> {
  const {
    config,
    taskQueue,
    workflowsPath,
    activities,
    interceptors,
    identity,
    maxConcurrentActivityTaskExecutions,
    maxConcurrentWorkflowTaskExecutions,
    debugMode,
  } = options;

  // Validate that at least one of workflows or activities is provided
  if (!workflowsPath && !activities) {
    throw new Error(
      'At least one of workflowsPath or activities must be provided'
    );
  }

  // Configure runtime logger
  Runtime.install({
    logger: new DefaultLogger(mapLogLevel(config.logging.level)),
  });

  // Create native connection for worker
  const connectionOptions = await buildNativeConnectionOptions(config);
  const connection = await NativeConnection.connect(connectionOptions);

  // Build worker options
  const workerOptions: WorkerOptions = {
    connection,
    namespace: config.temporal.namespace,
    taskQueue,
  };

  // Add workflows if path provided
  if (workflowsPath) {
    workerOptions.workflowsPath = workflowsPath;
  }

  // Add activities if provided
  if (activities) {
    workerOptions.activities = activities;
  }

  // Add interceptors if provided
  if (interceptors) {
    workerOptions.interceptors = interceptors;
  }

  // Set identity
  workerOptions.identity =
    identity ?? config.temporal.workerIdentity ?? `orkestra-worker-${process.pid}`;

  // Set concurrency limits
  if (maxConcurrentActivityTaskExecutions !== undefined) {
    workerOptions.maxConcurrentActivityTaskExecutions =
      maxConcurrentActivityTaskExecutions;
  }

  if (maxConcurrentWorkflowTaskExecutions !== undefined) {
    workerOptions.maxConcurrentWorkflowTaskExecutions =
      maxConcurrentWorkflowTaskExecutions;
  }

  // Enable debug mode if requested
  if (debugMode) {
    workerOptions.debugMode = true;
  }

  return Worker.create(workerOptions);
}

/**
 * Result of worker health check
 */
export interface WorkerHealthCheckResult {
  /** Whether the worker is healthy */
  healthy: boolean;
  /** Worker state */
  state: 'running' | 'drained' | 'failed' | 'unknown';
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Worker runner with lifecycle management
 *
 * Provides a managed way to run workers with graceful shutdown.
 *
 * @example
 * ```typescript
 * const runner = new WorkerRunner({
 *   config,
 *   taskQueue: 'my-queue',
 *   activities: { ... },
 * });
 *
 * // Start worker (blocks until shutdown)
 * await runner.run();
 *
 * // Or run with graceful shutdown
 * process.on('SIGINT', () => runner.shutdown());
 * await runner.run();
 * ```
 */
export class WorkerRunner {
  private readonly options: CreateWorkerOptions;
  private worker: Worker | null = null;
  private running = false;
  private shutdownRequested = false;

  constructor(options: CreateWorkerOptions) {
    this.options = options;
  }

  /**
   * Start and run the worker
   *
   * This method blocks until the worker is shut down.
   */
  async run(): Promise<void> {
    if (this.running) {
      throw new Error('Worker is already running');
    }

    this.running = true;
    this.shutdownRequested = false;

    try {
      this.worker = await createWorker(this.options);
      await this.worker.run();
    } finally {
      this.running = false;
      this.worker = null;
    }
  }

  /**
   * Request graceful shutdown
   */
  shutdown(): void {
    if (!this.running || this.shutdownRequested) {
      return;
    }

    this.shutdownRequested = true;
    this.worker?.shutdown();
  }

  /**
   * Check if the worker is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Check if shutdown has been requested
   */
  isShutdownRequested(): boolean {
    return this.shutdownRequested;
  }

  /**
   * Get health check result
   */
  getHealthCheck(): WorkerHealthCheckResult {
    if (!this.running) {
      return {
        healthy: false,
        state: 'unknown',
        error: 'Worker is not running',
      };
    }

    if (this.shutdownRequested) {
      return {
        healthy: false,
        state: 'drained',
      };
    }

    return {
      healthy: true,
      state: 'running',
    };
  }
}
