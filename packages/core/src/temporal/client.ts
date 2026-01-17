/**
 * Temporal Client Factory
 *
 * Creates configured Temporal clients for workflow management.
 */

import { Client, type ClientOptions } from '@temporalio/client';
import type { OrkestraConfig } from '../config/index.js';
import {
  TemporalConnectionManager,
  createTemporalConnection,
  type TemporalConnectionOptions,
} from './connection.js';

/**
 * Options for creating a Temporal client
 */
export interface CreateTemporalClientOptions {
  /** Orkestra configuration */
  config: OrkestraConfig;
  /** Optional namespace override */
  namespace?: string;
  /** Optional connection manager to reuse */
  connectionManager?: TemporalConnectionManager;
  /** Optional client interceptors */
  interceptors?: ClientOptions['interceptors'];
}

/**
 * Create a Temporal client
 *
 * Creates a new Temporal client with the provided configuration.
 * Supports namespace override and client interceptors.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const client = await createTemporalClient({ config });
 *
 * // With namespace override
 * const client = await createTemporalClient({
 *   config,
 *   namespace: 'my-namespace',
 * });
 *
 * // With connection manager
 * const connectionManager = new TemporalConnectionManager(config);
 * const client = await createTemporalClient({
 *   config,
 *   connectionManager,
 * });
 * ```
 *
 * @param options - Client creation options
 * @returns A configured Temporal client
 */
export async function createTemporalClient(
  options: CreateTemporalClientOptions
): Promise<Client> {
  const { config, namespace, connectionManager, interceptors } = options;

  // Get or create connection
  const connection = connectionManager
    ? await connectionManager.getConnection()
    : await createTemporalConnection({ config });

  const clientOptions: ClientOptions = {
    connection,
    namespace: namespace ?? config.temporal.namespace,
  };

  if (interceptors) {
    clientOptions.interceptors = interceptors;
  }

  return new Client(clientOptions);
}

/**
 * Temporal health check result
 */
export interface TemporalHealthCheckResult {
  /** Whether Temporal is healthy */
  healthy: boolean;
  /** Connection status */
  connection: {
    healthy: boolean;
    error?: string;
    responseTimeMs?: number;
  };
  /** Namespace status */
  namespace?: {
    name: string;
    exists: boolean;
    error?: string;
  };
}

/**
 * Check the health of a Temporal connection and namespace
 *
 * Verifies that the Temporal server is reachable and the configured
 * namespace exists.
 *
 * @example
 * ```typescript
 * const client = await createTemporalClient({ config });
 * const health = await checkTemporalHealth(client, config.temporal.namespace);
 *
 * if (!health.healthy) {
 *   console.error('Temporal is unhealthy:', health);
 * }
 * ```
 *
 * @param client - Temporal client to check
 * @param namespace - Optional namespace to verify (uses client's namespace if not provided)
 * @returns Health check result
 */
export async function checkTemporalHealth(
  client: Client,
  namespace?: string
): Promise<TemporalHealthCheckResult> {
  const startTime = Date.now();

  const result: TemporalHealthCheckResult = {
    healthy: false,
    connection: {
      healthy: false,
    },
  };

  try {
    // Check connection health via the workflow service
    // List a single workflow to verify connectivity
    const handle = client.workflow.list({ pageSize: 1 });
    await handle[Symbol.asyncIterator]().next();

    result.connection.healthy = true;
    result.connection.responseTimeMs = Date.now() - startTime;

    // If namespace provided, try to verify it exists
    if (namespace) {
      result.namespace = {
        name: namespace,
        exists: true, // If we got here, the namespace must exist
      };
    }

    result.healthy = true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes('namespace') &&
      errorMessage.toLowerCase().includes('not found')
    ) {
      // Namespace doesn't exist
      result.connection.healthy = true;
      result.connection.responseTimeMs = Date.now() - startTime;
      result.namespace = {
        name: namespace ?? 'unknown',
        exists: false,
        error: errorMessage,
      };
    } else {
      // Connection error
      result.connection.error = errorMessage;
      result.connection.responseTimeMs = Date.now() - startTime;
    }
  }

  return result;
}

/**
 * Options for Temporal client with managed lifecycle
 */
export interface ManagedTemporalClientOptions extends CreateTemporalClientOptions {
  /** Identity for this client */
  identity?: string;
}

/**
 * Managed Temporal client with automatic lifecycle management
 *
 * Wraps a Temporal client with connection management and cleanup.
 *
 * @example
 * ```typescript
 * const managedClient = new ManagedTemporalClient({ config });
 *
 * try {
 *   const client = await managedClient.getClient();
 *   // Use client...
 * } finally {
 *   await managedClient.close();
 * }
 * ```
 */
export class ManagedTemporalClient {
  private readonly config: OrkestraConfig;
  private readonly namespace?: string;
  private readonly interceptors?: ClientOptions['interceptors'];
  private readonly identity?: string;

  private connectionManager: TemporalConnectionManager | null = null;
  private client: Client | null = null;
  private closed = false;

  constructor(options: ManagedTemporalClientOptions) {
    this.config = options.config;
    if (options.namespace !== undefined) {
      this.namespace = options.namespace;
    }
    if (options.interceptors !== undefined) {
      this.interceptors = options.interceptors;
    }
    if (options.identity !== undefined) {
      this.identity = options.identity;
    }
  }

  /**
   * Get or create the managed client
   */
  async getClient(): Promise<Client> {
    if (this.closed) {
      throw new Error('Managed client is closed');
    }

    if (this.client) {
      return this.client;
    }

    // Create connection manager if not exists
    if (!this.connectionManager) {
      const connectionOptions: TemporalConnectionOptions = {
        config: this.config,
      };
      if (this.identity !== undefined) {
        connectionOptions.identity = this.identity;
      }
      this.connectionManager = new TemporalConnectionManager(connectionOptions);
    }

    // Create client
    const clientOptions: CreateTemporalClientOptions = {
      config: this.config,
      connectionManager: this.connectionManager,
    };
    if (this.namespace !== undefined) {
      clientOptions.namespace = this.namespace;
    }
    if (this.interceptors !== undefined) {
      clientOptions.interceptors = this.interceptors;
    }
    this.client = await createTemporalClient(clientOptions);

    return this.client;
  }

  /**
   * Check the health of this client
   */
  async checkHealth(): Promise<TemporalHealthCheckResult> {
    if (this.closed) {
      return {
        healthy: false,
        connection: {
          healthy: false,
          error: 'Managed client is closed',
        },
      };
    }

    try {
      const client = await this.getClient();
      return checkTemporalHealth(
        client,
        this.namespace ?? this.config.temporal.namespace
      );
    } catch (error) {
      return {
        healthy: false,
        connection: {
          healthy: false,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Check if the managed client is closed
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Close the managed client and connection
   */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.client = null;

    if (this.connectionManager) {
      await this.connectionManager.close();
      this.connectionManager = null;
    }
  }
}
