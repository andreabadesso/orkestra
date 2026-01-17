/**
 * Configuration loader for Orkestra
 *
 * Loads configuration from environment variables with sensible defaults.
 */

import { z } from 'zod';
import {
  orkestraConfigSchema,
  type OrkestraConfig,
} from './schema.js';

/**
 * Error thrown when configuration loading fails
 */
export class ConfigurationError extends Error {
  readonly errors: z.ZodIssue[] | null;

  constructor(
    message: string,
    errors: z.ZodIssue[] | null = null
  ) {
    super(message);
    this.name = 'ConfigurationError';
    this.errors = errors;
  }
}

/**
 * Environment variable prefix
 */
const ENV_PREFIX = 'ORKESTRA_';

/**
 * Get an environment variable value
 * @param key - Environment variable key (without prefix)
 * @param defaultValue - Default value if not set
 */
function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[`${ENV_PREFIX}${key}`] ?? process.env[key] ?? defaultValue;
}

/**
 * Get an environment variable as a number
 * @param key - Environment variable key (without prefix)
 * @param defaultValue - Default value if not set
 */
function getEnvNumber(key: string, defaultValue?: number): number | undefined {
  const value = getEnv(key);
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get an environment variable as a boolean
 * @param key - Environment variable key (without prefix)
 * @param defaultValue - Default value if not set
 */
function getEnvBoolean(key: string, defaultValue?: boolean): boolean | undefined {
  const value = getEnv(key);
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Get an environment variable as an array
 * @param key - Environment variable key (without prefix)
 * @param defaultValue - Default value if not set
 */
function getEnvArray(key: string, defaultValue?: string[]): string[] | undefined {
  const value = getEnv(key);
  if (value === undefined) return defaultValue;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Build raw config object from environment variables
 * Returns a plain object that will be processed by removeUndefined
 */
function buildRawConfig(): Record<string, unknown> {
  const corsEnabled = getEnvBoolean('CORS_ENABLED');
  const corsOrigins = getEnvArray('CORS_ORIGINS');
  const corsMethods = getEnvArray('CORS_METHODS');
  const corsHeaders = getEnvArray('CORS_HEADERS');

  // Only include cors if at least one value is set
  const cors: Record<string, unknown> = {};
  if (corsEnabled !== undefined) cors['enabled'] = corsEnabled;
  if (corsOrigins !== undefined) cors['origins'] = corsOrigins;
  if (corsMethods !== undefined) cors['methods'] = corsMethods;
  if (corsHeaders !== undefined) cors['headers'] = corsHeaders;

  return {
    env: getEnv('ENV') ?? getEnv('NODE_ENV'),
    database: {
      url: getEnv('DATABASE_URL'),
      maxConnections: getEnvNumber('DATABASE_MAX_CONNECTIONS'),
      connectionTimeoutMs: getEnvNumber('DATABASE_CONNECTION_TIMEOUT_MS'),
      idleTimeoutMs: getEnvNumber('DATABASE_IDLE_TIMEOUT_MS'),
    },
    temporal: {
      address: getEnv('TEMPORAL_ADDRESS'),
      namespace: getEnv('TEMPORAL_NAMESPACE'),
      taskQueue: getEnv('TEMPORAL_TASK_QUEUE'),
      workerIdentity: getEnv('TEMPORAL_WORKER_IDENTITY'),
      tls: getEnvBoolean('TEMPORAL_TLS'),
      tlsCertPath: getEnv('TEMPORAL_TLS_CERT_PATH'),
      tlsKeyPath: getEnv('TEMPORAL_TLS_KEY_PATH'),
      connectionTimeoutMs: getEnvNumber('TEMPORAL_CONNECTION_TIMEOUT_MS'),
    },
    server: {
      port: getEnvNumber('SERVER_PORT') ?? getEnvNumber('PORT'),
      host: getEnv('SERVER_HOST') ?? getEnv('HOST'),
      baseUrl: getEnv('SERVER_BASE_URL') ?? getEnv('BASE_URL'),
      cors: Object.keys(cors).length > 0 ? cors : undefined,
      bodySizeLimit: getEnv('SERVER_BODY_SIZE_LIMIT'),
      requestTimeoutMs: getEnvNumber('SERVER_REQUEST_TIMEOUT_MS'),
    },
    auth: {
      jwtSecret: getEnv('AUTH_JWT_SECRET') ?? getEnv('JWT_SECRET'),
      jwtExpiresIn: getEnv('AUTH_JWT_EXPIRES_IN'),
      apiKeyHeader: getEnv('AUTH_API_KEY_HEADER'),
      tenantIdHeader: getEnv('AUTH_TENANT_ID_HEADER'),
      enableApiKey: getEnvBoolean('AUTH_ENABLE_API_KEY'),
      enableJwt: getEnvBoolean('AUTH_ENABLE_JWT'),
      bcryptRounds: getEnvNumber('AUTH_BCRYPT_ROUNDS'),
    },
    langfuse: buildLangfuseConfig(),
    logging: {
      level: getEnv('LOG_LEVEL'),
      format: getEnv('LOG_FORMAT'),
      timestamp: getEnvBoolean('LOG_TIMESTAMP'),
      caller: getEnvBoolean('LOG_CALLER'),
    },
  };
}

/**
 * Build Langfuse configuration
 */
function buildLangfuseConfig(): Record<string, unknown> | undefined {
  const enabled = getEnvBoolean('LANGFUSE_ENABLED');
  if (enabled === undefined && !getEnv('LANGFUSE_PUBLIC_KEY')) {
    return undefined;
  }
  return {
    enabled,
    publicKey: getEnv('LANGFUSE_PUBLIC_KEY'),
    secretKey: getEnv('LANGFUSE_SECRET_KEY'),
    host: getEnv('LANGFUSE_HOST'),
    flushIntervalMs: getEnvNumber('LANGFUSE_FLUSH_INTERVAL_MS'),
  };
}

/**
 * Remove undefined values from an object recursively
 */
function removeUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const cleaned = removeUndefined(value as Record<string, unknown>);
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Load configuration from environment variables
 *
 * @param overrides - Optional configuration overrides
 * @returns Validated Orkestra configuration
 * @throws ConfigurationError if validation fails
 *
 * @example
 * ```typescript
 * // Load from environment
 * const config = loadConfig();
 *
 * // Load with overrides
 * const config = loadConfig({
 *   server: { port: 4000 }
 * });
 * ```
 */
export function loadConfig(overrides?: Partial<OrkestraConfig>): OrkestraConfig {
  const rawConfig = buildRawConfig();
  const envConfig = removeUndefined(rawConfig);

  // Deep merge environment config with overrides
  const merged = deepMerge(envConfig, overrides ?? {});

  try {
    return orkestraConfigSchema.parse(merged);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
      throw new ConfigurationError(
        `Configuration validation failed:\n${messages.join('\n')}`,
        error.issues
      );
    }
    throw error;
  }
}

/**
 * Validate a partial configuration
 *
 * @param config - Partial configuration to validate
 * @returns Validation result
 */
export function validateConfig(config: unknown): {
  success: boolean;
  data?: OrkestraConfig;
  errors?: z.ZodIssue[];
} {
  const result = orkestraConfigSchema.safeParse(config);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

/**
 * Deep merge two objects
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };

  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = result[key];

    if (
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Get required environment variable
 *
 * @param key - Environment variable key
 * @throws ConfigurationError if variable is not set
 */
export function requireEnv(key: string): string {
  const value = getEnv(key);
  if (value === undefined) {
    throw new ConfigurationError(`Required environment variable ${ENV_PREFIX}${key} (or ${key}) is not set`);
  }
  return value;
}
