/**
 * Prisma client singleton
 *
 * Provides a singleton instance of the Prisma client to avoid
 * creating multiple connections to the database.
 */

import { PrismaClient } from '@prisma/client';

// Global reference for the Prisma client to enable hot reloading in development
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Prisma client configuration options
 */
export interface PrismaClientOptions {
  /** Enable query logging */
  logQueries?: boolean;
  /** Enable info logging */
  logInfo?: boolean;
  /** Enable warning logging */
  logWarnings?: boolean;
  /** Enable error logging */
  logErrors?: boolean;
}

/**
 * Create a new Prisma client instance with configured logging
 */
function createPrismaClient(options: PrismaClientOptions = {}): PrismaClient {
  const {
    logQueries = false,
    logInfo = false,
    logWarnings = true,
    logErrors = true,
  } = options;

  type LogLevel = 'query' | 'info' | 'warn' | 'error';
  const log: LogLevel[] = [];

  if (logQueries) {
    log.push('query');
  }
  if (logInfo) {
    log.push('info');
  }
  if (logWarnings) {
    log.push('warn');
  }
  if (logErrors) {
    log.push('error');
  }

  if (log.length > 0) {
    return new PrismaClient({ log });
  }
  return new PrismaClient();
}

/**
 * Get the singleton Prisma client instance
 *
 * In development, the client is stored in a global variable to survive
 * hot module reloading. In production, a module-level variable is used.
 *
 * @param options - Optional configuration for the Prisma client
 * @returns The Prisma client instance
 *
 * @example
 * ```typescript
 * import { getPrismaClient } from '@orkestra/core';
 *
 * const prisma = getPrismaClient();
 * const users = await prisma.user.findMany();
 * ```
 */
export function getPrismaClient(options?: PrismaClientOptions): PrismaClient {
  if (process.env['NODE_ENV'] === 'production') {
    // In production, always create a new client if none exists
    if (!globalThis.__prisma) {
      globalThis.__prisma = createPrismaClient(options);
    }
    return globalThis.__prisma;
  }

  // In development, use global to survive hot reloading
  if (!globalThis.__prisma) {
    globalThis.__prisma = createPrismaClient({
      logQueries: process.env['DEBUG_PRISMA'] === 'true',
      ...options,
    });
  }
  return globalThis.__prisma;
}

/**
 * Disconnect the Prisma client
 *
 * Should be called when shutting down the application to ensure
 * clean disconnection from the database.
 *
 * @example
 * ```typescript
 * import { disconnectPrisma } from '@orkestra/core';
 *
 * process.on('SIGTERM', async () => {
 *   await disconnectPrisma();
 *   process.exit(0);
 * });
 * ```
 */
export async function disconnectPrisma(): Promise<void> {
  if (globalThis.__prisma) {
    await globalThis.__prisma.$disconnect();
    globalThis.__prisma = undefined;
  }
}

/**
 * Default Prisma client instance
 *
 * Use `getPrismaClient()` for more control over initialization,
 * or use this exported instance for convenience.
 */
export const prisma = getPrismaClient();

/**
 * Re-export PrismaClient type for convenience
 */
export type { PrismaClient };
