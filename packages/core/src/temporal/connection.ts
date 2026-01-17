/**
 * Temporal Connection Manager
 *
 * Provides connection pooling and lifecycle management for Temporal clients.
 * Handles TLS configuration and connection health monitoring.
 */

import { Connection, type ConnectionOptions } from '@temporalio/client';
import * as fs from 'node:fs/promises';
import type { OrkestraConfig } from '../config/index.js';

/**
 * Options for creating a Temporal connection
 */
export interface TemporalConnectionOptions {
  /** Orkestra configuration */
  config: OrkestraConfig;
  /** Optional connection identity */
  identity?: string;
}

/**
 * Result of a health check
 */
export interface HealthCheckResult {
  /** Whether the connection is healthy */
  healthy: boolean;
  /** Optional error message if unhealthy */
  error?: string;
  /** Response time in milliseconds */
  responseTimeMs?: number;
}

/**
 * Creates connection options from Orkestra config
 */
async function buildConnectionOptions(
  config: OrkestraConfig,
  identity?: string
): Promise<ConnectionOptions> {
  const { temporal } = config;

  const options: ConnectionOptions = {
    address: temporal.address,
  };

  // Handle TLS configuration
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

  // Identity is typically set at the worker/client level, not at the connection level
  // The identity parameter is stored for potential use but not added to connection options
  void identity;

  return options;
}

/**
 * Temporal Connection Manager
 *
 * Manages Temporal connection lifecycle with support for:
 * - Lazy connection creation
 * - Connection pooling (single shared connection)
 * - Graceful shutdown
 * - Health monitoring
 *
 * @example
 * ```typescript
 * const manager = new TemporalConnectionManager(config);
 *
 * // Get or create connection
 * const connection = await manager.getConnection();
 *
 * // Check health
 * const health = await manager.checkHealth();
 *
 * // Graceful shutdown
 * await manager.close();
 * ```
 */
export class TemporalConnectionManager {
  private readonly config: OrkestraConfig;
  private readonly identity?: string;
  private connection: Connection | null = null;
  private connectionPromise: Promise<Connection> | null = null;
  private closed = false;

  constructor(options: TemporalConnectionOptions) {
    this.config = options.config;
    if (options.identity !== undefined) {
      this.identity = options.identity;
    }
  }

  /**
   * Get or create a Temporal connection
   *
   * Uses lazy initialization and returns the same connection instance
   * for all callers. Thread-safe through promise caching.
   *
   * @returns The Temporal connection
   * @throws Error if the connection is closed or cannot be established
   */
  async getConnection(): Promise<Connection> {
    if (this.closed) {
      throw new Error('Connection manager is closed');
    }

    if (this.connection) {
      return this.connection;
    }

    // Use promise caching to ensure only one connection is created
    if (!this.connectionPromise) {
      this.connectionPromise = this.createConnection();
    }

    return this.connectionPromise;
  }

  /**
   * Creates a new Temporal connection
   */
  private async createConnection(): Promise<Connection> {
    try {
      const options = await buildConnectionOptions(this.config, this.identity);

      this.connection = await Connection.connect(options);
      return this.connection;
    } catch (error) {
      this.connectionPromise = null;
      throw error;
    }
  }

  /**
   * Check the health of the Temporal connection
   *
   * Attempts to get the connection and perform a basic check.
   *
   * @returns Health check result
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      if (this.closed) {
        return {
          healthy: false,
          error: 'Connection manager is closed',
        };
      }

      const connection = await this.getConnection();

      // Check if connection exists and is usable
      // The connection health check verifies the gRPC channel is alive
      await connection.healthService.check({});

      return {
        healthy: true,
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if the connection manager is closed
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Close the Temporal connection
   *
   * Gracefully closes the connection and releases resources.
   * Safe to call multiple times.
   */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;

    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }

    this.connectionPromise = null;
  }
}

/**
 * Create a standalone Temporal connection
 *
 * Useful for one-off connections or when you need direct control.
 *
 * @param options - Connection options
 * @returns A new Temporal connection
 */
export async function createTemporalConnection(
  options: TemporalConnectionOptions
): Promise<Connection> {
  const connectionOptions = await buildConnectionOptions(
    options.config,
    options.identity
  );
  return Connection.connect(connectionOptions);
}
