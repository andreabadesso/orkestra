/**
 * Configuration schema definitions using Zod
 */

import { z } from 'zod';

/**
 * Database configuration schema
 */
export const databaseConfigSchema = z.object({
  /** PostgreSQL connection URL */
  url: z.string().url().describe('PostgreSQL connection URL'),
  /** Maximum number of connections in the pool */
  maxConnections: z.number().int().min(1).max(100).default(10).describe('Maximum database connections'),
  /** Connection timeout in milliseconds */
  connectionTimeoutMs: z.number().int().min(1000).default(10000).describe('Connection timeout in ms'),
  /** Idle timeout in milliseconds before closing connection */
  idleTimeoutMs: z.number().int().min(1000).default(60000).describe('Idle timeout in ms'),
});

/**
 * Temporal workflow engine configuration schema
 */
export const temporalConfigSchema = z.object({
  /** Temporal server address (host:port) */
  address: z.string().default('localhost:7233').describe('Temporal server address'),
  /** Temporal namespace */
  namespace: z.string().default('default').describe('Temporal namespace'),
  /** Default task queue for workflows */
  taskQueue: z.string().default('orkestra-main').describe('Default task queue'),
  /** Worker identity prefix */
  workerIdentity: z.string().optional().describe('Worker identity prefix'),
  /** Enable TLS connection */
  tls: z.boolean().default(false).describe('Enable TLS'),
  /** Path to TLS certificate */
  tlsCertPath: z.string().optional().describe('TLS certificate path'),
  /** Path to TLS key */
  tlsKeyPath: z.string().optional().describe('TLS key path'),
  /** Connection timeout in milliseconds */
  connectionTimeoutMs: z.number().int().min(1000).default(10000).describe('Connection timeout in ms'),
});

/**
 * Server configuration schema
 */
export const serverConfigSchema = z.object({
  /** Server port */
  port: z.number().int().min(1).max(65535).default(3000).describe('Server port'),
  /** Server host */
  host: z.string().default('0.0.0.0').describe('Server host'),
  /** Base URL for the API */
  baseUrl: z.string().url().optional().describe('Base URL for the API'),
  /** Enable CORS */
  cors: z.object({
    /** Enable CORS */
    enabled: z.boolean().default(true),
    /** Allowed origins */
    origins: z.array(z.string()).default(['*']),
    /** Allowed methods */
    methods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']),
    /** Allowed headers */
    headers: z.array(z.string()).default(['Content-Type', 'Authorization', 'X-Tenant-ID']),
  }).default({
    enabled: true,
    origins: ['*'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  }),
  /** Request body size limit */
  bodySizeLimit: z.string().default('10mb').describe('Request body size limit'),
  /** Request timeout in milliseconds */
  requestTimeoutMs: z.number().int().min(1000).default(30000).describe('Request timeout in ms'),
});

/**
 * Authentication configuration schema
 */
export const authConfigSchema = z.object({
  /** JWT secret key */
  jwtSecret: z.string().min(32).describe('JWT secret key (min 32 chars)'),
  /** JWT token expiry */
  jwtExpiresIn: z.string().default('24h').describe('JWT token expiry'),
  /** API key header name */
  apiKeyHeader: z.string().default('X-API-Key').describe('API key header name'),
  /** Tenant ID header name */
  tenantIdHeader: z.string().default('X-Tenant-ID').describe('Tenant ID header name'),
  /** Enable API key authentication */
  enableApiKey: z.boolean().default(true).describe('Enable API key auth'),
  /** Enable JWT authentication */
  enableJwt: z.boolean().default(true).describe('Enable JWT auth'),
  /** Password hashing rounds */
  bcryptRounds: z.number().int().min(10).max(14).default(12).describe('Bcrypt rounds'),
});

/**
 * Langfuse observability configuration schema
 */
export const langfuseConfigSchema = z.object({
  /** Enable Langfuse integration */
  enabled: z.boolean().default(false).describe('Enable Langfuse'),
  /** Langfuse public key */
  publicKey: z.string().optional().describe('Langfuse public key'),
  /** Langfuse secret key */
  secretKey: z.string().optional().describe('Langfuse secret key'),
  /** Langfuse host */
  host: z.string().url().default('https://cloud.langfuse.com').describe('Langfuse host'),
  /** Flush interval in milliseconds */
  flushIntervalMs: z.number().int().min(100).default(1000).describe('Flush interval in ms'),
}).refine(
  (data) => !data.enabled || (data.publicKey && data.secretKey),
  {
    message: 'publicKey and secretKey are required when Langfuse is enabled',
    path: ['enabled'],
  }
);

/**
 * Logging configuration schema
 */
export const loggingConfigSchema = z.object({
  /** Log level */
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  /** Log format */
  format: z.enum(['json', 'pretty']).default('json'),
  /** Include timestamp */
  timestamp: z.boolean().default(true),
  /** Include caller info */
  caller: z.boolean().default(false),
});

/**
 * Complete Orkestra configuration schema
 */
export const orkestraConfigSchema = z.object({
  /** Environment name */
  env: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  /** Database configuration */
  database: databaseConfigSchema,
  /** Temporal configuration */
  temporal: temporalConfigSchema.default({
    address: 'localhost:7233',
    namespace: 'default',
    taskQueue: 'orkestra-main',
    tls: false,
    connectionTimeoutMs: 10000,
  }),
  /** Server configuration */
  server: serverConfigSchema.default({
    port: 3000,
    host: '0.0.0.0',
    cors: {
      enabled: true,
      origins: ['*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
    },
    bodySizeLimit: '10mb',
    requestTimeoutMs: 30000,
  }),
  /** Authentication configuration */
  auth: authConfigSchema,
  /** Langfuse configuration */
  langfuse: langfuseConfigSchema.optional(),
  /** Logging configuration */
  logging: loggingConfigSchema.default({
    level: 'info',
    format: 'json',
    timestamp: true,
    caller: false,
  }),
});

// Export inferred types
export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;
export type TemporalConfig = z.infer<typeof temporalConfigSchema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type AuthConfig = z.infer<typeof authConfigSchema>;
export type LangfuseConfig = z.infer<typeof langfuseConfigSchema>;
export type LoggingConfig = z.infer<typeof loggingConfigSchema>;
export type OrkestraConfig = z.infer<typeof orkestraConfigSchema>;
