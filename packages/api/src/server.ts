/**
 * Server Setup
 *
 * HTTP server setup for the Orkestra API with tRPC integration.
 */

import { createServer as createHttpServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHTTPHandler } from '@trpc/server/adapters/standalone';
import cors from 'cors';
import { appRouter } from './trpc/routers/index.js';
import { createContext } from './trpc/context.js';
import { createErrorHandler, type ErrorHandlerOptions } from './middleware/error-handler.js';
import type { Repositories } from '@orkestra/core';

/**
 * Server options
 */
export interface ServerOptions {
  /** Port to listen on */
  port?: number;
  /** Host to bind to */
  host?: string;
  /** JWT secret for authentication */
  jwtSecret?: string;
  /** API key validator function */
  validateApiKey?: (key: string) => Promise<{ keyId: string; tenantId: string; permissions: string[] } | null>;
  /** Database repositories */
  repositories?: Repositories;
  /** CORS options */
  cors?: cors.CorsOptions;
  /** Public paths (no auth required) */
  publicPaths?: string[];
  /** Error handler options */
  errorHandler?: ErrorHandlerOptions;
  /** Whether to include health check endpoint */
  healthCheck?: boolean;
  /** Custom health check handler */
  healthCheckHandler?: (req: IncomingMessage, res: ServerResponse) => void;
}

/**
 * Default server options
 */
const defaultOptions: Partial<ServerOptions> = {
  port: 3000,
  host: '0.0.0.0',
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  },
  publicPaths: ['/health', '/ready'],
  healthCheck: true,
};

/**
 * Create the tRPC handler
 */
function createTRPCHandler(options: ServerOptions) {
  return createHTTPHandler({
    router: appRouter,
    createContext: async ({ req }) => {
      return createContext({
        req,
        repositories: options.repositories,
        jwtSecret: options.jwtSecret,
        validateApiKey: options.validateApiKey,
      });
    },
    onError: ({ error, path }) => {
      console.error(`[tRPC Error] ${path}:`, error);
    },
  });
}

/**
 * Default health check handler
 */
function defaultHealthCheckHandler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env['npm_package_version'] ?? '0.0.1',
  }));
}

/**
 * Create HTTP server with tRPC
 */
export function createServer(options: ServerOptions = {}): HttpServer {
  const opts = { ...defaultOptions, ...options };

  // Create handlers
  const corsHandler = cors(opts.cors);
  const trpcHandler = createTRPCHandler(opts);
  const errorHandler = createErrorHandler(opts.errorHandler);
  const healthHandler = opts.healthCheckHandler ?? defaultHealthCheckHandler;

  // Create server
  const server = createHttpServer((req, res) => {
    const url = req.url ?? '/';
    const pathname = url.split('?')[0];

    // Handle CORS preflight
    corsHandler(req, res, (err) => {
      if (err) {
        errorHandler(err as Error, req, res);
        return;
      }

      // Health check endpoints
      if (opts.healthCheck && (pathname === '/health' || pathname === '/ready')) {
        healthHandler(req, res);
        return;
      }

      // tRPC handler
      trpcHandler(req, res);
    });
  });

  return server;
}

/**
 * Start the server
 */
export async function startServer(options: ServerOptions = {}): Promise<HttpServer> {
  const opts = { ...defaultOptions, ...options };
  const server = createServer(opts);

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(opts.port, opts.host, () => {
      console.log(`[Orkestra API] Server listening on ${opts.host}:${opts.port}`);
      resolve(server);
    });
  });
}

/**
 * Stop the server gracefully
 */
export async function stopServer(server: HttpServer, timeout: number = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Server shutdown timed out'));
    }, timeout);

    server.close((err) => {
      clearTimeout(timeoutId);
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Caller factory return type
 */
export type CallerFactory = (mockReq?: Partial<IncomingMessage>) => Promise<ReturnType<typeof appRouter.createCaller>>;

/**
 * Create a standalone tRPC caller for testing
 */
export function createCaller(options: {
  repositories?: Repositories;
  jwtSecret?: string;
  validateApiKey?: (key: string) => Promise<{ keyId: string; tenantId: string; permissions: string[] } | null>;
}): CallerFactory {
  return async (mockReq: Partial<IncomingMessage> = {}) => {
    const ctx = await createContext({
      req: mockReq as IncomingMessage,
      repositories: options.repositories,
      jwtSecret: options.jwtSecret,
      validateApiKey: options.validateApiKey,
    });
    return appRouter.createCaller(ctx);
  };
}
