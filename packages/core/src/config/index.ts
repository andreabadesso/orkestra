/**
 * Configuration module for Orkestra
 *
 * Provides Zod schemas for configuration validation and
 * utilities for loading configuration from environment variables.
 */

// Schema exports
export {
  databaseConfigSchema,
  temporalConfigSchema,
  serverConfigSchema,
  authConfigSchema,
  langfuseConfigSchema,
  loggingConfigSchema,
  orkestraConfigSchema,
} from './schema.js';

export type {
  DatabaseConfig,
  TemporalConfig,
  ServerConfig,
  AuthConfig,
  LangfuseConfig,
  LoggingConfig,
  OrkestraConfig,
} from './schema.js';

// Loader exports
export {
  loadConfig,
  validateConfig,
  requireEnv,
  ConfigurationError,
} from './loader.js';
